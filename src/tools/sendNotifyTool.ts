import "dotenv/config"
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getClient } from '../utils/client';

const client = getClient()

export const sendNotifyTool = new DynamicStructuredTool({
  name: 'sendNotify',
  description: '进行消息通知',
  schema: z.object({
    text: z.string().describe('总结后的文本'),
    id: z.string().describe('用户ID，如果需要发送给管理员，可以不用填写'),
  }),
  func: async ({ text,id }) => {
    try {
        await client.im.v1.message.create({
            params: {
                receive_id_type: 'open_id',
            },
            data: {
                receive_id: id || process.env.FEISHU_NOTIFY_USER_ID ,
                msg_type: 'text',
                content: JSON.stringify({
                    text
                }) 
            }
        })
        return "执行成功"
    } catch (error) {
      return '失败:' + error.message;
    }
  }
});
