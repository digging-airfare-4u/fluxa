'use client';

/**
 * Reset Password Page
 * User arrives here after clicking password reset link from email.
 * The Supabase client auto-detects the recovery token from the URL hash
 * via detectSessionInUrl: true, then fires PASSWORD_RECOVERY event.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

export default function ResetPasswordPage() {
  const router = useRouter();
  const tCommon = useT('common');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if there's already an active session (user may have refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('请填写新密码');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/app'), 2000);
    } catch {
      setError('操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="aurora-bg" />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt={tCommon('accessibility.logo_alt')}
            width={64}
            height={64}
            className="size-16 rounded-2xl mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">
            重置密码
          </h1>
          <p className="mt-2 text-muted-foreground">
            请输入你的新密码
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-card/80">
          <CardContent className="p-8">
            {success ? (
              <div className="text-center space-y-4">
                <div className="p-3 rounded-xl text-sm bg-green-500/10 border border-green-500/20 text-green-500">
                  密码重置成功！正在跳转...
                </div>
              </div>
            ) : !ready ? (
              <div className="text-center space-y-4">
                <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">正在验证重置链接...</p>
                <Button
                  variant="link"
                  onClick={() => router.push('/auth')}
                  className="text-sm text-primary"
                >
                  返回登录
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-2 text-muted-foreground">
                    新密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <Input
                      id="new-password"
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

                <div>
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium mb-2 text-muted-foreground">
                    确认新密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                      className="pl-12 h-12"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                    {error}
                  </div>
                )}

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
                      提交中...
                    </>
                  ) : (
                    '重置密码'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
