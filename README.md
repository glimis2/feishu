# 飞书学员监督平台

基于 deepagentjs 和 langchainjs 的多 Agent 协作系统，自动收集、分析学员学习日报并发送提醒。

## 功能特性

- 🤖 **三 Agent 协作**：MainAgent 调度、CollectorAgent 收集分析、ReminderAgent 提醒
- 📊 **智能分析**：使用 LangChain 和 GPT-4 分析学习内容
- ⚡ **并行处理**：使用 p-limit 控制并发，高效处理大量学员
- ⏰ **定时任务**：每晚 8:00 自动执行统计和提醒
- 💾 **本地存储**：无需数据库，所有数据序列化到 JSON 文件
- 🔄 **错误重试**：网络失败自动重试，确保任务完成

## 技术栈

- **运行时**：Node.js 18+, TypeScript 5+
- **AI 框架**：deepagentjs, langchainjs, @langchain/openai
- **定时任务**：node-cron
- **并发控制**：p-limit
- **HTTP 客户端**：axios
- **日志**：winston
- **测试**：Jest, ts-jest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入配置：

```bash
cp .env.example .env
```

编辑 `.env`：

```
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CONFIG_DOC_URL=https://xxx.feishu.cn/docx/xxx
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4
```

### 3. 配置飞书应用

1. 在飞书开放平台创建企业自建应用
2. 获取 `app_id` 和 `app_secret`
3. 配置权限：
   - `docx:document` - 文档读取
   - `im:message` - 消息发送
4. 创建配置文档，格式如下：

```
学员列表：
- 张三: https://feishu.cn/docx/doc1 (user123)
- 李四: https://feishu.cn/docx/doc2 (user456)
```

### 4. 运行系统

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

使用 PM2（推荐）：
```bash
pm2 start dist/main.js --name feishuagent
pm2 save
pm2 startup
```

## 测试

运行所有测试：
```bash
npm test
```

运行测试并查看覆盖率：
```bash
npm test -- --coverage
```

## 项目结构

```
feishuagent/
├── src/
│   ├── agents/          # Agent 实现
│   ├── tools/           # 飞书 API 和工具
│   ├── utils/           # 工具函数
│   ├── scheduler/       # 定时任务
│   ├── types/           # TypeScript 类型
│   └── main.ts          # 入口文件
├── tests/               # 测试文件
├── config/              # 配置文件
├── data/                # 运行时数据
│   ├── tasks/           # 任务状态
│   ├── history/         # 历史记录
│   └── students/        # 学员数据
└── logs/                # 日志文件
```

## 配置说明

编辑 `config/config.json`：

```json
{
  "schedule": {
    "cron": "0 20 * * *",      // 每天 20:00 执行
    "timezone": "Asia/Shanghai"
  },
  "concurrency": {
    "maxCollectors": 10,        // 最大并发收集数
    "maxReminders": 10          // 最大并发提醒数
  }
}
```

## 许可证

MIT
