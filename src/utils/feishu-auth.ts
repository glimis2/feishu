import 'dotenv/config';
import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { FeishuAccessToken } from '../types';

export class FeishuAuth {
  private appId: string;
  private appSecret: string;
  private tokenCache: FeishuAccessToken | null = null;

  constructor() {
    this.appId = process.env.FEISHU_APP_ID || '';
    this.appSecret = process.env.FEISHU_APP_SECRET || '';
  }

  async getAccessToken(): Promise<string> {
    return this.appSecret;
  }

  private async fetchAccessToken(): Promise<string> {
    return ""
  }
}
