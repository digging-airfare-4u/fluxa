/**
 * Provider config form metadata
 * Centralizes provider-specific labels and placeholders for the settings form.
 */

import type { ProviderType, ProviderModelType } from '@/lib/api/provider-configs';

export interface ProviderConfigFormMeta {
  title: string;
  description: string;
  apiUrlPlaceholder: string;
  modelNamePlaceholder: string;
  displayNamePlaceholder: string;
}

export type ProviderConfigFormTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const DEFAULT_MESSAGES: Record<string, string> = {
  'providers.volcengine.title': 'Volcengine / 豆包',
  'providers.volcengine.chat_desc': '适用于火山引擎或豆包聊天/推理模型接入。',
  'providers.volcengine.image_desc': '适用于火山引擎或豆包图像模型接入。',
  'providers.volcengine.chat_display_placeholder': '例如：豆包 Brain',
  'providers.volcengine.image_display_placeholder': '例如：豆包 Seedream',
  'providers.openai_compatible.title': 'OpenAI-Compatible',
  'providers.openai_compatible.chat_desc': '适用于兼容 OpenAI 接口协议的聊天/推理服务。',
  'providers.openai_compatible.image_desc': '适用于兼容 OpenAI 接口协议的图像服务。',
  'providers.openai_compatible.chat_display_placeholder': '例如：自定义 Brain 服务',
  'providers.openai_compatible.image_display_placeholder': '例如：自定义图像服务',
  'providers.anthropic_compatible.title': 'Anthropic-Compatible',
  'providers.anthropic_compatible.desc': '适用于兼容 Anthropic Messages 接口协议的 Agent Brain 服务。',
  'providers.anthropic_compatible.display_placeholder': '例如：MiniMax Brain',
};

const defaultTranslate: ProviderConfigFormTranslate = (key) => DEFAULT_MESSAGES[key] ?? key;

export function getProviderConfigFormMeta(
  provider: ProviderType,
  modelType: ProviderModelType = 'image',
  t: ProviderConfigFormTranslate = defaultTranslate,
): ProviderConfigFormMeta {
  if (provider === 'volcengine') {
    return {
      title: t('providers.volcengine.title'),
      description:
        modelType === 'chat'
          ? t('providers.volcengine.chat_desc')
          : t('providers.volcengine.image_desc'),
      apiUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
      modelNamePlaceholder:
        modelType === 'chat'
          ? 'doubao-seed-1-6-vision-250815'
          : 'doubao-seedream-4-0-250828',
      displayNamePlaceholder:
        modelType === 'chat'
          ? t('providers.volcengine.chat_display_placeholder')
          : t('providers.volcengine.image_display_placeholder'),
    };
  }

  if (provider === 'anthropic-compatible') {
    return {
      title: t('providers.anthropic_compatible.title'),
      description: t('providers.anthropic_compatible.desc'),
      apiUrlPlaceholder: 'https://api.minimaxi.com/anthropic',
      modelNamePlaceholder: 'MiniMax-M2.7',
      displayNamePlaceholder: t('providers.anthropic_compatible.display_placeholder'),
    };
  }

  return {
    title: t('providers.openai_compatible.title'),
    description:
      modelType === 'chat'
        ? t('providers.openai_compatible.chat_desc')
        : t('providers.openai_compatible.image_desc'),
    apiUrlPlaceholder: 'https://api.example.com/v1',
    modelNamePlaceholder: modelType === 'chat' ? 'gpt-4o-mini' : 'gpt-image-1',
    displayNamePlaceholder:
      modelType === 'chat'
        ? t('providers.openai_compatible.chat_display_placeholder')
        : t('providers.openai_compatible.image_display_placeholder'),
  };
}
