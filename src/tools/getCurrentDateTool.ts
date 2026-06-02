import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 获取当前日期工具
 * 返回格式：YYYY-MM-DD
 */
export const getCurrentDateTool = new DynamicStructuredTool({
  name: 'get_current_date',
  description: '获取当前系统日期，返回格式为 YYYY-MM-DD，用于检查学员今日总结提交情况',
  // 该工具不需要输入参数
  schema: z.object({}),
  // 返回格式：string 类型的日期
  responseFormat: z.string().describe('当前日期，格式：YYYY-MM-DD'),

  func: async () => {
    // 获取当前东八区日期（中国时区）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const currentDate = `${year}-${month}-${day}`;
    return currentDate;
  }
});