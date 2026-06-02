
import dayjs from 'dayjs';
import path from 'path';
import { getClient } from '../utils/client';
import { extractDocumentId } from '../utils/extractDocumentId';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/file';
import { blocksToMarkdown } from '../utils/document-block-to-markdown';
import _ from 'lodash'
import { StudentConfig } from './studentConfig';

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
if(!dateStr) return ""
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


async function getStudentRecordSheet() {
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
            ...rs,
            record_id: item.record_id,
            status: 'pending'
        };
    });
}



export class StudentLogStore {
    data = []
    date = ""
    constructor(date, data) {
        this.date = date
        this.data = data
    }

    // 获取某天学生数据
    static async load(date) {
        try {
            const filePath = path.resolve(process.cwd(), `data/students/${date}.json`);
            let data
            if (await fileExists(filePath)) {
                data = await readJsonFile(filePath);
            }
            data = await getStudentRecordSheet() || [];
            return new StudentLogStore(date, data);
        } catch (error) {
            return new StudentLogStore(date, []);
        }
    }



    /**
     * 更新 文档数据
     */
    async _updateStatus() {
        const records = _.map(this.data, item => ({
            fields: {
                '最后读取时间': Date.now(),
                '最后更新时间': Date.now(),
            },
            record_id: item.record_id,
        }));


        await client.bitable.v1.appTableRecord.batchUpdate({
            path: {
                app_token: await getAppToken(),
                table_id: await getTableId()
            },
            data: { records },
        });

        // 此处也可以放到 save中，也可以直接当做缓存处理
        const filePath = path.resolve(process.cwd(), `data/students/${this.date}.json`);
        await writeJsonFile(filePath, this.data);
    }

    /**
     * 对学生的数据，进行展开
     * 关联info/文件信息
     */
    async associateInfo() {
        let students = this.data
        for (const student of students) {
            // 空数据忽略，成功的忽略
            if (!student.file || student.status === 'success') {
                return student;
            }
            try {
                const response = await client.docx.v1.documentBlock.list({
                    path: { document_id: student.file.token },
                    params: { page_size: 500, document_revision_id: -1 },
                });

                // 倒序获取markdown信息
                const items = response.data.items;
                let lastIndex = -1;

                for (let i = items.length - 1; i >= 0; i--) {
                    if (items[i].block_type === 3) {
                        lastIndex = i;
                        break;
                    }
                }

                const blocks = lastIndex !== -1 ? items.slice(lastIndex) : [];
                const blockDate = (blocks[0] as { heading1?: { elements?: Array<{ text_run?: { content: string } }> } })?.heading1?.elements?.[0]?.text_run?.content;
                // 判断是否为当前的信息
                
                const normalizedBlockDate = parseDate(blockDate);
                const normalizedInputDate = parseDate(this.date);

                if (normalizedBlockDate === normalizedInputDate) {
                    student.status = 'success';
                    student.md = blocksToMarkdown(blocks as Array<unknown>);
                } else {
                    throw new Error('日期不匹配:' + blockDate);
                }
            } catch (error) {
                student.status = 'fail';
            }
        }

        // 读取完成后，回写数据
        await this._updateStatus()
    }

    unsubmitted(){
        return _.chain(this.data)
            .filter(item => item.status !== 'success' && item.name)
            .value() || []
    }
    // 实际上，可以在这里写发送信息，继续节省一波tokens
    send() {

    }
}


/**
 * 某个学生的最新日志
 * 只看最新，不看历史记录
 */
export class StudentLog {
    data = {
        userId :null,
        date: null,
        md:"", // 具体日志内容
    }
    
    constructor(data = {}) {
        Object.assign(this.data,data)
    }

    // 根据 date 获取日志
    static async loadByUserId(userId){
        let ret = {
            userId ,
            date: null,
            md:"", // 具体日志内容
            status:'fail' // 描述是否由标题
        }
        // 1. 寻找对应的文件地址
        let studentConfig = await StudentConfig.findByUserId(userId)
        const fileUrl = studentConfig.data.file.link
        const document_id =  extractDocumentId(fileUrl)
    
        // 获取所有的block
        const response = await client.docx.v1.documentBlock.list({
            path: { document_id: document_id },
            params: { page_size: 500, document_revision_id: -1 },
        });

        // 倒序?倒序个锤子，直接第一行写
        const items = response.data.items;
   
        let blockStartIndex = items.findIndex(item=>item.block_type === 3)
        let blockEndIndex = items.slice(blockStartIndex+1).findIndex(item=>item.block_type === 3)
        
        let blocks = items.slice(blockStartIndex + 1,blockEndIndex + blockStartIndex + 1) 
        if(blockEndIndex === -1){
            blocks = items.slice(blockStartIndex + 1)
        }
        
        const blockHeader = items[blockStartIndex]
        const blockDate = (blockHeader as { heading1?: { elements?: Array<{ text_run?: { content: string } }> } })?.heading1?.elements?.[0]?.text_run?.content;
        // // 判断是否为当前的信息
        ret.date = parseDate(blockDate); // 需要防御，略
        ret.md = blocksToMarkdown(blocks as Array<unknown>);
        
        return new StudentLog(ret)
    }

    /**
     * 保存今日日志
     */
    static async save(userId,date,text){
        const studentLog = await StudentLog.loadByUserId(userId)

        // 判断 最后一项是否跟当前的需要一样
        let hasHeader = false
        date = parseDate(date)
        if(studentLog.data.date === date){
            // 此处为更新，为追加，不需要header
            hasHeader = false
        }else{
            // 此处为新增，需要添加header
            hasHeader = true
        }
        // 1. 把 markdown 转换为 blocks
        const {data:{blocks}} = await client.docx.v1.document.convert({
			data: {
				content_type: 'markdown',
content: hasHeader?`# ${date}\n${text}`:text,
				},
        })
        // 2. 通过文件，获取所有blocks
        const document_id =  extractDocumentId(fileUrl)
        const {data:{items}} = await client.docx.v1.documentBlock.list({
            path: { document_id: document_id },
            params: { page_size: 500, document_revision_id: -1 },
        })

        // 默认第一个heade 就是 日期
        let block  = items[0]
        // 在第一个block之后，添加日志
       const response = await client.docx.v1.documentBlockChildren.create({
            path: {
                document_id,
                block_id: block.block_id
            },
            params: {
                document_revision_id: -1,
            },
            data: {
                children: blocks,
                index: hasHeader?0:1
            },
        })
    }

 

}