import * as path from 'path';
import { CollectorAgent } from './collector-agent';
import { ReminderAgent } from './reminder-agent';
import { FeishuDocClient } from '../tools/feishu-doc';
import { logger } from '../utils/logger';
import { writeJsonFile } from '../utils/file';
import { Student, TaskData, DailyReport } from '../types';

export class MainAgent {
  private collectorAgent: CollectorAgent;
  private reminderAgent: ReminderAgent;
  private docClient: FeishuDocClient;
  private configDocUrl: string;

  constructor(
    collectorAgent: CollectorAgent,
    reminderAgent: ReminderAgent,
    docClient: FeishuDocClient,
    configDocUrl: string
  ) {
    this.collectorAgent = collectorAgent;
    this.reminderAgent = reminderAgent;
    this.docClient = docClient;
    this.configDocUrl = configDocUrl;
  }

  async executeDailyTask(): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);

    try {
      logger.info('Starting daily monitoring task');

      const students = await this.loadStudentConfig();
      logger.info(`Loaded ${students.length} students from config`);

      const collectTaskId = `${timestamp}_collect`;
      const collectTask: TaskData = {
        taskId: collectTaskId,
        type: 'collect',
        status: 'running',
        createdAt: new Date().toISOString(),
        input: { students },
        errors: []
      };
      await this.saveTask(collectTask);

      const collectionResults = await this.collectorAgent.collectStudentData(students);

      collectTask.status = 'completed';
      collectTask.completedAt = new Date().toISOString();
      collectTask.output = { results: collectionResults };
      await this.saveTask(collectTask);

      const notSubmittedStudents = collectionResults
        .filter(r => r.status === 'not_submitted')
        .map(r => students.find(s => s.studentId === r.studentId)!)
        .filter(s => s !== undefined);

      logger.info(`Found ${notSubmittedStudents.length} students who haven't submitted`);

      const remindTaskId = `${timestamp}_remind`;
      const remindTask: TaskData = {
        taskId: remindTaskId,
        type: 'remind',
        status: 'running',
        createdAt: new Date().toISOString(),
        input: { students: notSubmittedStudents },
        errors: []
      };
      await this.saveTask(remindTask);

      const reminderResults = await this.reminderAgent.sendReminders(notSubmittedStudents);

      remindTask.status = 'completed';
      remindTask.completedAt = new Date().toISOString();
      remindTask.output = { results: reminderResults };
      await this.saveTask(remindTask);

      const executionTime = Math.round((Date.now() - startTime) / 1000);
      const report = this.generateDailyReport(
        collectionResults,
        reminderResults.filter(r => r.success).length,
        executionTime
      );

      await this.saveDailyReport(report);

      logger.info(`Daily task completed in ${executionTime}s`);
    } catch (error) {
      logger.error(`Daily task failed: ${error}`);
      throw error;
    }
  }

  private async loadStudentConfig(): Promise<Student[]> {
    const documentId = this.docClient.extractDocumentId(this.configDocUrl);
    const docContent = await this.docClient.getDocContent(documentId);

    return this.parseStudentConfig(docContent.content);
  }

  private parseStudentConfig(content: string): Student[] {
    const students: Student[] = [];
    const lines = content.split('\n');

    let studentIdCounter = 1;
    for (const line of lines) {
      const match = line.match(/^-\s*(.+?):\s*(https:\/\/.+?)\s*(?:\((.+?)\))?$/);
      if (match) {
        const [, name, docUrl, feishuUserId] = match;
        students.push({
          studentId: String(studentIdCounter++).padStart(3, '0'),
          name: name.trim(),
          docUrl: docUrl.trim(),
          feishuUserId: feishuUserId?.trim()
        });
      }
    }

    return students;
  }

  private generateDailyReport(
    collectionResults: any[],
    remindersSent: number,
    executionTime: number
  ): DailyReport {
    const submitted = collectionResults.filter(r => r.status === 'submitted').length;
    const notSubmitted = collectionResults.filter(r => r.status === 'not_submitted').length;

    return {
      date: new Date().toISOString().split('T')[0],
      totalStudents: collectionResults.length,
      submitted,
      notSubmitted,
      students: collectionResults,
      remindersSent,
      executionTime: `${Math.floor(executionTime / 60)}m ${executionTime % 60}s`
    };
  }

  private async saveTask(task: TaskData): Promise<void> {
    const filePath = path.join(process.cwd(), 'data', 'tasks', `${task.taskId}.json`);
    await writeJsonFile(filePath, task);
  }

  private async saveDailyReport(report: DailyReport): Promise<void> {
    const filePath = path.join(process.cwd(), 'data', 'history', `${report.date}.json`);
    await writeJsonFile(filePath, report);
  }
}
