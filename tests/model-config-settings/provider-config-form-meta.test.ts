/**
 * Feature: model-config-settings
 * Provider Config Form Metadata
 * Validates: Requirements 4.1-4.7
 */

import { describe, expect, it } from 'vitest';
import { getProviderConfigFormMeta } from '@/components/settings/provider-config-form-meta';

describe('Provider config form metadata', () => {
  it('should return volcengine-specific labels and placeholders', () => {
    expect(getProviderConfigFormMeta('volcengine')).toEqual({
      title: 'Volcengine / 豆包',
      description: '适用于火山引擎或豆包图像模型接入。',
      apiUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
      modelNamePlaceholder: 'doubao-seedream-4-0-250828',
      displayNamePlaceholder: '例如：豆包 Seedream',
    });
  });

  it('should return openai-compatible-specific labels and placeholders', () => {
    expect(getProviderConfigFormMeta('openai-compatible')).toEqual({
      title: 'OpenAI-Compatible',
      description: '适用于兼容 OpenAI 接口协议的图像服务。',
      apiUrlPlaceholder: 'https://api.example.com/v1',
      modelNamePlaceholder: 'gpt-image-1',
      displayNamePlaceholder: '例如：自定义图像服务',
    });
  });
});
