/**
 * Daily Report Generator - 每日报告生成器
 */

import type { StudentResult, DailyReport } from '../types';

/**
 * 生成每日报告
 */
export function generateDailyReport(
  collectionResults: StudentResult[],
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
