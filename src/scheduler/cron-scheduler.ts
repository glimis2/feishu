import cron from 'node-cron';
import { logger } from '../utils/logger';

export class CronScheduler {
  private cronExpression: string;
  private timezone: string;
  private task: cron.ScheduledTask | null = null;

  constructor(cronExpression: string, timezone: string = 'Asia/Shanghai') {
    this.cronExpression = cronExpression;
    this.timezone = timezone;
  }

  schedule(taskFn: () => Promise<void>): void {
    logger.info(`Scheduling task with cron: ${this.cronExpression} (${this.timezone})`);

    this.task = cron.schedule(
      this.cronExpression,
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

    logger.info('Task scheduled successfully');
  }

  start(): void {
    if (this.task) {
      this.task.start();
      logger.info('Scheduler started');
    }
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      logger.info('Scheduler stopped');
    }
  }
}
