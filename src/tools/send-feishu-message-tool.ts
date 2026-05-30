import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {StudentStore} from '../model/student'

import { getClient } from '../utils/client';
const client = getClient()

export const sendFeishuMessageTool = new DynamicStructuredTool({
  name: 'send_feishu_message',
  description: '发送飞书消息提醒，提醒用户做下总结。输入时间，返回发送结果',
  schema: z.object({
    date: z.string().describe('需要提醒的时间,格式为 YYYY-MM-DD 如 2026-05-29')
  }),
  func: async ({ date }): Promise<string> => {
    try {
      const studentStore = await StudentStore.load(date)
      const unsubmitted =  studentStore.unsubmitted()
      let number = 0
      for(const student of unsubmitted){
          if(!student?.name?.token){
            continue
          }
           await client.im.v1.message.create({
              params: {
                receive_id_type: 'open_id',
              },
              data: {
                receive_id: student.name.token,
                msg_type: 'post',

                content: JSON.stringify({ 
                  "zh_cn": { 
                    "title": "消息提醒", 
                    "content": [
                      [
                        { "tag": "text", "text": "铁子，记得做下总结哈，可以直接将今日总结发给我，也可以在以下链接中进行添加" },
                        { "tag": "a", "href": student.file.link, "text": student.file.text }
                    ]
                    
                    ] } }),
              },
            }
            )
          number++
      }
      return "提醒成功:"+number
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = { success: false, error: errorMessage };
      return JSON.stringify(result);
    }
  },
});
