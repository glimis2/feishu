# 飞书学员监督平台设计文档

**日期**: 2026-05-27  
**项目**: feishuagent  
**目标**: 构建自动化学员学习监督系统，每晚统计学习日报并提醒未提交学员

## 一、系统概述

基于deepagentjs框架和langchainjs的多Agent协作系统，实现学员学习日报的自动收集、分析和提醒功能。系统每晚8:00自动运行，无需数据库，所有数据序列化到本地文件。

## 二、系统架构

### 2.1 三Agent协作模型

**MainAgent（主调度Agent）**
- 职责：定时触发、任务编排、结果汇总
- 启动流程：读取配置 → 并行调度CollectorAgent和ReminderAgent → 汇总结果 → 生成最终报告
- 状态管理：维护任务执行历史、学员统计记录

**CollectorAgent（文档收集Agent）**
- 职责：批量并行读取飞书文档、内容分析、提取学习数据
- 输入：学员文档URL列表
- 输出：每个学员的学习总结（学会的内容、不会的内容、疑问问题）+ 文档状态（已更新/未更新）
- 并行策略：为每个文档创建独立的异步任务，同时执行多个文档读取

**ReminderAgent（提醒Agent）**
- 职责：批量并行向未提交学员发送飞书消息提醒
- 输入：未提交学员列表（姓名、飞书ID等）
- 输出：每个学员的提醒发送结果
- 并行策略：同时向多个学员发送提醒消息

### 2.2 Agent间通信

使用本地JSON文件作为消息队列和结果存储：
- 文件路径：`data/tasks/{task_id}.json`
- MainAgent创建任务文件，子Agent读取并更新状态
- 通过轮询文件状态实现同步

## 三、数据存储结构

### 3.1 目录结构

```
feishuagent/
├── config/
│   └── config.json          # 系统配置
├── data/
│   ├── tasks/               # 任务队列和执行状态
│   │   └── {task_id}.json   # 单个任务的状态和结果
│   ├── history/             # 历史记录
│   │   └── {date}.json      # 每日执行结果归档
│   └── students/            # 学员数据缓存
│       └── {student_id}.json # 学员的历史学习记录
├── logs/
│   └── {date}.log           # 运行日志
└── src/
    ├── agents/              # Agent实现
    │   ├── main_agent.ts
    │   ├── collector_agent.ts
    │   └── reminder_agent.ts
    ├── tools/               # 飞书API工具
    │   ├── feishu_doc.ts
    │   └── feishu_bot.ts
    └── scheduler/           # 定时任务
        └── cron_scheduler.ts
```

### 3.2 关键数据结构

**config/config.json**
```json
{
  "feishu": {
    "app_id": "cli_xxx",
    "app_secret": "xxx",
    "config_doc_url": "https://xxx.feishu.cn/docx/xxx"
  },
  "schedule": {
    "cron": "0 20 * * *",
    "timezone": "Asia/Shanghai"
  },
  "concurrency": {
    "max_collectors": 10,
    "max_reminders": 10
  }
}
```

**data/tasks/{task_id}.json**
```json
{
  "task_id": "20260527_200000_collect",
  "type": "collect",
  "status": "completed",
  "created_at": "2026-05-27T20:00:00",
  "completed_at": "2026-05-27T20:05:30",
  "input": {
    "student_docs": [
      {"student_id": "001", "name": "张三", "doc_url": "https://..."}
    ]
  },
  "output": {
    "results": [
      {
        "student_id": "001",
        "name": "张三",
        "status": "submitted",
        "summary": {
          "learned": ["Python基础语法", "列表推导式"],
          "not_learned": ["装饰器"],
          "questions": ["闭包的应用场景？"]
        }
      }
    ]
  },
  "errors": []
}
```

**data/history/{date}.json**
```json
{
  "date": "2026-05-27",
  "total_students": 30,
  "submitted": 25,
  "not_submitted": 5,
  "students": [
    {
      "student_id": "001",
      "name": "张三",
      "status": "submitted",
      "summary": {...}
    }
  ],
  "reminders_sent": 5,
  "execution_time": "5m 30s"
}
```

## 四、核心工作流程

### 4.1 每日执行流程（每晚8:00触发）

**步骤1: MainAgent启动**
1. 读取 `config/config.json` 获取飞书配置
2. 调用飞书API读取配置文档（包含学员文档URL列表）
3. 解析配置文档，提取学员信息（姓名、文档URL、飞书ID）
4. 创建两个任务文件：
   - `data/tasks/{timestamp}_collect.json`
   - `data/tasks/{timestamp}_remind.json`

**步骤2: CollectorAgent批量收集（并行执行）**
1. 读取任务文件获取学员文档URL列表
2. 使用Promise.all并行处理每个文档：
   - 调用飞书API获取文档内容和最后修改时间
   - 判断文档状态：
     - 最后修改时间是今天 → 调用AI分析内容
     - 最后修改时间不是今天 → 标记为"未提交"
3. AI分析prompt：
   ```
   分析以下学习日报，提取结构化信息：
   1. 学会的内容（列表形式）
   2. 不会的内容（列表形式）
   3. 疑问的问题（列表形式）
   
   文档内容：
   {doc_content}
   
   输出JSON格式。
   ```
4. 将所有结果写入 `data/tasks/{timestamp}_collect.json`

**步骤3: ReminderAgent批量提醒（并行执行）**
1. 等待CollectorAgent完成（轮询任务文件状态）
2. 读取收集结果，筛选出"未提交"学员列表
3. 使用Promise.all并行发送飞书消息：
   - 消息内容："【学习日报提醒】请及时提交今天的学习日报"
   - 通过飞书机器人webhook或消息API发送
4. 将发送结果写入 `data/tasks/{timestamp}_remind.json`

**步骤4: MainAgent汇总**
1. 等待两个子Agent完成
2. 读取两个任务文件的结果
3. 生成汇总报告：
   - 统计总人数、已提交数、未提交数
   - 整合所有学员的学习总结
   - 记录提醒发送情况
4. 保存到 `data/history/{date}.json`
5. 记录执行日志到 `logs/{date}.log`

### 4.2 错误处理策略

**网络失败**
- 重试机制：每个API调用失败后重试3次，间隔2秒
- 失败后记录错误日志，继续处理其他学员
- 在最终报告中标注失败的学员

**文档权限问题**
- 捕获权限异常，记录到错误日志
- 标记该学员为"无法访问"状态
- 跳过该学员，继续处理其他学员

**Agent崩溃**
- MainAgent设置超时时间（30分钟）
- 超时后终止任务，记录错误状态
- 发送告警消息到管理员（可选）

**并发限流**
- 限制最大并发数（默认10个）
- 避免触发飞书API限流
- 使用信号量控制并发数量

## 五、技术实现细节

### 5.1 deepagentjs集成

**Agent架构说明**

deepagentsjs 提供了基于 LangGraph 的 Agent 框架，支持工具调用和状态管理。

**Agent定义**
```typescript
import { Agent } from 'deepagentsjs';
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({ 
  modelName: 'gpt-4',
  temperature: 0 
});

// MainAgent - 主调度Agent
const mainAgent = new Agent({
  name: 'MainAgent',
  llm,
  tools: [
    loadConfigTool,      // 加载配置文档
    parseConfigTool,     // 解析学员列表
    saveTaskTool,        // 保存任务状态
    saveDailyReportTool  // 保存每日报告
  ],
  systemPrompt: `你是主调度Agent，负责协调整个学员监督流程。
你的职责：
1. 从飞书文档加载学员配置
2. 调用CollectorAgent收集学员学习数据
3. 调用ReminderAgent向未提交学员发送提醒
4. 生成并保存每日报告

请按照工作流程顺序执行任务。`
});

// CollectorAgent - 文档收集Agent
const collectorAgent = new Agent({
  name: 'CollectorAgent',
  llm,
  tools: [
    fetchFeishuDocTool,    // 获取飞书文档内容
    analyzeContentTool,    // 分析学习内容
    validateDateTool       // 验证是否为今日报告
  ],
  systemPrompt: `你是文档收集Agent，负责批量收集和分析学员学习日报。
你的职责：
1. 读取每个学员的飞书文档
2. 判断文档是否为今日更新
3. 如果是今日报告，使用AI分析提取：学会的内容、不会的内容、疑问的问题
4. 返回每个学员的分析结果

使用并发处理提高效率，但要控制并发数量避免API限流。`
});

// ReminderAgent - 提醒Agent
const reminderAgent = new Agent({
  name: 'ReminderAgent',
  llm,
  tools: [
    sendFeishuMessageTool  // 发送飞书消息
  ],
  systemPrompt: `你是提醒Agent，负责向未提交学员发送学习日报提醒。
你的职责：
1. 接收未提交学员列表
2. 向每个学员发送飞书消息提醒
3. 返回发送结果

消息内容：【学习日报提醒】请及时提交今天的学习日报

使用并发发送提高效率，但要控制并发数量。`
});
```

**Agent工具定义**

每个Agent的工具都是标准的LangChain工具：

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// 示例：获取飞书文档工具
const fetchFeishuDocTool = new DynamicStructuredTool({
  name: 'fetch_feishu_doc',
  description: '获取飞书文档的内容和最后修改时间',
  schema: z.object({
    docUrl: z.string().describe('飞书文档URL')
  }),
  func: async ({ docUrl }) => {
    const documentId = extractDocumentId(docUrl);
    const docClient = new FeishuDocClient(feishuAuth);
    const content = await docClient.getDocContent(documentId);
    return JSON.stringify(content);
  }
});

// 示例：分析内容工具
const analyzeContentTool = new DynamicStructuredTool({
  name: 'analyze_content',
  description: '使用AI分析学习日报内容，提取学会的、不会的、疑问的内容',
  schema: z.object({
    content: z.string().describe('文档内容')
  }),
  func: async ({ content }) => {
    const analyzer = new ContentAnalyzer(llm);
    const summary = await analyzer.analyzeContent(content);
    return JSON.stringify(summary);
  }
});
```

**Agent执行流程**

```typescript
// 1. MainAgent启动每日任务
const mainResult = await mainAgent.invoke({
  input: '执行今日学员监督任务',
  config: {
    configDocUrl: 'https://feishu.cn/docx/xxx'
  }
});

// 2. MainAgent内部会调用CollectorAgent
// CollectorAgent使用工具收集每个学员的数据

// 3. MainAgent根据收集结果调用ReminderAgent
// ReminderAgent使用工具发送提醒消息

// 4. MainAgent生成并保存每日报告
```

### 5.2 定时任务实现

使用node-cron实现定时触发：
```typescript
import cron from 'node-cron';

// 每天20:00执行
cron.schedule('0 20 * * *', async () => {
  console.log('Starting daily monitor task...');
  await mainAgent.run();
}, {
  timezone: 'Asia/Shanghai'
});
```

### 5.3 飞书API集成

**文档读取**
- API: `GET /open-api/docx/v1/documents/{document_id}/content`
- 认证: Bearer token（通过app_id/app_secret获取）
- 返回: 文档内容（Markdown格式）和元数据（最后修改时间）

**消息发送**
- 方式1: 机器人webhook（简单，但需要用户在群里）
- 方式2: 消息API（灵活，可发送私聊消息）
- 消息格式: 文本消息或卡片消息

### 5.4 并行处理实现

使用p-limit实现并发控制：
```typescript
import pLimit from 'p-limit';

async function processStudent(student: Student): Promise<StudentResult> {
  // 读取文档
  const docContent = await fetchFeishuDoc(student.docUrl);
  // 分析内容
  const summary = await analyzeContent(docContent);
  return { studentId: student.id, summary };
}

async function batchCollect(students: Student[], maxConcurrency = 10): Promise<StudentResult[]> {
  const limit = pLimit(maxConcurrency);
  const tasks = students.map(s => limit(() => processStudent(s)));
  const results = await Promise.allSettled(tasks);
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<StudentResult>).value);
}
```

### 5.5 AI内容分析

**使用langchainjs进行内容分析**
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';

const analysisPrompt = ChatPromptTemplate.fromTemplate(`
分析以下学习日报，提取结构化信息：

1. 学会的内容：学员明确表示已掌握或理解的知识点
2. 不会的内容：学员表示困难或未掌握的知识点
3. 疑问的问题：学员提出的具体问题

文档内容：
{docContent}

{formatInstructions}
`);

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  learned: '学会的内容列表',
  not_learned: '不会的内容列表',
  questions: '疑问的问题列表'
});

async function analyzeContent(docContent: string) {
  const chain = analysisPrompt.pipe(llm).pipe(parser);
  return await chain.invoke({
    docContent,
    formatInstructions: parser.getFormatInstructions()
  });
}
```

**判断文档是否为当日学习记录**
```typescript
const validationPrompt = ChatPromptTemplate.fromTemplate(`
判断以下文档是否为今日（{today}）的学习日报：

文档内容：
{docContent}

文档最后修改时间：{lastModified}

判断标准：
1. 最后修改时间是今天
2. 内容中包含今日学习相关的描述

请回答：是 或 否
`);
```

## 六、部署和运行

### 6.1 环境要求

- Node.js 18+
- TypeScript 5+
- 依赖库：deepagentjs, langchainjs, @langchain/openai, node-cron, p-limit, axios

### 6.2 配置步骤

1. 安装依赖：`npm install` 或 `pnpm install`
2. 配置飞书应用：
   - 创建飞书企业自建应用
   - 获取app_id和app_secret
   - 配置权限：文档读取、消息发送
3. 编辑 `config/config.json`，填入飞书配置和OpenAI API Key
4. 准备配置文档：在飞书创建文档，列出学员信息

### 6.3 启动方式

**方式1: 开发模式**
```bash
npm run dev
# 或
tsx src/main.ts
```

**方式2: 生产模式**
```bash
npm run build
npm start
# 或
node dist/main.js
```

**方式3: 后台运行（Linux）**
```bash
nohup node dist/main.js > logs/app.log 2>&1 &
```

**方式4: 使用PM2管理（推荐）**
```bash
pm2 start dist/main.js --name feishuagent
pm2 save
pm2 startup
```

### 6.4 监控和维护

- 日志文件：`logs/{date}.log`
- 历史数据：`data/history/{date}.json`
- 定期清理旧日志（保留30天）
- 监控磁盘空间使用

## 七、扩展性考虑

### 7.1 可扩展点

1. **多种通知方式**：除了飞书，可扩展支持邮件、短信、企业微信
2. **自定义分析规则**：支持配置不同的内容分析prompt
3. **报表生成**：生成周报、月报等统计报表
4. **Web管理界面**：提供可视化配置和查看历史数据

### 7.2 性能优化

1. **缓存机制**：缓存飞书access_token，减少认证请求
2. **增量更新**：只处理有变化的文档
3. **分布式部署**：如果学员数量超过1000人，可考虑多实例部署

## 八、风险和限制

### 8.1 已知限制

- 飞书API限流：每分钟最多100次请求
- 文档解析：复杂格式（表格、图片）可能解析不完整
- 时区问题：需确保服务器时区与配置一致

### 8.2 风险缓解

- 并发控制：限制最大并发数避免限流
- 错误重试：网络失败自动重试
- 日志记录：详细记录所有操作便于排查问题

## 九、总结

本系统通过三Agent协作模型，实现了学员学习日报的自动化监督。核心优势：

1. **无数据库依赖**：所有数据序列化到本地文件，部署简单
2. **并行处理**：批量并发处理提高效率
3. **容错性强**：完善的错误处理机制
4. **易于扩展**：模块化设计便于功能扩展

系统适用于中小规模学员管理（<500人），能够有效减少人工统计工作量，提高学员学习监督效率。
