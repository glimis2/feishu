import pLimit from 'p-limit';
import { FeishuDocClient } from '../tools/feishu-doc';
import { ContentAnalyzer } from '../tools/content-analyzer';
import { logger } from '../utils/logger';
import { Student, StudentResult } from '../types';

export class CollectorAgent {
  private docClient: FeishuDocClient;
  private analyzer: ContentAnalyzer;
  private maxConcurrency: number;

  constructor(
    docClient: FeishuDocClient,
    analyzer: ContentAnalyzer,
    maxConcurrency: number = 10
  ) {
    this.docClient = docClient;
    this.analyzer = analyzer;
    this.maxConcurrency = maxConcurrency;
  }

  async collectStudentData(students: Student[]): Promise<StudentResult[]> {
    logger.info(`Starting to collect data for ${students.length} students`);

    const limit = pLimit(this.maxConcurrency);
    const tasks = students.map(student =>
      limit(() => this.processStudent(student))
    );

    const results = await Promise.allSettled(tasks);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to process student ${students[index].name}: ${result.reason}`);
        return {
          studentId: students[index].studentId,
          name: students[index].name,
          status: 'error' as const,
          error: result.reason.message
        };
      }
    });
  }

  private async processStudent(student: Student): Promise<StudentResult> {
    try {
      logger.info(`Processing student: ${student.name}`);

      const documentId = this.docClient.extractDocumentId(student.docUrl);
      const docContent = await this.docClient.getDocContent(documentId);

      const isTodayReport = await this.analyzer.isTodayReport(
        docContent.content,
        docContent.lastModified
      );

      if (!isTodayReport) {
        logger.info(`Student ${student.name} has not submitted today's report`);
        return {
          studentId: student.studentId,
          name: student.name,
          status: 'not_submitted'
        };
      }

      const summary = await this.analyzer.analyzeContent(docContent.content);

      logger.info(`Student ${student.name} report analyzed successfully`);
      return {
        studentId: student.studentId,
        name: student.name,
        status: 'submitted',
        summary
      };
    } catch (error) {
      logger.error(`Error processing student ${student.name}: ${error}`);
      throw error;
    }
  }
}
