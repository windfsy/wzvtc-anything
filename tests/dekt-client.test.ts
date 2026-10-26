import { describe, expect, it } from 'vitest';
import { HttpClient, type FetchLike } from '../src/core/http.js';
import { DektClient } from '../src/connectors/dekt/client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('DektClient', () => {
  it('logs in, lists activities, and maps transcript without PII fields', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/Account/Login')) {
        return jsonResponse({ access_token: 'dekt-token' });
      }
      if (url.includes('/Student/GetHomePageLinks')) {
        return jsonResponse({ ok: true });
      }
      if (url.includes('/StuAction/GetActivityList')) {
        return jsonResponse({
          List: {
            Items: [
              {
                Id: 'activity-1',
                ActivityName: '活动',
                ActivityType: '文化艺术',
                ActivityTime: '2026-11-01',
                ActPlace: '体育馆',
                StatusName: '可报名',
                BMStatusName: '',
                LimitStuNumberText: '10/30',
                Iid: '00000000-0000-0000-0000-000000000000',
              },
            ],
            TotalPages: 1,
          },
        });
      }
      if (url.includes('/StuAction/GetActivityInfo')) {
        return jsonResponse({
          ActInfo: { Id: 'activity-1', ActivityName: '活动' },
          ApplyRoleList: [{ value: 'role-1', text: '参与者' }],
          ApplyInfo: { ActivityRoleId: '00000000-0000-0000-0000-000000000000' },
        });
      }
      if (url.includes('/StuAction/GetMyJudgeXSActionScoreList')) {
        return jsonResponse({
          Items: [
            {
              Name: 'should-not-leak',
              StudentId: 'should-not-leak',
              SumGetNum: 12,
              Rank: 3,
              ClassName: '班级',
              SpecialtyName: '专业',
              CollegeName: '学院',
              SpeTypeName: '类型',
            },
          ],
        });
      }
      return jsonResponse({ error: 'not found' }, 404);
    };

    const client = new DektClient(new HttpClient(fetchImpl));
    const session = await client.loginWithPassword('student-id', 'plain-password');
    expect(session.accessToken).toBe('dekt-token');

    const loginBody = String(requests[0]?.init?.body ?? '');
    expect(loginBody).not.toContain('plain-password');

    await expect(client.probe(session)).resolves.toBe(true);

    const list = await client.listActivities(session, { page: 1 });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.name).toBe('活动');
    expect(list.items[0]?.enrollment_id).toBeUndefined();

    const detail = await client.getActivity(session, 'activity-1');
    expect(detail.roles).toEqual([{ value: 'role-1', text: '参与者' }]);
    expect(detail.already_enrolled).toBe(false);

    const transcript = await client.getTranscript(session, 1);
    expect(transcript.items).toHaveLength(1);
    expect(JSON.stringify(transcript)).not.toContain('should-not-leak');
    expect(transcript.items[0]?.total_hours).toBe(12);
  });

  it('maps a 401 to auth_expired', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input).includes('/Account/Login')) {
        return jsonResponse({ access_token: 'dekt-token' });
      }
      return jsonResponse({ error: 'unauthorized' }, 401);
    };
    const client = new DektClient(new HttpClient(fetchImpl));
    const session = await client.loginWithPassword('student-id', 'password');
    await expect(client.listActivities(session)).rejects.toMatchObject({ code: 'auth_expired' });
  });

  it('maps a rejected login to auth_required', async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ error: 'bad credentials' }, 400);
    const client = new DektClient(new HttpClient(fetchImpl));
    await expect(client.loginWithPassword('student-id', 'wrong')).rejects.toMatchObject({
      code: 'auth_required',
    });
  });

  it('enrolls, finds an enrollment, and cancels with flattened model fields', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/StuAction/SaveActivityStudentsApply')) {
        return jsonResponse({ errcode: 0, errmsg: '报名成功' });
      }
      if (url.includes('/StuAction/DelActivityStudentsApply')) {
        return jsonResponse({ errcode: 0, errmsg: '撤销成功' });
      }
      if (url.includes('/StuAction/GetActivityList') && url.includes('Status=3')) {
        return jsonResponse({
          List: {
            Items: [
              {
                Id: 'activity-1',
                ActivityName: '活动',
                Iid: 'enrollment-1',
                StatusName: '已报名',
              },
            ],
            TotalPages: 1,
          },
        });
      }
      return jsonResponse({ error: 'not found' }, 404);
    };

    const client = new DektClient(new HttpClient(fetchImpl));
    const session = {
      accessToken: 'dekt-token',
      baseUrl: 'https://ek.wzvtc.cn:9087/PhoneApi/api',
      obtainedAt: '2026-10-26T00:00:00.000Z',
    };

    const enrollment = await client.findEnrollment(session, 'activity-1');
    expect(enrollment?.enrollment_id).toBe('enrollment-1');

    const enrollResult = await client.enroll(session, {
      activityId: 'activity-1',
      roleId: 'role-1',
      roleText: '参与者',
    });
    expect(enrollResult.ok).toBe(true);
    const enrollBody = decodeURIComponent(
      String(requests.find((request) => request.url.includes('SaveActivity'))?.init?.body ?? ''),
    );
    expect(enrollBody).toContain('model[ActivityId]=activity-1');
    expect(enrollBody).toContain('model[ActivityRoleId]=role-1');

    const cancelResult = await client.cancel(session, 'enrollment-1');
    expect(cancelResult.ok).toBe(true);
    expect(
      requests.some((request) =>
        request.url.includes('DelActivityStudentsApply?formId=enrollment-1'),
      ),
    ).toBe(true);
  });

  it('treats duplicate enrollment as a failure', async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse({ errcode: 1, errmsg: '您已报名过该活动' });
    const client = new DektClient(new HttpClient(fetchImpl));
    const session = {
      accessToken: 'dekt-token',
      baseUrl: 'https://ek.wzvtc.cn:9087/PhoneApi/api',
      obtainedAt: '2026-10-26T00:00:00.000Z',
    };
    const result = await client.enroll(session, {
      activityId: 'activity-1',
      roleId: 'role-1',
      roleText: '参与者',
    });
    expect(result.ok).toBe(false);
    expect(result.failureMessage).toContain('已报名');
  });
});
