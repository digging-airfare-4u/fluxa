# Design Document: i18n Internationalization

## Overview

本设计文档描述 Fluxa 项目国际化（i18n）功能的技术实现方案。采用 `next-intl` 库实现 Next.js App Router 的完整国际化支持，包括 SSR/CSR 兼容、动态语言切换、命名空间资源管理等核心能力。

### 技术选型

- **核心库**: `next-intl` v4.x - 专为 Next.js App Router 设计的 i18n 解决方案
- **格式化**: `Intl.*` 原生 API - 日期、数字、货币格式化
- **消息格式**: ICU MessageFormat - 支持变量插值和复数规则

### 设计原则

1. **渐进式迁移**: 不破坏现有功能，逐步替换硬编码文案
2. **类型安全**: 利用 TypeScript 提供翻译键的类型检查
3. **性能优先**: 按需加载翻译资源，避免首屏加载过大
4. **开发体验**: 提供清晰的 key 命名规范和调试工具

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Layout    │  │   Pages     │  │      Components         │  │
│  │  (Server)   │  │  (Server/   │  │   (Client/Server)       │  │
│  │             │  │   Client)   │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    I18n Provider                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │ useTransla- │  │ useLocale   │  │ useFormatter    │    │  │
│  │  │   tions()   │  │             │  │                 │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Translation Resources                     │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │  src/locales/                                        │ │  │
│  │  │  ├── zh-CN/                                          │ │  │
│  │  │  │   ├── common.json                                 │ │  │
│  │  │  │   ├── auth.json                                   │ │  │
│  │  │  │   ├── editor.json                                 │ │  │
│  │  │  │   ├── chat.json                                   │ │  │
│  │  │  │   ├── home.json                                   │ │  │
│  │  │  │   ├── points.json                                 │ │  │
│  │  │  │   └── errors.json                                 │ │  │
│  │  │  └── en-US/                                          │ │  │
│  │  │      └── (same structure)                            │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. I18n Configuration (`src/lib/i18n/config.ts`)

```typescript
export const locales = ['zh-CN', 'en-US'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-CN';

export const localeNames: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

export const namespaces = [
  'common',
  'auth', 
  'editor',
  'chat',
  'home',
  'points',
  'errors',
] as const;

export type Namespace = (typeof namespaces)[number];
```

### 2. Request Configuration (`src/lib/i18n/request.ts`)

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie or use default
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = (locales.includes(localeCookie as Locale) 
    ? localeCookie 
    : defaultLocale) as Locale;

  // Load all namespace messages
  const messages = {
    common: (await import(`@/locales/${locale}/common.json`)).default,
    auth: (await import(`@/locales/${locale}/auth.json`)).default,
    editor: (await import(`@/locales/${locale}/editor.json`)).default,
    chat: (await import(`@/locales/${locale}/chat.json`)).default,
    home: (await import(`@/locales/${locale}/home.json`)).default,
    points: (await import(`@/locales/${locale}/points.json`)).default,
    errors: (await import(`@/locales/${locale}/errors.json`)).default,
  };

  return {
    locale,
    messages,
    timeZone: 'Asia/Shanghai',
    now: new Date(),
  };
});
```

### 3. I18n Provider Wrapper (`src/lib/i18n/I18nProvider.tsx`)

```typescript
'use client';

import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';
import { ReactNode } from 'react';

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
  now?: Date;
}

export function I18nProvider({ 
  children, 
  locale, 
  messages,
  timeZone,
  now,
}: I18nProviderProps) {
  return (
    <NextIntlClientProvider 
      locale={locale} 
      messages={messages}
      timeZone={timeZone}
      now={now}
      onError={(error) => {
        // Log missing translations in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('[i18n]', error.message);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return debug placeholder for missing keys
        return `__MISSING_KEY__:${namespace}.${key}`;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
```

### 4. Language Switcher Component (`src/components/ui/LanguageSwitcher.tsx`)

```typescript
'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, type Locale } from '@/lib/i18n/config';
import { setLocale } from '@/lib/i18n/actions';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: Locale) => {
    startTransition(() => {
      setLocale(newLocale);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          disabled={isPending}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => handleLocaleChange(l)}
            className={locale === l ? 'bg-accent' : ''}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 5. Server Action for Locale Change (`src/lib/i18n/actions.ts`)

```typescript
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type Locale } from './config';

export async function setLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return (cookieStore.get('NEXT_LOCALE')?.value as Locale) || 'zh-CN';
}
```

### 6. Custom Hooks (`src/lib/i18n/hooks.ts`)

```typescript
'use client';

import { useTranslations, useFormatter, useLocale } from 'next-intl';
import type { Namespace } from './config';

// Re-export with namespace typing
export function useT(namespace: Namespace) {
  return useTranslations(namespace);
}

// Convenience hook for common namespace
export function useCommonT() {
  return useTranslations('common');
}

// Format utilities
export function useI18nFormatter() {
  const format = useFormatter();
  const locale = useLocale();

  return {
    formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => 
      format.dateTime(date, options),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      format.number(value, options),
    formatRelativeTime: (date: Date | number) =>
      format.relativeTime(date),
    formatPoints: (points: number) =>
      format.number(points, { style: 'decimal' }),
    locale,
  };
}
```

## Data Models

### Translation File Structure

#### `src/locales/zh-CN/common.json`
```json
{
  "app": {
    "name": "Fluxa",
    "tagline": "AI 驱动的设计生成平台"
  },
  "actions": {
    "ok": "确定",
    "cancel": "取消",
    "save": "保存",
    "delete": "删除",
    "edit": "编辑",
    "copy": "复制",
    "close": "关闭",
    "back": "返回",
    "next": "下一步",
    "submit": "提交",
    "retry": "重试",
    "confirm": "确认",
    "loading": "加载中...",
    "uploading": "上传中...",
    "saving": "保存中...",
    "generating": "生成中..."
  },
  "status": {
    "success": "操作成功",
    "error": "操作失败",
    "loading": "加载中",
    "empty": "暂无数据",
    "no_permission": "无权限访问"
  },
  "time": {
    "just_now": "刚刚",
    "minutes_ago": "{count} 分钟前",
    "hours_ago": "{count} 小时前",
    "days_ago": "{count} 天前"
  },
  "pagination": {
    "previous": "上一页",
    "next": "下一页",
    "page": "第 {current} 页，共 {total} 页"
  }
}
```

#### `src/locales/zh-CN/auth.json`
```json
{
  "login": {
    "title": "登录 Fluxa",
    "email_label": "邮箱",
    "email_placeholder": "your@email.com",
    "password_label": "密码",
    "password_placeholder": "至少 6 个字符",
    "confirm_password_label": "确认密码",
    "confirm_password_placeholder": "再次输入密码",
    "submit": "登录",
    "submitting": "登录中...",
    "no_account": "还没有账户？",
    "register_link": "立即注册"
  },
  "register": {
    "title": "注册 Fluxa",
    "submit": "注册",
    "submitting": "注册中...",
    "has_account": "已有账户？",
    "login_link": "立即登录",
    "success": "注册成功！请查收验证邮件，点击链接完成验证后即可登录。"
  },
  "errors": {
    "email_required": "请填写邮箱",
    "password_required": "请填写密码",
    "password_mismatch": "两次输入的密码不一致",
    "password_too_short": "密码至少需要 6 个字符",
    "invalid_credentials": "邮箱或密码错误",
    "email_not_confirmed": "请先验证邮箱后再登录",
    "email_already_registered": "该邮箱已被注册",
    "generic_error": "操作失败，请重试"
  }
}
```

#### `src/locales/zh-CN/editor.json`
```json
{
  "menu": {
    "home": "主页",
    "projects": "项目库",
    "new_project": "新建项目",
    "delete_project": "删除当前项目",
    "import_image": "导入图片",
    "undo": "撤销",
    "redo": "重做",
    "copy_object": "复制对象",
    "show_all_images": "显示画布所有图片",
    "zoom_in": "放大",
    "zoom_out": "缩小"
  },
  "toolbar": {
    "select": "选择",
    "hand": "移动画布",
    "text": "文本",
    "shapes": "形状",
    "image": "图片",
    "ai": "AI 助手"
  },
  "layer_panel": {
    "title": "图层",
    "expand": "展开图层面板",
    "collapse": "收起图层面板",
    "no_layers": "暂无图层",
    "lock": "锁定",
    "unlock": "解锁",
    "visible": "显示",
    "hidden": "隐藏",
    "delete": "删除图层"
  },
  "context_menu": {
    "bring_to_front": "置于顶层",
    "send_to_back": "置于底层",
    "duplicate": "复制",
    "delete": "删除",
    "lock": "锁定",
    "unlock": "解锁"
  },
  "export": {
    "title": "导出",
    "format": "格式",
    "quality": "质量",
    "scale": "缩放",
    "download": "下载"
  },
  "tooltips": {
    "collapse_panel": "收起面板",
    "expand_panel": "展开面板"
  }
}
```

#### `src/locales/zh-CN/chat.json`
```json
{
  "panel": {
    "title": "Fluxa",
    "collapse": "收起面板",
    "expand": "展开聊天面板"
  },
  "empty_state": {
    "title": "开始设计",
    "description": "描述你想要的设计，AI 将为你生成可编辑的画布"
  },
  "input": {
    "placeholder": "描述你想要的设计...",
    "send": "发送",
    "stop": "停止",
    "attach": "添加附件"
  },
  "status": {
    "generating": "正在生成...",
    "thinking": "思考中...",
    "processing": "处理中..."
  },
  "message": {
    "copy": "复制",
    "regenerate": "重新生成",
    "add_to_canvas": "添加到画布",
    "locate_on_canvas": "在画布上定位"
  },
  "model_selector": {
    "label": "选择模型",
    "image_models": "图像模型",
    "text_models": "文本模型"
  },
  "placeholders": [
    "帮我设计一张科技感的海报...",
    "创建一个简约风格的名片...",
    "设计一张生日派对邀请函...",
    "制作一个产品宣传图...",
    "帮我做一张社交媒体封面..."
  ]
}
```

#### `src/locales/zh-CN/home.json`
```json
{
  "landing": {
    "tagline": "AI Design",
    "cta": "Get Started"
  },
  "dashboard": {
    "title": "我的项目",
    "new_project": "新建项目",
    "empty_state": {
      "title": "还没有项目",
      "description": "创建你的第一个设计项目"
    }
  },
  "project_card": {
    "open": "打开",
    "delete": "删除",
    "rename": "重命名",
    "created_at": "创建于 {date}",
    "updated_at": "更新于 {date}"
  },
  "quick_tags": {
    "poster": "海报",
    "card": "名片",
    "social": "社交媒体",
    "banner": "横幅",
    "invitation": "邀请函"
  }
}
```

#### `src/locales/zh-CN/points.json`
```json
{
  "balance": {
    "title": "积分余额",
    "points": "{count} 点",
    "unlimited": "无限"
  },
  "insufficient": {
    "title": "限时优惠！",
    "description": "升级即可畅享 365 天无限使用",
    "model_specific": "{modelName}",
    "all_models": "所有 AI 模型",
    "current_balance": "当前余额 {balance} 点，还需 {needed} 点",
    "later": "稍后再说",
    "upgrade": "立即升级"
  },
  "transaction": {
    "title": "交易记录",
    "type": {
      "earn": "获得",
      "spend": "消费",
      "refund": "退款"
    },
    "empty": "暂无交易记录"
  },
  "pricing": {
    "title": "定价",
    "free": {
      "name": "免费版",
      "price": "¥0",
      "features": [
        "每日 {count} 点积分",
        "基础 AI 模型",
        "标准导出质量"
      ]
    },
    "pro": {
      "name": "专业版",
      "price": "¥{price}/月",
      "features": [
        "无限积分",
        "所有 AI 模型",
        "高清导出",
        "优先支持"
      ]
    }
  }
}
```

#### `src/locales/zh-CN/errors.json`
```json
{
  "network": {
    "offline": "网络连接已断开",
    "timeout": "请求超时，请重试",
    "server_error": "服务器错误，请稍后重试"
  },
  "api": {
    "unauthorized": "请先登录",
    "forbidden": "无权限执行此操作",
    "not_found": "资源不存在",
    "rate_limit": "请求过于频繁，请稍后重试",
    "insufficient_points": "积分不足",
    "generation_failed": "生成失败，请重试",
    "upload_failed": "上传失败",
    "export_failed": "导出失败",
    "unknown": "发生未知错误"
  },
  "validation": {
    "required": "此字段为必填项",
    "invalid_email": "请输入有效的邮箱地址",
    "invalid_format": "格式不正确"
  },
  "pages": {
    "not_found": {
      "title": "404",
      "description": "页面不存在",
      "back_home": "返回首页"
    },
    "server_error": {
      "title": "500",
      "description": "服务器错误",
      "retry": "重试"
    }
  }
}
```

### English Translations (`src/locales/en-US/`)

对应的英文翻译文件结构相同，内容为英文版本。



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Translation Key Validation

*For any* translation key in any namespace file, the key SHALL:
- Follow the pattern `{section}.{element}` or `{section}.{element}.{action}` (within namespace context)
- Use only lowercase letters, numbers, and underscores
- Not contain Chinese characters
- Be unique across the entire application
- Be alphabetically sorted within its namespace file

**Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.5**

### Property 2: Translation Fallback Behavior

*For any* translation key:
- If the key exists in the current locale, that translation SHALL be returned
- If the key is missing in the current locale but exists in `en-US`, the `en-US` translation SHALL be returned
- If the key is missing in all locales, `__MISSING_KEY__:{namespace}.{key}` SHALL be returned

**Validates: Requirements 2.4, 2.5**

### Property 3: Variable Interpolation

*For any* translation string containing `{variableName}` placeholders:
- When all variables are provided, they SHALL be correctly substituted
- When a variable is missing, the placeholder `{variableName}` SHALL remain visible in the output

**Validates: Requirements 4.1, 4.3**

### Property 4: Locale-Aware Formatting

*For any* date or number value:
- Date formatting SHALL produce locale-appropriate output (e.g., `2024/1/15` for zh-CN, `1/15/2024` for en-US)
- Number formatting SHALL produce locale-appropriate output (e.g., `1,234.56` for en-US, `1,234.56` for zh-CN)

**Validates: Requirements 4.4, 4.5**

### Property 5: Plural Form Selection

*For any* count value used with plural translations:
- English SHALL use `one` form for count === 1, `other` form otherwise
- Chinese SHALL use the same form regardless of count (no plural distinction)

**Validates: Requirements 5.1, 5.3**

### Property 6: Locale Preference Persistence Round-Trip

*For any* locale selection by a user:
- The preference SHALL be persisted to cookie
- On subsequent visits, the persisted locale SHALL be restored
- The round-trip (select → persist → restore) SHALL return the same locale

**Validates: Requirements 1.4, 1.5, 6.3, 6.4**

### Property 7: HTML Lang Attribute Sync

*For any* active locale, the HTML `<html lang="">` attribute SHALL match the current locale code.

**Validates: Requirements 6.5**

### Property 8: SSR/CSR Hydration Consistency

*For any* locale, the server-rendered HTML content SHALL match the client-side hydrated content, producing no hydration mismatch warnings.

**Validates: Requirements 1.2**

### Property 9: Error Code to Message Mapping

*For any* API error code defined in the system, there SHALL exist a corresponding localized error message in all supported locales.

**Validates: Requirements 11.1-11.5**

## Error Handling

### Missing Translation Keys

```typescript
// In I18nProvider configuration
onError={(error) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[i18n] Missing translation:', error.message);
  }
  // In production, silently use fallback
}}

getMessageFallback={({ namespace, key }) => {
  // Return debug placeholder for missing keys
  return `__MISSING_KEY__:${namespace}.${key}`;
}}
```

### Locale Detection Fallback

```typescript
// Priority order for locale detection:
// 1. Cookie (NEXT_LOCALE)
// 2. Browser Accept-Language header (future enhancement)
// 3. Default locale (zh-CN)

function detectLocale(cookieValue?: string): Locale {
  if (cookieValue && locales.includes(cookieValue as Locale)) {
    return cookieValue as Locale;
  }
  return defaultLocale;
}
```

### Invalid Locale Handling

```typescript
// If an invalid locale is somehow set, fall back to default
function validateLocale(locale: string): Locale {
  return locales.includes(locale as Locale) 
    ? (locale as Locale) 
    : defaultLocale;
}
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Configuration Tests**
   - Verify all locales are defined
   - Verify all namespaces are defined
   - Verify default locale is valid

2. **Translation Loading Tests**
   - Verify each namespace file loads correctly
   - Verify JSON structure is valid
   - Verify no duplicate keys within namespace

3. **Component Tests**
   - Verify LanguageSwitcher renders correctly
   - Verify locale change triggers UI update
   - Verify I18nProvider wraps children correctly

### Property-Based Tests

Property-based tests will use `fast-check` to verify universal properties:

1. **Key Validation Property Test**
   - Generate random keys and verify format rules
   - Verify alphabetical sorting
   - Verify uniqueness across namespaces

2. **Fallback Property Test**
   - Generate random key lookups
   - Verify fallback chain works correctly

3. **Interpolation Property Test**
   - Generate random variable values
   - Verify substitution works correctly

4. **Formatting Property Test**
   - Generate random dates and numbers
   - Verify locale-appropriate formatting

5. **Persistence Round-Trip Property Test**
   - Generate random locale selections
   - Verify persist → restore cycle

### Test Configuration

```typescript
// vitest.config.ts additions
export default defineConfig({
  test: {
    // ... existing config
    setupFiles: ['./tests/i18n/setup.ts'],
  },
});

// tests/i18n/setup.ts
import { setRequestLocale } from 'next-intl/server';

// Mock next-intl for testing
vi.mock('next-intl', async () => {
  const actual = await vi.importActual('next-intl');
  return {
    ...actual,
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  };
});
```

### Test File Structure

```
tests/
└── i18n/
    ├── setup.ts                    # Test setup and mocks
    ├── config.test.ts              # Configuration tests
    ├── key-validation.test.ts      # Property 1: Key validation
    ├── fallback.test.ts            # Property 2: Fallback behavior
    ├── interpolation.test.ts       # Property 3: Variable interpolation
    ├── formatting.test.ts          # Property 4: Locale-aware formatting
    ├── plural.test.ts              # Property 5: Plural form selection
    ├── persistence.test.ts         # Property 6: Locale persistence
    └── components.test.ts          # Component unit tests
```

### Property Test Example

```typescript
/**
 * Feature: i18n-internationalization
 * Property 1: Translation Key Validation
 * Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.5
 */
describe('Property 1: Translation Key Validation', () => {
  const keyPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,2}$/;
  const chinesePattern = /[\u4e00-\u9fff]/;

  it('all keys should match naming pattern and not contain Chinese', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getAllTranslationKeys()),
        (key) => {
          expect(key).toMatch(keyPattern);
          expect(key).not.toMatch(chinesePattern);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```
