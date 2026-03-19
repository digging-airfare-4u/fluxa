'use client';

/**
 * ProviderConfigForm Component
 * Form for creating/editing a user provider configuration.
 * Flow: validate fields → test connectivity → persist config.
 * Requirements: 4.1-4.7, 7.1-7.5
 */

import { useState, useCallback } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { ProviderType, ProviderModelType } from '@/lib/api/provider-configs';
import { getProviderConfigFormMeta } from './provider-config-form-meta';

// ============================================================================
// Types
// ============================================================================

export interface ProviderConfigFormValues {
  provider: ProviderType;
  apiKey?: string;
  apiUrl: string;
  modelName: string;
  displayName: string;
  modelType: ProviderModelType;
}

export interface ProviderConfigFormProps {
  /** Config ID when editing an existing config */
  configId?: string;
  /** Initial form values (for editing) */
  initialValues?: Partial<ProviderConfigFormValues>;
  /** Provider type (locked for the form) */
  provider: ProviderType;
  /** Whether the config is currently enabled */
  isEnabled?: boolean;
  /** Masked API key display for edit mode */
  maskedKey?: string;
  /** Called when form is saved (after test + persist) */
  onSave: (values: ProviderConfigFormValues) => Promise<void>;
  /** Called when config is deleted */
  onDelete?: () => Promise<void>;
  /** Called when enabled state is toggled */
  onToggleEnabled?: (enabled: boolean) => Promise<void>;
  /** Called to test provider connectivity */
  onTest: (params: {
    provider: ProviderType;
    apiUrl: string;
    apiKey?: string;
    modelName: string;
    configId?: string;
  }) => Promise<{ success: boolean; error?: { code: string; message: string } }>;
  /** Called to cancel/close the form */
  onCancel: () => void;
}


type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

interface FormErrors {
  apiKey?: string;
  apiUrl?: string;
  modelName?: string;
  displayName?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ProviderConfigForm({
  configId,
  initialValues,
  provider,
  isEnabled = true,
  maskedKey,
  onSave,
  onDelete,
  onToggleEnabled,
  onTest,
  onCancel,
}: ProviderConfigFormProps) {
  const isEditing = !!configId;
  const ProviderIcon = provider === 'volcengine' ? Cloud : KeyRound;
  const isAnthropicCompatible = provider === 'anthropic-compatible';

  // Form state
  const [modelType, setModelType] = useState<ProviderModelType>(initialValues?.modelType ?? (isAnthropicCompatible ? 'chat' : 'image'));
  const resolvedModelType = isAnthropicCompatible ? 'chat' : modelType;
  const meta = getProviderConfigFormMeta(provider, resolvedModelType);
  const [apiKey, setApiKey] = useState(initialValues?.apiKey ?? '');
  const [apiUrl, setApiUrl] = useState(initialValues?.apiUrl ?? '');
  const [modelName, setModelName] = useState(initialValues?.modelName ?? '');
  const [displayName, setDisplayName] = useState(initialValues?.displayName ?? '');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- Validation ----
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};

    if (!isEditing && !apiKey.trim()) {
      errs.apiKey = 'API Key 不能为空';
    }
    if (!apiUrl.trim()) {
      errs.apiUrl = 'API URL 不能为空';
    }
    if (!modelName.trim()) {
      errs.modelName = '模型名称不能为空';
    }
    if (!displayName.trim()) {
      errs.displayName = '显示名称不能为空';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [isEditing, apiKey, apiUrl, modelName, displayName]);

  // ---- Test + Save flow ----
  const handleSave = useCallback(async () => {
    if (!validate()) return;

    // Step 1: Test connectivity
    setTestStatus('testing');
    setTestError(null);
    setSaveError(null);

    try {
      const result = await onTest({
        provider,
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        modelName: modelName.trim(),
        configId,
      });

      if (!result.success) {
        setTestStatus('failed');
        setTestError(result.error?.message ?? '连接测试失败');
        return;
      }

      setTestStatus('success');

      // Step 2: Persist config
      setIsSaving(true);
      await onSave({
        provider,
        apiKey: apiKey.trim() || undefined,
        apiUrl: apiUrl.trim(),
        modelName: modelName.trim(),
        displayName: displayName.trim(),
        modelType: resolvedModelType,
      });
    } catch (err) {
      console.error('[Settings] ProviderConfigForm save error:', err);
      setSaveError(err instanceof Error ? err.message : '保存失败');
      setTestStatus('idle');
    } finally {
      setIsSaving(false);
    }
  }, [validate, onTest, onSave, apiUrl, apiKey, modelName, displayName, configId, provider, modelType, resolvedModelType]);

  // ---- Delete ----
  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (err) {
      console.error('[Settings] ProviderConfigForm delete error:', err);
      setSaveError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [onDelete]);

  // ---- Toggle ----
  const handleToggle = useCallback(async (checked: boolean) => {
    if (!onToggleEnabled) return;
    try {
      await onToggleEnabled(checked);
    } catch (err) {
      console.error('[Settings] ProviderConfigForm toggle error:', err);
    }
  }, [onToggleEnabled]);

  const isSubmitting = testStatus === 'testing' || isSaving;

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
              <ProviderIcon className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{meta.title}</CardTitle>
                <Badge variant={isEditing ? 'secondary' : 'outline'} className="text-[10px]">
                  {isEditing ? '编辑中' : '新配置'}
                </Badge>
              </div>
              <CardDescription>{meta.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">连接信息</CardTitle>
          </div>
          <CardDescription>
            先验证 API Key、Endpoint 和模型名，再保存为平台共享配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {!isAnthropicCompatible && (
            <div className="space-y-2">
              <Label>用途</Label>
              <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                {(['image', 'chat'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setModelType(value)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      modelType === value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {value === 'image' ? '图像生成' : '聊天 / Agent Brain'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isEditing && onToggleEnabled && (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="config-enabled" className="text-sm font-medium">
                    启用此配置
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    关闭后会保留凭据，但不会参与模型选择。
                  </p>
                </div>
                <Switch
                  id="config-enabled"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                />
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="api-key">
              API Key {isEditing && <span className="text-muted-foreground font-normal">(留空保留原 Key)</span>}
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder={isEditing && maskedKey ? maskedKey : '输入 API Key'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setErrors((prev) => ({ ...prev, apiKey: undefined }));
                setTestStatus('idle');
              }}
              aria-invalid={!!errors.apiKey}
            />
            {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-url">API URL / Endpoint</Label>
            <Input
              id="api-url"
              type="url"
              placeholder={meta.apiUrlPlaceholder}
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setErrors((prev) => ({ ...prev, apiUrl: undefined }));
                setTestStatus('idle');
              }}
              aria-invalid={!!errors.apiUrl}
            />
            {errors.apiUrl && <p className="text-xs text-destructive">{errors.apiUrl}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model-name">模型名称</Label>
            <Input
              id="model-name"
              placeholder={meta.modelNamePlaceholder}
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setErrors((prev) => ({ ...prev, modelName: undefined }));
                setTestStatus('idle');
              }}
              aria-invalid={!!errors.modelName}
            />
            {errors.modelName && <p className="text-xs text-destructive">{errors.modelName}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-4">
          <CardTitle className="text-sm">显示设置</CardTitle>
          <CardDescription>
            用于在模型选择器和设置面板里区分不同配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">显示名称</Label>
            <Input
              id="display-name"
              placeholder={meta.displayNamePlaceholder}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              aria-invalid={!!errors.displayName}
            />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Test status feedback */}
      {testStatus === 'success' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-4" />
          连接测试通过
        </div>
      )}
      {testStatus === 'failed' && testError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <XCircle className="size-4 mt-0.5 shrink-0" />
          <span>{testError}</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="size-4 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <Card className="gap-0 py-0">
        <CardFooter className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            {isEditing && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5 mr-1" />
                删除
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              {testStatus === 'testing' ? '测试中...' : isSaving ? '保存中...' : '测试并保存'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将移除此配置及其存储的凭据，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {isDeleting && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
