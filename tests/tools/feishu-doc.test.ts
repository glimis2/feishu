import { FeishuDocClient } from '../../src/tools/feishu-doc';
import { FeishuAuth } from '../../src/tools/feishu-auth';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../src/tools/feishu-auth');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFeishuAuth = FeishuAuth as jest.MockedClass<typeof FeishuAuth>;

describe('FeishuDocClient', () => {
  let client: FeishuDocClient;
  let mockAuth: jest.Mocked<FeishuAuth>;

  beforeEach(() => {
    mockAuth = new MockedFeishuAuth('app_id', 'app_secret') as jest.Mocked<FeishuAuth>;
    mockAuth.getAccessToken.mockResolvedValue('test_token');
    client = new FeishuDocClient(mockAuth);
    jest.clearAllMocks();
  });

  it('should fetch document content', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        data: {
          content: '# Test Document\nContent here',
          revision: 1,
          last_modified: '2026-05-27T10:00:00Z'
        }
      }
    });

    const result = await client.getDocContent('doc123');

    expect(result.content).toBe('# Test Document\nContent here');
    expect(result.lastModified).toBe('2026-05-27T10:00:00Z');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/docx/v1/documents/doc123/raw_content',
      {
        headers: {
          Authorization: 'Bearer test_token'
        }
      }
    );
  });

  it('should throw error on API failure', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 99991663,
        msg: 'document not found'
      }
    });

    await expect(client.getDocContent('doc123')).rejects.toThrow('document not found');
  });
});
