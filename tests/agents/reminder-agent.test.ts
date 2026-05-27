import { ReminderAgent } from '../../src/agents/reminder-agent';
import { FeishuBotClient } from '../../src/tools/feishu-bot';
import { Student } from '../../src/types';

jest.mock('../../src/tools/feishu-bot');

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
