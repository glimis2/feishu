/**
 * MainAgent Tool Dependencies - MainAgent 工具依赖管理
 */

// MainAgent 依赖（在 MainAgent 创建时初始化）
let docClient: any;
let configDocUrl: string;
let collectorAgent: any;
let reminderAgent: any;

/**
 * 初始化 MainAgent 工具依赖
 */
export function initializeMainAgentTools(
  _docClient: any,
  _configDocUrl: string,
  _collectorAgent: any,
  _reminderAgent: any
) {
  docClient = _docClient;
  configDocUrl = _configDocUrl;
  collectorAgent = _collectorAgent;
  reminderAgent = _reminderAgent;
}

/**
 * 获取文档客户端
 */
export function getDocClient() {
  if (!docClient) {
    throw new Error('DocClient not initialized. Call initializeMainAgentTools first.');
  }
  return docClient;
}

/**
 * 获取配置文档 URL
 */
export function getConfigDocUrl() {
  if (!configDocUrl) {
    throw new Error('ConfigDocUrl not initialized. Call initializeMainAgentTools first.');
  }
  return configDocUrl;
}

/**
 * 获取 CollectorAgent
 */
export function getCollectorAgent() {
  if (!collectorAgent) {
    throw new Error('CollectorAgent not initialized. Call initializeMainAgentTools first.');
  }
  return collectorAgent;
}

/**
 * 获取 ReminderAgent
 */
export function getReminderAgent() {
  if (!reminderAgent) {
    throw new Error('ReminderAgent not initialized. Call initializeMainAgentTools first.');
  }
  return reminderAgent;
}
