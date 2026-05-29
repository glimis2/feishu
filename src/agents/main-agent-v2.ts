/**
 * MainAgent - 使用 deepagentsjs 实现
 *
 * 主调度Agent，协调 CollectorAgent 和 ReminderAgent
 */

import { createDeepAgent } from 'deepagentsjs-monorepo/libs/deepagents/src/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as path from 'path';
import { FeishuDocClient } from '../tools/feishu-doc';
import { logger } from '../utils/logger';
import { writeJsonFile } from '../utils/file';
import { createCollectorAgent, collectStudentData } from './collector-agent-v2';
import { createReminderAgent, sendReminders } from './reminder-agent-v2';
import type { Student, TaskData, DailyReport, StudentResult, ReminderResult } from '../types';

const MAIN_AGENT_SYSTEM_PROMPT = `你是主调度Agent，负责协调整个学员监督流程。

## 你的职责

1. 从飞书配置文档加载学员列表
2. 调用 CollectorAgent 收集所有学员的学习数据
3. 根据收集结果，筛选出未提交的学员
4. 调用 ReminderAgent 向未提交学员发送提醒
5. 生成并保存每日报告

## 工作流程

1. 使用 load_student_config 工具加载学员配置
2. 使用 collect_student_data 工具收集学员数据
3. 使用 send_reminders 工具发送提醒（仅针对未提交学员）
4. 使用 save_daily_report 工具保存报告

## 注意事项

- 按顺序执行任务
- 记录每个步骤的执行时间
- 优雅处理所有错误
- 生成详细的执行报告`;

/**
 * 创建 MainAgent 及其工具
 */
export function createMainAgent(
  llm: ChatOpenAI,
  docClient: FeishuDocClient,
  configDocUrl: string
) {
  // 创建子 Agent
  const collectorAgent = createCollectorAgent(llm);
  const reminderAgent = createReminderAgent(llm);

  // 工具：加载学员配置
  const loadStudentConfigTool = new DynamicStructuredTool({
    name: 'load_student_config',
    description: '从飞书配置文档加载学员列表',
    schema: z.object({}),
    func: async () => {
      try {
        logger.info('MainAgent: Loading student config');
        const documentId = docClient.extractDocumentId(configDocUrl);
        const docContent = await docClient.getDocContent(documentId);
        const students = parseStudentConfig(docContent.content);

        return JSON.stringify({
          success: true,
          students,
          count: students.length
        });
      } catch (error) {
        logger.error(`Load config error: ${error}`);
        return JSON.stringify({
          success: false,
          error: (error as Error).message
        });
      }
    }
  });

  // 工具：收集学员数据
  const collectStudentDataTool = new DynamicStructuredTool({
    name: 'collect_student_data',
    description: '调用 CollectorAgent 收集所有学员的学习数据',
    schema: z.object({
      students: z.array(z.any()).describe('学员列表')
    }),
    func: async ({ students }) => {
      try {
        logger.info('MainAgent: Collecting student data');
        const results = await collectStudentData(collectorAgent, students as Student[]);

        return JSON.stringify({
          success: true,
          results,
          submitted: results.filter(r => r.status === 'submitted').length,
          notSubmitted: results.filter(r => r.status === 'not_submitted').length
        });
      } catch (error) {
        logger.error(`Collect data error: ${error}`);
        return JSON.stringify({
          success: false,
          error: (error as Error).message
        });
      }
    }
  });

  // 工具：发送提醒
  const sendRemindersTool = new DynamicStructuredTool({
    name: 'send_reminders',
    description: '调用 ReminderAgent 向未提交学员发送提醒',
    schema: z.object({
      students: z.array(z.any()).describe('未提交学员列表')
    }),
    func: async ({ students }) => {
      try {
        logger.info('MainAgent: Sending reminders');
        const results = await sendReminders(reminderAgent, students as Student[]);

        return JSON.stringify({
          success: true,
          results,
          sent: results.filter(r => r.success).length
        });
      } catch (error) {
        logger.error(`Send reminders error: ${error}`);
        return JSON.stringify({
          success: false,
          error: (error as Error).message
        });
      }
    }
  });

  // 工具：保存每日报告
  const saveDailyReportTool = new DynamicStructuredTool({
    name: 'save_daily_report',
    description: '保存每日执行报告',
    schema: z.object({
      collectionResults: z.array(z.any()).describe('收集结果'),
      remindersSent: z.number().describe('发送提醒数量'),
      executionTime: z.number().describe('执行时间（秒）')
    }),
    func: async ({ collectionResults, remindersSent, executionTime }) => {
      try {
        const report = generateDailyReport(
          collectionResults as StudentResult[],
          remindersSent,
          executionTime
        );

        const filePath = path.join(process.cwd(), 'data', 'history', `${report.date}.json`);
        await writeJsonFile(filePath, report);

        logger.info('MainAgent: Daily report saved');
        return JSON.stringify({
          success: true,
          report
        });
      } catch (error) {
        logger.error(`Save report error: ${error}`);
        return JSON.stringify({
          success: false,
          error: (error as Error).message
        });
      }
    }
  });

  return createDeepAgent({
    systemPrompt: MAIN_AGENT_SYSTEM_PROMPT,
    tools: [
      loadStudentConfigTool,
      collectStudentDataTool,
      sendRemindersTool,
      saveDailyReportTool
    ]
  });
}

/**
 * 执行每日任务
 */
export async function executeDailyTask(
  agent: ReturnType<typeof createMainAgent>
): Promise<void> {
  const startTime = Date.now();

  logger.info('MainAgent: Starting daily monitoring task');

  const prompt = `执行今日学员监督任务：

1. 加载学员配置
2. 收集所有学员的学习数据
3. 向未提交学员发送提醒
4. 保存每日报告

请按顺序执行所有步骤，并报告执行结果。`;

  try {
    const result = await agent.invoke({
      messages: [{ role: 'user', content: prompt }]
    });

    const executionTime = Math.round((Date.now() - startTime) / 1000);
    logger.info(`MainAgent: Daily task completed in ${executionTime}s`);

  } catch (error) {
    logger.error(`MainAgent: Daily task failed: ${error}`);
    throw error;
  }
}

/**
 * 解析学员配置
 */
function parseStudentConfig(content: string): Student[] {
  const students: Student[] = [];
  const lines = content.split('\n');

  let studentIdCounter = 1;
  for (const line of lines) {
    const match = line.match(/^-\s*(.+?):\s*(https:\/\/.+?)\s*(?:\((.+?)\))?$/);
    if (match) {
      const [, name, docUrl, feishuUserId] = match;
      students.push({
        studentId: String(studentIdCounter++).padStart(3, '0'),
        name: name.trim(),
        docUrl: docUrl.trim(),
        feishuUserId: feishuUserId?.trim()
      });
    }
  }

  return students;
}

/**
 * 生成每日报告
 */
function generateDailyReport(
  collectionResults: StudentResult[],
  remindersSent: number,
  executionTime: number
): DailyReport {
  const submitted = collectionResults.filter(r => r.status === 'submitted').length;
  const notSubmitted = collectionResults.filter(r => r.status === 'not_submitted').length;

  return {
    date: new Date().toISOString().split('T')[0],
    totalStudents: collectionResults.length,
    submitted,
    notSubmitted,
    students: collectionResults,
    remindersSent,
    executionTime: `${Math.floor(executionTime / 60)}m ${executionTime % 60}s`
  };
}
