'use client';

/**
 * Auth Page - Email/Password Login and Registration
 * Supports light/dark theme
 * Requirements: 13.2 - Translate all alt attributes
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';
import { storeReferralCodeLocally } from '@/lib/supabase/queries/referral-codes';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useT('common');
  const refCode = searchParams.get('ref') ?? '';
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(refCode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Persist referral code to localStorage (survives OAuth redirects)
  useEffect(() => {
    if (refCode) storeReferralCodeLocally(refCode);
  }, [refCode]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'forgot') {
      if (!email) {
        setError('请填写邮箱');
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

        setSuccess('重置密码邮件已发送，请查收邮箱并点击链接重置密码。');
      } catch {
        setError('操作失败，请重试');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
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
            setError('邮箱或密码错误');
          } else if (error.message.includes('Email not confirmed')) {
            setError('请先验证邮箱后再登录');
          } else {
            setError(error.message);
          }
          return;
        }

        router.push('/app');
      } else {
        const normalizedInviteCode = inviteCode.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
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
            setError('该邮箱已被注册');
          } else {
            setError(error.message);
          }
          return;
        }

        setSuccess('注册成功！请查收验证邮件，点击链接完成验证后即可登录。');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setInviteCode('');
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [mode, email, password, confirmPassword, inviteCode, router]);

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <Image
            src="/logo.png" 
            alt={tCommon('accessibility.logo_alt')} 
            width={64}
            height={64}
            className="size-16 rounded-2xl mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">
            Fluxa
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === 'login' ? '登录你的账户' : mode === 'register' ? '创建新账户' : '找回你的密码'}
          </p>
        </div>

        {/* Auth Form */}
        <Card className="backdrop-blur-xl bg-card/80">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2 text-muted-foreground">
                  邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-12 h-12"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Input */}
              {mode !== 'forgot' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2 text-muted-foreground">
                    密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="至少 6 个字符"
                      className="pl-12 pr-12 h-12"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-8"
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Forgot password link (Login only) */}
              {mode === 'login' && (
                <div className="flex justify-end -mt-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => switchMode('forgot')}
                    className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
                  >
                    忘记密码？
                  </Button>
                </div>
              )}

              {/* Confirm Password (Register only) */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-muted-foreground">
                    确认密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次输入密码"
                      className="pl-12 h-12"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium mb-2 text-muted-foreground">
                    邀请码（选填）
                  </label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="输入邀请码"
                    className="h-12"
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-xl text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="p-3 rounded-xl text-sm bg-green-500/10 border border-green-500/20 text-green-500">
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full h-12",
                  "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-5 animate-spin mr-2" />
                    {mode === 'login' ? '登录中...' : mode === 'register' ? '注册中...' : '发送中...'}
                  </>
                ) : (
                  mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送重置邮件'
                )}
              </Button>
            </form>

            {/* Divider */}
            {mode !== 'forgot' && (
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或</span>
                </div>
              </div>
            )}

            {/* Google Sign In */}
            {mode !== 'forgot' && (
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                className="w-full h-12 mt-4"
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
                <svg className="size-5 mr-2" viewBox="0 0 24 24">
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
                使用 Google 登录
              </Button>
            )}

            {/* Toggle Mode */}
            <div className="mt-6 text-center text-sm">
              {mode === 'forgot' ? (
                <Button
                  variant="link"
                  onClick={() => switchMode('login')}
                  className="p-0 h-auto font-medium text-primary"
                >
                  返回登录
                </Button>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    {mode === 'login' ? '还没有账户？' : '已有账户？'}
                  </span>
                  <Button
                    variant="link"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="ml-1 p-0 h-auto font-medium text-primary"
                  >
                    {mode === 'login' ? '立即注册' : '立即登录'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs mt-6 text-muted-foreground">
          继续即表示你同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
