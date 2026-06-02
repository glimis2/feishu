import * as dotenv from 'dotenv';
// import { createMainAgent } from './agents/main-agent';
import { logger } from './utils/logger';
import { getClient, getWsClient } from './utils/client';
import * as Lark from '@larksuiteoapi/node-sdk';
import { createHelperAgent } from './agents/helper-agent'
import { getCost } from './utils/getCost';

dotenv.config();

const mapping = new Map()

async function main() {
  try {
    logger.info('Starting Feishu Student Monitor System');
    // const agent = await createMainAgent();

    // await agent.invoke({
    //   messages: [{ role: 'user', content: "执行最终汇总任务" }]
    // })

    // 监听任务
    const client = getClient()
    const helperAgent = await createHelperAgent()

    const wsClient = getWsClient()
    wsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new Lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => {
          console.log("接收到信息", data)
          if (mapping.get(data.event_id)) {
            return // 防止重复提交
          }
          mapping.set(data.event_id, "pending")
          
          const result = await helperAgent.invoke({
            messages: [
              {
                role: 'user', content: `
${JSON.stringify(data)}           
` }]
          })

          const cost = getCost(result)
          console.log("cost", cost)

        }
      })
    });

  } catch (error) {
    logger.error(`Failed to start system: ${error}`);
    process.exit(1);
  }
}

main();
