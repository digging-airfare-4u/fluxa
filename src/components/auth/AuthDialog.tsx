'use client';

/**
 * AuthDialog - Login/Register Dialog Component
 * Modal-based authentication instead of page redirect
 * Requirements: 7.5, 8.1, 8.2, 8.3, 11.2, 13.2
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: AuthMode;
  redirectTo?: string;
  /** Pre-filled referral code from ?ref= URL param */
  initialReferralCode?: string;
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = 'login',
  redirectTo = '/app',
  initialReferralCode = '',
}: AuthDialogProps) {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useT('common');
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialReferralCode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'forgot') {
      if (!email) {
        setError(t('errors.email_required'));
        return;
      }

      setIsLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
          setError(error.message);
          return;
        }

        setSuccess(t('forgot.success'));
      } catch {
        setError(t('errors.generic_error'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError(t('errors.email_required') + ' ' + t('errors.password_required'));
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('errors.password_mismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('errors.password_too_short'));
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError(t('errors.invalid_credentials'));
          } else if (error.message.includes('Email not confirmed')) {
            setError(t('errors.email_not_confirmed'));
          } else {
            setError(error.message);
          }
          return;
        }

        onOpenChange(false);
        router.push(redirectTo);
        router.refresh();
      } else {
        const normalizedInviteCode = inviteCode.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
            data: normalizedInviteCode
              ? {
                  pending_invite_code: normalizedInviteCode,
                  pending_referral_code: normalizedInviteCode,
                }
              : undefined,
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            setError(t('errors.email_already_registered'));
          } else {
            setError(error.message);
          }
          return;
        }

        setSuccess(t('register.success'));
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setInviteCode('');
      }
    } catch {
      setError(t('errors.generic_error'));
    } finally {
      setIsLoading(false);
    }
  }, [mode, email, password, confirmPassword, inviteCode, router, onOpenChange, redirectTo, t]);

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  }, []);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setInviteCode(initialReferralCode);
    setError(null);
    setSuccess(null);
    setMode(defaultMode);
  }, [defaultMode, initialReferralCode]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/logo.png" 
              alt={tCommon('accessibility.logo_alt')} 
              width={48}
              height={48}
              className="size-12 rounded-xl"
            />
            <DialogTitle className="text-xl font-semibold">
              {mode === 'login' ? t('login.title') : mode === 'register' ? t('register.title') : t('forgot.title')}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5 text-muted-foreground">
              {t('login.email_label')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.email_placeholder')}
                className="pl-10 h-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          {mode !== 'forgot' && (
            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5 text-muted-foreground">
                {t('login.password_label')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.password_placeholder')}
                  className="pl-10 pr-10 h-10"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Forgot password link (Login only) */}
          {mode === 'login' && (
            <div className="flex justify-end -mt-1">
              <Button
                type="button"
                variant="link"
                onClick={() => switchMode('forgot')}
                className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
              >
                {t('forgot.link')}
              </Button>
            </div>
          )}

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm-password" className="block text-sm font-medium mb-1.5 text-muted-foreground">
                {t('register.confirm_password_label')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('register.confirm_password_placeholder')}
                  className="pl-10 h-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-invite-code" className="block text-sm font-medium mb-1.5 text-muted-foreground">
                邀请码（选填）
              </label>
              <Input
                id="auth-invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="输入邀请码"
                className="h-10"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-lg text-sm bg-destructive/10 border border-destructive/20 text-destructive">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-2.5 rounded-lg text-sm bg-green-500/10 border border-green-500/20 text-green-500">
              {success}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-10",
              "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                {mode === 'login' ? t('login.submitting') : mode === 'register' ? t('register.submitting') : t('forgot.submitting')}
              </>
            ) : (
              mode === 'login' ? t('login.submit') : mode === 'register' ? t('register.submit') : t('forgot.submit')
            )}
          </Button>

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('login.or_divider')}</span>
              </div>
            </div>
          )}

          {/* Google Sign In */}
          {mode !== 'forgot' && (
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="w-full h-10"
              onClick={async () => {
                setError(null);
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                  },
                });
                if (error) setError(error.message);
              }}
            >
              <svg className="size-4 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t('login.google_button')}
            </Button>
          )}

          {/* Toggle Mode */}
          <div className="text-center text-sm">
            {mode === 'forgot' ? (
              <Button
                type="button"
                variant="link"
                onClick={() => switchMode('login')}
                className="p-0 h-auto font-medium text-primary"
              >
                {t('forgot.back_to_login')}
              </Button>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {mode === 'login' ? t('login.no_account') : t('register.has_account')}
                </span>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="ml-1 p-0 h-auto font-medium text-primary"
                >
                  {mode === 'login' ? t('login.register_link') : t('register.login_link')}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
