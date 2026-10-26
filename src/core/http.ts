import { CLI_VERSION } from './version.js';
import { WzvtcError } from './errors.js';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  redirect?: 'follow' | 'error' | 'manual';
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: unknown | null;
  url: string;
}

export class HttpClient {
  constructor(
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
    private readonly defaultTimeoutMs = 20_000,
  ) {}

  async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.defaultTimeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': `wzvtc-anything/${CLI_VERSION}`,
          ...options.headers,
        },
        body: options.body,
        redirect: options.redirect ?? 'follow',
        signal: controller.signal,
      });
      const text = await response.text();
      let json: unknown | null = null;
      if (text.trim().length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        text,
        json,
        url: response.url || url,
      };
    } catch (error) {
      const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new WzvtcError(
        'network_error',
        isTimeout ? '请求超时' : `网络请求失败：${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
          retryable: true,
          action: {
            type: 'wait',
            message: '检查网络或 WebVPN 后重试；读操作可安全重试，写操作请先对账',
          },
          details: cause?.code ? { cause: cause.code } : undefined,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async postForm(
    url: string,
    form: Record<string, string> | string,
    headers: Record<string, string> = {},
    redirect: 'follow' | 'manual' = 'follow',
  ): Promise<HttpResponse> {
    const body = typeof form === 'string' ? form : new URLSearchParams(form).toString();
    return this.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body,
      redirect,
    });
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
