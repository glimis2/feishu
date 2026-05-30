import { ChatDeepSeek } from "@langchain/deepseek";
import { loadConfig } from '../utils/config-utils'
import { CronScheduler } from "../scheduler/cron-scheduler";
import { createMiddleware } from "langchain";
import { createDeepAgent } from 'deepagents';
import { checkStudentTool, getAllStudentMdTool, sendFeishuMessageTool } from '../tools';
import { summaryTool } from '../tools/summary-tool';
import { getCurrentDateTool } from "../tools/get-current-date-tool";
import { sendNotifyTool } from "../tools/send-notify-tool";

const MAIN_AGENT_SYSTEM_PROMPT = `你是一个学员监督agent，负责协调整个学员监督流程。

## 你的执行

### 预统计任务
1. 由 checkStudentTool 获取是否包含未提交的学员
2. 如果有,调用 sendFeishuMessageTool 发送提醒
3. 做完以上任务后，调用 sendNotifyTool 进行整体进度的提醒

### 最终汇总任务
最终汇总任务，是对昨日任务的汇总，按照以下逻辑进行执行

1. 调用 getAllStudentMdTool 获取所有学生待汇总的记录
2. 对所有的日报进行总结, 强调不会获未掌握的内容结构
3. 对未掌握的知识点和学员，进行关联，转换为json格式,其中
name 为学员信息，knowledge 为未掌握的知识点
4. 调用 sendNotifyTool 进行汇总任务的提醒
`;

/**
 * 创建 MainAgent
 */
export async function createMainAgent() {
  const config = await loadConfig()



  const llm = new ChatDeepSeek({
    apiKey: config.deepseek.apiKey,
    model: config.deepseek.model,
    temperature: 0
  })

  const logger = createMiddleware({
    name: "logging",
    wrapModelCall: async (request, handler) => {
      const result = await handler(request);
      return result;
    },
    wrapToolCall: async (request, handler) => {
      const result = await handler(request);
      return result;
    },
  });

  const agent = createDeepAgent({
    model: llm,
    systemPrompt: MAIN_AGENT_SYSTEM_PROMPT,
    tools:[
      checkStudentTool,
      getAllStudentMdTool,
      summaryTool,
      sendFeishuMessageTool,
      getCurrentDateTool,
      sendNotifyTool
    ],
    middleware: [
      logger
    ]
  })

  // 创建定时任务
  const cronScheduler = new CronScheduler();

  cronScheduler.schedule('0 20 * * *', async () => {
    await agent.invoke({
      messages: [{ role: 'user', content: "执行今日学员预检查任务" }]
    })
  });

  cronScheduler.schedule('10 0 * * *', async () => {
    await agent.invoke({
      messages: [{ role: 'user', content: "执行最终汇总任务" }]
    })
  });

  return agent;
}

