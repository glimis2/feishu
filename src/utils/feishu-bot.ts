import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { FeishuAuth } from './feishu-auth';

export class FeishuBotClient {
  private auth: FeishuAuth;

  constructor(auth: FeishuAuth) {
    this.auth = auth;
  }

  async sendMessage(userId: string, message: string): Promise<void> {
    return retryWithBackoff(async () => {
      const token = await this.auth.getAccessToken();

      logger.info(`Sending message to user: ${userId}`);

      const response = await axios.post(
        'https://open.feishu.cn/open-api/im/v1/messages',
        {
          receive_id: userId,
          msg_type: 'text',
          content: JSON.stringify({ text: message })
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            receive_id_type: 'user_id'
          }
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to send message: ${response.data.msg}`);
      }

      logger.info(`Message sent successfully to user: ${userId}`);
    });
  }
}
