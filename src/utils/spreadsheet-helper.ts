import { getClient } from './client';
import { extractDocumentId } from './extractDocumentId';

export async function getSheetByTitle(spreadsheetToken: string, sheetTitle: string) {
  const client = getClient();
  const response = await client.sheets.v3.spreadsheetSheet.query({
    path: {
      spreadsheet_token: spreadsheetToken
    },
  });
  return response.data.sheets.find(item => item.title === sheetTitle);
}

export async function getStudentRecordSheet(docUrl: string) {
  const spreadsheetToken = extractDocumentId(docUrl);
  return getSheetByTitle(spreadsheetToken, "学员记录");
}
