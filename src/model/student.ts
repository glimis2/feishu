import { getClient } from '../utils/client';
const client = getClient();

/**
 * 通过飞书获取的模型
 */
export class StudentModel {
    data = {}
    constructor(data){
        this.data = data
    }
    // 获取某天学生数据
    static async load(userId) {
        try {
            const response = await client.contact.v3.user.get({
                    path: {
                        user_id: userId,
                    },
                    params: {
                        user_id_type: 'open_id',
                        department_id_type: 'open_department_id',
                    },
                }
            )
            return new StudentModel(response.data.user)
        } catch (error) {
            return null
        }
    }
}