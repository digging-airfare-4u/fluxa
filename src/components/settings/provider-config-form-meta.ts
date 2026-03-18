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

export function getProviderConfigFormMeta(
  provider: ProviderType,
  modelType: ProviderModelType = 'image',
): ProviderConfigFormMeta {
  if (provider === 'volcengine') {
    return {
      title: 'Volcengine / 豆包',
      description: modelType === 'chat'
        ? '适用于火山引擎或豆包聊天/推理模型接入。'
        : '适用于火山引擎或豆包图像模型接入。',
      apiUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
      modelNamePlaceholder: modelType === 'chat'
        ? 'doubao-seed-1-6-vision-250815'
        : 'doubao-seedream-4-0-250828',
      displayNamePlaceholder: modelType === 'chat'
        ? '例如：豆包 Brain'
        : '例如：豆包 Seedream',
    };
  }

  return {
    title: 'OpenAI-Compatible',
    description: modelType === 'chat'
      ? '适用于兼容 OpenAI 接口协议的聊天/推理服务。'
      : '适用于兼容 OpenAI 接口协议的图像服务。',
    apiUrlPlaceholder: 'https://api.example.com/v1',
    modelNamePlaceholder: modelType === 'chat' ? 'gpt-4o-mini' : 'gpt-image-1',
    displayNamePlaceholder: modelType === 'chat' ? '例如：自定义 Brain 服务' : '例如：自定义图像服务',
  };
}
