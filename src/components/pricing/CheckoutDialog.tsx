'use client';

/**
 * Checkout Dialog
 * Shows available payment channels, creates order, and polls for payment status.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, QrCode, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getSession } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { usePointsStore } from '@/lib/store/usePointsStore';
import type { PaymentChannel } from '@/lib/payments/types';

interface AvailableChannel {
  channel: PaymentChannel;
  label: string;
  label_en: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCode: string;
  productName: string;
  amountDisplay: string;
  onPaymentSuccess?: () => void;
}

type CheckoutStep = 'channels' | 'processing' | 'polling' | 'success' | 'failed';

const CHANNEL_ICONS: Record<PaymentChannel, React.ReactNode> = {
  alipay_page: <span className="text-lg">💳</span>,
  wechat_native: <QrCode className="h-4 w-4" />,
  wechat_jsapi: <span className="text-lg">💬</span>,
  unionpay: <span className="text-lg">🏦</span>,
};

export function CheckoutDialog({
  open,
  onOpenChange,
  productCode,
  productName,
  amountDisplay,
  onPaymentSuccess,
}: CheckoutDialogProps) {
  const t = useTranslations('points');
  const fetchPoints = usePointsStore((s) => s.fetchPoints);
  const [step, setStep] = useState<CheckoutStep>('channels');
  const [channels, setChannels] = useState<AvailableChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [channelData, setChannelData] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load available channels when dialog opens
  useEffect(() => {
    if (!open) {
      setStep('channels');
      setOrderNo(null);
      setChannelData(null);
      setErrorMsg(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    async function loadChannels() {
      try {
        const res = await fetch('/api/payments/channels');
        if (!res.ok) return;
        const data = await res.json();
        setChannels(data.channels ?? []);
      } catch {
        setChannels([]);
      }
    }
    loadChannels();
  }, [open]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (orderNoVal: string) => {
      stopPolling();

      let attempts = 0;
      const maxAttempts = 120; // 10 minutes at 5s interval

      pollingRef.current = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          stopPolling();
          setStep('failed');
          setErrorMsg('Payment timeout');
          return;
        }

        try {
          const session = await getSession();
          if (!session) return;

          const res = await fetch(
            `/api/payments/order-status?order_no=${encodeURIComponent(orderNoVal)}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );

          if (!res.ok) return;
          const data = await res.json();

          if (data.status === 'paid') {
            stopPolling();
            setStep('success');
            fetchPoints();
            onPaymentSuccess?.();
          } else if (data.status === 'expired' || data.status === 'failed' || data.status === 'closed') {
            stopPolling();
            setStep('failed');
            setErrorMsg(data.status === 'expired' ? 'Order expired' : 'Payment failed');
          }
        } catch {
          // Ignore polling errors, will retry
        }
      }, 5000);
    },
    [stopPolling, fetchPoints, onPaymentSuccess]
  );

  const handleSelectChannel = async (channel: PaymentChannel) => {
    setLoading(true);
    setStep('processing');
    setErrorMsg(null);

    try {
      const session = await getSession();
      if (!session) {
        setErrorMsg('Please log in first');
        setStep('failed');
        return;
      }

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ product_code: productCode, channel }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error?.message ?? 'Checkout failed');
        setStep('failed');
        return;
      }

      setOrderNo(data.order_no);
      setChannelData(data.channel_data);

      // Handle channel-specific actions
      if (data.channel_data?.type === 'redirect' && data.channel_data?.url) {
        window.open(data.channel_data.url, '_blank');
        setStep('polling');
        startPolling(data.order_no);
      } else if (data.channel_data?.type === 'qr') {
        setStep('polling');
        startPolling(data.order_no);
      } else if (data.channel_data?.type === 'jsapi') {
        // JSAPI handled by WeChat bridge — for now show polling
        setStep('polling');
        startPolling(data.order_no);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed');
      setStep('failed');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>{amountDisplay}</DialogDescription>
        </DialogHeader>

        {/* Step: Channel Selection */}
        {step === 'channels' && (
          <div className="space-y-3 py-2">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('pricing.no_channels')}
              </p>
            ) : (
              channels.map((ch) => (
                <Button
                  key={ch.channel}
                  variant="outline"
                  className="w-full justify-start gap-3 h-12"
                  onClick={() => handleSelectChannel(ch.channel)}
                  disabled={loading}
                >
                  {CHANNEL_ICONS[ch.channel]}
                  <span>{ch.label}</span>
                </Button>
              ))
            )}
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('pricing.creating_order')}</p>
          </div>
        )}

        {/* Step: Polling (awaiting payment) */}
        {step === 'polling' && (
          <div className="flex flex-col items-center py-6 gap-4">
            {channelData?.type === 'qr' && channelData?.qr_url ? (
              <div className="space-y-3 text-center">
                <div className="mx-auto w-48 h-48 border rounded-lg flex items-center justify-center bg-white">
                  {/* QR code image — uses a public QR API for rendering */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(channelData.qr_url as string)}`}
                    alt="Payment QR Code"
                    className="w-44 h-44"
                  />
                </div>
                <p className="text-sm text-muted-foreground">{t('pricing.scan_qr')}</p>
              </div>
            ) : channelData?.type === 'redirect' ? (
              <div className="space-y-3 text-center">
                <ExternalLink className="h-8 w-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">{t('pricing.redirect_hint')}</p>
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>{t('pricing.waiting_payment')}</span>
            </div>

            {orderNo && (
              <p className="text-xs text-muted-foreground">
                {t('pricing.order_no')}: {orderNo}
              </p>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className={cn('flex flex-col items-center py-8 gap-3')}>
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium">{t('pricing.payment_success')}</p>
            <Button variant="default" onClick={() => onOpenChange(false)} className="mt-2">
              {t('pricing.done')}
            </Button>
          </div>
        )}

        {/* Step: Failed */}
        {step === 'failed' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-destructive">{errorMsg ?? t('pricing.payment_failed')}</p>
            <Button
              variant="outline"
              onClick={() => {
                setStep('channels');
                setErrorMsg(null);
              }}
              className="mt-2"
            >
              {t('pricing.retry')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
