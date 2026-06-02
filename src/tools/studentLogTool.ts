import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { StudentLog } from '../model/studentLog';
import _ from 'lodash'


/**
 * 学生配置工具
 */
export const studentLogTool = new DynamicStructuredTool({
  name: 'StudentLog',
  description: '查询/创建学员日志等信息,仅针对每日的日志信息进行管理',
  schema: z.object({
    // fileUrl: z.string().describe('飞书用户的文件地址'),
    userId:z.string().describe('飞书用户的openid信息'),
    date: z.string().describe('日期，格式为 yyyy-MM-dd'),
    text: z.string().describe('日志内容'),
    type: z.enum([ 'read','save']).describe('日志信息类型，读取 或者 保存')
  }),
  func: async (data) => {
    try {
      const model = await mapping[data.type](data)
      if(_.isObject(model)){ // 默认返回对象
        return JSON.stringify(model)
      }else if(_.isString(model)){
        return model // 演示，返回字符串，这种设计也可以
      }else{
        throw new Error("没有数据") // 兜底
      }
       
    } catch (error) {
      return error.message
    }
  }
});


const mapping = {
  async read({userId}){
      let studentLog = await StudentLog.loadByUserId(userId)
      return studentLog
  },
  async save({userId ,date,text}){
    await StudentLog.save(userId ,date,text)
    return "保存成功"
  }
}
