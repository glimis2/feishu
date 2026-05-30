import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { logger } from '../utils/logger';
import { StudentSummary } from '../types';

interface AnalysisResult {
  learned: string[];
  not_learned: string[];
  questions: string[];
}

export class ContentAnalyzer {
  private llm: BaseChatModel;
  private analysisParser: any;
  private analysisPrompt: ChatPromptTemplate;
  private validationPrompt: ChatPromptTemplate;

  constructor(llm: BaseChatModel) {
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
      }) as AnalysisResult;

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
