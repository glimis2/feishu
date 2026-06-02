
import dayjs from 'dayjs';
import path from 'path';
import { getClient } from '../utils/client';
import { extractDocumentId } from '../utils/extractDocumentId';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/file';
import { blocksToMarkdown } from '../utils/document-block-to-markdown';
import _ from 'lodash'

const client = getClient();



let spreadsheet_token
let app_token
let table_id




function getSpreadsheetToken(): string {
    if (!spreadsheet_token) {
        const docUrl = process.env.FEISHU_SUMMARY_DOC_URL;
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
        const table = response.data.items.find(item => item.name === '日报');
        if (!table) {
            throw new Error('未找到日报表格');
        }
        table_id = table.table_id;
    }
    return table_id;
}



const headerMapping = {
    '总结': 'text',
    '时间': 'date'
};

export class DailySummary {
    // 获取某天学生数据
    static async save(date,text) {
        await client.bitable.v1.appTableRecord.create({
                path: {
                    app_token: await getAppToken(),
                    table_id: await getTableId(),
                },
                data: {
                    fields: {
                        "总结": text,
                        "时间": dayjs(date).toDate().getTime(),
                    }
                },
            }
        )
    }
}