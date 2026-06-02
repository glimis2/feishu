import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { StudentConfig } from '../model/studentConfig';
import _ from 'lodash'


/**
 * 学生配置工具
 */
export const studentConfigTool = new DynamicStructuredTool({
  name: 'studentConfig',
  description: '查询,创建学员配置文档等信息，如果用户需要设置自己的配置信息，可以使用当前方法',
  schema: z.object({
    userid: z.string().describe('飞书用户的openid信息'),
    username: z.string().describe('用户名称'),
    type: z.enum(['create', 'read']).describe('配置信息类型，创建 或者 读取')
  }),
  func: async ({ userid, username,type }) => {
    try {
      const student = await mapping[type](userid,username)
      if(_.isObject(student)){ // 默认返回对象
        return JSON.stringify(student)
      }else if(_.isString(student)){
        return student // 演示，返回字符串，这种设计也可以
      }else{
        throw new Error("没有数据") // 兜底
      }
       
    } catch (error) {
      return error.message
    }
  }
});


const mapping = {
  async read(userid){
      let studentConfig = await StudentConfig.findByUserId(userid)
      return studentConfig
  },
  async create(userid){
    let studentConfig = await StudentConfig.findByUserId(userid)
    if(studentConfig){ // 此处可以选择报错
      return studentConfig
    }
    studentConfig = await StudentConfig.create(userid)
    return studentConfig
  },
  // 只可以修改name
  async update(userid,username){
    let studentConfig = await StudentConfig.findByUserId(userid)
    if(!studentConfig){
      throw new Error("记录不存在,无需修改")
    }
    studentConfig.data.name.name = username
    await studentConfig.update()
    
    return studentConfig
  }
}
