/**
 * Payment Domain Layer
 * Unified exports for cn-web-payments: types, services, adapters, and utilities.
 */

export * from './types';
export * from './scene';
export * from './order-no';
export * from './channels';
export { createOrder, getOrderByNo, getOrderForUser, listUserOrders, transitionOrderStatus, PaymentOrderError } from './order-service';
export { fulfillOrder, rollbackFulfillment } from './fulfillment';
export { createRefund, RefundError } from './refund-service';
export { getAdapter, getAdapterByProvider } from './adapter-factory';
export { AlipayAdapter, WechatNativeAdapter, WechatJsapiAdapter, UnionPayAdapter } from './adapters';
