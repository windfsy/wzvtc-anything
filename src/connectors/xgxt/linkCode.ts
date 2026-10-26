import { WzvtcError } from '../../core/errors.js';

export const XGXT_HOSTS = ['xgxt.wzvtc.cn', 'xgxt-443.webvpn.wzvtc.cn'] as const;

export interface ParsedXgxtLink {
  host: string;
  code: string;
  baseUrl: string;
}

export function parseXgxtLink(raw: string): ParsedXgxtLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new WzvtcError('invalid_input', '学工链接格式不正确', {
      action: {
        type: 'ask_user',
        message: '请从微信公众号重新复制完整链接；不要手动拼接',
        requires_user: true,
      },
    });
  }

  if (url.protocol !== 'https:') {
    throw new WzvtcError('invalid_input', '学工链接必须使用 https');
  }

  if (!XGXT_HOSTS.includes(url.hostname as (typeof XGXT_HOSTS)[number])) {
    throw new WzvtcError('invalid_input', '学工链接域名不在允许列表', {
      details: { allowedHosts: [...XGXT_HOSTS] },
    });
  }

  const code = url.searchParams.get('openid') ?? url.searchParams.get('code');
  if (!code || code.length < 4 || code.length > 4096 || /\s/.test(code)) {
    throw new WzvtcError('invalid_input', '学工链接中缺少有效的 openid/code 参数', {
      action: {
        type: 'ask_user',
        message: '请从微信公众号重新复制链接；不要手动截断或修改',
        requires_user: true,
      },
    });
  }

  return {
    host: url.hostname,
    code,
    baseUrl: `https://${url.hostname}/PhoneApi/api`,
  };
}
