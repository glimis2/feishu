import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {StudentStore} from '../model/studentLog'

export const studentInfoTool = new DynamicStructuredTool({
  name: 'studentInfo',
  description: '查询,修改学员',
  schema: z.object({
    date: z.string().describe('检测时间，格式：YYYY-MM-DD'),
    text: z.string().describe('总结后的文本'),
  }),
  func: async ({ date, text }) => {
    try {
      const studentStore = await StudentStore.load(date)
      await studentStore.associateInfo()
      
      const md = studentStore.data
      .filter(item=>item.md)  
      .map(item=>`# ${item.name?.name}\n
${item.md}`)
      .join('\n');


    } catch (error) {
      return '无数据';
    }
  }
});
