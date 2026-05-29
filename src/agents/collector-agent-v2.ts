/**
 * CollectorAgent - 使用 deepagentsjs 实现
 *
 * 负责批量收集和分析学员学习日报
 */

import { createDeepAgent } from 'deepagentsjs-monorepo/libs/deepagents/src/index.js';
import { ChatOpenAI } from '@langchain/openai';
import {
  fetchFeishuDocTool,
  analyzeContentTool,
  validateTodayReportTool
} from '../tools/agent-tools';
import { logger } from '../utils/logger';
import type { Student, StudentResult } from '../types';

const COLLECTOR_SYSTEM_PROMPT = `你是文档收集Agent，负责批量收集和分析学员学习日报。

## 你的职责

1. 接收学员列表（包含姓名、文档URL）
2. 对每个学员：
   - 使用 fetch_feishu_doc 工具获取文档内容和最后修改时间
   - 使用 validate_today_report 工具判断是否为今日报告
   - 如果是今日报告，使用 analyze_learning_content 工具分析内容
   - 如果不是今日报告，标记为"未提交"
3. 返回所有学员的处理结果

## 工作流程

对于每个学员：
1. 调用 fetch_feishu_doc 获取文档
2. 调用 validate_today_report 验证日期
3. 如果验证通过，调用 analyze_learning_content 分析
4. 记录结果（submitted/not_submitted/error）

## 输出格式

返回JSON数组，每个元素包含：
- studentId: 学员ID
- name: 学员姓名
- status: "submitted" | "not_submitted" | "error"
- summary: { learned: [], notLearned: [], questions: [] } (仅当status为submitted时)
- error: 错误信息 (仅当status为error时)

## 注意事项

- 并发处理多个学员，但要控制并发数量
- 单个学员失败不影响其他学员
- 记录详细的处理日志
- 优雅处理所有错误`;

/**
 * 创建 CollectorAgent
 */
export function createCollectorAgent(llm: ChatOpenAI) {
  return createDeepAgent({
    systemPrompt: COLLECTOR_SYSTEM_PROMPT,
    tools: [
      fetchFeishuDocTool,
      analyzeContentTool,
      validateTodayReportTool
    ]
  });
}

/**
 * 执行收集任务的辅助函数
 */
export async function collectStudentData(
  agent: ReturnType<typeof createCollectorAgent>,
  students: Student[]
): Promise<StudentResult[]> {
  logger.info(`CollectorAgent: Starting to collect data for ${students.length} students`);

  const studentsInfo = students.map(s => ({
    studentId: s.studentId,
    name: s.name,
    docUrl: s.docUrl
  }));

  const prompt = `请收集以下学员的学习日报数据：

${JSON.stringify(studentsInfo, null, 2)}

对每个学员：
1. 获取文档内容
2. 验证是否为今日报告
3. 如果是今日报告，分析内容
4. 返回结果

请按照输出格式返回JSON数组。`;

  try {
    const result = await agent.invoke({
      messages: [{ role: 'user', content: prompt }]
    });

    // 解析 Agent 返回的结果
    const lastMessage = result.messages[result.messages.length - 1];
    const content = lastMessage.content as string;

    // 尝试从响应中提取JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]) as StudentResult[];
      logger.info(`CollectorAgent: Collected data for ${results.length} students`);
      return results;
    }

    // 如果无法解析，返回错误结果
    logger.error('CollectorAgent: Failed to parse results');
    return students.map(s => ({
      studentId: s.studentId,
      name: s.name,
      status: 'error' as const,
      error: 'Failed to parse agent response'
    }));

  } catch (error) {
    logger.error(`CollectorAgent error: ${error}`);
    return students.map(s => ({
      studentId: s.studentId,
      name: s.name,
      status: 'error' as const,
      error: (error as Error).message
    }));
  }
}
