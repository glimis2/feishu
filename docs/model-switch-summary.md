# 模型切换总结 - OpenAI → DeepSeek

## ✅ 完成的工作

### 1. 更新依赖和配置

#### 环境变量 (.env.example)
```bash
# 之前
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4

# 之后
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat
```

#### 配置文件 (config/config.json)
```json
{
  "deepseek": {
    "apiKey": "",
    "model": "deepseek-chat"
  }
}
```

### 2. 更新类型定义

**src/types/index.ts**
```typescript
export interface Config {
  feishu: { ... };
  deepseek: {  // 从 openai 改为 deepseek
    apiKey: string;
    model: string;
  };
  schedule: { ... };
  concurrency: { ... };
}
```

### 3. 更新主入口文件

**src/main.ts**
```typescript
// 导入
import { ChatDeepSeek } from '@langchain/deepseek';

// 配置加载
deepseek: {
  apiKey: process.env.DEEPSEEK_API_KEY || config.deepseek?.apiKey || '',
  model: process.env.DEEPSEEK_MODEL || config.deepseek?.model || 'deepseek-chat'
}

// LLM 初始化
const llm = new ChatDeepSeek({
  apiKey: config.deepseek.apiKey,
  model: config.deepseek.model,
  temperature: 0
});
```

### 4. 更新工具和 Agent 类型

**使用通用基类 `BaseChatModel`**

所有文件都从具体的 `ChatOpenAI` 改为通用的 `BaseChatModel`：

- `src/tools/content-analyzer.ts`
- `src/agents/collector-agent-v2.ts`
- `src/agents/reminder-agent-v2.ts`
- `src/agents/main-agent-v2.ts`

```typescript
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export function createCollectorAgent(llm: BaseChatModel) {
  // ...
}
```

**优势**：
- 支持任何 LangChain 兼容的 LLM
- 可以轻松切换到其他模型（Anthropic、Groq、Ollama 等）
- 不需要修改 agent 代码

### 5. 更新测试脚本

**scripts/test-v2-agents.ts**
```typescript
import { ChatDeepSeek } from '@langchain/deepseek';

const llm = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
  model: 'deepseek-chat',
  temperature: 0
});
```

## 📦 依赖包

项目已安装 `@langchain/deepseek`：

```json
{
  "dependencies": {
    "@langchain/deepseek": "^1.0.24",
    "@langchain/core": "^1.1.40",
    "deepagents": "^1.10.2"
  }
}
```

## ✅ 测试验证

```bash
npx tsx scripts/test-v2-agents.ts
```

**结果**：
```
✅ Dependencies initialized
✅ CollectorAgent created
✅ ReminderAgent created
✅ MainAgent created
🎉 All V2 Agents created successfully!
```

## 🔄 支持的模型

由于使用了 `BaseChatModel`，现在可以轻松切换到任何 LangChain 支持的模型：

### DeepSeek (当前)
```typescript
import { ChatDeepSeek } from '@langchain/deepseek';
const llm = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat'
});
```

### OpenAI
```typescript
import { ChatOpenAI } from '@langchain/openai';
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});
```

### Anthropic Claude
```typescript
import { ChatAnthropic } from '@langchain/anthropic';
const llm = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});
```

### Groq
```typescript
import { ChatGroq } from '@langchain/groq';
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.1-70b-versatile'
});
```

### Ollama (本地)
```typescript
import { ChatOllama } from '@langchain/ollama';
const llm = new ChatOllama({
  model: 'llama3',
  baseUrl: 'http://localhost:11434'
});
```

## 📝 配置示例

创建 `.env` 文件：

```bash
# 飞书配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CONFIG_DOC_URL=https://xxx.feishu.cn/docx/xxx

# DeepSeek配置
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# 定时任务配置
CRON_SCHEDULE=0 20 * * *
TIMEZONE=Asia/Shanghai

# 并发控制
MAX_COLLECTORS=10
MAX_REMINDERS=10
```

## 🚀 运行系统

```bash
npm run dev
```

## 📊 更新的文件列表

1. ✅ `.env.example` - 环境变量模板
2. ✅ `config/config.json` - 配置文件
3. ✅ `src/types/index.ts` - 类型定义
4. ✅ `src/main.ts` - 主入口
5. ✅ `src/tools/content-analyzer.ts` - 内容分析器
6. ✅ `src/agents/collector-agent-v2.ts` - 收集器 Agent
7. ✅ `src/agents/reminder-agent-v2.ts` - 提醒 Agent
8. ✅ `src/agents/main-agent-v2.ts` - 主 Agent
9. ✅ `scripts/test-v2-agents.ts` - 测试脚本

## 🎯 关键改进

1. **模型无关设计** - 使用 `BaseChatModel` 而不是具体实现
2. **易于切换** - 只需修改 main.ts 中的导入和初始化
3. **配置驱动** - 通过环境变量和配置文件控制
4. **向后兼容** - 保持了所有 API 接口不变

模型切换完成！🎉
