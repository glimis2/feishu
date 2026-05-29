/**
 * MainAgent V2 集成测试
 *
 * 测试使用 deepagentsjs 实现的 MainAgent
 */

import { ChatOpenAI } from '@langchain/openai';
import { FeishuAuth } from '../../src/tools/feishu-auth';
import { FeishuDocClient } from '../../src/tools/feishu-doc';
import { FeishuBotClient } from '../../src/tools/feishu-bot';
import { ContentAnalyzer } from '../../src/tools/content-analyzer';
import { initializeToolDependencies } from '../../src/tools/agent-tools';
import { createMainAgent } from '../../src/agents/main-agent-v2';

describe('MainAgent V2 Integration', () => {
  let llm: ChatOpenAI;
  let feishuAuth: FeishuAuth;
  let docClient: FeishuDocClient;
  let botClient: FeishuBotClient;
  let analyzer: ContentAnalyzer;

  beforeAll(() => {
    llm = new ChatOpenAI({
      openAIApiKey: 'test-key',
      modelName: 'gpt-4',
      temperature: 0
    });

    feishuAuth = new FeishuAuth('test-app-id', 'test-app-secret');
    docClient = new FeishuDocClient(feishuAuth);
    botClient = new FeishuBotClient(feishuAuth);
    analyzer = new ContentAnalyzer(llm);

    // 初始化工具依赖
    initializeToolDependencies(feishuAuth, docClient, botClient, analyzer);
  });

  it('should create MainAgent successfully', () => {
    const configDocUrl = 'https://feishu.cn/docx/test123';
    const mainAgent = createMainAgent(llm, docClient, configDocUrl);

    expect(mainAgent).toBeDefined();
    expect(typeof mainAgent.invoke).toBe('function');
  });

  it('should have correct agent structure', () => {
    const configDocUrl = 'https://feishu.cn/docx/test123';
    const mainAgent = createMainAgent(llm, docClient, configDocUrl);

    // deepagentsjs agent 应该有 invoke 方法
    expect(mainAgent.invoke).toBeDefined();
  });
});
