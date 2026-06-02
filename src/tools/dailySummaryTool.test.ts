import { dailySummaryTool } from './dailySummaryTool';

jest.mock('../utils/feishu-bot');

describe('dailySummaryTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('基本功能', () => {
    it('修改', async () => {
      const studnetRaw = await dailySummaryTool.func({
        date: "2024-01-01",
        text: "德玛西亚"
      })
    });

  })
});
