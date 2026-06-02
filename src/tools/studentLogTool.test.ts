import { studentLogTool } from './studentLogTool';

jest.mock('../utils/feishu-bot');

describe('studentLogTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('基本功能', () => {

    // it('读取', async () => {
    //   const studnetLogRaw = await studentLogTool.func({
    //     fileUrl:"https://g15x4fm9ei6.feishu.cn/wiki/YzSNwI89RiEUe5kRfJYcLdPqnEb", 
    //     type:"read"
    //   })
    //   const studnetLog = JSON.parse(studnetLogRaw)
    // });


    it('写入', async () => {
      const studnetLogRaw = await studentLogTool.func({
        fileUrl:"https://g15x4fm9ei6.feishu.cn/wiki/YzSNwI89RiEUe5kRfJYcLdPqnEb", 
        date:'2026-6-2',
        text:`- 学了算法
- 感觉自己萌萌的
- 666`,
        type:"save"
      })
     
    });
  })
});
