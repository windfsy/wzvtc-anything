import { describe, expect, it } from 'vitest';
import { HttpClient, type FetchLike } from '../src/core/http.js';
import { ZyhClient } from '../src/connectors/zyh/client.js';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('ZyhClient', () => {
  it('logs in with at/user-id headers and parses hours read-only', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/userCenter/login.do')) {
        return jsonResponse({ errCode: '0000', message: '成功' }, 200, {
          at: 'zyh-token',
          'user-id': 'zyh-user',
        });
      }
      if (url.includes('/volunteerinfo/getvolunteerbyId.do')) {
        return jsonResponse({
          errCode: '0000',
          nav: [
            { name: '信用时数', value: '44.52' },
            { name: '荣誉时数', value: 0 },
            { name: '培训时长', value: 0 },
          ],
          hours_totalduration: 44.52,
          points: 10,
          ranking: 100,
          info: { real_name: 'should-not-leak' },
        });
      }
      if (url.includes('/activity/hoursList.do')) {
        return jsonResponse({
          errCode: '0000',
          data: [
            {
              activityname: '活动',
              signintime: 1700000000000,
              signouttime: 1700003600000,
              value: 1,
            },
          ],
        });
      }
      return jsonResponse({ errCode: 'E404' }, 404);
    };

    const client = new ZyhClient(new HttpClient(fetchImpl));
    const session = await client.loginWithPassword('account', 'plain-password');
    expect(session.accessToken).toBe('zyh-token');
    expect(session.userId).toBe('zyh-user');

    const summary = await client.summary(session);
    expect(summary.credit_hours).toBe(44.52);
    expect(summary.honor_hours).toBe(0);
    expect(summary.total_hours).toBe(44.52);
    expect(JSON.stringify(summary)).not.toContain('should-not-leak');

    const hours = await client.hours(session, { year: 2026, page: 1, rows: 5 });
    expect(hours.items).toHaveLength(1);
    expect(hours.items[0]?.signin_at).toContain('+08:00');

    const summaryRequest = requests.find((request) =>
      request.url.includes('/volunteerinfo/getvolunteerbyId.do'),
    );
    const headers = new Headers(summaryRequest?.init?.headers);
    expect(headers.get('platform-id')).toBe('3');
    expect(headers.get('user-id')).toBe('zyh-user');
    expect(headers.get('authorization')).toBe('zyh-token');
  });

  it('maps a login errCode to auth_required', async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse({ errCode: 'E0002', message: '登录账号不能为空' });
    const client = new ZyhClient(new HttpClient(fetchImpl));
    await expect(client.loginWithPassword('account', 'wrong')).rejects.toMatchObject({
      code: 'auth_required',
    });
  });

  it('maps a 401 to auth_expired', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input).includes('/userCenter/login.do')) {
        return jsonResponse({ errCode: '0000' }, 200, {
          at: 'zyh-token',
          'user-id': 'zyh-user',
        });
      }
      return jsonResponse({ errCode: 'E5000' }, 401);
    };
    const client = new ZyhClient(new HttpClient(fetchImpl));
    const session = await client.loginWithPassword('account', 'password');
    await expect(client.summary(session)).rejects.toMatchObject({ code: 'auth_expired' });
  });
});
