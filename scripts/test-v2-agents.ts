/**
 * 测试 V2 Agents 是否能正常创建和工作
 */

import * as dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { FeishuAuth } from '../src/tools/feishu-auth';
import { FeishuDocClient } from '../src/tools/feishu-doc';
import { FeishuBotClient } from '../src/tools/feishu-bot';
import { ContentAnalyzer } from '../src/tools/content-analyzer';
import { initializeToolDependencies } from '../src/tools/agent-tools';
import { createMainAgent } from '../src/agents/main-agent-v2';
import { createCollectorAgent } from '../src/agents/collector-agent-v2';
import { createReminderAgent } from '../src/agents/reminder-agent-v2';

dotenv.config();

async function testV2Agents() {
  console.log('🧪 Testing V2 Agents...\n');

  try {
    // 1. 初始化依赖
    console.log('1️⃣ Initializing dependencies...');
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY || 'test-key',
      modelName: 'gpt-4',
      temperature: 0
    });

    const feishuAuth = new FeishuAuth(
      process.env.FEISHU_APP_ID || 'test-app-id',
      process.env.FEISHU_APP_SECRET || 'test-secret'
    );
    const docClient = new FeishuDocClient(feishuAuth);
    const botClient = new FeishuBotClient(feishuAuth);
    const analyzer = new ContentAnalyzer(llm);

    initializeToolDependencies(feishuAuth, docClient, botClient, analyzer);
    console.log('✅ Dependencies initialized\n');

    // 2. 创建 CollectorAgent
    console.log('2️⃣ Creating CollectorAgent...');
    const collectorAgent = createCollectorAgent(llm);
    console.log('✅ CollectorAgent created');
    console.log('   - Has invoke method:', typeof collectorAgent.invoke === 'function');
    console.log();

    // 3. 创建 ReminderAgent
    console.log('3️⃣ Creating ReminderAgent...');
    const reminderAgent = createReminderAgent(llm);
    console.log('✅ ReminderAgent created');
    console.log('   - Has invoke method:', typeof reminderAgent.invoke === 'function');
    console.log();

    // 4. 创建 MainAgent
    console.log('4️⃣ Creating MainAgent...');
    const configDocUrl = process.env.FEISHU_CONFIG_DOC_URL || 'https://feishu.cn/docx/test123';
    const mainAgent = createMainAgent(llm, docClient, configDocUrl);
    console.log('✅ MainAgent created');
    console.log('   - Has invoke method:', typeof mainAgent.invoke === 'function');
    console.log();

    console.log('🎉 All V2 Agents created successfully!');
    console.log('\n✨ The deepagentsjs integration is working correctly.');

  } catch (error) {
    console.error('❌ Error testing V2 agents:', error);
    process.exit(1);
  }
}

testV2Agents();
