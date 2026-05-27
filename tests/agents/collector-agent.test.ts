import { CollectorAgent } from '../../src/agents/collector-agent';
import { FeishuDocClient } from '../../src/tools/feishu-doc';
import { ContentAnalyzer } from '../../src/tools/content-analyzer';
import { Student } from '../../src/types';

jest.mock('p-limit', () => {
  return jest.fn(() => (fn: any) => fn());
});

jest.mock('../../src/tools/feishu-doc');
jest.mock('../../src/tools/content-analyzer');

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
