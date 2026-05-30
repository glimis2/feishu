import { sendFeishuMessageTool } from './send-feishu-message-tool';
import { FeishuBotClient } from '../utils/feishu-bot';
import { initializeToolDependencies } from '../utils/tool-dependencies';

jest.mock('../utils/feishu-bot');

describe('sendFeishuMessageTool', () => {

  describe('基本功能', () => {
    it('应该成功发送消息', async () => {
      await sendFeishuMessageTool.func({
        date:"2026-05-30"
      })
    });
  })
});
