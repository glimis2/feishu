import { FeishuBotClient } from '../../src/tools/feishu-bot';
import { FeishuAuth } from '../../src/tools/feishu-auth';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../src/tools/feishu-auth');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFeishuAuth = FeishuAuth as jest.MockedClass<typeof FeishuAuth>;

describe('FeishuBotClient', () => {
  let client: FeishuBotClient;
  let mockAuth: jest.Mocked<FeishuAuth>;

  beforeEach(() => {
    mockAuth = new MockedFeishuAuth('app_id', 'app_secret') as jest.Mocked<FeishuAuth>;
    mockAuth.getAccessToken.mockResolvedValue('test_token');
    client = new FeishuBotClient(mockAuth);
    jest.clearAllMocks();
  });

  it('should send message to user', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        msg: 'success'
      }
    });

    await client.sendMessage('user123', '测试消息');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/im/v1/messages',
      {
        receive_id: 'user123',
        msg_type: 'text',
        content: JSON.stringify({ text: '测试消息' })
      },
      {
        headers: {
          Authorization: 'Bearer test_token'
        },
        params: {
          receive_id_type: 'user_id'
        }
      }
    );
  });

  it('should throw error on send failure', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 99991663,
        msg: 'user not found'
      }
    });

    await expect(client.sendMessage('user123', '测试')).rejects.toThrow('user not found');
  });
});
