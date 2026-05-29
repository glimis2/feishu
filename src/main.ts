import * as dotenv from 'dotenv';
import * as path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { FeishuAuth } from './tools/feishu-auth';
import { FeishuDocClient } from './tools/feishu-doc';
import { FeishuBotClient } from './tools/feishu-bot';
import { ContentAnalyzer } from './tools/content-analyzer';
import { createMainAgent, executeDailyTask } from './agents/main-agent-v2';
import { initializeToolDependencies } from './tools/agent-tools';
import { CronScheduler } from './scheduler/cron-scheduler';
import { logger } from './utils/logger';
import { readJsonFile, ensureDir } from './utils/file';
import { Config } from './types';

dotenv.config();

async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'config', 'config.json');
  const config = await readJsonFile<Config>(configPath);

  return {
    feishu: {
      appId: process.env.FEISHU_APP_ID || config.feishu.appId,
      appSecret: process.env.FEISHU_APP_SECRET || config.feishu.appSecret,
      configDocUrl: process.env.FEISHU_CONFIG_DOC_URL || config.feishu.configDocUrl
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || config.openai.apiKey,
      model: process.env.OPENAI_MODEL || config.openai.model
    },
    schedule: {
      cron: process.env.CRON_SCHEDULE || config.schedule.cron,
      timezone: process.env.TIMEZONE || config.schedule.timezone
    },
    concurrency: {
      maxCollectors: parseInt(process.env.MAX_COLLECTORS || String(config.concurrency.maxCollectors)),
      maxReminders: parseInt(process.env.MAX_REMINDERS || String(config.concurrency.maxReminders))
    }
  };
}

async function initializeDataDirectories(): Promise<void> {
  const dirs = [
    path.join(process.cwd(), 'data', 'tasks'),
    path.join(process.cwd(), 'data', 'history'),
    path.join(process.cwd(), 'data', 'students'),
    path.join(process.cwd(), 'logs')
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

async function main() {
  try {
    logger.info('Starting Feishu Student Monitor System');

    await initializeDataDirectories();
    const config = await loadConfig();

    const llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: 0
    });

    const feishuAuth = new FeishuAuth(config.feishu.appId, config.feishu.appSecret);
    const docClient = new FeishuDocClient(feishuAuth);
    const botClient = new FeishuBotClient(feishuAuth);
    const analyzer = new ContentAnalyzer(llm);

    // 初始化 agent-tools 的依赖
    initializeToolDependencies(feishuAuth, docClient, botClient, analyzer);

    // 使用 deepagentsjs 创建 MainAgent
    const mainAgent = createMainAgent(llm, docClient, config.feishu.configDocUrl);

    const scheduler = new CronScheduler(
      config.schedule.cron,
      config.schedule.timezone
    );

    scheduler.schedule(async () => {
      await executeDailyTask(mainAgent);
    });

    scheduler.start();

    logger.info(`System started. Scheduled to run at: ${config.schedule.cron} (${config.schedule.timezone})`);
    logger.info('Press Ctrl+C to stop');

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Failed to start system: ${error}`);
    process.exit(1);
  }
}

main();
