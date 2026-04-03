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
import { useTranslations } from 'next-intl';
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
  fetchModelDefaults,
  updateModelDefaults,
  type UserProviderConfig,
  type ProviderType,
  type ModelDefaults,
  type ModelDefaultKey,
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

type ProviderConfigTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function getProviderLabel(provider: ProviderType, t: ProviderConfigTranslate): string {
  if (provider === 'volcengine') return t('providers.volcengine.title');
  if (provider === 'anthropic-compatible') return t('providers.anthropic_compatible.title');
  return t('providers.openai_compatible.title');
}

function getModelDefaultLabel(key: ModelDefaultKey, t: ProviderConfigTranslate): string {
  if (key === 'default_chat_model') return t('defaults.default_chat_model');
  if (key === 'default_image_model') return t('defaults.default_image_model');
  return t('defaults.agent_default_brain_model');
}

// ============================================================================
// Sub-components
// ============================================================================

/** Status badge for a config item */
function ConfigStatusBadge({
  config,
  t,
}: {
  config: UserProviderConfig;
  t: ProviderConfigTranslate;
}) {
  if (!config.is_enabled) {
    return (
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
        {t('statuses.disabled')}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-green-500/30 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400"
    >
      {t('statuses.configured')}
    </Badge>
  );
}

/** Single config list item */
function ConfigItem({
  config,
  onEdit,
  onToggle,
  readOnly = false,
  t,
}: {
  config: UserProviderConfig;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  readOnly?: boolean;
  t: ProviderConfigTranslate;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50',
        !config.is_enabled && 'opacity-60',
      )}
      onClick={readOnly ? undefined : onEdit}
      role={readOnly ? undefined : 'button'}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={
        readOnly
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') onEdit();
            }
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{config.display_name}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {config.model_type === 'chat' ? t('model_types.chat') : t('model_types.image')}
          </Badge>
          <ConfigStatusBadge config={config} t={t} />
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">{config.model_name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{config.api_key_masked}</span>
        </div>
      </div>
      <Switch
        checked={config.is_enabled}
        disabled={readOnly}
        onCheckedChange={(checked) => {
          onToggle(checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${config.is_enabled ? t('actions.disable') : t('actions.enable')} ${config.display_name}`}
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
      <Card className="overflow-hidden py-0">
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
          <CardContent className="space-y-2 px-4 pb-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/** Hardcoded system defaults — must match _shared/defaults.ts */
const SYSTEM_DEFAULTS: Record<ModelDefaultKey, string | null> = {
  default_chat_model: 'doubao-seed-1-6-vision-250815',
  default_image_model: 'gemini-2.5-flash-image',
  agent_default_brain_model: null,
};

export function ProviderConfigPanel({
  open,
  onOpenChange,
  onConfigsChange,
}: ProviderConfigPanelProps) {
  const t = useTranslations('providerConfig') as unknown as ProviderConfigTranslate;
  const [configs, setConfigs] = useState<UserProviderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<EditingState>({ type: 'none' });
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [modelDefaults, setModelDefaults] = useState<ModelDefaults>({
    default_chat_model: null,
    default_image_model: null,
    agent_default_brain_model: null,
  });
  const [editingDefault, setEditingDefault] = useState<ModelDefaultKey | null>(null);
  const [editingDefaultValue, setEditingDefaultValue] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);

  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [context, defaults] = await Promise.all([
        fetchProviderConfigsContext(),
        fetchModelDefaults().catch(() => null),
      ]);
      setConfigs(context.data);
      setCanManage(context.canManage);
      if (defaults) setModelDefaults(defaults);
    } catch (err) {
      console.error('[Settings] Failed to load provider configs:', err);
      setCanManage(false);
      setError(t('panel.load_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      loadConfigs();
      setEditing({ type: 'none' });
    }
  }, [open, loadConfigs]);

  const volcengineConfigs = configs.filter((c) => c.provider === 'volcengine');
  const openaiCompatibleConfigs = configs.filter((c) => c.provider === 'openai-compatible');
  const anthropicCompatibleConfigs = configs.filter((c) => c.provider === 'anthropic-compatible');

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await updateProviderEnabled(id, enabled);
      setConfigs((prev) =>
        prev.map((config) => (config.id === id ? { ...config, is_enabled: enabled } : config)),
      );
    } catch (err) {
      console.error('[Settings] Toggle failed:', err);
    }
  }, []);

  const handleSave = useCallback(
    async (values: ProviderConfigFormValues) => {
      if (editing.type === 'new') {
        const created = await createProviderConfig(values);
        setConfigs((prev) => [...prev, created]);
      } else if (editing.type === 'edit') {
        const updated = await updateProviderConfig(editing.config.id, values);
        setConfigs((prev) =>
          prev.map((config) => (config.id === updated.id ? updated : config)),
        );
      } else {
        return;
      }

      setEditing({ type: 'none' });
      onConfigsChange?.();
    },
    [editing, onConfigsChange],
  );

  const handleDelete = useCallback(async () => {
    if (editing.type !== 'edit') return;
    await deleteProviderConfig(editing.config.id);
    setConfigs((prev) => prev.filter((config) => config.id !== editing.config.id));
    setEditing({ type: 'none' });
    onConfigsChange?.();
  }, [editing, onConfigsChange]);

  const handleTest = useCallback(
    async (params: {
      provider: ProviderType;
      apiUrl: string;
      apiKey?: string;
      modelName: string;
      configId?: string;
    }) => {
      return testProviderConnection(params);
    },
    [],
  );

  const handleSaveDefault = useCallback(async (key: ModelDefaultKey, value: string) => {
    try {
      setSavingDefault(true);
      const trimmed = value.trim();
      await updateModelDefaults({ [key]: trimmed || null });
      setModelDefaults((prev) => ({ ...prev, [key]: trimmed || null }));
      setEditingDefault(null);
    } catch (err) {
      console.error('[Settings] Failed to save model default:', err);
    } finally {
      setSavingDefault(false);
    }
  }, []);

  const handleResetDefault = useCallback(async (key: ModelDefaultKey) => {
    try {
      setSavingDefault(true);
      await updateModelDefaults({ [key]: null });
      setModelDefaults((prev) => ({ ...prev, [key]: null }));
      setEditingDefault(null);
    } catch (err) {
      console.error('[Settings] Failed to reset model default:', err);
    } finally {
      setSavingDefault(false);
    }
  }, []);

  const isEditingForm = editing.type !== 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Settings2 className="size-5 text-muted-foreground" />
              {t('panel.title')}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isLoading && !canManage && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t('panel.no_permission')}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : isEditingForm ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing({ type: 'none' })}
                >
                  <ArrowLeft className="mr-1 size-4" />
                  {t('panel.back')}
                </Button>
                <span className="text-sm font-medium">
                  {editing.type === 'new'
                    ? t('panel.create_title', { provider: getProviderLabel(editing.provider, t) })
                    : t('panel.edit_title', {
                        name: editing.type === 'edit' ? editing.config.display_name : '',
                      })}
                </span>
              </div>
              <ProviderConfigForm
                configId={editing.type === 'edit' ? editing.config.id : undefined}
                provider={
                  editing.type === 'new'
                    ? editing.provider
                    : editing.type === 'edit'
                      ? (editing.config.provider as ProviderType)
                      : 'openai-compatible'
                }
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
            <>
              {canManage && (
                <ProviderSection
                  title={t('defaults.title')}
                  description={t('defaults.description')}
                  icon={<Settings2 className="size-4" />}
                >
                  {(['default_chat_model', 'default_image_model', 'agent_default_brain_model'] as const).map(
                    (key) => {
                      const isEditingDefault = editingDefault === key;
                      const currentValue = modelDefaults[key];
                      const hintText =
                        key === 'agent_default_brain_model'
                          ? t('defaults.follow_default_chat_model')
                          : t('defaults.use_system_default', {
                              value: SYSTEM_DEFAULTS[key] ?? '',
                            });

                      return (
                        <div key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 text-sm font-medium">
                              {getModelDefaultLabel(key, t)}
                            </div>
                            {isEditingDefault ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  className="flex-1 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={editingDefaultValue}
                                  onChange={(e) => setEditingDefaultValue(e.target.value)}
                                  placeholder={hintText}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDefault(key, editingDefaultValue);
                                    if (e.key === 'Escape') setEditingDefault(null);
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  disabled={savingDefault}
                                  onClick={() => handleSaveDefault(key, editingDefaultValue)}
                                >
                                  {savingDefault ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    t('form.save')
                                  )}
                                </Button>
                                {currentValue && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-destructive"
                                    disabled={savingDefault}
                                    onClick={() => handleResetDefault(key)}
                                  >
                                    {t('form.reset')}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setEditingDefault(null)}
                                >
                                  {t('form.cancel')}
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                                onClick={() => {
                                  setEditingDefault(key);
                                  setEditingDefaultValue(currentValue ?? '');
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    setEditingDefault(key);
                                    setEditingDefaultValue(currentValue ?? '');
                                  }
                                }}
                              >
                                {currentValue ? (
                                  <span className="text-foreground">{currentValue}</span>
                                ) : (
                                  <span className="italic">{hintText}</span>
                                )}
                                <span className="ml-2 text-[10px] opacity-60">
                                  {t('defaults.click_to_edit')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </ProviderSection>
              )}

              <ProviderSection
                title={t('providers.gemini.title')}
                description={t('providers.gemini.section_desc')}
                icon={<Sparkles className="size-4 text-amber-500" />}
              >
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" />
                    <span className="text-sm font-medium">{t('providers.gemini.title')}</span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                    >
                      {t('statuses.built_in')}
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-500/30 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400"
                  >
                    {t('statuses.configured')}
                  </Badge>
                </div>
              </ProviderSection>

              <ProviderSection
                title={t('providers.volcengine.title')}
                description={
                  canManage
                    ? t('providers.volcengine.section_manage_desc')
                    : t('providers.volcengine.section_readonly_desc')
                }
                icon={<Cloud className="size-4" />}
                action={
                  canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ type: 'new', provider: 'volcengine' })}
                    >
                      <Plus className="size-3.5" />
                      {t('panel.add')}
                    </Button>
                  ) : undefined
                }
              >
                {volcengineConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                    t={t}
                  />
                ))}
                {volcengineConfigs.length === 0 && (
                  <p className="py-1 text-xs text-muted-foreground">{t('panel.empty')}</p>
                )}
              </ProviderSection>

              <ProviderSection
                title={t('providers.openai_compatible.title')}
                description={
                  canManage
                    ? t('providers.openai_compatible.section_manage_desc')
                    : t('providers.openai_compatible.section_readonly_desc')
                }
                icon={<KeyRound className="size-4" />}
                action={
                  canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ type: 'new', provider: 'openai-compatible' })}
                    >
                      <Plus className="size-3.5" />
                      {t('panel.add')}
                    </Button>
                  ) : undefined
                }
              >
                {openaiCompatibleConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                    t={t}
                  />
                ))}
                {openaiCompatibleConfigs.length === 0 && (
                  <p className="py-1 text-xs text-muted-foreground">{t('panel.empty')}</p>
                )}
              </ProviderSection>

              <ProviderSection
                title={t('providers.anthropic_compatible.title')}
                description={
                  canManage
                    ? t('providers.anthropic_compatible.section_manage_desc')
                    : t('providers.anthropic_compatible.section_readonly_desc')
                }
                icon={<KeyRound className="size-4" />}
                action={
                  canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ type: 'new', provider: 'anthropic-compatible' })}
                    >
                      <Plus className="size-3.5" />
                      {t('panel.add')}
                    </Button>
                  ) : undefined
                }
              >
                {anthropicCompatibleConfigs.map((config) => (
                  <ConfigItem
                    key={config.id}
                    config={config}
                    onEdit={() => setEditing({ type: 'edit', config })}
                    onToggle={(enabled) => handleToggle(config.id, enabled)}
                    readOnly={!canManage}
                    t={t}
                  />
                ))}
                {anthropicCompatibleConfigs.length === 0 && (
                  <p className="py-1 text-xs text-muted-foreground">{t('panel.empty')}</p>
                )}
              </ProviderSection>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
