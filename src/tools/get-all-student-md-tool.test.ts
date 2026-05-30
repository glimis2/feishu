import { getAllStudentMdTool } from './get-all-student-md-tool';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('getAllStudentMdTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本功能', () => {
    it('应该成功获取指定日期的报告数据', async () => {
      
      const result = await getAllStudentMdTool.func({ date: '2026-05-30' });

    });

  });


});
