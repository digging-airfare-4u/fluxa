'use client';

/**
 * AuthDialog - Login/Register Dialog Component
 * Modal-based authentication instead of page redirect
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [mode, email, password, confirmPassword, router, onOpenChange, redirectTo]);

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
            <img 
              src="/logo.png" 
              alt="Fluxa" 
              className="size-12 rounded-xl"
            />
            <DialogTitle className="text-xl font-semibold">
              {mode === 'login' ? '登录 Fluxa' : '注册 Fluxa'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5 text-muted-foreground">
              邮箱
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="pl-10 h-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5 text-muted-foreground">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 个字符"
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
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
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
                {mode === 'login' ? '登录中...' : '注册中...'}
              </>
            ) : (
              mode === 'login' ? '登录' : '注册'
            )}
          </Button>

          {/* Toggle Mode */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {mode === 'login' ? '还没有账户？' : '已有账户？'}
            </span>
            <Button
              type="button"
              variant="link"
              onClick={toggleMode}
              className="ml-1 p-0 h-auto font-medium text-primary"
            >
              {mode === 'login' ? '立即注册' : '立即登录'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
