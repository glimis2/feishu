
import dayjs from 'dayjs';
import path from 'path';
import { getClient } from '../utils/client';
import { extractDocumentId } from '../utils/extractDocumentId';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/file';
import { blocksToMarkdown } from '../utils/document-block-to-markdown';
import _ from 'lodash'

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



export class StudentStore {
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
            return new StudentStore(date, data);
        } catch (error) {
            return new StudentStore(date, []);
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