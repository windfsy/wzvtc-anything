import { describe, expect, it } from 'vitest';
import { HttpClient, type FetchLike } from '../src/core/http.js';
import { XgxtClient } from '../src/connectors/xgxt/client.js';

const code = 'TEST_CODE_123456';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('XgxtClient', () => {
  it('exchanges a link code, lists leaves, and submits a write', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/Account/Login?code=')) {
        return jsonResponse({ access_token: 'access-token', refresh_token: 'refresh-token' });
      }
      if (url.includes('/Leave/GetAllLeaveManageList')) {
        return jsonResponse({
          List: { Items: [{ Id: '1', LeaveType: '事假', LeaveThing: 'test' }], TotalPages: 1 },
          IsApply: '0',
        });
      }
      if (url.includes('/Leave/SaveAllLeaveManage')) {
        return jsonResponse({ Msg: '成功' });
      }
      return jsonResponse({ error: 'not found' }, 404);
    };

    const client = new XgxtClient(new HttpClient(fetchImpl));
    const session = await client.exchangeLinkCode(code, 'xgxt.wzvtc.cn');
    expect(session.accessToken).toBe('access-token');
    expect(session.baseUrl).toBe('https://xgxt.wzvtc.cn/PhoneApi/api');

    const list = await client.listLeaves(session, 1);
    expect(list.items).toHaveLength(1);
    expect(list.totalPages).toBe(1);

    const write = await client.saveLeave(session, { LeaveThing: 'test' });
    expect(write.ok).toBe(true);
    const saveRequest = requests.find((request) => request.url.includes('/Leave/SaveAllLeaveManage'));
    const body = String(saveRequest?.init?.body ?? '');
    expect(body).toContain('model');
    expect(body).toContain('test');
    expect(requests.some((request) => request.url.includes(code))).toBe(true);
  });

  it('logs in with username/password without sending the plaintext password', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      requests.push({ url: String(input), init });
      return jsonResponse({ access_token: 'access-token', refresh_token: 'refresh-token' });
    };
    const client = new XgxtClient(new HttpClient(fetchImpl));
    const session = await client.loginWithPassword(
      'student-id',
      'plain-password',
      'xgxt.wzvtc.cn',
    );
    expect(session.accessToken).toBe('access-token');
    const body = String(requests[0]?.init?.body ?? '');
    expect(body).toContain('grant_type=password');
    expect(body).toContain('student-id');
    expect(body).not.toContain('plain-password');
  });

  it('maps a rejected password login to auth_required', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ error: 'bad credentials' }, 401);
    const client = new XgxtClient(new HttpClient(fetchImpl));
    await expect(
      client.loginWithPassword('student-id', 'wrong-password', 'xgxt.wzvtc.cn'),
    ).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('maps a 401 to auth_expired', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input).includes('/Account/Login')) {
        return jsonResponse({ access_token: 'access-token' });
      }
      return jsonResponse({ error: 'unauthorized' }, 401);
    };
    const client = new XgxtClient(new HttpClient(fetchImpl));
    const session = await client.exchangeLinkCode(code, 'xgxt.wzvtc.cn');
    await expect(client.listLeaves(session, 1)).rejects.toMatchObject({ code: 'auth_expired' });
  });

  it('maps a failed exchange to link_code_expired without leaking the code', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ error: 'invalid code' }, 400);
    const client = new XgxtClient(new HttpClient(fetchImpl));
    try {
      await client.exchangeLinkCode(code, 'xgxt.wzvtc.cn');
      throw new Error('expected exchange to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'link_code_expired' });
      expect(String(error)).not.toContain(code);
    }
  });
});
