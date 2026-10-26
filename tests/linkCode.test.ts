import { describe, expect, it } from 'vitest';
import { WzvtcError } from '../src/core/errors.js';
import { parseXgxtLink } from '../src/connectors/xgxt/linkCode.js';

const code = 'TEST_CODE_123456';

describe('parseXgxtLink', () => {
  it('parses a valid direct link', () => {
    const parsed = parseXgxtLink(
      `https://xgxt.wzvtc.cn/Phone/index.html?openid=${encodeURIComponent(code)}#/StuIndex`,
    );
    expect(parsed.host).toBe('xgxt.wzvtc.cn');
    expect(parsed.code).toBe(code);
    expect(parsed.baseUrl).toBe('https://xgxt.wzvtc.cn/PhoneApi/api');
  });

  it('parses a WebVPN link', () => {
    const parsed = parseXgxtLink(
      `https://xgxt-443.webvpn.wzvtc.cn/Phone/index.html?openid=${encodeURIComponent(code)}`,
    );
    expect(parsed.host).toBe('xgxt-443.webvpn.wzvtc.cn');
    expect(parsed.baseUrl).toBe('https://xgxt-443.webvpn.wzvtc.cn/PhoneApi/api');
  });

  it('rejects a non-allowlisted host without leaking the code', () => {
    try {
      parseXgxtLink(`https://evil.example.com/Phone/index.html?openid=${code}`);
      throw new Error('expected parse to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(WzvtcError);
      const typed = error as WzvtcError;
      expect(typed.code).toBe('invalid_input');
      expect(typed.message).not.toContain(code);
    }
  });

  it('rejects http links', () => {
    expect(() =>
      parseXgxtLink(`http://xgxt.wzvtc.cn/Phone/index.html?openid=${code}`),
    ).toThrowError(WzvtcError);
  });

  it('rejects links without a code', () => {
    try {
      parseXgxtLink('https://xgxt.wzvtc.cn/Phone/index.html');
      throw new Error('expected parse to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(WzvtcError);
      expect((error as WzvtcError).code).toBe('invalid_input');
    }
  });
});
