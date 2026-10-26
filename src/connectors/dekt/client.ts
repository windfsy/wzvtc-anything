import { HttpClient, type HttpResponse } from '../../core/http.js';
import { WzvtcError } from '../../core/errors.js';
import { rsaEncryptPkcs1, WZVTC_MOBILE_RSA_PUBLIC_KEY } from '../../core/rsa.js';
import type { ProviderSession } from '../../core/vault/vault.js';

export const DEKT_BASE = 'https://ek.wzvtc.cn:9087';

interface LoginResponse {
  access_token?: string;
  error?: string;
  Msg?: string;
  msg?: string;
}

export interface DektActivity {
  id: string;
  name: string;
  type: string;
  time: string;
  place: string;
  status: string;
  signup_status: string;
  capacity: string;
  enrollment_id?: string;
}

export interface DektActivityDetail extends DektActivity {
  roles: Array<{ value: string; text: string }>;
  already_enrolled: boolean;
}

export interface DektTranscriptSummary {
  total_hours: unknown;
  rank: unknown;
  class_name: unknown;
  major: unknown;
  college: unknown;
  student_type: unknown;
}

export interface DektEnrollInput {
  activityId: string;
  roleId: string;
  roleText: string;
}

export interface DektWriteResponse {
  ok: boolean;
  status: number;
  failureMessage?: string;
  unknown?: boolean;
  json: unknown | null;
}

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

export function isActivityFull(capacity: string): boolean {
  const match = capacity.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return false;
  return Number(match[1]) >= Number(match[2]);
}

function todayInShanghai(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function isZeroGuid(value: unknown): boolean {
  return !value || String(value) === ZERO_GUID;
}

function parseActivity(item: Record<string, unknown>): DektActivity {
  return {
    id: text(item.Id),
    name: text(item.ActivityName),
    type: text(item.ActivityType),
    time: text(item.ActivityTime),
    place: text(item.ActPlace),
    status: text(item.StatusName),
    signup_status: text(item.BMStatusName),
    capacity: text(item.LimitStuNumberText),
    enrollment_id: isZeroGuid(item.Iid) ? undefined : text(item.Iid),
  };
}

export class DektClient {
  constructor(private readonly http: HttpClient = new HttpClient()) {}

  async loginWithPassword(username: string, password: string): Promise<ProviderSession> {
    const baseUrl = `${DEKT_BASE}/PhoneApi/api`;
    const response = await this.http.postForm(
      `${baseUrl}/Account/Login?OpenId=`,
      {
        grant_type: 'password',
        username,
        password: rsaEncryptPkcs1(WZVTC_MOBILE_RSA_PUBLIC_KEY, password),
      },
      {
        origin: DEKT_BASE,
        referer: `${DEKT_BASE}/phone/index.html`,
        accept: 'application/json, text/plain, */*',
      },
    );

    const data = response.json as LoginResponse | null;
    if (response.ok && data?.access_token) {
      return {
        accessToken: data.access_token,
        baseUrl,
        obtainedAt: new Date().toISOString(),
      };
    }

    throw new WzvtcError('auth_required', '第二课堂账号密码登录失败', {
      action: {
        type: 'ask_user',
        message: '检查第二课堂密码后手动重试；不要反复重试',
        requires_user: true,
      },
      details: {
        status: response.status,
        response_keys: data ? Object.keys(data).sort() : [],
      },
    });
  }

  async probe(session: ProviderSession): Promise<boolean> {
    await this.requestWithSession(session, '/Student/GetHomePageLinks', true);
    return true;
  }

  async listActivities(
    session: ProviderSession,
    options: { page?: number; status?: number } = {},
  ): Promise<{ items: DektActivity[]; totalPages: number }> {
    const page = options.page ?? 1;
    const status = options.status ?? -1;
    const response = await this.requestWithSession(
      session,
      `/StuAction/GetActivityList?pageIndex=${encodeURIComponent(String(page))}&ActivityName=&ActivityType=&Status=${encodeURIComponent(String(status))}`,
    );
    const data = response.json as { List?: { Items?: unknown[]; TotalPages?: number } } | null;
    if (!data) {
      throw new WzvtcError('upstream_changed', '第二课堂活动列表返回了空响应');
    }
    const items = Array.isArray(data.List?.Items) ? data.List.Items : [];
    return {
      items: items
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map(parseActivity),
      totalPages: data?.List?.TotalPages ?? 1,
    };
  }

  async getActivity(session: ProviderSession, id: string): Promise<DektActivityDetail> {
    const response = await this.requestWithSession(
      session,
      `/StuAction/GetActivityInfo?id=${encodeURIComponent(id)}`,
    );
    const data = response.json as Record<string, unknown> | null;
    if (!data) {
      throw new WzvtcError('upstream_changed', '第二课堂活动详情返回了非 JSON 响应');
    }
    const rawAct = (data.ActInfo ?? data) as Record<string, unknown>;
    const base = parseActivity(rawAct);
    const rawRoles = Array.isArray(data.ApplyRoleList)
      ? data.ApplyRoleList
      : Array.isArray(rawAct.ApplyRoleList)
        ? rawAct.ApplyRoleList
        : [];
    const applyInfo = (data.ApplyInfo ?? rawAct.ApplyInfo ?? {}) as Record<string, unknown>;
    const applyEnrollmentId = applyInfo.Iid ?? applyInfo.Id;
    return {
      ...base,
      roles: rawRoles
        .filter((role): role is Record<string, unknown> => typeof role === 'object' && role !== null)
        .map((role) => ({ value: text(role.value), text: text(role.text) })),
      already_enrolled: !isZeroGuid(applyInfo.ActivityRoleId),
      ...(isZeroGuid(applyEnrollmentId) ? {} : { enrollment_id: text(applyEnrollmentId) }),
    };
  }

  async getTranscript(
    session: ProviderSession,
    page = 1,
  ): Promise<{ items: DektTranscriptSummary[]; page: number }> {
    const response = await this.requestWithSession(
      session,
      `/StuAction/GetMyJudgeXSActionScoreList?pageIndex=${encodeURIComponent(String(page))}`,
    );
    const data = response.json as { Items?: unknown[] } | null;
    if (!data) {
      throw new WzvtcError('upstream_changed', '第二课堂成绩单返回了空响应');
    }
    const items = Array.isArray(data.Items) ? data.Items : [];
    return {
      page,
      items: items
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          total_hours: item.SumGetNum,
          rank: item.Rank,
          class_name: item.ClassName,
          major: item.SpecialtyName,
          college: item.CollegeName,
          student_type: item.SpeTypeName,
        })),
    };
  }

  async findEnrollment(
    session: ProviderSession,
    activityId: string,
  ): Promise<DektActivity | null> {
    for (let page = 1; page <= 10; page += 1) {
      const result = await this.listActivities(session, { page, status: 3 });
      const found = result.items.find((item) => item.id === activityId);
      if (found) return found;
      if (page >= result.totalPages) break;
    }
    return null;
  }

  async enroll(session: ProviderSession, input: DektEnrollInput): Promise<DektWriteResponse> {
    const response = await this.postFormWithSession(session, '/StuAction/SaveActivityStudentsApply', {
      'model[Id]': ZERO_GUID,
      'model[ActivityId]': input.activityId,
      'model[StudentId]': '',
      'model[UserType]': '',
      'model[ActivityRoleId]': input.roleId,
      'model[ActivityRoleText]': input.roleText,
      'model[ActivityRoleIndex]': '0',
      'model[InsertUserId]': '',
      'model[InsertTime]': todayInShanghai(),
      'model[FlowStatus]': '',
      'model[WFType]': '',
      'model[NextWFType]': '',
      'model[IsEdit]': '1',
    });
    return this.toWriteResponse(response);
  }

  async cancel(session: ProviderSession, enrollmentId: string): Promise<DektWriteResponse> {
    const response = await this.getRawWithSession(
      session,
      `/StuAction/DelActivityStudentsApply?formId=${encodeURIComponent(enrollmentId)}`,
    );
    return this.toWriteResponse(response);
  }

  private authHeaders(session: ProviderSession): Record<string, string> {
    return {
      authorization: `Bearer ${session.accessToken}`,
      accept: 'application/json, text/plain, */*',
      origin: DEKT_BASE,
      referer: `${DEKT_BASE}/phone/index.html`,
    };
  }

  private async postFormWithSession(
    session: ProviderSession,
    path: string,
    form: Record<string, string>,
  ): Promise<HttpResponse> {
    const response = await this.http.postForm(
      `${session.baseUrl}${path}`,
      form,
      this.authHeaders(session),
      'manual',
    );
    this.throwIfExpired(response, session);
    return response;
  }

  private async getRawWithSession(
    session: ProviderSession,
    path: string,
  ): Promise<HttpResponse> {
    const response = await this.http.request(`${session.baseUrl}${path}`, {
      headers: this.authHeaders(session),
      redirect: 'manual',
    });
    this.throwIfExpired(response, session);
    return response;
  }

  private throwIfExpired(response: HttpResponse, _session: ProviderSession): void {
    if (response.status === 401) {
      throw new WzvtcError('auth_expired', '第二课堂会话已失效', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth login dekt --password-stdin',
          message: '请重新登录第二课堂',
          requires_user: true,
        },
      });
    }
  }

  private toWriteResponse(response: HttpResponse): DektWriteResponse {
    const json = response.json as Record<string, unknown> | null;
    const isJsonObject = json !== null && typeof json === 'object' && !Array.isArray(json);
    const errcode = json?.errcode;
    const message = text(json?.errmsg ?? json?.error ?? json?.Msg);
    const errcodeFailure = errcode !== undefined && errcode !== null && String(errcode) !== '0';
    const messageFailure = /(失败|错误|不能|请选择|不存在|已报名|已满|无权|异常|非法)/.test(message);

    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        status: response.status,
        unknown: true,
        failureMessage: '上游返回重定向',
        json,
      };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        status: response.status,
        unknown: true,
        failureMessage: `上游返回 HTTP ${response.status}`,
        json,
      };
    }
    if (!isJsonObject) {
      return {
        ok: false,
        status: response.status,
        unknown: response.ok,
        failureMessage: response.ok ? '上游返回非 JSON 响应' : `上游返回 HTTP ${response.status}`,
        json,
      };
    }

    const ok = response.ok && !errcodeFailure && !messageFailure;
    return {
      ok,
      status: response.status,
      failureMessage: ok
        ? undefined
        : message || (errcodeFailure ? `errcode=${String(errcode)}` : `HTTP ${response.status}`),
      json,
    };
  }

  private async requestWithSession(
    session: ProviderSession,
    path: string,
    allowEmpty = false,
  ): Promise<HttpResponse> {
    const response = await this.http.request(`${session.baseUrl}${path}`, {
      headers: this.authHeaders(session),
    });
    if (response.status === 401) {
      throw new WzvtcError('auth_expired', '第二课堂会话已失效', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth login dekt --password-stdin',
          message: '请重新登录第二课堂',
          requires_user: true,
        },
      });
    }
    if (!response.ok) {
      throw new WzvtcError('upstream_changed', `第二课堂接口返回 HTTP ${response.status}`, {
        details: { status: response.status },
      });
    }
    if (!allowEmpty) {
      if (response.json === null && /<html/i.test(response.text)) {
        throw new WzvtcError('auth_expired', '第二课堂返回了登录页', {
          action: {
            type: 'run_command',
            command: 'wzvtc auth login dekt --password-stdin',
            message: '请重新登录第二课堂',
            requires_user: true,
          },
        });
      }
      if (response.json === null) {
        throw new WzvtcError('upstream_changed', '第二课堂接口返回了非 JSON 响应');
      }
    }
    return response;
  }
}
