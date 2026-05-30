/**
 * Check Student Tool - 检查学员工具
 */
import 'dotenv/config';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import _ from 'lodash';

import {StudentStore} from '../model/student'

export const checkStudentTool = new DynamicStructuredTool({
  name: 'check_student',
  description: '执行检查任务,获取学员列表，检查每位学员是否已完成当日总结文档，并返回检查结果。检测结果为未完成总结学员信息列表',

  // responseFormat: "json",
  schema: z.object({
    date: z.string().describe('检测时间，格式：YYYY-MM-DD'),
  }),
  func: async ({ date }) => {
    // 获取所有学生的模型
    const studentStore = await StudentStore.load(date);
    await studentStore.associateInfo()
    return JSON.stringify(studentStore.unsubmitted())
  },
});
