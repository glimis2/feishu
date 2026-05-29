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
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

验证安装：
```bash
node --version  # 应显示 v18.x.x
npm --version
```

### 2. 克隆项目

```bash
git clone <repository-url> feishuagent
cd feishuagent
```

### 3. 安装依赖

```bash
npm install
```

### 4. 配置环境

```bash
cp .env.example .env
nano .env  # 编辑配置
```

### 5. 构建项目

```bash
npm run build
```

### 6. 使用 PM2 部署（推荐）

安装 PM2：
```bash
npm install -g pm2
```

启动应用：
```bash
pm2 start dist/main.js --name feishuagent
```

设置开机自启：
```bash
pm2 save
pm2 startup
# 按照提示执行命令
```

查看状态：
```bash
pm2 status
pm2 logs feishuagent
```

### 7. 使用 systemd 部署（备选）

创建服务文件 `/etc/systemd/system/feishuagent.service`：

```ini
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
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable feishuagent
sudo systemctl start feishuagent
sudo systemctl status feishuagent
```

## 配置飞书应用

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 记录 `App ID` 和 `App Secret`

### 2. 配置应用权限

在应用管理后台，添加以下权限：

- **文档权限**：
  - `docx:document` - 查看、评论和编辑文档
  - `docx:document:readonly` - 查看文档（只读）

- **消息权限**：
  - `im:message` - 获取与发送单聊、群组消息
  - `im:message:send_as_bot` - 以应用的身份发消息

### 3. 发布应用

1. 完成权限配置后，提交版本审核
2. 审核通过后，在企业内发布应用
3. 确保需要使用的用户已添加应用

### 4. 创建配置文档

在飞书中创建一个文档，格式如下：

```
学员列表：
- 张三: https://xxx.feishu.cn/docx/doc1 (ou_xxx)
- 李四: https://xxx.feishu.cn/docx/doc2 (ou_yyy)
- 王五: https://xxx.feishu.cn/docx/doc3
```

说明：
- 每行一个学员
- 格式：`- 姓名: 文档URL (飞书用户ID)`
- 飞书用户ID 可选，如果不提供则不会发送提醒
- 获取用户ID：在飞书管理后台 -> 通讯录 -> 查看用户详情

## 监控和维护

### 日志管理

日志位置：
- 应用日志：`logs/{date}.log`
- PM2 日志：`~/.pm2/logs/`

查看日志：
```bash
# 实时查看
pm2 logs feishuagent

# 查看历史日志
tail -f logs/$(date +%Y-%m-%d).log
```

定期清理旧日志（保留 30 天）：
```bash
find logs/ -name "*.log" -mtime +30 -delete
find data/history/ -name "*.json" -mtime +90 -delete
```

### 性能监控

使用 PM2 监控：
```bash
pm2 monit
```

### 更新部署

```bash
git pull
npm install
npm run build
pm2 restart feishuagent
```

## 故障排查

### 应用无法启动

1. 检查 Node.js 版本：`node --version`
2. 检查环境变量：`cat .env`
3. 检查日志：`pm2 logs feishuagent`
4. 检查配置文件：`cat config/config.json`

### 飞书 API 调用失败

1. 验证 app_id 和 app_secret
2. 检查应用权限配置
3. 确认应用已发布并添加用户
4. 确认网络可访问飞书 API
5. 检查文档 URL 格式是否正确

### OpenAI API 调用失败

1. 验证 API Key
2. 检查账户余额
3. 确认网络可访问 OpenAI API
4. 检查模型名称是否正确

### 定时任务未执行

1. 检查 cron 表达式：`config/config.json` 中的 `schedule.cron`
2. 检查时区设置：`schedule.timezone`
3. 查看日志确认任务是否触发
4. 确认应用进程正在运行：`pm2 status`

## 安全建议

1. **环境变量**：不要将 `.env` 文件提交到 Git
   ```bash
   echo ".env" >> .gitignore
   ```

2. **文件权限**：限制配置文件访问权限
   ```bash
   chmod 600 .env config/config.json
   ```

3. **防火墙**：只开放必要端口（如果需要远程访问）

4. **定期更新**：及时更新依赖包
   ```bash
   npm audit
   npm update
   ```

5. **API 密钥轮换**：定期更换飞书和 OpenAI 的密钥

## 备份策略

定期备份重要数据：

```bash
# 备份配置
tar -czf backup-config-$(date +%Y%m%d).tar.gz config/ .env

# 备份历史数据
tar -czf backup-data-$(date +%Y%m%d).tar.gz data/history/
```

建议设置定时备份任务（crontab）：

```bash
# 每天凌晨 2 点备份
0 2 * * * cd /path/to/feishuagent && tar -czf backup-data-$(date +\%Y\%m\%d).tar.gz data/history/
```

## 性能优化

### 并发控制

根据服务器性能调整并发数：

```json
{
  "concurrency": {
    "maxCollectors": 10,  // 增加可提高处理速度，但会增加内存使用
    "maxReminders": 10
  }
}
```

### 日志级别

生产环境可以调整日志级别以减少 I/O：

编辑 `src/utils/logger.ts`，将日志级别改为 `warn` 或 `error`。

### 内存限制

如果处理大量学员，可以增加 Node.js 内存限制：

```bash
pm2 start dist/main.js --name feishuagent --node-args="--max-old-space-size=2048"
```

## 常见问题

### Q: 如何修改定时任务执行时间？

A: 编辑 `config/config.json` 中的 `schedule.cron`，使用标准 cron 表达式。

### Q: 如何手动触发一次任务？

A: 暂时修改 cron 表达式为即将到来的时间，或者直接运行：
```bash
npm run dev
```

### Q: 如何添加新学员？

A: 在飞书配置文档中添加新行，系统会在下次执行时自动读取。

### Q: 如何查看历史报告？

A: 历史报告保存在 `data/history/` 目录，每天一个 JSON 文件。

## 技术支持

如有问题，请查看：
- 项目日志：`logs/` 目录
- 任务数据：`data/tasks/` 目录
- 历史记录：`data/history/` 目录
