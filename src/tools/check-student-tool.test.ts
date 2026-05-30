/**
 * Check Student Tool 测试
 *
 * 测试检查学员工具的功能
 */
import {checkStudentTool} from './check-student-tool';

describe('checkStudentTool', () => {


  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该成功检查学员', async () => {
        const data = await checkStudentTool.func({date: '2026-05-30'});

        console.log(data)
    });


  });

});
