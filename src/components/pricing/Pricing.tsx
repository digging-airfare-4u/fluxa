'use client';

/**
 * Pricing Component
 * Displays membership plans with monthly/yearly toggle and confetti animation
 */

import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import NumberFlow from '@number-flow/react';

export interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
  level?: 'free' | 'pro' | 'team';
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  paymentEnabled?: boolean;
}

export function Pricing({
  plans,
  title = '简单透明的定价',
  description = '选择适合你的方案\n所有方案都包含 AI 设计生成、画布编辑和项目管理功能',
  paymentEnabled = true,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);

    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: [
          'hsl(var(--primary))',
          'hsl(var(--accent))',
          'hsl(var(--secondary))',
          'hsl(var(--muted))',
        ],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
      });
    }
  };

  return (
    <div className="container py-12">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground text-sm whitespace-pre-line">{description}</p>
      </div>

      <div className="flex justify-center mb-8">
        <label className="relative inline-flex items-center cursor-pointer">
          <Label>
            <Switch
              ref={switchRef as React.RefObject<HTMLButtonElement>}
              checked={!isMonthly}
              onCheckedChange={handleToggle}
              className="relative"
            />
          </Label>
        </label>
        <span className="ml-2 text-sm font-medium">
          年付 <span className="text-primary">(省 20%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ y: 30, opacity: 0 }}
            whileInView={{
              y: 0,
              opacity: 1,
              scale: isDesktop && plan.isPopular ? 1.02 : 1,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
            }}
            className={cn(
              'rounded-xl border p-5 bg-background text-center flex flex-col relative',
              plan.isPopular ? 'border-primary border-2 shadow-lg' : 'border-border'
            )}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary py-0.5 px-3 rounded-full flex items-center">
                <Star className="text-primary-foreground h-3 w-3 fill-current" />
                <span className="text-primary-foreground ml-1 text-xs font-semibold">
                  推荐
                </span>
              </div>
            )}
            <div className="flex-1 flex flex-col">
              <p className="text-sm font-semibold text-muted-foreground">{plan.name}</p>
              
              {/* 价格显示：充值关闭时隐藏付费套餐价格 */}
              {paymentEnabled || plan.level === 'free' ? (
                <>
                  <div className="mt-4 flex items-baseline justify-center gap-x-1">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      <NumberFlow
                        value={isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)}
                        format={{
                          style: 'currency',
                          currency: 'CNY',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }}
                        transformTiming={{
                          duration: 500,
                          easing: 'ease-out',
                        }}
                        willChange
                        className="tabular-nums"
                      />
                    </span>
                    {plan.period !== 'Next 3 months' && (
                      <span className="text-xs text-muted-foreground">
                        / {plan.period === 'month' ? '月' : plan.period}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isMonthly ? '按月计费' : '按年计费'}
                  </p>
                </>
              ) : (
                <div className="mt-4 h-12 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">暂不可用</span>
                </div>
              )}

              <ul className="mt-4 gap-1.5 flex flex-col text-sm">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-left text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4">
                {/* 按钮：充值关闭时付费套餐显示禁用状态 */}
                {paymentEnabled || plan.level === 'free' ? (
                  <Link
                    href={plan.href}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'w-full font-medium',
                      'transition-all duration-200 hover:ring-2 hover:ring-primary hover:ring-offset-1',
                      plan.isPopular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                        : ''
                    )}
                  >
                    {plan.buttonText}
                  </Link>
                ) : (
                  <button
                    disabled
                    onClick={() => alert('充值入口暂时关闭，请稍后再试')}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'w-full font-medium opacity-50 cursor-not-allowed'
                    )}
                  >
                    充值入口已关闭
                  </button>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{plan.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default Pricing;
