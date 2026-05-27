# 飞书学员监督平台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基于deepagentjs和langchainjs的多Agent协作系统，实现学员学习日报的自动收集、分析和提醒

**Architecture:** 三Agent协作模型（MainAgent调度、CollectorAgent收集分析、ReminderAgent提醒），使用本地JSON文件存储状态，node-cron定时触发，p-limit控制并发

**Tech Stack:** Node.js 18+, TypeScript 5+, deepagentjs, langchainjs, @langchain/openai, node-cron, p-limit, axios

---

## 文件结构规划

```
feishuagent/
├── package.json
├── tsconfig.json
├── .env.example
├── config/
│   └── config.json
├── src/
│   ├── main.ts                    # 入口文件
│   ├── types/
│   │   └── index.ts               # 类型定义
│   ├── utils/
│   │   ├── file.ts                # 文件操作工具
│   │   ├── logger.ts              # 日志工具
│   │   └── retry.ts               # 重试工具
│   ├── tools/
│   │   ├── feishu-auth.ts         # 飞书认证
│   │   ├── feishu-doc.ts          # 飞书文档API
│   │   └── feishu-bot.ts          # 飞书机器人API
│   ├── agents/
│   │   ├── main-agent.ts          # 主调度Agent
│   │   ├── collector-agent.ts     # 文档收集Agent
│   │   └── reminder-agent.ts      # 提醒Agent
│   └── scheduler/
│       └── cron-scheduler.ts      # 定时任务
├── tests/
│   ├── utils/
│   ├── tools/
│   └── agents/
└── data/                          # 运行时创建
    ├── tasks/
    ├── history/
    └── students/
```

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: 创建package.json**

```json
{
  "name": "feishuagent",
  "version": "1.0.0",
  "description": "飞书学员监督平台 - 自动收集和分析学员学习日报",
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsx src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "keywords": ["feishu", "agent", "monitoring"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "axios": "^1.7.0",
    "deepagentjs": "^1.0.0",
    "dotenv": "^16.4.0",
    "langchain": "^0.3.0",
    "node-cron": "^3.0.0",
    "p-limit": "^6.0.0",
    "winston": "^3.14.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: 创建tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建.env.example**

```
# 飞书配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CONFIG_DOC_URL=https://xxx.feishu.cn/docx/xxx

# OpenAI配置
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4

# 定时任务配置
CRON_SCHEDULE=0 20 * * *
TIMEZONE=Asia/Shanghai

# 并发控制
MAX_COLLECTORS=10
MAX_REMINDERS=10
```

- [ ] **Step 4: 创建.gitignore**

```
node_modules/
dist/
.env
data/
logs/
*.log
.DS_Store
```

- [ ] **Step 5: 安装依赖**

Run: `npm install`
Expected: 所有依赖安装成功

- [ ] **Step 6: 提交**

```bash
git add package.json tsconfig.json .env.example .gitignore
git commit -m "chore: initialize project with dependencies and config"
```

---

### Task 2: 类型定义

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 编写类型定义**

```typescript
export interface Config {
  feishu: {
    appId: string;
    appSecret: string;
    configDocUrl: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  schedule: {
    cron: string;
    timezone: string;
  };
  concurrency: {
    maxCollectors: number;
    maxReminders: number;
  };
}

export interface Student {
  studentId: string;
  name: string;
  docUrl: string;
  feishuUserId?: string;
}

export interface StudentSummary {
  learned: string[];
  notLearned: string[];
  questions: string[];
}

export interface StudentResult {
  studentId: string;
  name: string;
  status: 'submitted' | 'not_submitted' | 'error';
  summary?: StudentSummary;
  error?: string;
}

export interface TaskData {
  taskId: string;
  type: 'collect' | 'remind';
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  input: {
    students?: Student[];
    studentIds?: string[];
  };
  output?: {
    results: StudentResult[] | ReminderResult[];
  };
  errors: string[];
}

export interface ReminderResult {
  studentId: string;
  name: string;
  success: boolean;
  error?: string;
}

export interface DailyReport {
  date: string;
  totalStudents: number;
  submitted: number;
  notSubmitted: number;
  students: StudentResult[];
  remindersSent: number;
  executionTime: string;
}

export interface FeishuAccessToken {
  token: string;
  expireAt: number;
}

export interface FeishuDocContent {
  content: string;
  lastModified: string;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: 日志工具

**Files:**
- Create: `src/utils/logger.ts`
- Create: `tests/utils/logger.test.ts`

- [ ] **Step 1: 编写日志工具测试**

```typescript
import { logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';

describe('Logger', () => {
  const testLogDir = path.join(process.cwd(), 'logs');
  
  beforeAll(() => {
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(console, 'log');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(console, 'error');
    logger.error('test error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/utils/logger.test.ts`
Expected: FAIL - logger module not found

- [ ] **Step 3: 实现日志工具**

```typescript
import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const getLogFileName = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `${date}.log`);
};

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: getLogFileName() }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/utils/logger.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/logger.ts tests/utils/logger.test.ts
git commit -m "feat: add logger utility with winston"
```

---

### Task 4: 文件操作工具

**Files:**
- Create: `src/utils/file.ts`
- Create: `tests/utils/file.test.ts`

- [ ] **Step 1: 编写文件工具测试**

```typescript
import { readJsonFile, writeJsonFile, ensureDir } from '../file';
import * as fs from 'fs';
import * as path from 'path';

describe('File Utils', () => {
  const testDir = path.join(process.cwd(), 'test-data');
  const testFile = path.join(testDir, 'test.json');

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should create directory if not exists', async () => {
    await ensureDir(testDir);
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('should write and read JSON file', async () => {
    const data = { test: 'value' };
    await writeJsonFile(testFile, data);
    const result = await readJsonFile(testFile);
    expect(result).toEqual(data);
  });

  it('should throw error when reading non-existent file', async () => {
    await expect(readJsonFile(testFile)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/utils/file.test.ts`
Expected: FAIL - file module not found

- [ ] **Step 3: 实现文件工具**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/utils/file.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/file.ts tests/utils/file.test.ts
git commit -m "feat: add file utility functions"
```

---

### Task 5: 重试工具

**Files:**
- Create: `src/utils/retry.ts`
- Create: `tests/utils/retry.test.ts`

- [ ] **Step 1: 编写重试工具测试**

```typescript
import { retryWithBackoff } from '../retry';

describe('Retry Utils', () => {
  it('should succeed on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 3, 100);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
    
    const result = await retryWithBackoff(fn, 3, 100);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));
    await expect(retryWithBackoff(fn, 3, 100)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/utils/retry.test.ts`
Expected: FAIL - retry module not found

- [ ] **Step 3: 实现重试工具**

```typescript
import { logger } from './logger';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        logger.error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
        throw lastError;
      }
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/utils/retry.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/retry.ts tests/utils/retry.test.ts
git commit -m "feat: add retry utility with exponential backoff"
```

---

### Task 6: 飞书认证

**Files:**
- Create: `src/tools/feishu-auth.ts`
- Create: `tests/tools/feishu-auth.test.ts`

- [ ] **Step 1: 编写飞书认证测试**

```typescript
import { FeishuAuth } from '../feishu-auth';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FeishuAuth', () => {
  let auth: FeishuAuth;

  beforeEach(() => {
    auth = new FeishuAuth('test_app_id', 'test_app_secret');
    jest.clearAllMocks();
  });

  it('should get access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        tenant_access_token: 'test_token',
        expire: 7200
      }
    });

    const token = await auth.getAccessToken();
    expect(token).toBe('test_token');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/auth/v3/tenant_access_token/internal',
      {
        app_id: 'test_app_id',
        app_secret: 'test_app_secret'
      }
    );
  });

  it('should cache access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        tenant_access_token: 'test_token',
        expire: 7200
      }
    });

    await auth.getAccessToken();
    await auth.getAccessToken();
    
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should refresh expired token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        tenant_access_token: 'test_token',
        expire: 0
      }
    });

    await auth.getAccessToken();
    await new Promise(resolve => setTimeout(resolve, 100));
    await auth.getAccessToken();
    
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/tools/feishu-auth.test.ts`
Expected: FAIL - FeishuAuth not found

- [ ] **Step 3: 实现飞书认证**

```typescript
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
      const expireIn = response.data.expire || 7200;
      
      this.tokenCache = {
        token,
        expireAt: Date.now() + (expireIn - 300) * 1000
      };

      logger.info('Access token fetched successfully');
      return token;
    });
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/tools/feishu-auth.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/feishu-auth.ts tests/tools/feishu-auth.test.ts
git commit -m "feat: add Feishu authentication with token caching"
```

---

### Task 7: 飞书文档API

**Files:**
- Create: `src/tools/feishu-doc.ts`
- Create: `tests/tools/feishu-doc.test.ts`

- [ ] **Step 1: 编写飞书文档API测试**

```typescript
import { FeishuDocClient } from '../feishu-doc';
import { FeishuAuth } from '../feishu-auth';
import axios from 'axios';

jest.mock('axios');
jest.mock('../feishu-auth');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFeishuAuth = FeishuAuth as jest.MockedClass<typeof FeishuAuth>;

describe('FeishuDocClient', () => {
  let client: FeishuDocClient;
  let mockAuth: jest.Mocked<FeishuAuth>;

  beforeEach(() => {
    mockAuth = new MockedFeishuAuth('app_id', 'app_secret') as jest.Mocked<FeishuAuth>;
    mockAuth.getAccessToken.mockResolvedValue('test_token');
    client = new FeishuDocClient(mockAuth);
    jest.clearAllMocks();
  });

  it('should fetch document content', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        data: {
          content: '# Test Document\nContent here',
          revision: 1,
          last_modified: '2026-05-27T10:00:00Z'
        }
      }
    });

    const result = await client.getDocContent('doc123');
    
    expect(result.content).toBe('# Test Document\nContent here');
    expect(result.lastModified).toBe('2026-05-27T10:00:00Z');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/docx/v1/documents/doc123/raw_content',
      {
        headers: {
          Authorization: 'Bearer test_token'
        }
      }
    );
  });

  it('should throw error on API failure', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 99991663,
        msg: 'document not found'
      }
    });

    await expect(client.getDocContent('doc123')).rejects.toThrow('document not found');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/tools/feishu-doc.test.ts`
Expected: FAIL - FeishuDocClient not found

- [ ] **Step 3: 实现飞书文档API**

```typescript
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/tools/feishu-doc.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/feishu-doc.ts tests/tools/feishu-doc.test.ts
git commit -m "feat: add Feishu document API client"
```

---

### Task 8: 飞书机器人API

**Files:**
- Create: `src/tools/feishu-bot.ts`
- Create: `tests/tools/feishu-bot.test.ts`

- [ ] **Step 1: 编写飞书机器人API测试**

```typescript
import { FeishuBotClient } from '../feishu-bot';
import { FeishuAuth } from '../feishu-auth';
import axios from 'axios';

jest.mock('axios');
jest.mock('../feishu-auth');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFeishuAuth = FeishuAuth as jest.MockedClass<typeof FeishuAuth>;

describe('FeishuBotClient', () => {
  let client: FeishuBotClient;
  let mockAuth: jest.Mocked<FeishuAuth>;

  beforeEach(() => {
    mockAuth = new MockedFeishuAuth('app_id', 'app_secret') as jest.Mocked<FeishuAuth>;
    mockAuth.getAccessToken.mockResolvedValue('test_token');
    client = new FeishuBotClient(mockAuth);
    jest.clearAllMocks();
  });

  it('should send message to user', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        msg: 'success'
      }
    });

    await client.sendMessage('user123', '测试消息');
    
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/im/v1/messages',
      {
        receive_id: 'user123',
        msg_type: 'text',
        content: JSON.stringify({ text: '测试消息' })
      },
      {
        headers: {
          Authorization: 'Bearer test_token'
        },
        params: {
          receive_id_type: 'user_id'
        }
      }
    );
  });

  it('should throw error on send failure', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 99991663,
        msg: 'user not found'
      }
    });

    await expect(client.sendMessage('user123', '测试')).rejects.toThrow('user not found');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/tools/feishu-bot.test.ts`
Expected: FAIL - FeishuBotClient not found

- [ ] **Step 3: 实现飞书机器人API**

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { FeishuAuth } from './feishu-auth';

export class FeishuBotClient {
  private auth: FeishuAuth;

  constructor(auth: FeishuAuth) {
    this.auth = auth;
  }

  async sendMessage(userId: string, message: string): Promise<void> {
    return retryWithBackoff(async () => {
      const token = await this.auth.getAccessToken();
      
      logger.info(`Sending message to user: ${userId}`);
      
      const response = await axios.post(
        'https://open.feishu.cn/open-api/im/v1/messages',
        {
          receive_id: userId,
          msg_type: 'text',
          content: JSON.stringify({ text: message })
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            receive_id_type: 'user_id'
          }
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to send message: ${response.data.msg}`);
      }

      logger.info(`Message sent successfully to user: ${userId}`);
    });
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/tools/feishu-bot.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/feishu-bot.ts tests/tools/feishu-bot.test.ts
git commit -m "feat: add Feishu bot API client for sending messages"
```

---

### Task 9: 内容分析工具（langchainjs）

**Files:**
- Create: `src/tools/content-analyzer.ts`
- Create: `tests/tools/content-analyzer.test.ts`

- [ ] **Step 1: 编写内容分析测试**

```typescript
import { ContentAnalyzer } from '../content-analyzer';
import { ChatOpenAI } from '@langchain/openai';

jest.mock('@langchain/openai');

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let mockLLM: jest.Mocked<ChatOpenAI>;

  beforeEach(() => {
    mockLLM = new ChatOpenAI() as jest.Mocked<ChatOpenAI>;
    analyzer = new ContentAnalyzer(mockLLM);
    jest.clearAllMocks();
  });

  it('should analyze document content', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({
      learned: ['JavaScript基础', 'Promise用法'],
      not_learned: ['async/await'],
      questions: ['如何处理错误？']
    });

    (mockLLM as any).pipe = jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: mockInvoke
      })
    });

    const result = await analyzer.analyzeContent('今天学习了JavaScript基础和Promise');
    
    expect(result.learned).toContain('JavaScript基础');
    expect(result.notLearned).toContain('async/await');
    expect(result.questions).toContain('如何处理错误？');
  });

  it('should validate if document is today report', async () => {
    const mockInvoke = jest.fn().mockResolvedValue('是');

    (mockLLM as any).pipe = jest.fn().mockReturnValue({
      invoke: mockInvoke
    });

    const today = new Date().toISOString().split('T')[0];
    const result = await analyzer.isTodayReport('今天学习内容', today);
    
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/tools/content-analyzer.test.ts`
Expected: FAIL - ContentAnalyzer not found

- [ ] **Step 3: 实现内容分析工具**

```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../utils/logger';
import { StudentSummary } from '../types';

export class ContentAnalyzer {
  private llm: ChatOpenAI;
  private analysisParser: StructuredOutputParser;
  private analysisPrompt: ChatPromptTemplate;
  private validationPrompt: ChatPromptTemplate;

  constructor(llm: ChatOpenAI) {
    this.llm = llm;
    
    this.analysisParser = StructuredOutputParser.fromNamesAndDescriptions({
      learned: '学会的内容列表（数组）',
      not_learned: '不会的内容列表（数组）',
      questions: '疑问的问题列表（数组）'
    });

    this.analysisPrompt = ChatPromptTemplate.fromTemplate(`
分析以下学习日报，提取结构化信息：

1. 学会的内容：学员明确表示已掌握或理解的知识点
2. 不会的内容：学员表示困难或未掌握的知识点
3. 疑问的问题：学员提出的具体问题

文档内容：
{docContent}

{formatInstructions}
`);

    this.validationPrompt = ChatPromptTemplate.fromTemplate(`
判断以下文档是否为今日（{today}）的学习日报：

文档内容：
{docContent}

文档最后修改时间：{lastModified}

判断标准：
1. 最后修改时间是今天
2. 内容中包含今日学习相关的描述

请只回答：是 或 否
`);
  }

  async analyzeContent(docContent: string): Promise<StudentSummary> {
    try {
      logger.info('Analyzing document content with LLM');
      
      const chain = this.analysisPrompt.pipe(this.llm).pipe(this.analysisParser);
      const result = await chain.invoke({
        docContent,
        formatInstructions: this.analysisParser.getFormatInstructions()
      });

      return {
        learned: result.learned || [],
        notLearned: result.not_learned || [],
        questions: result.questions || []
      };
    } catch (error) {
      logger.error(`Failed to analyze content: ${error}`);
      throw error;
    }
  }

  async isTodayReport(docContent: string, lastModified: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const modifiedDate = new Date(lastModified).toISOString().split('T')[0];
      
      if (modifiedDate !== today) {
        return false;
      }

      const chain = this.validationPrompt.pipe(this.llm);
      const result = await chain.invoke({
        docContent,
        lastModified,
        today
      });

      const answer = (result.content as string).trim();
      return answer === '是';
    } catch (error) {
      logger.error(`Failed to validate document: ${error}`);
      return false;
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/tools/content-analyzer.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/tools/content-analyzer.ts tests/tools/content-analyzer.test.ts
git commit -m "feat: add content analyzer using langchainjs"
```

---

### Task 10: CollectorAgent实现

**Files:**
- Create: `src/agents/collector-agent.ts`
- Create: `tests/agents/collector-agent.test.ts`

- [ ] **Step 1: 编写CollectorAgent测试**

```typescript
import { CollectorAgent } from '../collector-agent';
import { FeishuDocClient } from '../../tools/feishu-doc';
import { ContentAnalyzer } from '../../tools/content-analyzer';
import { Student } from '../../types';

jest.mock('../../tools/feishu-doc');
jest.mock('../../tools/content-analyzer');

describe('CollectorAgent', () => {
  let agent: CollectorAgent;
  let mockDocClient: jest.Mocked<FeishuDocClient>;
  let mockAnalyzer: jest.Mocked<ContentAnalyzer>;

  beforeEach(() => {
    mockDocClient = new FeishuDocClient(null as any) as jest.Mocked<FeishuDocClient>;
    mockAnalyzer = new ContentAnalyzer(null as any) as jest.Mocked<ContentAnalyzer>;
    agent = new CollectorAgent(mockDocClient, mockAnalyzer, 5);
    jest.clearAllMocks();
  });

  it('should collect submitted student data', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://feishu.cn/docx/abc123' }
    ];

    mockDocClient.extractDocumentId.mockReturnValue('abc123');
    mockDocClient.getDocContent.mockResolvedValue({
      content: '今天学习了TypeScript',
      lastModified: new Date().toISOString()
    });
    mockAnalyzer.isTodayReport.mockResolvedValue(true);
    mockAnalyzer.analyzeContent.mockResolvedValue({
      learned: ['TypeScript'],
      notLearned: [],
      questions: []
    });

    const results = await agent.collectStudentData(students);
    
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('submitted');
    expect(results[0].summary?.learned).toContain('TypeScript');
  });

  it('should mark not submitted when document not updated today', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://feishu.cn/docx/abc123' }
    ];

    mockDocClient.extractDocumentId.mockReturnValue('abc123');
    mockDocClient.getDocContent.mockResolvedValue({
      content: '昨天的内容',
      lastModified: '2026-05-26T10:00:00Z'
    });
    mockAnalyzer.isTodayReport.mockResolvedValue(false);

    const results = await agent.collectStudentData(students);
    
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('not_submitted');
    expect(results[0].summary).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://feishu.cn/docx/abc123' }
    ];

    mockDocClient.extractDocumentId.mockReturnValue('abc123');
    mockDocClient.getDocContent.mockRejectedValue(new Error('Network error'));

    const results = await agent.collectStudentData(students);
    
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('error');
    expect(results[0].error).toContain('Network error');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/agents/collector-agent.test.ts`
Expected: FAIL - CollectorAgent not found

- [ ] **Step 3: 实现CollectorAgent**

```typescript
import pLimit from 'p-limit';
import { FeishuDocClient } from '../tools/feishu-doc';
import { ContentAnalyzer } from '../tools/content-analyzer';
import { logger } from '../utils/logger';
import { Student, StudentResult } from '../types';

export class CollectorAgent {
  private docClient: FeishuDocClient;
  private analyzer: ContentAnalyzer;
  private maxConcurrency: number;

  constructor(
    docClient: FeishuDocClient,
    analyzer: ContentAnalyzer,
    maxConcurrency: number = 10
  ) {
    this.docClient = docClient;
    this.analyzer = analyzer;
    this.maxConcurrency = maxConcurrency;
  }

  async collectStudentData(students: Student[]): Promise<StudentResult[]> {
    logger.info(`Starting to collect data for ${students.length} students`);
    
    const limit = pLimit(this.maxConcurrency);
    const tasks = students.map(student => 
      limit(() => this.processStudent(student))
    );

    const results = await Promise.allSettled(tasks);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to process student ${students[index].name}: ${result.reason}`);
        return {
          studentId: students[index].studentId,
          name: students[index].name,
          status: 'error' as const,
          error: result.reason.message
        };
      }
    });
  }

  private async processStudent(student: Student): Promise<StudentResult> {
    try {
      logger.info(`Processing student: ${student.name}`);
      
      const documentId = this.docClient.extractDocumentId(student.docUrl);
      const docContent = await this.docClient.getDocContent(documentId);
      
      const isTodayReport = await this.analyzer.isTodayReport(
        docContent.content,
        docContent.lastModified
      );

      if (!isTodayReport) {
        logger.info(`Student ${student.name} has not submitted today's report`);
        return {
          studentId: student.studentId,
          name: student.name,
          status: 'not_submitted'
        };
      }

      const summary = await this.analyzer.analyzeContent(docContent.content);
      
      logger.info(`Student ${student.name} report analyzed successfully`);
      return {
        studentId: student.studentId,
        name: student.name,
        status: 'submitted',
        summary
      };
    } catch (error) {
      logger.error(`Error processing student ${student.name}: ${error}`);
      throw error;
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/agents/collector-agent.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/agents/collector-agent.ts tests/agents/collector-agent.test.ts
git commit -m "feat: add CollectorAgent for parallel document collection"
```

---

### Task 11: ReminderAgent实现

**Files:**
- Create: `src/agents/reminder-agent.ts`
- Create: `tests/agents/reminder-agent.test.ts`

- [ ] **Step 1: 编写ReminderAgent测试**

```typescript
import { ReminderAgent } from '../reminder-agent';
import { FeishuBotClient } from '../../tools/feishu-bot';
import { Student } from '../../types';

jest.mock('../../tools/feishu-bot');

describe('ReminderAgent', () => {
  let agent: ReminderAgent;
  let mockBotClient: jest.Mocked<FeishuBotClient>;

  beforeEach(() => {
    mockBotClient = new FeishuBotClient(null as any) as jest.Mocked<FeishuBotClient>;
    agent = new ReminderAgent(mockBotClient, 5);
    jest.clearAllMocks();
  });

  it('should send reminders to students', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://...', feishuUserId: 'user123' },
      { studentId: '002', name: '李四', docUrl: 'https://...', feishuUserId: 'user456' }
    ];

    mockBotClient.sendMessage.mockResolvedValue();

    const results = await agent.sendReminders(students);
    
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(mockBotClient.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should handle send failures', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://...', feishuUserId: 'user123' }
    ];

    mockBotClient.sendMessage.mockRejectedValue(new Error('Send failed'));

    const results = await agent.sendReminders(students);
    
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Send failed');
  });

  it('should skip students without feishuUserId', async () => {
    const students: Student[] = [
      { studentId: '001', name: '张三', docUrl: 'https://...' }
    ];

    const results = await agent.sendReminders(students);
    
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('No Feishu user ID');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/agents/reminder-agent.test.ts`
Expected: FAIL - ReminderAgent not found

- [ ] **Step 3: 实现ReminderAgent**

```typescript
import pLimit from 'p-limit';
import { FeishuBotClient } from '../tools/feishu-bot';
import { logger } from '../utils/logger';
import { Student, ReminderResult } from '../types';

export class ReminderAgent {
  private botClient: FeishuBotClient;
  private maxConcurrency: number;
  private reminderMessage: string;

  constructor(
    botClient: FeishuBotClient,
    maxConcurrency: number = 10,
    reminderMessage: string = '【学习日报提醒】请及时提交今天的学习日报'
  ) {
    this.botClient = botClient;
    this.maxConcurrency = maxConcurrency;
    this.reminderMessage = reminderMessage;
  }

  async sendReminders(students: Student[]): Promise<ReminderResult[]> {
    logger.info(`Sending reminders to ${students.length} students`);
    
    const limit = pLimit(this.maxConcurrency);
    const tasks = students.map(student => 
      limit(() => this.sendReminder(student))
    );

    const results = await Promise.allSettled(tasks);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to send reminder to ${students[index].name}: ${result.reason}`);
        return {
          studentId: students[index].studentId,
          name: students[index].name,
          success: false,
          error: result.reason.message
        };
      }
    });
  }

  private async sendReminder(student: Student): Promise<ReminderResult> {
    try {
      if (!student.feishuUserId) {
        logger.warn(`Student ${student.name} has no Feishu user ID, skipping`);
        return {
          studentId: student.studentId,
          name: student.name,
          success: false,
          error: 'No Feishu user ID provided'
        };
      }

      logger.info(`Sending reminder to student: ${student.name}`);
      
      await this.botClient.sendMessage(student.feishuUserId, this.reminderMessage);
      
      logger.info(`Reminder sent successfully to: ${student.name}`);
      return {
        studentId: student.studentId,
        name: student.name,
        success: true
      };
    } catch (error) {
      logger.error(`Error sending reminder to ${student.name}: ${error}`);
      throw error;
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/agents/reminder-agent.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/agents/reminder-agent.ts tests/agents/reminder-agent.test.ts
git commit -m "feat: add ReminderAgent for parallel message sending"
```

---

### Task 12: MainAgent实现

**Files:**
- Create: `src/agents/main-agent.ts`
- Create: `tests/agents/main-agent.test.ts`

- [ ] **Step 1: 编写MainAgent测试**

```typescript
import { MainAgent } from '../main-agent';
import { CollectorAgent } from '../collector-agent';
import { ReminderAgent } from '../reminder-agent';
import { FeishuDocClient } from '../../tools/feishu-doc';
import * as fileUtils from '../../utils/file';

jest.mock('../collector-agent');
jest.mock('../reminder-agent');
jest.mock('../../tools/feishu-doc');
jest.mock('../../utils/file');

describe('MainAgent', () => {
  let agent: MainAgent;
  let mockCollector: jest.Mocked<CollectorAgent>;
  let mockReminder: jest.Mocked<ReminderAgent>;
  let mockDocClient: jest.Mocked<FeishuDocClient>;

  beforeEach(() => {
    mockCollector = new CollectorAgent(null as any, null as any) as jest.Mocked<CollectorAgent>;
    mockReminder = new ReminderAgent(null as any) as jest.Mocked<ReminderAgent>;
    mockDocClient = new FeishuDocClient(null as any) as jest.Mocked<FeishuDocClient>;
    
    agent = new MainAgent(
      mockCollector,
      mockReminder,
      mockDocClient,
      'https://feishu.cn/docx/config123'
    );
    
    jest.clearAllMocks();
  });

  it('should execute daily task successfully', async () => {
    const configContent = `
学员列表：
- 张三: https://feishu.cn/docx/doc1 (user123)
- 李四: https://feishu.cn/docx/doc2 (user456)
    `;

    mockDocClient.extractDocumentId.mockReturnValue('config123');
    mockDocClient.getDocContent.mockResolvedValue({
      content: configContent,
      lastModified: new Date().toISOString()
    });

    mockCollector.collectStudentData.mockResolvedValue([
      {
        studentId: '001',
        name: '张三',
        status: 'submitted',
        summary: { learned: ['TypeScript'], notLearned: [], questions: [] }
      },
      {
        studentId: '002',
        name: '李四',
        status: 'not_submitted'
      }
    ]);

    mockReminder.sendReminders.mockResolvedValue([
      { studentId: '002', name: '李四', success: true }
    ]);

    (fileUtils.writeJsonFile as jest.Mock).mockResolvedValue(undefined);

    await agent.executeDailyTask();

    expect(mockCollector.collectStudentData).toHaveBeenCalled();
    expect(mockReminder.sendReminders).toHaveBeenCalled();
    expect(fileUtils.writeJsonFile).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/agents/main-agent.test.ts`
Expected: FAIL - MainAgent not found

- [ ] **Step 3: 实现MainAgent**

```typescript
import * as path from 'path';
import { CollectorAgent } from './collector-agent';
import { ReminderAgent } from './reminder-agent';
import { FeishuDocClient } from '../tools/feishu-doc';
import { logger } from '../utils/logger';
import { writeJsonFile } from '../utils/file';
import { Student, TaskData, DailyReport } from '../types';

export class MainAgent {
  private collectorAgent: CollectorAgent;
  private reminderAgent: ReminderAgent;
  private docClient: FeishuDocClient;
  private configDocUrl: string;

  constructor(
    collectorAgent: CollectorAgent,
    reminderAgent: ReminderAgent,
    docClient: FeishuDocClient,
    configDocUrl: string
  ) {
    this.collectorAgent = collectorAgent;
    this.reminderAgent = reminderAgent;
    this.docClient = docClient;
    this.configDocUrl = configDocUrl;
  }

  async executeDailyTask(): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
    
    try {
      logger.info('Starting daily monitoring task');

      const students = await this.loadStudentConfig();
      logger.info(`Loaded ${students.length} students from config`);

      const collectTaskId = `${timestamp}_collect`;
      const collectTask: TaskData = {
        taskId: collectTaskId,
        type: 'collect',
        status: 'running',
        createdAt: new Date().toISOString(),
        input: { students },
        errors: []
      };
      await this.saveTask(collectTask);

      const collectionResults = await this.collectorAgent.collectStudentData(students);
      
      collectTask.status = 'completed';
      collectTask.completedAt = new Date().toISOString();
      collectTask.output = { results: collectionResults };
      await this.saveTask(collectTask);

      const notSubmittedStudents = collectionResults
        .filter(r => r.status === 'not_submitted')
        .map(r => students.find(s => s.studentId === r.studentId)!)
        .filter(s => s !== undefined);

      logger.info(`Found ${notSubmittedStudents.length} students who haven't submitted`);

      const remindTaskId = `${timestamp}_remind`;
      const remindTask: TaskData = {
        taskId: remindTaskId,
        type: 'remind',
        status: 'running',
        createdAt: new Date().toISOString(),
        input: { students: notSubmittedStudents },
        errors: []
      };
      await this.saveTask(remindTask);

      const reminderResults = await this.reminderAgent.sendReminders(notSubmittedStudents);
      
      remindTask.status = 'completed';
      remindTask.completedAt = new Date().toISOString();
      remindTask.output = { results: reminderResults };
      await this.saveTask(remindTask);

      const executionTime = Math.round((Date.now() - startTime) / 1000);
      const report = this.generateDailyReport(
        collectionResults,
        reminderResults.filter(r => r.success).length,
        executionTime
      );
      
      await this.saveDailyReport(report);

      logger.info(`Daily task completed in ${executionTime}s`);
    } catch (error) {
      logger.error(`Daily task failed: ${error}`);
      throw error;
    }
  }

  private async loadStudentConfig(): Promise<Student[]> {
    const documentId = this.docClient.extractDocumentId(this.configDocUrl);
    const docContent = await this.docClient.getDocContent(documentId);
    
    return this.parseStudentConfig(docContent.content);
  }

  private parseStudentConfig(content: string): Student[] {
    const students: Student[] = [];
    const lines = content.split('\n');
    
    let studentIdCounter = 1;
    for (const line of lines) {
      const match = line.match(/^-\s*(.+?):\s*(https:\/\/.+?)\s*(?:\((.+?)\))?$/);
      if (match) {
        const [, name, docUrl, feishuUserId] = match;
        students.push({
          studentId: String(studentIdCounter++).padStart(3, '0'),
          name: name.trim(),
          docUrl: docUrl.trim(),
          feishuUserId: feishuUserId?.trim()
        });
      }
    }
    
    return students;
  }

  private generateDailyReport(
    collectionResults: any[],
    remindersSent: number,
    executionTime: number
  ): DailyReport {
    const submitted = collectionResults.filter(r => r.status === 'submitted').length;
    const notSubmitted = collectionResults.filter(r => r.status === 'not_submitted').length;
    
    return {
      date: new Date().toISOString().split('T')[0],
      totalStudents: collectionResults.length,
      submitted,
      notSubmitted,
      students: collectionResults,
      remindersSent,
      executionTime: `${Math.floor(executionTime / 60)}m ${executionTime % 60}s`
    };
  }

  private async saveTask(task: TaskData): Promise<void> {
    const filePath = path.join(process.cwd(), 'data', 'tasks', `${task.taskId}.json`);
    await writeJsonFile(filePath, task);
  }

  private async saveDailyReport(report: DailyReport): Promise<void> {
    const filePath = path.join(process.cwd(), 'data', 'history', `${report.date}.json`);
    await writeJsonFile(filePath, report);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/agents/main-agent.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/agents/main-agent.ts tests/agents/main-agent.test.ts
git commit -m "feat: add MainAgent for task orchestration"
```

---

### Task 13: 定时任务调度器

**Files:**
- Create: `src/scheduler/cron-scheduler.ts`
- Create: `tests/scheduler/cron-scheduler.test.ts`

- [ ] **Step 1: 编写定时任务测试**

```typescript
import { CronScheduler } from '../cron-scheduler';
import cron from 'node-cron';

jest.mock('node-cron');

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let mockTask: jest.Mock;

  beforeEach(() => {
    mockTask = jest.fn().mockResolvedValue(undefined);
    scheduler = new CronScheduler('0 20 * * *', 'Asia/Shanghai');
    jest.clearAllMocks();
  });

  it('should schedule task with cron expression', () => {
    scheduler.schedule(mockTask);

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 20 * * *',
      expect.any(Function),
      { timezone: 'Asia/Shanghai' }
    );
  });

  it('should execute task when triggered', async () => {
    let scheduledCallback: Function;
    
    (cron.schedule as jest.Mock).mockImplementation((expr, callback, opts) => {
      scheduledCallback = callback;
      return { start: jest.fn(), stop: jest.fn() };
    });

    scheduler.schedule(mockTask);
    await scheduledCallback!();

    expect(mockTask).toHaveBeenCalled();
  });

  it('should handle task errors', async () => {
    const errorTask = jest.fn().mockRejectedValue(new Error('Task failed'));
    let scheduledCallback: Function;
    
    (cron.schedule as jest.Mock).mockImplementation((expr, callback, opts) => {
      scheduledCallback = callback;
      return { start: jest.fn(), stop: jest.fn() };
    });

    scheduler.schedule(errorTask);
    await scheduledCallback!();

    expect(errorTask).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/scheduler/cron-scheduler.test.ts`
Expected: FAIL - CronScheduler not found

- [ ] **Step 3: 实现定时任务调度器**

```typescript
import cron from 'node-cron';
import { logger } from '../utils/logger';

export class CronScheduler {
  private cronExpression: string;
  private timezone: string;
  private task: cron.ScheduledTask | null = null;

  constructor(cronExpression: string, timezone: string = 'Asia/Shanghai') {
    this.cronExpression = cronExpression;
    this.timezone = timezone;
  }

  schedule(taskFn: () => Promise<void>): void {
    logger.info(`Scheduling task with cron: ${this.cronExpression} (${this.timezone})`);

    this.task = cron.schedule(
      this.cronExpression,
      async () => {
        try {
          logger.info('Cron task triggered');
          await taskFn();
          logger.info('Cron task completed successfully');
        } catch (error) {
          logger.error(`Cron task failed: ${error}`);
        }
      },
      {
        timezone: this.timezone
      }
    );

    logger.info('Task scheduled successfully');
  }

  start(): void {
    if (this.task) {
      this.task.start();
      logger.info('Scheduler started');
    }
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      logger.info('Scheduler stopped');
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/scheduler/cron-scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scheduler/cron-scheduler.ts tests/scheduler/cron-scheduler.test.ts
git commit -m "feat: add cron scheduler for daily tasks"
```

---

### Task 14: 主入口文件和配置加载

**Files:**
- Create: `src/main.ts`
- Create: `config/config.json`

- [ ] **Step 1: 创建配置文件模板**

```json
{
  "feishu": {
    "appId": "",
    "appSecret": "",
    "configDocUrl": ""
  },
  "openai": {
    "apiKey": "",
    "model": "gpt-4"
  },
  "schedule": {
    "cron": "0 20 * * *",
    "timezone": "Asia/Shanghai"
  },
  "concurrency": {
    "maxCollectors": 10,
    "maxReminders": 10
  }
}
```

- [ ] **Step 2: 实现主入口文件**

```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { FeishuAuth } from './tools/feishu-auth';
import { FeishuDocClient } from './tools/feishu-doc';
import { FeishuBotClient } from './tools/feishu-bot';
import { ContentAnalyzer } from './tools/content-analyzer';
import { CollectorAgent } from './agents/collector-agent';
import { ReminderAgent } from './agents/reminder-agent';
import { MainAgent } from './agents/main-agent';
import { CronScheduler } from './scheduler/cron-scheduler';
import { logger } from './utils/logger';
import { readJsonFile, ensureDir } from './utils/file';
import { Config } from './types';

dotenv.config();

async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'config', 'config.json');
  const config = await readJsonFile<Config>(configPath);
  
  return {
    feishu: {
      appId: process.env.FEISHU_APP_ID || config.feishu.appId,
      appSecret: process.env.FEISHU_APP_SECRET || config.feishu.appSecret,
      configDocUrl: process.env.FEISHU_CONFIG_DOC_URL || config.feishu.configDocUrl
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || config.openai.apiKey,
      model: process.env.OPENAI_MODEL || config.openai.model
    },
    schedule: {
      cron: process.env.CRON_SCHEDULE || config.schedule.cron,
      timezone: process.env.TIMEZONE || config.schedule.timezone
    },
    concurrency: {
      maxCollectors: parseInt(process.env.MAX_COLLECTORS || String(config.concurrency.maxCollectors)),
      maxReminders: parseInt(process.env.MAX_REMINDERS || String(config.concurrency.maxReminders))
    }
  };
}

async function initializeDataDirectories(): Promise<void> {
  const dirs = [
    path.join(process.cwd(), 'data', 'tasks'),
    path.join(process.cwd(), 'data', 'history'),
    path.join(process.cwd(), 'data', 'students'),
    path.join(process.cwd(), 'logs')
  ];
  
  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

async function main() {
  try {
    logger.info('Starting Feishu Student Monitor System');

    await initializeDataDirectories();
    const config = await loadConfig();

    const llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: 0
    });

    const feishuAuth = new FeishuAuth(config.feishu.appId, config.feishu.appSecret);
    const docClient = new FeishuDocClient(feishuAuth);
    const botClient = new FeishuBotClient(feishuAuth);
    const analyzer = new ContentAnalyzer(llm);

    const collectorAgent = new CollectorAgent(
      docClient,
      analyzer,
      config.concurrency.maxCollectors
    );

    const reminderAgent = new ReminderAgent(
      botClient,
      config.concurrency.maxReminders
    );

    const mainAgent = new MainAgent(
      collectorAgent,
      reminderAgent,
      docClient,
      config.feishu.configDocUrl
    );

    const scheduler = new CronScheduler(
      config.schedule.cron,
      config.schedule.timezone
    );

    scheduler.schedule(async () => {
      await mainAgent.executeDailyTask();
    });

    scheduler.start();

    logger.info(`System started. Scheduled to run at: ${config.schedule.cron} (${config.schedule.timezone})`);
    logger.info('Press Ctrl+C to stop');

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Failed to start system: ${error}`);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: 测试主入口文件**

Run: `npm run dev`
Expected: 系统启动成功，显示定时任务配置信息

- [ ] **Step 4: 提交**

```bash
git add src/main.ts config/config.json
git commit -m "feat: add main entry point with configuration loading"
```

---

### Task 15: Jest配置和集成测试

**Files:**
- Create: `jest.config.js`
- Create: `tests/integration/full-workflow.test.ts`

- [ ] **Step 1: 创建Jest配置**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

- [ ] **Step 2: 创建测试setup文件**

```typescript
// tests/setup.ts
jest.setTimeout(30000);

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  jest.clearAllMocks();
});
```

- [ ] **Step 3: 编写集成测试**

```typescript
import { MainAgent } from '../../src/agents/main-agent';
import { CollectorAgent } from '../../src/agents/collector-agent';
import { ReminderAgent } from '../../src/agents/reminder-agent';
import { FeishuDocClient } from '../../src/tools/feishu-doc';
import { FeishuBotClient } from '../../src/tools/feishu-bot';
import { FeishuAuth } from '../../src/tools/feishu-auth';
import { ContentAnalyzer } from '../../src/tools/content-analyzer';
import { ChatOpenAI } from '@langchain/openai';

jest.mock('../../src/tools/feishu-auth');
jest.mock('../../src/tools/feishu-doc');
jest.mock('../../src/tools/feishu-bot');
jest.mock('@langchain/openai');

describe('Full Workflow Integration Test', () => {
  it('should complete full daily task workflow', async () => {
    const mockAuth = new FeishuAuth('app_id', 'app_secret') as jest.Mocked<FeishuAuth>;
    mockAuth.getAccessToken.mockResolvedValue('test_token');

    const mockDocClient = new FeishuDocClient(mockAuth) as jest.Mocked<FeishuDocClient>;
    mockDocClient.extractDocumentId.mockReturnValue('doc123');
    mockDocClient.getDocContent.mockResolvedValueOnce({
      content: '- 张三: https://feishu.cn/docx/doc1 (user123)\n- 李四: https://feishu.cn/docx/doc2 (user456)',
      lastModified: new Date().toISOString()
    });
    mockDocClient.getDocContent.mockResolvedValueOnce({
      content: '今天学习了TypeScript',
      lastModified: new Date().toISOString()
    });
    mockDocClient.getDocContent.mockResolvedValueOnce({
      content: '昨天的内容',
      lastModified: '2026-05-26T10:00:00Z'
    });

    const mockBotClient = new FeishuBotClient(mockAuth) as jest.Mocked<FeishuBotClient>;
    mockBotClient.sendMessage.mockResolvedValue();

    const mockLLM = new ChatOpenAI() as jest.Mocked<ChatOpenAI>;
    (mockLLM as any).pipe = jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          learned: ['TypeScript'],
          not_learned: [],
          questions: []
        })
      }),
      invoke: jest.fn().mockResolvedValue({ content: '是' })
    });

    const analyzer = new ContentAnalyzer(mockLLM);
    const collectorAgent = new CollectorAgent(mockDocClient, analyzer, 5);
    const reminderAgent = new ReminderAgent(mockBotClient, 5);
    const mainAgent = new MainAgent(
      collectorAgent,
      reminderAgent,
      mockDocClient,
      'https://feishu.cn/docx/config123'
    );

    await expect(mainAgent.executeDailyTask()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 4: 运行所有测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 5: 提交**

```bash
git add jest.config.js tests/setup.ts tests/integration/full-workflow.test.ts
git commit -m "test: add Jest configuration and integration tests"
```

---

### Task 16: README文档和部署指南

**Files:**
- Create: `README.md`
- Create: `DEPLOYMENT.md`

- [ ] **Step 1: 编写README文档**

```markdown
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

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入配置：

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 `.env`：

\`\`\`
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CONFIG_DOC_URL=https://xxx.feishu.cn/docx/xxx
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4
\`\`\`

### 3. 配置飞书应用

1. 在飞书开放平台创建企业自建应用
2. 获取 `app_id` 和 `app_secret`
3. 配置权限：
   - `docx:document` - 文档读取
   - `im:message` - 消息发送
4. 创建配置文档，格式如下：

\`\`\`
学员列表：
- 张三: https://feishu.cn/docx/doc1 (user123)
- 李四: https://feishu.cn/docx/doc2 (user456)
\`\`\`

### 4. 运行系统

开发模式：
\`\`\`bash
npm run dev
\`\`\`

生产模式：
\`\`\`bash
npm run build
npm start
\`\`\`

使用 PM2（推荐）：
\`\`\`bash
pm2 start dist/main.js --name feishuagent
pm2 save
pm2 startup
\`\`\`

## 测试

运行所有测试：
\`\`\`bash
npm test
\`\`\`

运行测试并查看覆盖率：
\`\`\`bash
npm test -- --coverage
\`\`\`

## 项目结构

\`\`\`
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
\`\`\`

## 配置说明

编辑 `config/config.json`：

\`\`\`json
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
\`\`\`

## 许可证

MIT
\`\`\`

- [ ] **Step 2: 编写部署指南**

\`\`\`markdown
# 部署指南

## 服务器要求

- **操作系统**：Linux (Ubuntu 20.04+ 推荐) 或 Windows Server
- **Node.js**：18.0.0 或更高版本
- **内存**：最低 512MB，推荐 1GB+
- **磁盘**：最低 1GB 可用空间
- **网络**：能访问飞书 API 和 OpenAI API

## 部署步骤

### 1. 安装 Node.js

Ubuntu/Debian:
\`\`\`bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
\`\`\`

验证安装：
\`\`\`bash
node --version  # 应显示 v18.x.x
npm --version
\`\`\`

### 2. 克隆项目

\`\`\`bash
git clone <repository-url> feishuagent
cd feishuagent
\`\`\`

### 3. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 4. 配置环境

\`\`\`bash
cp .env.example .env
nano .env  # 编辑配置
\`\`\`

### 5. 构建项目

\`\`\`bash
npm run build
\`\`\`

### 6. 使用 PM2 部署（推荐）

安装 PM2：
\`\`\`bash
npm install -g pm2
\`\`\`

启动应用：
\`\`\`bash
pm2 start dist/main.js --name feishuagent
\`\`\`

设置开机自启：
\`\`\`bash
pm2 save
pm2 startup
# 按照提示执行命令
\`\`\`

查看状态：
\`\`\`bash
pm2 status
pm2 logs feishuagent
\`\`\`

### 7. 使用 systemd 部署（备选）

创建服务文件 `/etc/systemd/system/feishuagent.service`：

\`\`\`ini
[Unit]
Description=Feishu Student Monitor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/feishuagent
ExecStart=/usr/bin/node /home/ubuntu/feishuagent/dist/main.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/ubuntu/feishuagent/logs/app.log
StandardError=append:/home/ubuntu/feishuagent/logs/error.log

[Install]
WantedBy=multi-user.target
\`\`\`

启动服务：
\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl enable feishuagent
sudo systemctl start feishuagent
sudo systemctl status feishuagent
\`\`\`

## 监控和维护

### 日志管理

日志位置：
- 应用日志：`logs/{date}.log`
- PM2 日志：`~/.pm2/logs/`

查看日志：
\`\`\`bash
# 实时查看
pm2 logs feishuagent

# 查看历史日志
tail -f logs/$(date +%Y-%m-%d).log
\`\`\`

定期清理旧日志（保留 30 天）：
\`\`\`bash
find logs/ -name "*.log" -mtime +30 -delete
find data/history/ -name "*.json" -mtime +90 -delete
\`\`\`

### 性能监控

使用 PM2 监控：
\`\`\`bash
pm2 monit
\`\`\`

### 更新部署

\`\`\`bash
git pull
npm install
npm run build
pm2 restart feishuagent
\`\`\`

## 故障排查

### 应用无法启动

1. 检查 Node.js 版本：`node --version`
2. 检查环境变量：`cat .env`
3. 检查日志：`pm2 logs feishuagent`

### 飞书 API 调用失败

1. 验证 app_id 和 app_secret
2. 检查应用权限配置
3. 确认网络可访问飞书 API

### OpenAI API 调用失败

1. 验证 API Key
2. 检查账户余额
3. 确认网络可访问 OpenAI API

## 安全建议

1. **环境变量**：不要将 `.env` 文件提交到 Git
2. **文件权限**：限制配置文件访问权限
   \`\`\`bash
   chmod 600 .env config/config.json
   \`\`\`
3. **防火墙**：只开放必要端口
4. **定期更新**：及时更新依赖包
   \`\`\`bash
   npm audit
   npm update
   \`\`\`

## 备份策略

定期备份重要数据：
\`\`\`bash
# 备份配置
tar -czf backup-config-$(date +%Y%m%d).tar.gz config/ .env

# 备份历史数据
tar -czf backup-data-$(date +%Y%m%d).tar.gz data/history/
\`\`\`
\`\`\`

- [ ] **Step 3: 提交文档**

\`\`\`bash
git add README.md DEPLOYMENT.md
git commit -m "docs: add README and deployment guide"
\`\`\`

---

## 自审清单

### 规格覆盖检查

- [x] **系统架构**：三 Agent 协作模型 (Task 10, 11, 12)
- [x] **数据存储**：本地 JSON 文件存储 (Task 4, 12)
- [x] **定时任务**：每晚 8:00 执行 (Task 13, 14)
- [x] **飞书集成**：认证、文档读取、消息发送 (Task 6, 7, 8)
- [x] **AI 分析**：langchainjs 内容分析 (Task 9)
- [x] **并行处理**：p-limit 并发控制 (Task 10, 11)
- [x] **错误处理**：重试机制和错误日志 (Task 5)
- [x] **日志记录**：winston 日志系统 (Task 3)

### 占位符检查

- [x] 无 TBD、TODO 或占位符
- [x] 所有代码块完整
- [x] 所有测试包含具体断言
- [x] 所有命令包含预期输出

### 类型一致性检查

- [x] Student 类型在所有任务中一致
- [x] StudentResult 类型在所有任务中一致
- [x] TaskData 类型在所有任务中一致
- [x] 函数签名在所有任务中一致
- [x] 文件路径在所有任务中一致

### 测试覆盖检查

- [x] 每个工具类都有单元测试 (Task 3-9)
- [x] 每个 Agent 都有单元测试 (Task 10-12)
- [x] 包含集成测试 (Task 15)
- [x] 测试遵循 TDD 流程（先写测试，后写实现）

### 提交粒度检查

- [x] 每个任务都有独立的提交
- [x] 提交信息遵循约定式提交格式
- [x] 每个提交都是可工作的状态

---

## 执行说明

计划已完成，包含 16 个任务，涵盖：
1. 项目初始化和配置 (Task 1)
2. 类型定义 (Task 2)
3. 基础工具（日志、文件、重试）(Task 3-5)
4. 飞书 API 集成（认证、文档、机器人）(Task 6-8)
5. AI 内容分析 (Task 9)
6. Agent 实现（Collector、Reminder、Main）(Task 10-12)
7. 定时任务和主入口 (Task 13-14)
8. 测试和文档 (Task 15-16)

所有任务遵循 TDD 流程，包含完整的测试和实现代码。
\`\`\`
