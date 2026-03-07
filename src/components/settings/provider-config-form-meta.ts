/**
 * Provider config form metadata
 * Centralizes provider-specific labels and placeholders for the settings form.
 */

import type { ProviderType } from '@/lib/api/provider-configs';

export interface ProviderConfigFormMeta {
  title: string;
  description: string;
  apiUrlPlaceholder: string;
  modelNamePlaceholder: string;
  displayNamePlaceholder: string;
}

export function getProviderConfigFormMeta(
  provider: ProviderType,
): ProviderConfigFormMeta {
  if (provider === 'volcengine') {
    return {
      title: 'Volcengine / 豆包',
      description: '适用于火山引擎或豆包图像模型接入。',
      apiUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
      modelNamePlaceholder: 'doubao-seedream-4-0-250828',
      displayNamePlaceholder: '例如：豆包 Seedream',
    };
  }

  return {
    title: 'OpenAI-Compatible',
    description: '适用于兼容 OpenAI 接口协议的图像服务。',
    apiUrlPlaceholder: 'https://api.example.com/v1',
    modelNamePlaceholder: 'gpt-image-1',
    displayNamePlaceholder: '例如：自定义图像服务',
  };
}
