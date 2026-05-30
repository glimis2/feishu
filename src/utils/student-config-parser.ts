/**
 * Student Config Parser - 学员配置解析器
 */

import path from 'path';
import { logger } from './logger';
import { getClient } from './client';
import { extractDocumentId } from './extractDocumentId';
import { fileExists, readJsonFile, writeJsonFile } from './file';
import type { Student } from '../types';

const client = getClient();

let spreadsheet_token: string | undefined;
let app_token: string | undefined;
let table_id: string | undefined;

interface StudentRecord {
  name: unknown;
  file?: { token: string };
  read_time?: unknown;
  status?: unknown;
  record_id: string;
  _task_status?: 'success' | 'fail';
  md?: string;
  [key: string]: unknown;
}

const headerMapping: Record<string, keyof StudentRecord> = {
  '姓名': 'name',
  '文件': 'file',
  '读取时间': 'read_time',
  '状态': 'status',
};

function getSpreadsheetToken(): string {
  if (!spreadsheet_token) {
    const docUrl = process.env.FEISHU_CONFIG_DOC_URL;
    if (!docUrl) {
      throw new Error('FEISHU_CONFIG_DOC_URL 未设置');
    }
    spreadsheet_token = extractDocumentId(docUrl);
  }
  return spreadsheet_token;
}

async function getAppToken(): Promise<string> {
  if (!app_token) {
    const response = await client.wiki.v2.space.getNode({
      params: { token: getSpreadsheetToken() },
    });
    app_token = response.data.node.obj_token;
  }
  return app_token;
}

async function getTableId(): Promise<string> {
  if (!table_id) {
    const response = await client.bitable.v1.appTable.list({
      path: { app_token: await getAppToken() },
      params: { page_size: 100 },
    });
    const table = response.data.items.find(item => item.name === '基础配置');
    if (!table) {
      throw new Error('未找到基础配置表格');
    }
    table_id = table.table_id;
  }
  return table_id;
}

export async function getStudentRecordSheet(): Promise<StudentRecord[]> {
  const response = await client.bitable.v1.appTableRecord.search({
    path: {
      app_token: await getAppToken(),
      table_id: await getTableId(),
    },
  });

  return response.data.items.map(item => {
    const rs: Partial<StudentRecord> = {};
    for (const key in headerMapping) {
      let obj = item.fields[key];
      if (Array.isArray(obj)) {
        obj = obj.filter((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'type' in item && 'text' in item) {
            const field = item as { type: string; text: string };
            return !(field.type === 'text' && field.text.trim() === '');
          }
          return true;
        })[0];
      }
      rs[headerMapping[key]] = obj;
    }
    return { ...rs, record_id: item.record_id } as StudentRecord;
  });
}

export async function getSheetTokens(): Promise<{ app_token: string; table_id: string }> {
  return {
    app_token: await getAppToken(),
    table_id: await getTableId(),
  };
}

export async function getStudents(date: string): Promise<StudentRecord[]> {
  try {
    const filePath = path.resolve(process.cwd(), `data/students/${date}.json`);

    if (await fileExists(filePath)) {
      return await readJsonFile<StudentRecord[]>(filePath);
    }

    const data = await getStudentRecordSheet() || [];
    return data;
  } catch (error) {
    logger.error(`Load config error: ${error}`);
    return [];
  }
}

export async function saveStudentsToCache(date: string, students: StudentRecord[]): Promise<void> {
  const filePath = path.resolve(process.cwd(), `data/students/${date}.json`);
  await writeJsonFile(filePath, students);
}

export function parseStudentConfig(content: string): Student[] {
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

export function resetStudentCache(): void {
  spreadsheet_token = undefined;
  app_token = undefined;
  table_id = undefined;
}
