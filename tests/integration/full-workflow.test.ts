import { ChatOpenAI } from '@langchain/openai';
import { FeishuAuth } from '../../src/tools/feishu-auth';
import { FeishuDocClient } from '../../src/tools/feishu-doc';
import { FeishuBotClient } from '../../src/tools/feishu-bot';
import { ContentAnalyzer } from '../../src/tools/content-analyzer';
import { CollectorAgent } from '../../src/agents/collector-agent';
import { ReminderAgent } from '../../src/agents/reminder-agent';
import { MainAgent } from '../../src/agents/main-agent';
import { Student } from '../../src/types';

jest.mock('../../src/tools/feishu-auth');
jest.mock('../../src/tools/feishu-doc');
jest.mock('../../src/tools/feishu-bot');
jest.mock('@langchain/openai');

describe('Full Workflow Integration Tests', () => {
  let mockFeishuAuth: jest.Mocked<FeishuAuth>;
  let mockDocClient: jest.Mocked<FeishuDocClient>;
  let mockBotClient: jest.Mocked<FeishuBotClient>;
  let mockLLM: jest.Mocked<ChatOpenAI>;
  let analyzer: ContentAnalyzer;
  let collectorAgent: CollectorAgent;
  let reminderAgent: ReminderAgent;
  let mainAgent: MainAgent;

  beforeEach(() => {
    mockFeishuAuth = new FeishuAuth('test-app-id', 'test-secret') as jest.Mocked<FeishuAuth>;
    mockDocClient = new FeishuDocClient(mockFeishuAuth) as jest.Mocked<FeishuDocClient>;
    mockBotClient = new FeishuBotClient(mockFeishuAuth) as jest.Mocked<FeishuBotClient>;
    mockLLM = new ChatOpenAI({ openAIApiKey: 'test-key' }) as jest.Mocked<ChatOpenAI>;

    analyzer = new ContentAnalyzer(mockLLM);
    collectorAgent = new CollectorAgent(mockDocClient, analyzer, 3);
    reminderAgent = new ReminderAgent(mockBotClient, 3);
    mainAgent = new MainAgent(collectorAgent, reminderAgent, mockDocClient, 'https://test-doc-url');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Daily Task Workflow', () => {
    it('should execute full workflow: load config -> collect reports -> send reminders', async () => {
      const mockStudents: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1', feishuUserId: 'user1' },
        { studentId: '002', name: 'Bob', docUrl: 'https://doc2', feishuUserId: 'user2' },
        { studentId: '003', name: 'Charlie', docUrl: 'https://doc3' }
      ];

      mockDocClient.extractDocumentId = jest.fn().mockReturnValue('config-doc-id');
      mockDocClient.getDocContent = jest.fn()
        .mockResolvedValueOnce({
          content: '- Alice: https://doc1 (user1)\n- Bob: https://doc2 (user2)\n- Charlie: https://doc3',
          lastModified: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          content: '今天学习了TypeScript和Jest测试框架',
          lastModified: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          content: '',
          lastModified: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          content: '学习了React Hooks',
          lastModified: new Date().toISOString()
        });

      mockLLM.invoke = jest.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            learned: ['TypeScript', 'Jest'],
            notLearned: [],
            questions: []
          })
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            learned: ['React Hooks'],
            notLearned: [],
            questions: []
          })
        });

      mockBotClient.sendMessage = jest.fn().mockResolvedValue(undefined);

      await mainAgent.executeDailyTask();

      expect(mockDocClient.getDocContent).toHaveBeenCalled();
      expect(mockLLM.invoke).toHaveBeenCalled();
      expect(mockBotClient.sendMessage).toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      mockDocClient.extractDocumentId = jest.fn().mockReturnValue('config-doc-id');
      mockDocClient.getDocContent = jest.fn()
        .mockResolvedValueOnce({
          content: '- Alice: https://doc1 (user1)\n- Bob: https://doc2 (user2)',
          lastModified: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          content: '学习内容',
          lastModified: new Date().toISOString()
        })
        .mockRejectedValueOnce(new Error('Network error'));

      mockLLM.invoke = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          learned: ['内容'],
          notLearned: [],
          questions: []
        })
      });

      mockBotClient.sendMessage = jest.fn().mockResolvedValue(undefined);

      await mainAgent.executeDailyTask();

      expect(mockDocClient.getDocContent).toHaveBeenCalled();
      expect(mockBotClient.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Component Integration', () => {
    it('should integrate CollectorAgent with FeishuDocClient for not submitted reports', async () => {
      const students: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1' }
      ];

      mockDocClient.extractDocumentId = jest.fn().mockReturnValue('doc1');
      mockDocClient.getDocContent = jest.fn().mockResolvedValue({
        content: '旧的内容',
        lastModified: new Date(Date.now() - 86400000).toISOString()
      });

      const results = await collectorAgent.collectStudentData(students);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('not_submitted');
      expect(results[0].summary).toBeUndefined();
    });

    it('should integrate CollectorAgent with error handling', async () => {
      const students: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1' }
      ];

      mockDocClient.extractDocumentId = jest.fn().mockReturnValue('doc1');
      mockDocClient.getDocContent = jest.fn().mockRejectedValue(new Error('Network error'));

      const results = await collectorAgent.collectStudentData(students);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].error).toBe('Network error');
    });

    it('should integrate ReminderAgent with FeishuBotClient', async () => {
      const students: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1', feishuUserId: 'user1' },
        { studentId: '002', name: 'Bob', docUrl: 'https://doc2', feishuUserId: 'user2' }
      ];

      mockBotClient.sendMessage = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const results = await reminderAgent.sendReminders(students);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockBotClient.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should continue processing after individual student errors', async () => {
      const students: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1' },
        { studentId: '002', name: 'Bob', docUrl: 'https://doc2' },
        { studentId: '003', name: 'Charlie', docUrl: 'https://doc3' }
      ];

      mockDocClient.extractDocumentId = jest.fn()
        .mockReturnValueOnce('doc1')
        .mockReturnValueOnce('doc2')
        .mockReturnValueOnce('doc3');

      mockDocClient.getDocContent = jest.fn()
        .mockResolvedValueOnce({ content: '内容1', lastModified: new Date(Date.now() - 86400000).toISOString() })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ content: '内容3', lastModified: new Date(Date.now() - 86400000).toISOString() });

      const results = await collectorAgent.collectStudentData(students);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('not_submitted');
      expect(results[1].status).toBe('error');
      expect(results[2].status).toBe('not_submitted');
    });

    it('should handle reminder failures gracefully', async () => {
      const students: Student[] = [
        { studentId: '001', name: 'Alice', docUrl: 'https://doc1', feishuUserId: 'user1' },
        { studentId: '002', name: 'Bob', docUrl: 'https://doc2', feishuUserId: 'user2' },
        { studentId: '003', name: 'Charlie', docUrl: 'https://doc3', feishuUserId: 'user3' }
      ];

      mockBotClient.sendMessage = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Send failed'))
        .mockResolvedValueOnce(undefined);

      const results = await reminderAgent.sendReminders(students);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limits in CollectorAgent', async () => {
      const students: Student[] = Array.from({ length: 10 }, (_, i) => ({
        studentId: `00${i}`,
        name: `Student${i}`,
        docUrl: `https://doc${i}`
      }));

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockDocClient.getDocContent = jest.fn().mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCalls--;
        return { content: '内容', lastModified: new Date().toISOString() };
      });

      mockLLM.invoke = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          learned: ['内容'],
          notLearned: [],
          questions: []
        })
      });

      await collectorAgent.collectStudentData(students);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should respect concurrency limits in ReminderAgent', async () => {
      const students: Student[] = Array.from({ length: 10 }, (_, i) => ({
        studentId: `00${i}`,
        name: `Student${i}`,
        docUrl: `https://doc${i}`,
        feishuUserId: `user${i}`
      }));

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockBotClient.sendMessage = jest.fn().mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCalls--;
      });

      await reminderAgent.sendReminders(students);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
});
