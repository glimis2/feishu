/**
 * ReminderAgent - 使用 deepagentsjs 实现
 *
 * 负责批量向未提交学员发送提醒消息
 */

import { createDeepAgent } from 'deepagentsjs-monorepo/libs/deepagents/src/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { sendFeishuMessageTool } from '../tools/agent-tools';
import { logger } from '../utils/logger';
import type { Student, ReminderResult } from '../types';

const REMINDER_SYSTEM_PROMPT = `你是提醒Agent，负责向未提交学员发送学习日报提醒。

## 你的职责

1. 接收未提交学员列表（包含姓名、飞书用户ID）
2. 对每个学员：
   - 检查是否有飞书用户ID
   - 如果有，使用 send_feishu_message 工具发送提醒消息
   - 如果没有，跳过并记录
3. 返回所有学员的发送结果

## 提醒消息内容

固定使用以下消息内容：
"【学习日报提醒】请及时提交今天的学习日报"

## 工作流程

对于每个学员：
1. 检查 feishuUserId 是否存在
2. 如果存在，调用 send_feishu_message 发送消息
3. 如果不存在，标记为失败（原因：无飞书用户ID）
4. 记录发送结果

## 输出格式

返回JSON数组，每个元素包含：
- studentId: 学员ID
- name: 学员姓名
- success: true | false
- error: 错误信息 (仅当success为false时)

## 注意事项

- 并发发送多个消息，但要控制并发数量
- 单个学员发送失败不影响其他学员
- 记录详细的发送日志
- 优雅处理所有错误`;

/**
 * 创建 ReminderAgent
 */
export function createReminderAgent(llm: ChatOpenAI) {
  return createDeepAgent({
    systemPrompt: REMINDER_SYSTEM_PROMPT,
    tools: [sendFeishuMessageTool]
  });
}

/**
 * 执行提醒任务的辅助函数
 */
export async function sendReminders(
  agent: ReturnType<typeof createReminderAgent>,
  students: Student[]
): Promise<ReminderResult[]> {
  logger.info(`ReminderAgent: Sending reminders to ${students.length} students`);

  const studentsInfo = students.map(s => ({
    studentId: s.studentId,
    name: s.name,
    feishuUserId: s.feishuUserId
  }));

  const prompt = `请向以下未提交学员发送学习日报提醒：

${JSON.stringify(studentsInfo, null, 2)}

提醒消息内容：【学习日报提醒】请及时提交今天的学习日报

对每个学员：
1. 检查是否有 feishuUserId
2. 如果有，发送提醒消息
3. 如果没有，标记为失败
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
      const results = JSON.parse(jsonMatch[0]) as ReminderResult[];
      logger.info(`ReminderAgent: Sent reminders to ${results.filter(r => r.success).length} students`);
      return results;
    }

    // 如果无法解析，返回错误结果
    logger.error('ReminderAgent: Failed to parse results');
    return students.map(s => ({
      studentId: s.studentId,
      name: s.name,
      success: false,
      error: 'Failed to parse agent response'
    }));

  } catch (error) {
    logger.error(`ReminderAgent error: ${error}`);
    return students.map(s => ({
      studentId: s.studentId,
      name: s.name,
      success: false,
      error: (error as Error).message
    }));
  }
}
