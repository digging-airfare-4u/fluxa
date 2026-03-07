/**
 * Channel Adapter Factory
 * Resolves the correct ChannelAdapter based on payment channel and server-side config.
 * Reads credentials from environment variables.
 */

import type { ChannelAdapter, PaymentChannel } from './types';
import { AlipayAdapter, type AlipayConfig } from './adapters/alipay';
import { WechatNativeAdapter, WechatJsapiAdapter, type WechatPayConfig } from './adapters/wechat';
import { UnionPayAdapter, type UnionPayConfig } from './adapters/unionpay';

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getAlipayConfig(): AlipayConfig {
  return {
    appId: getEnvOrThrow('ALIPAY_APP_ID'),
    privateKey: getEnvOrThrow('ALIPAY_PRIVATE_KEY'),
    alipayPublicKey: getEnvOrThrow('ALIPAY_PUBLIC_KEY'),
    gateway: process.env.ALIPAY_GATEWAY,
    notifyUrl: `${getEnvOrThrow('NEXT_PUBLIC_APP_URL')}/api/payments/notify/alipay`,
  };
}

function getWechatPayConfig(): WechatPayConfig {
  return {
    appId: getEnvOrThrow('WECHAT_PAY_APP_ID'),
    mchId: getEnvOrThrow('WECHAT_PAY_MCH_ID'),
    apiV3Key: getEnvOrThrow('WECHAT_PAY_API_V3_KEY'),
    privateKey: getEnvOrThrow('WECHAT_PAY_PRIVATE_KEY'),
    serialNo: getEnvOrThrow('WECHAT_PAY_SERIAL_NO'),
    platformPublicKey: getEnvOrThrow('WECHAT_PAY_PLATFORM_PUBLIC_KEY'),
    notifyUrl: `${getEnvOrThrow('NEXT_PUBLIC_APP_URL')}/api/payments/notify/wechat`,
    apiBase: process.env.WECHAT_PAY_API_BASE,
  };
}

function getUnionPayConfig(): UnionPayConfig {
  return {
    merId: getEnvOrThrow('UNIONPAY_MER_ID'),
    signCert: getEnvOrThrow('UNIONPAY_SIGN_CERT'),
    signCertPassword: getEnvOrThrow('UNIONPAY_SIGN_CERT_PASSWORD'),
    encryptKey: getEnvOrThrow('UNIONPAY_ENCRYPT_KEY'),
    notifyUrl: `${getEnvOrThrow('NEXT_PUBLIC_APP_URL')}/api/payments/notify/unionpay`,
    gateway: process.env.UNIONPAY_GATEWAY,
  };
}

/**
 * Get a ChannelAdapter for the given payment channel.
 * @param openId - Required for wechat_jsapi channel (user's WeChat OpenID)
 */
export function getAdapter(channel: PaymentChannel, openId?: string): ChannelAdapter {
  switch (channel) {
    case 'alipay_page':
      return new AlipayAdapter(getAlipayConfig());

    case 'wechat_native':
      return new WechatNativeAdapter(getWechatPayConfig());

    case 'wechat_jsapi': {
      if (!openId) {
        throw new Error('WeChat JSAPI requires user openId');
      }
      return new WechatJsapiAdapter(getWechatPayConfig(), openId);
    }

    case 'unionpay':
      return new UnionPayAdapter(getUnionPayConfig());

    default:
      throw new Error(`Unsupported payment channel: ${channel}`);
  }
}

/**
 * Get a ChannelAdapter by provider name (for webhook handling).
 */
export function getAdapterByProvider(provider: 'alipay' | 'wechat' | 'unionpay'): ChannelAdapter {
  switch (provider) {
    case 'alipay':
      return new AlipayAdapter(getAlipayConfig());
    case 'wechat':
      return new WechatNativeAdapter(getWechatPayConfig());
    case 'unionpay':
      return new UnionPayAdapter(getUnionPayConfig());
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
