import { studentInfoTool } from './student-info-tool';

jest.mock('../utils/feishu-bot');

describe('studentInfoTool', () => {

  describe('基本功能', () => {
    it('应该成功发送消息', async () => {
      await studentInfoTool.func({
        date:"2026-05-30"
      })
    });
  })
});
