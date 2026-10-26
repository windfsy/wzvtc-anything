import qs from 'qs';
import { HttpClient, type HttpResponse } from '../../core/http.js';
import { WzvtcError } from '../../core/errors.js';
import { rsaEncryptPkcs1, WZVTC_MOBILE_RSA_PUBLIC_KEY } from '../../core/rsa.js';
import type { XgxtSession } from '../../core/vault/vault.js';
import { XGXT_HOSTS } from './linkCode.js';

export interface XgxtLeaveList {
  items: unknown[];
  totalPages?: number;
  isApply?: unknown;
  rawKeys?: string[];
}

export interface XgxtWriteResponse {
  status: number;
  json: unknown | null;
  textPreview: string;
  ok: boolean;
  unknown?: boolean;
  failureMessage?: string;
}

interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  Msg?: string;
  msg?: string;
  error?: string;
  UserType?: string;
  IsMore?: unknown;
}

const FAILURE_PATTERN = /(失败|错误|不能|请选择|不存在|已存在|无权|异常|非法)/;

export class XgxtClient {
  constructor(private readonly http: HttpClient = new HttpClient()) {}

  async exchangeLinkCode(code: string, preferredHost?: string): Promise<XgxtSession> {
    const hosts = preferredHost ? [preferredHost] : [...XGXT_HOSTS];

    for (const host of hosts) {
      const baseUrl = `https://${host}/PhoneApi/api`;
      const url = `${baseUrl}/Account/Login?code=${encodeURIComponent(code)}`;
      let response: HttpResponse;
      try {
        response = await this.http.postForm(
          url,
          { grant_type: 'password', username: '', password: '' },
          {
            origin: `https://${host}`,
            referer: `https://${host}/Phone/index.html`,
            accept: 'application/json, text/plain, */*',
          },
        );
      } catch {
        continue;
      }

      const data = response.json as LoginResponse | null;
      if (response.ok && data?.access_token) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          baseUrl,
          obtainedAt: new Date().toISOString(),
        };
      }

      // A code is likely consumed by a 400/401. Do not replay it against the fallback host.
      if (response.status === 400 || response.status === 401) break;
    }

    throw new WzvtcError('link_code_expired', '学工链接换取 token 失败', {
      action: {
        type: 'ask_user',
        command: 'wzvtc auth import xgxt --channel wechat-mobile',
        message: '请重新从微信公众号复制链接并导入；不要复用旧链接',
        requires_user: true,
      },
    });
  }

  async loginWithPassword(
    username: string,
    password: string,
    preferredHost?: string,
  ): Promise<XgxtSession> {
    const hosts = preferredHost ? [preferredHost] : [...XGXT_HOSTS];
    let networkError: WzvtcError | null = null;

    for (const host of hosts) {
      const baseUrl = `https://${host}/PhoneApi/api`;
      let response: HttpResponse;
      try {
        response = await this.http.postForm(
          `${baseUrl}/Account/Login?OpenId=`,
          {
            grant_type: 'password',
            username,
            password: rsaEncryptPkcs1(WZVTC_MOBILE_RSA_PUBLIC_KEY, password),
          },
          {
            origin: `https://${host}`,
            referer: `https://${host}/Phone/index.html`,
            accept: 'application/json, text/plain, */*',
          },
        );
      } catch (error) {
        networkError =
          error instanceof WzvtcError
            ? error
            : new WzvtcError('network_error', '无法连接学工登录接口', { cause: error });
        continue;
      }

      const data = response.json as LoginResponse | null;
      if (response.ok && data?.access_token) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          baseUrl,
          obtainedAt: new Date().toISOString(),
        };
      }

      const rawMessage =
        (data?.Msg as string | undefined) ??
        (data?.msg as string | undefined) ??
        (data?.error as string | undefined) ??
        '';
      const msgKind = /密码|账号|用户名/.test(rawMessage)
        ? 'invalid_credentials'
        : /绑定/.test(rawMessage)
          ? 'need_binding'
          : /激活/.test(rawMessage)
            ? 'need_activation'
            : /配置/.test(rawMessage)
              ? 'need_config'
              : rawMessage
                ? 'upstream_message'
                : 'no_message';

      // Do not replay a failed password login against another host; it risks lockout.
      throw new WzvtcError('auth_required', '学工账号密码登录失败', {
        action: {
          type: 'ask_user',
          message: '检查账号密码后手动重试；不要反复重试。也可以改用微信 link-code 导入',
          requires_user: true,
        },
        details: {
          status: response.status,
          msg_kind: msgKind,
          response_keys: data ? Object.keys(data).sort() : [],
        },
      });
    }

    throw (
      networkError ??
      new WzvtcError('network_error', '无法连接学工登录接口', {
        retryable: true,
        action: { type: 'wait', message: '检查网络或 WebVPN 后重试' },
      })
    );
  }

  async listLeaves(session: XgxtSession, page = 1): Promise<XgxtLeaveList> {
    const response = await this.requestWithSession(
      session,
      `/Leave/GetAllLeaveManageList?pageIndex=${encodeURIComponent(String(page))}`,
    );
    const root = response.json as Record<string, unknown> | null;
    if (!root) {
      throw new WzvtcError('upstream_changed', '学工请假列表返回了非 JSON 响应', {
        details: { status: response.status },
      });
    }
    const list = root.List as { Items?: unknown[]; TotalPages?: number } | undefined;
    const items = Array.isArray(list?.Items)
      ? list.Items
      : Array.isArray(root.Items)
        ? (root.Items as unknown[])
        : [];
    return {
      items,
      totalPages: list?.TotalPages ?? (typeof root.TotalPages === 'number' ? root.TotalPages : undefined),
      isApply: root.IsApply,
      rawKeys: items.length === 0 ? Object.keys(root) : undefined,
    };
  }

  async leaveInfo(session: XgxtSession, id = ''): Promise<Record<string, unknown>> {
    const response = await this.requestWithSession(
      session,
      `/Leave/AllLeaveManageInfo?Id=${encodeURIComponent(id)}`,
    );
    const root = response.json as Record<string, unknown> | null;
    if (!root) {
      throw new WzvtcError('upstream_changed', '学工请假表单返回了非 JSON 响应', {
        details: { status: response.status },
      });
    }
    return root;
  }

  async saveLeave(session: XgxtSession, info: Record<string, unknown>): Promise<XgxtWriteResponse> {
    const body = qs.stringify({ model: info });
    return this.postWrite(session, '/Leave/SaveAllLeaveManage', body);
  }

  async deleteLeave(session: XgxtSession, id: string): Promise<XgxtWriteResponse> {
    const response = await this.requestWithSession(
      session,
      `/Leave/DelAllLeaveManage?Id=${encodeURIComponent(id)}`,
      { method: 'GET', redirect: 'manual' },
      false,
    );
    return this.toWriteResponse(response);
  }

  async probe(session: XgxtSession): Promise<boolean> {
    await this.listLeaves(session, 1);
    return true;
  }

  private async postWrite(
    session: XgxtSession,
    path: string,
    body: string,
  ): Promise<XgxtWriteResponse> {
    const response = await this.requestWithSession(
      session,
      path,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      },
      false,
    );
    return this.toWriteResponse(response);
  }

  private toWriteResponse(response: HttpResponse): XgxtWriteResponse {
    const json = response.json as Record<string, unknown> | null;
    const textPreview = response.text.slice(0, 500);
    const isJsonObject = json !== null && typeof json === 'object' && !Array.isArray(json);
    const rawMessage =
      (json?.Msg as string | undefined) ??
      (json?.msg as string | undefined) ??
      (json?.error as string | undefined) ??
      (json?.errmsg as string | undefined) ??
      '';

    if (response.status >= 300 && response.status < 400) {
      return {
        status: response.status,
        json,
        textPreview,
        ok: false,
        unknown: true,
        failureMessage: '上游返回重定向',
      };
    }
    if (response.status >= 500) {
      return {
        status: response.status,
        json,
        textPreview,
        ok: false,
        unknown: true,
        failureMessage: `上游返回 HTTP ${response.status}`,
      };
    }
    if (!isJsonObject) {
      return {
        status: response.status,
        json,
        textPreview,
        ok: false,
        unknown: response.ok,
        failureMessage: response.ok ? '上游返回非 JSON 响应' : `上游返回 HTTP ${response.status}`,
      };
    }

    const failure = !response.ok || Boolean(json.error) || FAILURE_PATTERN.test(rawMessage);
    return {
      status: response.status,
      json,
      textPreview,
      ok: !failure,
      failureMessage: failure ? rawMessage || `HTTP ${response.status}` : undefined,
    };
  }

  private async requestWithSession(
    session: XgxtSession,
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      redirect?: 'follow' | 'manual';
    } = {},
    throwOnHttpError = true,
  ): Promise<HttpResponse> {
    const origin = new URL(session.baseUrl).origin;
    const response = await this.http.request(`${session.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        origin,
        referer: `${origin}/Phone/index.html`,
        accept: 'application/json, text/plain, */*',
        ...options.headers,
      },
      body: options.body,
      redirect: options.redirect ?? 'follow',
    });

    if (response.status === 401) {
      throw new WzvtcError('auth_expired', '学工会话已失效', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth import xgxt --channel wechat-mobile',
          message: '请重新从微信公众号复制链接并导入',
          requires_user: true,
        },
      });
    }

    if (throwOnHttpError && response.status >= 300 && response.status < 400) {
      throw new WzvtcError('auth_expired', '学工会话被重定向到登录页', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth import xgxt --channel wechat-mobile',
          message: '请重新导入学工链接',
          requires_user: true,
        },
      });
    }

    if (throwOnHttpError && response.status >= 400) {
      throw new WzvtcError('upstream_changed', `学工接口返回 HTTP ${response.status}`, {
        details: { status: response.status },
      });
    }

    if (throwOnHttpError && response.json === null && /<html/i.test(response.text)) {
      throw new WzvtcError('auth_expired', '学工接口返回了登录页', {
        action: {
          type: 'run_command',
          command: 'wzvtc auth import xgxt --channel wechat-mobile',
          message: '请重新导入学工链接',
          requires_user: true,
        },
      });
    }

    return response;
  }
}
