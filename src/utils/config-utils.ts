import * as path from 'path';
import { logger } from './logger';
import { readJsonFile } from './file';
import type { Config } from '../types';

let cachedConfig: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    logger.debug('Using cached config');
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), 'config', 'config.json');
  const config = await readJsonFile<Config>(configPath);

  const result: Config = {
    feishu: {
      appId: process.env.FEISHU_APP_ID || config.feishu.appId,
      appSecret: process.env.FEISHU_APP_SECRET || config.feishu.appSecret,
      configDocUrl: process.env.FEISHU_CONFIG_DOC_URL || config.feishu.configDocUrl
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || config.deepseek?.apiKey || '',
      model: process.env.DEEPSEEK_MODEL || config.deepseek?.model || 'deepseek-chat'
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

  cachedConfig = result;
  logger.info('Config loaded and cached');
  return result;
}

export function clearConfigCache(): void {
  cachedConfig = null;
  logger.debug('Config cache cleared');
}
