import pLimit from 'p-limit';
import { FeishuBotClient } from '../tools/feishu-bot';
import { logger } from '../utils/logger';
import { Student, ReminderResult } from '../types';

export class ReminderAgent {
  private botClient: FeishuBotClient;
  private maxConcurrency: number;
  private reminderMessage: string;

  constructor(
    botClient: FeishuBotClient,
    maxConcurrency: number = 10,
    reminderMessage: string = '【学习日报提醒】请及时提交今天的学习日报'
  ) {
    this.botClient = botClient;
    this.maxConcurrency = maxConcurrency;
    this.reminderMessage = reminderMessage;
  }

  async sendReminders(students: Student[]): Promise<ReminderResult[]> {
    logger.info(`Sending reminders to ${students.length} students`);

    const limit = pLimit(this.maxConcurrency);
    const tasks = students.map(student =>
      limit(() => this.sendReminder(student))
    );

    const results = await Promise.allSettled(tasks);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to send reminder to ${students[index].name}: ${result.reason}`);
        return {
          studentId: students[index].studentId,
          name: students[index].name,
          success: false,
          error: result.reason.message
        };
      }
    });
  }

  private async sendReminder(student: Student): Promise<ReminderResult> {
    try {
      if (!student.feishuUserId) {
        logger.warn(`Student ${student.name} has no Feishu user ID, skipping`);
        return {
          studentId: student.studentId,
          name: student.name,
          success: false,
          error: 'No Feishu user ID provided'
        };
      }

      logger.info(`Sending reminder to student: ${student.name}`);

      await this.botClient.sendMessage(student.feishuUserId, this.reminderMessage);

      logger.info(`Reminder sent successfully to: ${student.name}`);
      return {
        studentId: student.studentId,
        name: student.name,
        success: true
      };
    } catch (error) {
      logger.error(`Error sending reminder to ${student.name}: ${error}`);
      throw error;
    }
  }
}
