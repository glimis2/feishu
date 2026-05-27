import { ContentAnalyzer } from '../../src/tools/content-analyzer';
import { ChatOpenAI } from '@langchain/openai';

jest.mock('@langchain/openai');
jest.mock('@langchain/core/prompts');
jest.mock('langchain/output_parsers');

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let mockLLM: jest.Mocked<ChatOpenAI>;

  beforeEach(() => {
    mockLLM = {
      pipe: jest.fn()
    } as any;

    analyzer = new ContentAnalyzer(mockLLM);
    jest.clearAllMocks();
  });

  it('should analyze document content', async () => {
    const mockChain = {
      invoke: jest.fn().mockResolvedValue({
        learned: ['JavaScript基础', 'Promise用法'],
        not_learned: ['async/await'],
        questions: ['如何处理错误？']
      })
    };

    const mockPipe = jest.fn().mockReturnValue(mockChain);
    (analyzer as any).analysisPrompt = {
      pipe: jest.fn().mockReturnValue({
        pipe: mockPipe
      })
    };

    (analyzer as any).analysisParser = {
      getFormatInstructions: jest.fn().mockReturnValue('format instructions')
    };

    const result = await analyzer.analyzeContent('今天学习了JavaScript基础和Promise');

    expect(result.learned).toContain('JavaScript基础');
    expect(result.notLearned).toContain('async/await');
    expect(result.questions).toContain('如何处理错误？');
  });

  it('should validate if document is today report', async () => {
    const mockChain = {
      invoke: jest.fn().mockResolvedValue({
        content: '是'
      })
    };

    (analyzer as any).validationPrompt = {
      pipe: jest.fn().mockReturnValue(mockChain)
    };

    const today = new Date().toISOString().split('T')[0];
    const result = await analyzer.isTodayReport('今天学习内容', today);

    expect(result).toBe(true);
  });
});
