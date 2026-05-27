import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { FeishuAuth } from './feishu-auth';
import { FeishuDocContent } from '../types';

export class FeishuDocClient {
  private auth: FeishuAuth;

  constructor(auth: FeishuAuth) {
    this.auth = auth;
  }

  async getDocContent(documentId: string): Promise<FeishuDocContent> {
    return retryWithBackoff(async () => {
      const token = await this.auth.getAccessToken();

      logger.info(`Fetching document content: ${documentId}`);

      const response = await axios.get(
        `https://open.feishu.cn/open-api/docx/v1/documents/${documentId}/raw_content`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to fetch document: ${response.data.msg}`);
      }

      const content = response.data.data.content || '';
      const lastModified = response.data.data.last_modified || new Date().toISOString();

      return {
        content,
        lastModified
      };
    });
  }

  extractDocumentId(url: string): string {
    const match = url.match(/\/docx\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error(`Invalid document URL: ${url}`);
    }
    return match[1];
  }
}
