import { HttpClient, type HttpResponse } from '../../core/http.js';
import { WzvtcError } from '../../core/errors.js';
import type { ProviderSession } from '../../core/vault/vault.js';

export const ZYH_BASE = 'https://ogmapi.zyh365.com/api';
// Public H5 client key embedded in the volunteer platform's web bundle; not a user secret.
const ZYH_ACCESS_KEY_ID = '92ae62f25d4d4ac8a58d58e2476a4e5b';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

interface ZyhResponse {
  status: number;
  json: Record<string, unknown> | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatTimestamp(value: unknown): string | null {
  const numeric = toNumber(value);
  if (numeric === null || numeric <= 0) return null;
  const local = new Date(numeric + 8 * 60 * 60 * 1000);
  return local.toISOString().replace('Z', '+08:00');
}

export interface ZyhHoursSummary {
  credit_hours: number | null;
  honor_hours: number | null;
  training_hours: number | null;
  total_hours: number | null;
  points: number | null;
  ranking: number | null;
}

export interface ZyhHoursRecord {
  activity: string;
  signin_at: string | null;
  signout_at: string | null;
  hours: number | null;
}

export class ZyhClient {
  constructor(private readonly http: HttpClient = new HttpClient()) {}

  async loginWithPassword(username: string, password: string): Promise<ProviderSession> {
    const response = await this.http.postForm(
      `${ZYH_BASE}/userCenter/login.do`,
      {
        api: 'userCenter/login',
        username,
        password,
        apimode: 'vmsapi',
        AccessKeyId: ZYH_ACCESS_KEY_ID,
      },
      this.loginHeaders(),
    );
    const json = response.json as Record<string, unknown> | null;
    const token = response.headers.get('at');
    const userId = response.headers.get('user-id');
    if (response.status !== 200 || json?.errCode !== '0000' || !token || !userId) {
      throw new WzvtcError('auth_required', '志愿汇账号密码登录失败', {
        action: {
          type: 'ask_user',
          message: '检查志愿汇账号密码后手动重试；不要反复重试',
          requires_user: true,
        },
        details: {
          status: response.status,
          err_code: json?.errCode ?? null,
          has_token_header: Boolean(token),
          has_user_header: Boolean(userId),
        },
      });
    }
    return {
      accessToken: token,
      userId,
      baseUrl: ZYH_BASE,
      obtainedAt: new Date().toISOString(),
    };
  }

  async probe(session: ProviderSession): Promise<boolean> {
    await this.summary(session);
    return true;
  }

  async summary(session: ProviderSession): Promise<ZyhHoursSummary> {
    const response = await this.postWithSession(session, '/volunteerinfo/getvolunteerbyId.do', {
      api: 'volunteerinfo/getvolunteerbyId',
      apimode: 'vmsapi',
      zyzid: session.userId ?? '',
    });
    const json = response.json ?? {};
    const nav = Array.isArray(json.nav) ? json.nav : [];
    const findNav = (pattern: RegExp): number | null => {
      const item = nav.find(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' &&
          entry !== null &&
          pattern.test(String((entry as Record<string, unknown>).name ?? '')),
      );
      return item ? toNumber(item.value) : null;
    };
    const credit = findNav(/信用时数/);
    const honor = findNav(/荣誉时数/);
    const training = findNav(/培训时长/);
    const total = toNumber(json.hours_totalduration) ?? (credit ?? 0) + (honor ?? 0);
    return {
      credit_hours: credit,
      honor_hours: honor,
      training_hours: training,
      total_hours: total,
      points: toNumber(json.points),
      ranking: toNumber(json.ranking),
    };
  }

  async hours(
    session: ProviderSession,
    options: { year?: number; page?: number; rows?: number } = {},
  ): Promise<{ items: ZyhHoursRecord[]; page: number }> {
    const year = options.year ?? new Date().getFullYear();
    const page = options.page ?? 1;
    const rows = options.rows ?? 20;
    const response = await this.postWithSession(session, '/activity/hoursList.do', {
      api: 'activity/hoursList',
      apimode: 'vmsapi',
      zyzid: session.userId ?? '',
      year: String(year),
      page: String(page),
      rows: String(rows),
    });
    const data = Array.isArray(response.json?.data) ? response.json.data : [];
    return {
      page,
      items: data
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          activity: String(item.activityname ?? ''),
          signin_at: formatTimestamp(item.signintime),
          signout_at: formatTimestamp(item.signouttime),
          hours: toNumber(item.value),
        })),
    };
  }

  private async postWithSession(
    session: ProviderSession,
    path: string,
    form: Record<string, string>,
  ): Promise<ZyhResponse> {
    const response = await this.http.postForm(`${session.baseUrl}${path}`, form, {
      ...this.sessionHeaders(session),
      'content-type': 'application/x-www-form-urlencoded',
    });
    if (response.status === 401) {
      throw new WzvtcError('auth_expired', '志愿汇会话已失效', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth login zyh --password-stdin',
          message: '请重新登录志愿汇',
          requires_user: true,
        },
      });
    }
    if (!response.ok) {
      throw new WzvtcError('upstream_changed', `志愿汇接口返回 HTTP ${response.status}`, {
        details: { status: response.status },
      });
    }
    if (response.json === null) {
      if (/<html/i.test(response.text)) {
        throw new WzvtcError('auth_expired', '志愿汇返回了登录页', {
          action: {
            type: 'run_command',
            command: 'wzvtc auth login zyh --password-stdin',
            message: '请重新登录志愿汇',
            requires_user: true,
          },
        });
      }
      throw new WzvtcError('upstream_changed', '志愿汇接口返回了非 JSON 响应');
    }
    const json = response.json as Record<string, unknown> | null;
    if (json?.errCode && json.errCode !== '0000') {
      if (json.errCode === 'E5000') {
        throw new WzvtcError('auth_expired', '志愿汇 token 已失效', {
          action: {
            type: 'run_command',
            command: 'wzvtc auth login zyh --password-stdin',
            message: '请重新登录志愿汇',
            requires_user: true,
          },
        });
      }
      throw new WzvtcError('upstream_blocked', '志愿汇拒绝了本次只读请求', {
        action: {
          type: 'ask_user',
          message: '停止自动化，改用志愿汇官方渠道；不要绕过平台限制',
          requires_user: true,
        },
        details: { err_code: json.errCode },
      });
    }
    return { status: response.status, json };
  }

  private loginHeaders(): Record<string, string> {
    return {
      accept: 'application/json, text/plain, */*',
      origin: 'https://m.zyh365.com',
      referer: 'https://m.zyh365.com/html/zyhH5/',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': MOBILE_UA,
    };
  }

  private sessionHeaders(session: ProviderSession): Record<string, string> {
    return {
      authorization: session.accessToken,
      'user-id': session.userId ?? '',
      'platform-id': '3',
      accept: 'application/json, text/plain, */*',
      origin: 'https://m.zyh365.com',
      referer: 'https://m.zyh365.com/html/zyhH5/',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': MOBILE_UA,
    };
  }
}
