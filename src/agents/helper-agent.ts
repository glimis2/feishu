import { ChatDeepSeek } from "@langchain/deepseek";
import { loadConfig } from '../utils/config-utils'
import { createDeepAgent } from 'deepagents';
import { studentConfigTool, studentLogTool ,sendNotifyTool,getCurrentDateTool} from '../tools';
import { costCalculationMiddleware } from "../middleware/costCalculationMiddleware";
import { loggerMiddleware } from "../middleware/loggerMiddleware";
const MAIN_AGENT_SYSTEM_PROMPT = `你是一个学员监督agent小助手,负责解决学生的日常数据的维护
判断用户期待修改的数据模型，而后进行维护，如果没有找到，直接告诉用户，你的工作范围

以下是你可以修改的模型,并且都有对应的Tool可以用来维护

## 数据模型

### StudentLog
学生的日报信息

### StudentConfig
学生的配置信息基础信息包括

## 工具使用逻辑

如果用户期待初始化配置环境或创建环境，调用 StudentConfig(type='create')
如果是查询配置日志，调用 StudentConfig(type='read')


## 重点事项

1. 你接收到的数据，来自飞书聊天消息，你需要根据消息内容，判断用户期待修改的数据模型，而后进行维护
2.  接收到信息后，立刻调用 sendNotifyTool ，发送你的工作计划
3. 仅针对学生的日报管理配置和日报做维护，其他工作一概不处理
4. 所有的输出结构，都会调用 sendNotifyTool 通知用户
`;

/**
 * 创建 MainAgent
 */
export async function createHelperAgent(): Promise<ReturnType<typeof createDeepAgent>> {
  const config = await loadConfig()

  const llm = new ChatDeepSeek({
    apiKey: config.deepseek.apiKey,
    model: config.deepseek.model,
    temperature: 0
  })



  const agent = createDeepAgent({
    model: llm,
    systemPrompt: MAIN_AGENT_SYSTEM_PROMPT,
    tools:[
      studentConfigTool, // 修改学生配置
      studentLogTool, // 修改学生日志
      sendNotifyTool, // 通知用户
      getCurrentDateTool
    ],
    middleware: [
      loggerMiddleware(),
      costCalculationMiddleware()
    ]
  })



  return agent;
}
