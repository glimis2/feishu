import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as path from 'path';
import { logger } from '../utils/logger';
import { fileExists, readJsonFile } from '../utils/file';
import {StudentStore} from '../model/studentLog'


export const getAllStudentMdTool = new DynamicStructuredTool({
  name: 'getAllStudentMd',
  description: '获取指定日期所有学生的报告数据',
  schema: z.object({
    date: z.string().describe('检测时间，格式：YYYY-MM-DD'),
  }),
  func: async ({ date }) => {
    try {
      const studentStore = await StudentStore.load(date)
      await studentStore.associateInfo()
      
      return studentStore.data
      .filter(item=>item.md)  
      .map(item=>`# ${item.name?.name}\n
${item.md}`)
      .join('\n') || '无数据';

    } catch (error) {
      return '无数据';
    }
  }
});
