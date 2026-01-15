'use client';

/**
 * PointsRules Component
 * Displays AI model costs and points rules
 */

import { useEffect, useState } from 'react';
import { Zap, Sparkles, ImageIcon, Download, Gift } from 'lucide-react';
import { getAIModels, type AIModel } from '@/lib/supabase/queries/ai-models';
import { getMembershipConfigs } from '@/lib/supabase/queries/membership';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PointsRules() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [registrationPoints, setRegistrationPoints] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [modelsData, configs] = await Promise.all([
          getAIModels(),
          getMembershipConfigs(),
        ]);
        setModels(modelsData);
        // 获取 free 等级的初始积分
        const freeConfig = configs.find(c => c.level === 'free');
        if (freeConfig) {
          setRegistrationPoints(freeConfig.initial_points);
        }
      } catch (err) {
        console.error('[PointsRules] Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="container py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">模型消耗与积分规则</h2>
        <p className="text-muted-foreground text-center mb-8">
          了解不同 AI 模型的积分消耗和获取方式
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 消耗规则 */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-5 text-primary" />
              <h3 className="font-semibold">积分消耗</h3>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      model.is_enabled ? 'bg-muted/50' : 'bg-muted/30 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        {model.provider === 'volcengine' ? (
                          <ImageIcon className="size-4 text-primary" />
                        ) : (
                          <Sparkles className="size-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{model.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.description || model.provider}
                          {!model.is_enabled && ' · 暂未开放'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Zap className="size-3.5 text-amber-500" />
                      {model.points_cost}
                    </div>
                  </div>
                ))}

                {/* 导出消耗 */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Download className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">导出图片</p>
                      <p className="text-xs text-muted-foreground">PNG/JPG 格式</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <Zap className="size-3.5 text-amber-500" />
                    5
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 获取规则 */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="size-5 text-primary" />
              <h3 className="font-semibold">积分获取</h3>
            </div>

            <div className="space-y-2">
              {/* 新用户注册 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Gift className="size-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">新用户注册</p>
                    <p className="text-xs text-muted-foreground">首次注册即送</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-green-500">
                  +{registrationPoints}
                </div>
              </div>

              {/* 每日登录 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Zap className="size-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">每日登录</p>
                    <p className="text-xs text-muted-foreground">每天首次登录</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-green-500">
                  +10
                </div>
              </div>

              {/* 购买积分 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">升级会员</p>
                    <p className="text-xs text-muted-foreground">获取更多初始积分</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium">推荐</span>
              </div>
            </div>

            {/* 说明 */}
            <div className="mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <p>· 积分永久有效，不会过期</p>
              <p>· 升级会员可获得更多初始积分和专属权益</p>
              <p>· 更多获取方式即将上线</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
