import "dotenv/config"
import dayjs from 'dayjs';
import { getClient } from '../utils/client';
import { extractDocumentId } from '../utils/extractDocumentId';
import _ from 'lodash'
import { StudentModel } from "./student";

const client = getClient();


const headerMapping = {
    '姓名': 'name',
    '文件': 'file',
    '读取时间': 'read_time',
    '状态': 'status',
};

let spreadsheet_token
let app_token
let table_id


const parseDate = (dateStr: string | undefined): string => {
    if (!dateStr) return ""
    const d = dayjs(dateStr);
    if (d.isValid()) {
        return d.format('YYYY-MM-DD');
    }
    return dateStr;
};

function getSpreadsheetToken(): string {
    if (!spreadsheet_token) {
        const docUrl = process.env.FEISHU_CONFIG_DOC_URL;
        if (!docUrl) {
            throw new Error('FEISHU_CONFIG_DOC_URL 未设置');
        }
        spreadsheet_token = extractDocumentId(docUrl);
    }
    return spreadsheet_token;
}

async function getAppToken(): Promise<string> {
    if (!app_token) {
        const response = await client.wiki.v2.space.getNode({
            params: { token: getSpreadsheetToken() },
        });
        app_token = response.data.node.obj_token;
    }
    return app_token;
}

async function getTableId(): Promise<string> {
    if (!table_id) {
        const response = await client.bitable.v1.appTable.list({
            path: { app_token: await getAppToken() },
            params: { page_size: 100 },
        });
        const table = response.data.items.find(item => item.name === '基础配置');
        if (!table) {
            throw new Error('未找到基础配置表格');
        }
        table_id = table.table_id;
    }
    return table_id;
}


async function getStudentRecordSheet(): Promise<StudyRecord[]> {
    const response = await client.bitable.v1.appTableRecord.search({
        path: {
            app_token: await getAppToken(),
            table_id: await getTableId(),
        },
    });

    return response.data.items.map(item => {
        const rs = {};
        for (const key in headerMapping) {
            let obj = item.fields[key];
            if (Array.isArray(obj)) {
                obj = obj.filter((item: unknown) => {
                    if (typeof item === 'object' && item !== null && 'type' in item && 'text' in item) {
                        const field = item as { type: string; text: string };
                        return !(field.type === 'text' && field.text.trim() === '');
                    }
                    return true;
                })[0];
            }
            rs[headerMapping[key]] = obj;
        }
        return {
            ...rs as StudyRecord,
            record_id: item.record_id
        };
    });
}

// 最外层的对象类型（你给的整条数据）
interface StudyRecord {
  file: FileLink;
  name: UserInfo;
  read_time: undefined;
  record_id: string;
  status: '学习中' | string; // 这里是字面量+扩展写法
}

// file 对象类型
interface FileLink {
  link: string;
  text: string;
  type: string;
}

// name 对象类型（用户信息）
interface UserInfo {
  avatar_url: string;
  email: string;
  en_name: string;
  id: string;
  name: string;
}
export class StudentConfig {
    data:StudyRecord = null

    constructor(data){
        this.data = data
    }    

    // 获取某天学生数据
    static async findByUserId(userid: string): Promise<StudentConfig | undefined> {
        const data = await getStudentRecordSheet() || [];
        const item = data.find(item => item.name.id === userid)
        if(item){
            return new StudentConfig(item)
        }
        return undefined
    }

    static async create(userid,name=""): Promise<StudentConfig | undefined> {
        
        const student = await StudentConfig.findByUserId(userid)
        if(student){
            return student
        }
        
        if(!name ){
            name = userid
        }
        const file = await client.docx.v1.document.create({
            data: {
                    // parent 地址
                    folder_token: process.env.FEISHU_CREATE_DOC_FOLDER_TOKEN,
                    // 文件名以 用户名为主
                    title: name
                },
            }
        )
        // 通过返回的id，换取wiki_id
        const node = await client.wiki.v2.space.getNode({
            params: {
                token: file.data.document.document_id,
                obj_type: 'docx',
            },
        })
        // 添加权限

        await client.drive.v1.permissionMember.create({
            path: {
                token: file.data.document.document_id
            },
            params: {
                type: 'docx',
                need_notification: true,
            },
            data: {
                member_type: 'unionid',
                member_id: userid,
                perm: 'edit',
                perm_type: 'container',
                type: 'user',
            },
        })

        
        // 添加记录
        await client.bitable.v1.appTableRecord.create({
            path: {
                app_token: await getAppToken(),
                table_id: await getTableId(),
            },
            data: {
                fields: {
                    "姓名": [{
                        "id": userid
                    }],
                    "文件": {
                        // "text": name, // 没有就是默认名
                        "link": `https://g15x4fm9ei6.feishu.cn/wiki/${node.data.node.node_token }`
                    },
                }
            },
        }
        )
        
        return await StudentConfig.findByUserId(userid)
    }


    
    async update(){
        // 修改列表中的文件名
        // https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/update
        // await client.bitable.v1.appTableRecord.update({
        //     path: {
        //         app_token
        //         table_id
        //         record_id
        //     },
        //     data: {
        //          fields: {
        //             "文件": {
        //                 "text": name,
        //                 "link": `https://g15x4fm9ei6.feishu.cn/wiki/${file.data.document.document_id}`
        //             },
        //         }
        //     },
        // })

        // 获取文档中的blocks
        const document_id = this.data.file.link.split('/wiki/')[1].split('?')[0]
        const response = await client.docx.v1.documentBlock.list({
            path: {
                document_id ,
            },
            params: {
                page_size: 500,
                document_revision_id: -1,
            },
        })
        const block = response.data.items.find(item=>item.block_type  === 1) // 此处为标题
        
        // 修改具体标题
        await client.docx.v1.documentBlock.patch({
            path: {
                document_id,
                block_id:block.block_id ,
            },
            data: {
                update_text_elements: {
                    elements: [
                        {
                            text_run: {
                                content: this.data.name.name,
                            },
                        }
                    ],
                },
            },
        })
        


        return "修改成功"

    }
}


export class StudentConfigStore {



}