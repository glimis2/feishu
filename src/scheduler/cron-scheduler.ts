import cron from 'node-cron';
import { logger } from '../utils/logger';

export class CronScheduler {
  private timezone: string;

  constructor(timezone: string = 'Asia/Shanghai') {
    this.timezone = timezone;
  }

  schedule(cronExpression: string, taskFn: () => Promise<void>): void {
    logger.info(`Scheduling task with cron: ${cronExpression} (${this.timezone})`);

    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          logger.info('Cron task triggered');
          await taskFn();
          logger.info('Cron task completed successfully');
        } catch (error) {
          logger.error(`Cron task failed: ${error}`);
        }
      },
      {
        timezone: this.timezone
      }
    );
    task.start()
    logger.info('Task scheduled successfully');
  }

}
