/**
 * WeChat Pay Adapters
 * - WechatNativeAdapter: Native QR payment for desktop browsers
 * - WechatJsapiAdapter: JSAPI payment for WeChat in-app browser
 *
 * Uses WeChat Pay V3 API with HMAC-SHA256 or RSA signing.
 * https://pay.weixin.qq.com/wiki/doc/apiv3/apis/
 */

import crypto from 'crypto';

import type {
  ChannelAdapter,
  ChannelAdapterCreateResult,
  ChannelAdapterVerifyResult,
  PaymentOrder,
} from '../types';

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  /** APIv3 key for notification decryption */
  apiV3Key: string;
  /** Merchant private key (PEM) for request signing */
  privateKey: string;
  /** Serial number of the merchant certificate */
  serialNo: string;
  /** WeChat platform public key (PEM) for webhook signature verification */
  platformPublicKey?: string;
  /** Notify URL for async callbacks */
  notifyUrl: string;
  /** WeChat Pay API base, defaults to production */
  apiBase?: string;
}

const DEFAULT_API_BASE = 'https://api.mch.weixin.qq.com';

// ─── Shared Utilities ───────────────────────────────────────────────

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function buildAuthHeader(
  config: WechatPayConfig,
  method: string,
  url: string,
  body: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  const signature = signer.sign(config.privateKey, 'base64');

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
}

function decryptAesGcm(
  apiV3Key: string,
  nonce: string,
  ciphertext: string,
  associatedData: string
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key),
    Buffer.from(nonce)
  );
  decipher.setAAD(Buffer.from(associatedData));
  const cipherBuf = Buffer.from(ciphertext, 'base64');

  // Last 16 bytes are the auth tag
  const authTag = cipherBuf.subarray(cipherBuf.length - 16);
  const encrypted = cipherBuf.subarray(0, cipherBuf.length - 16);

  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

async function wechatApiRequest(
  config: WechatPayConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const base = config.apiBase ?? DEFAULT_API_BASE;
  const bodyStr = body ? JSON.stringify(body) : '';
  const auth = buildAuthHeader(config, method, path, bodyStr);

  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: auth,
    },
    body: method === 'POST' ? bodyStr : undefined,
  });

  return (await response.json()) as Record<string, unknown>;
}

// ─── WeChat Native (QR Code) Adapter ────────────────────────────────

export class WechatNativeAdapter implements ChannelAdapter {
  readonly provider = 'wechat' as const;
  readonly channel = 'wechat_native' as const;

  constructor(private config: WechatPayConfig) {}

  async createPayment(
    order: PaymentOrder,
    _returnUrl: string
  ): Promise<ChannelAdapterCreateResult> {
    const requestBody = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: this.buildDescription(order),
      out_trade_no: order.order_no,
      notify_url: this.config.notifyUrl,
      amount: {
        total: order.amount_fen,
        currency: 'CNY',
      },
    };

    const result = await wechatApiRequest(
      this.config,
      'POST',
      '/v3/pay/transactions/native',
      requestBody
    );

    return {
      provider_payload: requestBody,
      provider_response: result,
      channel_data: {
        type: 'qr',
        qr_url: result.code_url ?? '',
      },
    };
  }

  async verifyNotification(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<ChannelAdapterVerifyResult> {
    return verifyWechatNotification(this.config, rawBody, _headers);
  }

  async queryOrder(orderNo: string) {
    return queryWechatOrder(this.config, orderNo);
  }

  async refund(
    orderNo: string,
    refundNo: string,
    totalAmountFen: number,
    refundAmountFen: number,
    reason?: string
  ) {
    return submitWechatRefund(this.config, orderNo, refundNo, totalAmountFen, refundAmountFen, reason);
  }

  private buildDescription(order: PaymentOrder): string {
    const metadata = (order.metadata ?? {}) as { product_title?: string };
    return metadata.product_title ?? `Fluxa - ${order.order_no}`;
  }
}

// ─── WeChat JSAPI Adapter ───────────────────────────────────────────

export class WechatJsapiAdapter implements ChannelAdapter {
  readonly provider = 'wechat' as const;
  readonly channel = 'wechat_jsapi' as const;

  constructor(
    private config: WechatPayConfig,
    private openId: string
  ) {}

  async createPayment(
    order: PaymentOrder,
    _returnUrl: string
  ): Promise<ChannelAdapterCreateResult> {
    const requestBody = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: this.buildDescription(order),
      out_trade_no: order.order_no,
      notify_url: this.config.notifyUrl,
      amount: {
        total: order.amount_fen,
        currency: 'CNY',
      },
      payer: {
        openid: this.openId,
      },
    };

    const result = await wechatApiRequest(
      this.config,
      'POST',
      '/v3/pay/transactions/jsapi',
      requestBody
    );

    // Build JSAPI params for frontend WeixinJSBridge.invoke
    const prepayId = result.prepay_id as string;
    const jsapiParams = this.buildJsapiParams(prepayId);

    return {
      provider_payload: requestBody,
      provider_response: result,
      channel_data: {
        type: 'jsapi',
        jsapi_params: jsapiParams,
      },
    };
  }

  async verifyNotification(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<ChannelAdapterVerifyResult> {
    return verifyWechatNotification(this.config, rawBody, _headers);
  }

  async queryOrder(orderNo: string) {
    return queryWechatOrder(this.config, orderNo);
  }

  async refund(
    orderNo: string,
    refundNo: string,
    totalAmountFen: number,
    refundAmountFen: number,
    reason?: string
  ) {
    return submitWechatRefund(this.config, orderNo, refundNo, totalAmountFen, refundAmountFen, reason);
  }

  private buildJsapiParams(prepayId: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();
    const pkg = `prepay_id=${prepayId}`;

    const message = `${this.config.appId}\n${timestamp}\n${nonce}\n${pkg}\n`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    const paySign = signer.sign(this.config.privateKey, 'base64');

    return {
      appId: this.config.appId,
      timeStamp: timestamp,
      nonceStr: nonce,
      package: pkg,
      signType: 'RSA',
      paySign,
    };
  }

  private buildDescription(order: PaymentOrder): string {
    const metadata = (order.metadata ?? {}) as { product_title?: string };
    return metadata.product_title ?? `Fluxa - ${order.order_no}`;
  }
}

// ─── Shared WeChat V3 Operations ────────────────────────────────────

function verifyWechatNotification(
  config: WechatPayConfig,
  rawBody: string,
  headers: Record<string, string>
): ChannelAdapterVerifyResult {
  try {
    const timestamp = headers['wechatpay-timestamp'];
    const nonceHeader = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    if (!timestamp || !nonceHeader || !signature || !serial) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    const now = Math.floor(Date.now() / 1000);
    const replayWindowSeconds = 5 * 60;
    if (Math.abs(now - ts) > replayWindowSeconds) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    if (!config.platformPublicKey) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    const signatureMessage = `${timestamp}\n${nonceHeader}\n${rawBody}\n`;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signatureMessage);
    const signatureOk = verifier.verify(config.platformPublicKey, signature, 'base64');

    if (!signatureOk) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    const notification = JSON.parse(rawBody) as {
      event_type?: string;
      resource?: {
        algorithm: string;
        nonce: string;
        ciphertext: string;
        associated_data: string;
      };
    };

    if (!notification.resource) {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
    }

    const { nonce, ciphertext, associated_data } = notification.resource;
    const decrypted = decryptAesGcm(config.apiV3Key, nonce, ciphertext, associated_data);
    const data = JSON.parse(decrypted) as Record<string, unknown>;

    const tradeState = data.trade_state as string | undefined;
    const isPaid = tradeState === 'SUCCESS';

    return {
      valid: true,
      order_no: isPaid ? (data.out_trade_no as string) : null,
      provider_transaction_id: isPaid ? (data.transaction_id as string) : null,
      paid_at: isPaid ? (data.success_time as string) : null,
      parsed_data: data,
    };
  } catch (err) {
    console.error('[WechatPay] Failed to verify notification:', err);
    return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: {} };
  }
}

async function queryWechatOrder(
  config: WechatPayConfig,
  orderNo: string
): Promise<{ paid: boolean; provider_transaction_id: string | null; paid_at: string | null }> {
  const result = await wechatApiRequest(
    config,
    'GET',
    `/v3/pay/transactions/out-trade-no/${orderNo}?mchid=${config.mchId}`
  );

  const tradeState = result.trade_state as string | undefined;
  const isPaid = tradeState === 'SUCCESS';

  return {
    paid: isPaid,
    provider_transaction_id: isPaid ? (result.transaction_id as string) : null,
    paid_at: isPaid ? (result.success_time as string) : null,
  };
}

async function submitWechatRefund(
  config: WechatPayConfig,
  orderNo: string,
  refundNo: string,
  totalAmountFen: number,
  refundAmountFen: number,
  reason?: string
): Promise<{ provider_refund_id: string; status: 'processing' | 'succeeded' | 'failed' }> {
  const body: Record<string, unknown> = {
    out_trade_no: orderNo,
    out_refund_no: refundNo,
    amount: {
      refund: refundAmountFen,
      total: totalAmountFen,
      currency: 'CNY',
    },
  };
  if (reason) body.reason = reason;

  const result = await wechatApiRequest(config, 'POST', '/v3/refund/domestic/refunds', body);

  const status = result.status as string | undefined;
  if (status === 'SUCCESS') {
    return { provider_refund_id: result.refund_id as string, status: 'succeeded' };
  }
  if (status === 'PROCESSING') {
    return { provider_refund_id: result.refund_id as string, status: 'processing' };
  }
  return { provider_refund_id: '', status: 'failed' };
}
