'use client';

/**
 * ProviderConfigPanel Component
 * Dialog panel for managing image and chat provider configurations.
 * Shows Gemini (built-in), Volcengine, and Custom OpenAI-Compatible sections.
 * Requirements: 1.1-1.7
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Cloud,
  KeyRound,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  fetchProviderConfigsContext,
  createProviderConfig,
  updateProviderConfig,
  updateProviderEnabled,
  deleteProviderConfig,
  testProviderConnection,
  updateAgentDefaultBrain,
  type UserProviderConfig,
  type ProviderType,
} from '@/lib/api/provider-configs';
import { ProviderConfigForm, type ProviderConfigFormValues } from './ProviderConfigForm';

// ============================================================================
// Types
// ============================================================================

export interface ProviderConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback triggered when configs are saved (create/update/delete) */
  onConfigsChange?: () => void;
}

type EditingState =
  | { type: 'none' }
  | { type: 'new'; provider: ProviderType }
  | { type: 'edit'; config: UserProviderConfig };

function getProviderLabel(provider: ProviderType): string {
  if (provider === 'volcengine') return 'Volcengine';
  if (provider === 'anthropic-compatible') return 'Anthropic-Compatible';
  return 'OpenAI-Compatible';
}

// ============================================================================
// Sub-components
// ============================================================================

/** Status badge for a config item */
function ConfigStatusBadge({ config }: { config: UserProviderConfig }) {
  if (!config.is_enabled) {
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">已禁用</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 dark:text-green-400">已配置</Badge>;
}

/** Single config list item */
function ConfigItem({
  config,
  onEdit,
  onToggle,
  readOnly = false,
}: {
  config: UserProviderConfig;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors',
        readOnly ? 'cursor-default' : 'hover:bg-muted/50 cursor-pointer',
        !config.is_enabled && 'opacity-60',
      )}
      onClick={readOnly ? undefined : onEdit}
      role={readOnly ? undefined : 'button'}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={readOnly ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(); }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{config.display_name}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {config.model_type === 'chat' ? '聊天' : '图像'}
          </Badge>
          <ConfigStatusBadge config={config} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{config.model_name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{config.api_key_masked}</span>
        </div>
      </div>
      <Switch
        checked={config.is_enabled}
        disabled={readOnly}
        onCheckedChange={(checked) => {
          // Stop propagation so clicking the switch doesn't trigger edit
          onToggle(checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${config.is_enabled ? '禁用' : '启用'} ${config.display_name}`}
      />
    </div>
  );
}

/** Collapsible section for a provider group */
function ProviderSection({
  title,
  description,
  icon,
  action,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto flex-1 justify-start px-0 py-0 hover:bg-transparent"
              >
                <div className="flex items-center gap-3 text-left">
                  <span className="flex size-8 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                    {icon}
                  </span>
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm">{title}</CardTitle>
                    {description ? (
                      <CardDescription className="text-xs">{description}</CardDescription>
                    ) : null}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="ml-auto size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            {action}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-2">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProviderConfigPanel({ open, onOpenChange, onConfigsChange }: ProviderConfigPanelProps) {
  const [configs, setConfigs] = useState<UserProviderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<EditingState>({ type: 'none' });
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  // ---- Load configs ----
  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const context = await fetchProviderConfigsContext();
      setConfigs(context.data);
      setCanManage(context.canManage);
    } catch (err) {
      console.error('[Settings] Failed to load provider configs:', err);
      setCanManage(false);
      setError('加载配置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadConfigs();
      setEditing({ type: 'none' });
    }
  }, [open, loadConfigs]);

  // ---- Grouped configs ----
  const volcengineConfigs = configs.filter((c) => c.provider === 'volcengine');
  const openaiCompatibleConfigs = configs.filter((c) => c.provider === 'openai-compatible');
  const anthropicCompatibleConfigs = configs.filter((c) => c.provider === 'anthropic-compatible');

  // ---- Handlers ----
  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await updateProviderEnabled(id, enabled);
      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_enabled: enabled } : c)),
      );
    } catch (err) {
      console.error('[Settings] Toggle failed:', err);
    }
  }, []);

  const handleSave = useCallback(
    async (values: ProviderConfigFormValues) => {
      let savedConfig: UserProviderConfig;

      if (editing.type === 'new') {
        const created = await createProviderConfig(values);
        savedConfig = created;
        setConfigs((prev) => [...prev, created]);
      } else if (editing.type === 'edit') {
        const updated = await updateProviderConfig(editing.config.id, values);
        savedConfig = updated;
        setConfigs((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      } else {
        return;
      }

      if (savedConfig.provider === 'anthropic-compatible') {
        await updateAgentDefaultBrain({
          model: savedConfig.model_identifier,
        });
      }

      setEditing({ type: 'none' });
      onConfigsChange?.();
    },
    [editing, onConfigsChange],
  );

  const handleDelete = useCallback(
    async () => {
      if (editing.type !== 'edit') return;
      await deleteProviderConfig(editing.config.id);
      setConfigs((prev) => prev.filter((c) => c.id !== editing.config.id));
      setEditing({ type: 'none' });
      onConfigsChange?.();
    },
    [editing, onConfigsChange],
  );

  const handleTest = useCallback(
    async (params: { provider: ProviderType; apiUrl: string; apiKey?: string; modelName: string; configId?: string }) => {
      return testProviderConnection(params);
    },
    [],
  );

  // ---- Render ----
  const isEditingForm = editing.type !== 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-background px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Settings2 className="size-5 text-muted-foreground" />
              Provider 配置
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          {error && (
            <div className="p-3 rounded-lg text-sm text-destructive bg-destructive/10 border border-destructive/20">
              {error}
            </div>
          )}

          {!isLoading && !canManage && (
            <div className="p-3 rounded-lg text-sm text-muted-foreground bg-muted/40 border">
              当前账号没有 Provider 管理权限。下面展示的是平台已开放的共享配置，只有超级管理员可以新增、编辑、启用或删除。
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : isEditingForm ? (
            /* ---- Form view ---- */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing({ type: 'none' })}
                >
                  <ArrowLeft className="mr-1 size-4" />
                  返回
                </Button>
                <span className="text-sm font-medium">
                  {editing.type === 'new'
                    ? `新增 ${getProviderLabel(editing.provider)} 配置`
                    : `编辑 ${editing.type === 'edit' ? editing.config.display_name : ''}`}
                </span>
              </div>
              <ProviderConfigForm
                configId={editing.type === 'edit' ? editing.config.id : undefined}
                provider={editing.type === 'new' ? editing.provider : editing.type === 'edit' ? (editing.config.provider as ProviderType) : 'openai-compatible'}
                initialValues={
                  editing.type === 'edit'
                    ? {
                        provider: editing.config.provider as ProviderType,
                        apiUrl: editing.config.api_url,
                        modelName: editing.config.model_name,
                        displayName: editing.config.display_name,
                        modelType: editing.config.model_type ?? 'image',
                      }
                    : undefined
                }
                isEnabled={editing.type === 'edit' ? editing.config.is_enabled : true}
                maskedKey={editing.type === 'edit' ? editing.config.api_key_masked : undefined}
                onSave={handleSave}
                onDelete={editing.type === 'edit' ? handleDelete : undefined}
                onToggleEnabled={
                  editing.type === 'edit'
                    ? (enabled) => handleToggle(editing.config.id, enabled)
                    : undefined
                }
                onTest={handleTest}
                onCancel={() => setEditing({ type: 'none' })}
              />
            </div>
          ) : (
            /* ---- List view ---- */
            <>
              {/* Gemini section (read-only) */}
              <ProviderSection
                title="Gemini"
                description="系统内置默认模型"
                icon={<Sparkles className="size-4 text-amber-500" />}
              >
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" />
                    <span className="text-sm font-medium">Gemini</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                      内置
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 dark:text-green-400">
                    已配置
                  </Badge>
                </div>
              </ProviderSection>

              {/* Volcengine section */}
              <ProviderSection
                title="Volcengine / 豆包"
                description={canManage ? '可添加多个共享配置' : '平台开放的共享配置'}
                icon={<Cloud className="size-4" />}
                action={canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ type: 'new', provider: 'volcengine' })}
                  >
                    <Plus className="size-3.5" />
                    新增
                  </Button>
                ) : undefined}
              >
                {volcengineConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                  />
                ))}
                {volcengineConfigs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">暂无配置</p>
                )}
              </ProviderSection>

              {/* Custom OpenAI-Compatible section */}
              <ProviderSection
                title="OpenAI-Compatible"
                description={canManage ? '兼容 OpenAI 接口的共享服务' : '平台开放的共享配置'}
                icon={<KeyRound className="size-4" />}
                action={canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ type: 'new', provider: 'openai-compatible' })}
                  >
                    <Plus className="size-3.5" />
                    新增
                  </Button>
                ) : undefined}
              >
                {openaiCompatibleConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                  />
                ))}
                {openaiCompatibleConfigs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">暂无配置</p>
                )}
              </ProviderSection>

              {/* Anthropic-Compatible section */}
              <ProviderSection
                title="Anthropic-Compatible"
                description={canManage ? 'Agent Brain 专用的 Anthropic Messages 兼容共享服务' : '平台开放的 Agent Brain 专用共享配置'}
                icon={<KeyRound className="size-4" />}
                action={canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ type: 'new', provider: 'anthropic-compatible' })}
                  >
                    <Plus className="size-3.5" />
                    新增
                  </Button>
                ) : undefined}
              >
                {anthropicCompatibleConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                  />
                ))}
                {anthropicCompatibleConfigs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">暂无配置</p>
                )}
              </ProviderSection>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
