import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DailySummary } from '../model/dailySummary';
import _ from 'lodash'


/**
 * 学生配置工具
 */
export const dailySummaryTool = new DynamicStructuredTool({
  name: 'dailySummary',
  description: '对所有学员的每日汇总信息，只包含保存功能',
  schema: z.object({
    date: z.string().describe('日期,格式为YYYY-MM-DD'),
    text: z.string().describe('每日汇总文本')
  }),
  func: async ({ date, text }) => {
    try {
      await DailySummary.save(date,text)
      return "保存成功"
    } catch (error) {
      return error.message
    }
  }
});

