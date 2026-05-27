import { FeishuAuth } from '../../src/tools/feishu-auth';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FeishuAuth', () => {
  let auth: FeishuAuth;

  beforeEach(() => {
    auth = new FeishuAuth('test_app_id', 'test_app_secret');
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should get access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        tenant_access_token: 'test_token',
        expire: 7200
      }
    });

    const token = await auth.getAccessToken();
    expect(token).toBe('test_token');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://open.feishu.cn/open-api/auth/v3/tenant_access_token/internal',
      {
        app_id: 'test_app_id',
        app_secret: 'test_app_secret'
      }
    );
  });

  it('should cache access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        code: 0,
        tenant_access_token: 'test_token',
        expire: 7200
      }
    });

    await auth.getAccessToken();
    await auth.getAccessToken();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should refresh expired token', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 0,
        tenant_access_token: 'test_token_1',
        expire: 0
      }
    }).mockResolvedValueOnce({
      data: {
        code: 0,
        tenant_access_token: 'test_token_2',
        expire: 0
      }
    });

    const token1 = await auth.getAccessToken();
    expect(token1).toBe('test_token_1');

    await new Promise(resolve => setTimeout(resolve, 100));

    const token2 = await auth.getAccessToken();
    expect(token2).toBe('test_token_2');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});
