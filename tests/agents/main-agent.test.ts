import { MainAgent } from '../../src/agents/main-agent';
import { CollectorAgent } from '../../src/agents/collector-agent';
import { ReminderAgent } from '../../src/agents/reminder-agent';
import { FeishuDocClient } from '../../src/tools/feishu-doc';
import * as fileUtils from '../../src/utils/file';

jest.mock('../../src/agents/collector-agent');
jest.mock('../../src/agents/reminder-agent');
jest.mock('../../src/tools/feishu-doc');
jest.mock('../../src/utils/file');

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
    expect(fileUtils.writeJsonFile).toHaveBeenCalledTimes(5);
  });
});
