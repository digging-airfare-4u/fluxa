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

type AuthMode = 'login' | 'register';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: AuthMode;
  redirectTo?: string;
}

export function AuthDialog({ 
  open, 
  onOpenChange, 
  defaultMode = 'login',
  redirectTo = '/app'
}: AuthDialogProps) {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useT('common');
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
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
      }
    } catch {
      setError(t('errors.generic_error'));
    } finally {
      setIsLoading(false);
    }
  }, [mode, email, password, confirmPassword, router, onOpenChange, redirectTo, t]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  }, [mode]);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    setMode(defaultMode);
  }, [defaultMode]);

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
              {mode === 'login' ? t('login.title') : t('register.title')}
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
                {mode === 'login' ? t('login.submitting') : t('register.submitting')}
              </>
            ) : (
              mode === 'login' ? t('login.submit') : t('register.submit')
            )}
          </Button>

          {/* Toggle Mode */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {mode === 'login' ? t('login.no_account') : t('register.has_account')}
            </span>
            <Button
              type="button"
              variant="link"
              onClick={toggleMode}
              className="ml-1 p-0 h-auto font-medium text-primary"
            >
              {mode === 'login' ? t('login.register_link') : t('register.login_link')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
