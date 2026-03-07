# Payments Operations Guide

## Environment Variables

### Required for Alipay
```
ALIPAY_APP_ID=           # Alipay Open Platform App ID
ALIPAY_PRIVATE_KEY=      # Merchant RSA2 private key (PKCS8 PEM)
ALIPAY_PUBLIC_KEY=       # Alipay public key for notification verification
ALIPAY_GATEWAY=          # Optional: defaults to https://openapi.alipay.com/gateway.do
                         # Use https://openapi-sandbox.dl.alipaydev.com/gateway.do for sandbox
```

### Required for WeChat Pay
```
WECHAT_PAY_APP_ID=       # WeChat AppID
WECHAT_PAY_MCH_ID=       # Merchant ID
WECHAT_PAY_API_V3_KEY=   # APIv3 key for notification decryption
WECHAT_PAY_PRIVATE_KEY=  # Merchant private key (PEM)
WECHAT_PAY_SERIAL_NO=    # Merchant certificate serial number
WECHAT_PAY_PLATFORM_PUBLIC_KEY= # WeChat platform public key PEM (for webhook signature verification)
WECHAT_PAY_API_BASE=     # Optional: defaults to https://api.mch.weixin.qq.com
```

### Required for Cron
```
CRON_SECRET=             # Shared secret for /api/payments/cron endpoint
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key (server-side only)
```

## Sandbox Testing

### Alipay Sandbox
1. Register at https://open.alipay.com/develop/sandbox
2. Use sandbox App ID and keys in env vars
3. Set `ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do`
4. Use sandbox buyer accounts for testing

### WeChat Pay Sandbox
1. Use the WeChat Pay API sandbox certificates
2. Set `WECHAT_PAY_API_BASE=https://api.mch.weixin.qq.com/sandboxnew`
3. Test amounts must match sandbox rules (specific amounts for specific results)

### Testing Checklist
- [ ] Create order via POST /api/payments/checkout
- [ ] Verify order appears in payment_orders table
- [ ] Complete sandbox payment
- [ ] Verify notification hits /api/payments/notify/{provider}
- [ ] Verify order transitions to 'paid' status
- [ ] Verify user_profiles.membership_level updates
- [ ] Verify user_profiles.points increases
- [ ] Verify point_transactions records the grant
- [ ] Test duplicate notification (should be idempotent)
- [ ] Test order expiration via POST /api/payments/cron
- [ ] Test order status polling via GET /api/payments/order-status

## UnionPay Enablement Checklist

UnionPay is currently feature-flagged off. To enable:

1. **Credentials**
   - Obtain merchant certificate (PFX) from UnionPay
   - Configure environment variables:
     ```
     UNIONPAY_MER_ID=
     UNIONPAY_SIGN_CERT=
     UNIONPAY_SIGN_CERT_PASSWORD=
     UNIONPAY_ENCRYPT_KEY=
     UNIONPAY_GATEWAY=     # Optional: defaults to production
     ```

2. **Implement Adapter**
   - Replace the stub methods in `src/lib/payments/adapters/unionpay.ts`
   - Implement UnionPay Gateway API for:
     - `frontTransReq` (page payment creation)
     - `backTransReq` (notification processing)
     - `queryTrans` (order query)
     - `refund` (refund submission)

3. **Enable Channel**
   - Update `system_settings.payment_channels`:
     ```sql
     UPDATE system_settings
     SET value = jsonb_set(value, '{unionpay,enabled}', 'true')
     WHERE key = 'payment_channels';
     ```

4. **Verify**
   - Run sandbox tests with UnionPay test cards
   - Verify notification URL is accessible
   - Verify refund flow end-to-end

## Rollback Procedure

1. **Disable payments**
   ```sql
   UPDATE system_settings SET value = '{"enabled": false}' WHERE key = 'payment_enabled';
   ```

2. **Disable specific channels**
   ```sql
   UPDATE system_settings
   SET value = jsonb_set(value, '{alipay_page,enabled}', 'false')
   WHERE key = 'payment_channels';
   ```

3. **Data preservation**: Order data is preserved; pending orders will be expired by the cron job. Fulfilled memberships and points are not rolled back automatically.

4. **Manual reconciliation**: Use the reconciliation export to verify all paid orders were fulfilled:
   ```
   POST /api/payments/cron  (with x-cron-secret header)
   ```

## Cron Setup

The `/api/payments/cron` endpoint should be called every 5 minutes:

```bash
# Example: using curl from a cron job
*/5 * * * * curl -s -X POST https://your-domain.com/api/payments/cron -H "x-cron-secret: YOUR_SECRET"
```

Or use Vercel Cron with a custom request header (recommended):
```json
// vercel.json
{
  "crons": [{
    "path": "/api/payments/cron",
    "schedule": "*/5 * * * *"
  }]
}
```

Ensure your scheduler sends `x-cron-secret: YOUR_SECRET` in headers.
