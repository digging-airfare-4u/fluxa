/**
 * Feature: model-config-settings
 * Provider Config Form Metadata
 * Validates: Requirements 4.1-4.7
 */

import { describe, expect, it } from 'vitest';
import { getProviderConfigFormMeta } from '@/components/settings/provider-config-form-meta';

describe('Provider config form metadata', () => {
  it('should return volcengine-specific labels and placeholders', () => {
    expect(getProviderConfigFormMeta('volcengine', 'image')).toEqual({
      title: 'Volcengine / 豆包',
      description: '适用于火山引擎或豆包图像模型接入。',
      apiUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
      modelNamePlaceholder: 'doubao-seedream-4-0-250828',
      displayNamePlaceholder: '例如：豆包 Seedream',
    });
  });

  it('should return openai-compatible chat labels and placeholders when used as a brain provider', () => {
    expect(getProviderConfigFormMeta('openai-compatible', 'chat')).toEqual({
      title: 'OpenAI-Compatible',
      description: '适用于兼容 OpenAI 接口协议的聊天/推理服务。',
      apiUrlPlaceholder: 'https://api.example.com/v1',
      modelNamePlaceholder: 'gpt-4o-mini',
      displayNamePlaceholder: '例如：自定义 Brain 服务',
    });
  });

  it('should return anthropic-compatible chat labels and MiniMax placeholders', () => {
    expect(getProviderConfigFormMeta('anthropic-compatible', 'chat')).toEqual({
      title: 'Anthropic-Compatible',
      description: '适用于兼容 Anthropic Messages 接口协议的 Agent Brain 服务。',
      apiUrlPlaceholder: 'https://api.minimaxi.com/anthropic',
      modelNamePlaceholder: 'MiniMax-M2.7',
      displayNamePlaceholder: '例如：MiniMax Brain',
    });
  });
});
