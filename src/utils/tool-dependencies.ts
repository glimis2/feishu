/**
 * Tool Dependencies - 工具依赖管理
 *
 * 管理所有工具共享的依赖实例
 */

import { FeishuAuth } from './feishu-auth';
import { FeishuDocClient } from './feishu-doc';
import { FeishuBotClient } from './feishu-bot';
import { ContentAnalyzer } from './content-analyzer';

// 全局实例（在主入口初始化）
let feishuAuth: FeishuAuth;
let feishuDocClient: FeishuDocClient;
let feishuBotClient: FeishuBotClient;
let contentAnalyzer: ContentAnalyzer;

/**
 * 初始化工具依赖
 */
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
 * 获取飞书认证实例
 */
export function getFeishuAuth(): FeishuAuth {
  if (!feishuAuth) {
    throw new Error('FeishuAuth not initialized. Call initializeToolDependencies first.');
  }
  return feishuAuth;
}

/**
 * 获取飞书文档客户端实例
 */
export function getFeishuDocClient(): FeishuDocClient {
  if (!feishuDocClient) {
    throw new Error('FeishuDocClient not initialized. Call initializeToolDependencies first.');
  }
  return feishuDocClient;
}

/**
 * 获取飞书机器人客户端实例
 */
export function getFeishuBotClient(): FeishuBotClient {
  if (!feishuBotClient) {
    throw new Error('FeishuBotClient not initialized. Call initializeToolDependencies first.');
  }
  return feishuBotClient;
}

/**
 * 获取内容分析器实例
 */
export function getContentAnalyzer(): ContentAnalyzer {
  if (!contentAnalyzer) {
    throw new Error('ContentAnalyzer not initialized. Call initializeToolDependencies first.');
  }
  return contentAnalyzer;
}
