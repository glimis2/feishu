import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { FeishuAccessToken } from '../types';

export class FeishuAuth {
  private appId: string;
  private appSecret: string;
  private tokenCache: FeishuAccessToken | null = null;

  constructor(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expireAt > Date.now()) {
      return this.tokenCache.token;
    }

    const token = await this.fetchAccessToken();
    return token;
  }

  private async fetchAccessToken(): Promise<string> {
    return retryWithBackoff(async () => {
      logger.info('Fetching Feishu access token');

      const response = await axios.post(
        'https://open.feishu.cn/open-api/auth/v3/tenant_access_token/internal',
        {
          app_id: this.appId,
          app_secret: this.appSecret
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get access token: ${response.data.msg}`);
      }

      const token = response.data.tenant_access_token;
      const expireIn = response.data.expire ?? 7200;

      // Subtract 300 seconds (5 minutes) as buffer, but ensure it's not negative
      const bufferTime = Math.max(expireIn - 300, 0);

      this.tokenCache = {
        token,
        expireAt: Date.now() + bufferTime * 1000
      };

      logger.info('Access token fetched successfully');
      return token;
    });
  }
}
