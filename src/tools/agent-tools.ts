/**
 * LangChain Tools for Deep Agents
 *
 * 将飞书 API 和内容分析功能封装为 LangChain tools
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { FeishuDocClient } from './feishu-doc';
import { FeishuBotClient } from './feishu-bot';
import { FeishuAuth } from './feishu-auth';
import { ContentAnalyzer } from './content-analyzer';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../utils/logger';

// 全局实例（在主入口初始化）
let feishuAuth: FeishuAuth;
let feishuDocClient: FeishuDocClient;
let feishuBotClient: FeishuBotClient;
let contentAnalyzer: ContentAnalyzer;

export function initializeToolDependencies(
  auth: FeishuAuth,
  docClient: FeishuDocClient,
  botClient: FeishuBotClient,
  analyzer: ContentAnalyzer
) {
  feishuAuth = auth;
  feishuDocClient = docClient;
  feishuBotClient = botClient;
  contentAnalyzer = analyzer;
}

/**
 * 工具：获取飞书文档内容
 */
export const fetchFeishuDocTool = new DynamicStructuredTool({
  name: 'fetch_feishu_doc',
  description: '获取飞书文档的内容和最后修改时间。输入文档URL，返回文档内容和最后修改时间的JSON字符串。',
  schema: z.object({
    docUrl: z.string().describe('飞书文档URL，例如：https://feishu.cn/docx/abc123')
  }),
  func: async ({ docUrl }) => {
    try {
      logger.info(`Tool: fetching document ${docUrl}`);
      const documentId = feishuDocClient.extractDocumentId(docUrl);
      const content = await feishuDocClient.getDocContent(documentId);
      return JSON.stringify({
        success: true,
        content: content.content,
        lastModified: content.lastModified
      });
    } catch (error) {
      logger.error(`Tool error: ${error}`);
      return JSON.stringify({
        success: false,
        error: (error as Error).message
      });
    }
  }
});

/**
 * 工具：分析学习内容
 */
export const analyzeContentTool = new DynamicStructuredTool({
  name: 'analyze_learning_content',
  description: '使用AI分析学习日报内容，提取学会的内容、不会的内容、疑问的问题。输入文档内容，返回分析结果的JSON字符串。',
  schema: z.object({
    content: z.string().describe('学习日报的文档内容')
  }),
  func: async ({ content }) => {
    try {
      logger.info('Tool: analyzing content');
      const summary = await contentAnalyzer.analyzeContent(content);
      return JSON.stringify({
        success: true,
        learned: summary.learned,
        notLearned: summary.notLearned,
        questions: summary.questions
      });
    } catch (error) {
      logger.error(`Tool error: ${error}`);
      return JSON.stringify({
        success: false,
        error: (error as Error).message
      });
    }
  }
});

/**
 * 工具：验证是否为今日报告
 */
export const validateTodayReportTool = new DynamicStructuredTool({
  name: 'validate_today_report',
  description: '验证文档是否为今日的学习日报。输入文档内容和最后修改时间，返回是否为今日报告的布尔值。',
  schema: z.object({
    content: z.string().describe('文档内容'),
    lastModified: z.string().describe('文档最后修改时间，ISO格式')
  }),
  func: async ({ content, lastModified }) => {
    try {
      logger.info('Tool: validating today report');
      const isToday = await contentAnalyzer.isTodayReport(content, lastModified);
      return JSON.stringify({
        success: true,
        isToday
      });
    } catch (error) {
      logger.error(`Tool error: ${error}`);
      return JSON.stringify({
        success: false,
        error: (error as Error).message
      });
    }
  }
});

/**
 * 工具：发送飞书消息
 */
export const sendFeishuMessageTool = new DynamicStructuredTool({
  name: 'send_feishu_message',
  description: '向指定用户发送飞书消息。输入用户ID和消息内容，返回发送结果。',
  schema: z.object({
    userId: z.string().describe('飞书用户ID'),
    message: z.string().describe('要发送的消息内容')
  }),
  func: async ({ userId, message }) => {
    try {
      logger.info(`Tool: sending message to ${userId}`);
      await feishuBotClient.sendMessage(userId, message);
      return JSON.stringify({
        success: true,
        message: '消息发送成功'
      });
    } catch (error) {
      logger.error(`Tool error: ${error}`);
      return JSON.stringify({
        success: false,
        error: (error as Error).message
      });
    }
  }
});

/**
 * 工具：提取文档ID
 */
export const extractDocIdTool = new DynamicStructuredTool({
  name: 'extract_document_id',
  description: '从飞书文档URL中提取文档ID。',
  schema: z.object({
    docUrl: z.string().describe('飞书文档URL')
  }),
  func: async ({ docUrl }) => {
    try {
      const documentId = feishuDocClient.extractDocumentId(docUrl);
      return JSON.stringify({
        success: true,
        documentId
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message
      });
    }
  }
});
