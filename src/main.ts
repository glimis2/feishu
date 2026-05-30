import * as dotenv from 'dotenv';
import { createMainAgent } from './agents/main-agent';
import { logger } from './utils/logger';
import { getClient, getWsClient } from './utils/client';
import * as Lark from '@larksuiteoapi/node-sdk';

dotenv.config();

async function main() {
  try {
    logger.info('Starting Feishu Student Monitor System');
    const agent = await createMainAgent();

    // await agent.invoke({
    //   messages: [{ role: 'user', content: "执行最终汇总任务" }]
    // })

    

  } catch (error) {
    logger.error(`Failed to start system: ${error}`);
    process.exit(1);
  }
}

main();
