/**
 * Alipay Page Payment Adapter
 * Implements ChannelAdapter for Alipay website (PC page) payment.
 *
 * Uses Alipay Open Platform unified trade APIs:
 * - alipay.trade.page.pay (create desktop page payment)
 * - alipay.trade.query (query order)
 * - alipay.trade.refund (submit refund)
 *
 * Sign method: RSA2 (SHA256withRSA)
 */

import crypto from 'crypto';

import type {
  ChannelAdapter,
  ChannelAdapterCreateResult,
  ChannelAdapterVerifyResult,
  PaymentOrder,
} from '../types';

export interface AlipayConfig {
  appId: string;
  /** Merchant RSA2 private key (PKCS8 PEM) */
  privateKey: string;
  /** Alipay public key (for notification verification) */
  alipayPublicKey: string;
  /** Gateway URL, defaults to production */
  gateway?: string;
  /** Notify URL for async callbacks */
  notifyUrl: string;
}

const DEFAULT_GATEWAY = 'https://openapi.alipay.com/gateway.do';

export class AlipayAdapter implements ChannelAdapter {
  readonly provider = 'alipay' as const;
  readonly channel = 'alipay_page' as const;

  private config: AlipayConfig;
  private gateway: string;

  constructor(config: AlipayConfig) {
    this.config = config;
    this.gateway = config.gateway ?? DEFAULT_GATEWAY;
  }

  async createPayment(
    order: PaymentOrder,
    returnUrl: string
  ): Promise<ChannelAdapterCreateResult> {
    const bizContent = {
      out_trade_no: order.order_no,
      total_amount: (order.amount_fen / 100).toFixed(2),
      subject: this.buildSubject(order),
      product_code: 'FAST_INSTANT_TRADE_PAY',
    };

    const params = this.buildCommonParams('alipay.trade.page.pay');
    params.biz_content = JSON.stringify(bizContent);
    params.return_url = returnUrl;
    params.notify_url = this.config.notifyUrl;
    params.sign = this.sign(params);

    // For page pay, we return a form URL that the frontend redirects to
    const formUrl = `${this.gateway}?${new URLSearchParams(params).toString()}`;

    return {
      provider_payload: { method: 'alipay.trade.page.pay', biz_content: bizContent },
      provider_response: { form_url: formUrl },
      channel_data: {
        type: 'redirect',
        url: formUrl,
      },
    };
  }

  async verifyNotification(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<ChannelAdapterVerifyResult> {
    const params = Object.fromEntries(new URLSearchParams(rawBody));
    const sign = params.sign;
    const signType = params.sign_type;

    if (!sign || signType !== 'RSA2') {
      return { valid: false, order_no: null, provider_transaction_id: null, paid_at: null, parsed_data: params };
    }

    // Remove sign and sign_type before verification
    const verifyParams = { ...params };
    delete verifyParams.sign;
    delete verifyParams.sign_type;

    const valid = this.verifySign(verifyParams, sign);

    const tradeStatus = params.trade_status;
    const isPaid = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';

    return {
      valid,
      order_no: isPaid ? params.out_trade_no ?? null : null,
      provider_transaction_id: isPaid ? params.trade_no ?? null : null,
      paid_at: isPaid ? params.gmt_payment ?? null : null,
      parsed_data: params,
    };
  }

  async queryOrder(orderNo: string): Promise<{
    paid: boolean;
    provider_transaction_id: string | null;
    paid_at: string | null;
  }> {
    const bizContent = { out_trade_no: orderNo };
    const params = this.buildCommonParams('alipay.trade.query');
    params.biz_content = JSON.stringify(bizContent);
    params.sign = this.sign(params);

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    const result = await response.json();
    const queryResponse = result.alipay_trade_query_response;

    if (!queryResponse || queryResponse.code !== '10000') {
      return { paid: false, provider_transaction_id: null, paid_at: null };
    }

    const tradeStatus = queryResponse.trade_status;
    const isPaid = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';

    return {
      paid: isPaid,
      provider_transaction_id: isPaid ? queryResponse.trade_no : null,
      paid_at: isPaid ? queryResponse.send_pay_date : null,
    };
  }

  async refund(
    orderNo: string,
    refundNo: string,
    _totalAmountFen: number,
    refundAmountFen: number,
    reason?: string
  ): Promise<{ provider_refund_id: string; status: 'processing' | 'succeeded' | 'failed' }> {
    const bizContent: Record<string, string> = {
      out_trade_no: orderNo,
      out_request_no: refundNo,
      refund_amount: (refundAmountFen / 100).toFixed(2),
    };
    if (reason) bizContent.refund_reason = reason;

    const params = this.buildCommonParams('alipay.trade.refund');
    params.biz_content = JSON.stringify(bizContent);
    params.sign = this.sign(params);

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    const result = await response.json();
    const refundResponse = result.alipay_trade_refund_response;

    if (!refundResponse || refundResponse.code !== '10000') {
      return { provider_refund_id: '', status: 'failed' };
    }

    // Alipay refund is synchronous — succeeded means done
    return {
      provider_refund_id: refundResponse.trade_no ?? orderNo,
      status: 'succeeded',
    };
  }

  // ─── Internal ───────────────────────────────────────────────────

  private buildCommonParams(method: string): Record<string, string> {
    return {
      app_id: this.config.appId,
      method,
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      format: 'JSON',
    };
  }

  private sign(params: Record<string, string>): string {
    const sortedStr = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== '')
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(sortedStr, 'utf8');
    return signer.sign(this.config.privateKey, 'base64');
  }

  private verifySign(params: Record<string, string>, signature: string): boolean {
    const sortedStr = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== '')
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(sortedStr, 'utf8');
    return verifier.verify(this.config.alipayPublicKey, signature, 'base64');
  }

  private buildSubject(order: PaymentOrder): string {
    const metadata = (order.metadata ?? {}) as { product_title?: string };
    return metadata.product_title ?? `Fluxa - ${order.order_no}`;
  }
}
