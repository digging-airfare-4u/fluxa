# Implementation Plan: i18n Internationalization

## Overview

本实现计划将 Fluxa 项目从硬编码中文文案迁移到完整的国际化支持。采用渐进式迁移策略，先搭建基础设施，再逐步替换各模块文案。

## Tasks

- [x] 1. 安装依赖并配置 next-intl 基础设施
  - [x] 1.1 安装 next-intl 依赖包
    - 运行 `pnpm add next-intl`
    - _Requirements: 1.1_
  - [x] 1.2 创建 i18n 配置文件
    - 创建 `src/lib/i18n/config.ts` 定义 locales、defaultLocale、namespaces
    - 创建 `src/lib/i18n/request.ts` 配置 getRequestConfig
    - _Requirements: 1.1, 1.6, 1.7_
  - [x] 1.3 创建 I18nProvider 组件
    - 创建 `src/lib/i18n/I18nProvider.tsx` 包装 NextIntlClientProvider
    - 配置 onError 和 getMessageFallback 处理缺失翻译
    - _Requirements: 1.6, 2.4, 2.5_
  - [x] 1.4 创建语言切换 Server Action
    - 创建 `src/lib/i18n/actions.ts` 实现 setLocale 和 getLocale
    - 使用 cookie 持久化语言偏好
    - _Requirements: 1.5, 6.3_
  - [x] 1.5 更新根布局集成 I18nProvider
    - 修改 `src/app/layout.tsx` 添加 I18nProvider
    - 从 cookie 读取 locale 并传递给 provider
    - 更新 HTML lang 属性
    - _Requirements: 1.2, 6.5_

- [x] 2. 创建翻译资源文件结构
  - [x] 2.1 创建 zh-CN 命名空间文件
    - 创建 `src/locales/zh-CN/common.json`
    - 创建 `src/locales/zh-CN/auth.json`
    - 创建 `src/locales/zh-CN/editor.json`
    - 创建 `src/locales/zh-CN/chat.json`
    - 创建 `src/locales/zh-CN/home.json`
    - 创建 `src/locales/zh-CN/points.json`
    - 创建 `src/locales/zh-CN/errors.json`
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 创建 en-US 命名空间文件
    - 创建对应的英文翻译文件
    - 确保所有 key 与 zh-CN 一致
    - _Requirements: 2.1, 2.2_
  - [x] 2.3 创建 i18n hooks 和工具函数
    - 创建 `src/lib/i18n/hooks.ts` 导出 useT、useCommonT、useI18nFormatter
    - 创建 `src/lib/i18n/index.ts` 统一导出
    - _Requirements: 1.6, 4.4, 4.5_

- [x] 3. Checkpoint - 验证基础设施
  - 确保 next-intl 正确集成
  - 验证翻译文件可以加载
  - 确保无 SSR/CSR 水合错误
  - 如有问题请询问用户

- [x] 4. 创建语言切换组件
  - [x] 4.1 实现 LanguageSwitcher 组件
    - 创建 `src/components/ui/LanguageSwitcher.tsx`
    - 使用 DropdownMenu 显示语言选项
    - 调用 setLocale action 切换语言
    - _Requirements: 6.1, 6.2_
  - [x] 4.2 集成语言切换到用户界面
    - 在 EditorLayout 顶部工具栏添加语言切换
    - 在首页/个人资料页添加语言切换入口
    - _Requirements: 6.1_

- [x] 5. 迁移 editor 命名空间文案
  - [x] 5.1 迁移 EditorLayout 菜单文案
    - 替换下拉菜单所有项目文案（主页、项目库、新建项目、删除当前项目、导入图片、撤销、重做、复制对象、显示画布所有图片、放大、缩小）
    - 使用 `useTranslations('editor')` 获取翻译
    - _Requirements: 7.2, 14.2_
  - [x] 5.2 迁移 LeftToolbar 工具提示
    - 替换所有工具按钮的 tooltip 文案（选择工具、框选工具、矩形工具、文字工具、画笔工具、图片上传、AI 功能）
    - _Requirements: 7.6, 14.1_
  - [x] 5.3 迁移 LayerPanel 文案
    - 替换图层面板标题（"图层"）和空状态文案（"暂无图层"）
    - _Requirements: 14.3_
  - [x] 5.4 迁移 ContextMenu 文案
    - 替换右键菜单所有项目文案（复制、粘贴、图层、置于顶层、上移一层、下移一层、置于底层、删除）
    - _Requirements: 14.2_

- [x] 6. 迁移 auth 命名空间文案
  - [x] 6.1 迁移 AuthDialog 组件
    - 替换登录/注册表单所有文案（标题、标签、占位符、按钮、链接文案）
    - 替换所有错误提示（请填写邮箱和密码、两次输入的密码不一致、密码至少需要 6 个字符、邮箱或密码错误、请先验证邮箱后再登录、该邮箱已被注册、操作失败请重试）
    - 替换成功提示（注册成功！请查收验证邮件...）
    - _Requirements: 7.5, 8.1, 8.2, 8.3, 11.2_

- [x] 7. 迁移 chat 命名空间文案
  - [x] 7.1 迁移 ChatPanel 组件
    - 替换面板标题、收起/展开提示（收起面板、展开聊天面板）
    - 替换空状态文案（开始设计、描述你想要的设计...）
    - 替换生成状态文案（正在生成...）
    - _Requirements: 15.1, 10.1, 15.2_
  - [x] 7.2 迁移 ChatInput 组件
    - 替换输入框占位符（请输入你的设计需求）
    - 替换 tooltip 文案（引用图片、发送）
    - 替换加载状态文案（加载中...、暂无图片）
    - _Requirements: 15.3_
  - [x] 7.3 迁移 ChatMessage 组件
    - 替换消息操作按钮文案（查看完整报告、设计方案详情、图片预览）
    - _Requirements: 15.1_

- [x] 8. 迁移 home 命名空间文案
  - [x] 8.1 迁移 HomeInput 组件
    - 替换打字机效果的占位符文案数组（PLACEHOLDER_TEXTS）
    - 替换默认占位符（描述你想要的设计...）
    - _Requirements: 8.2_
  - [x] 8.2 迁移 ProjectGrid 组件
    - 替换项目卡片操作文案（Delete、未命名、New Project）
    - 替换删除确认对话框文案（确定要删除这个项目吗？、此操作无法撤销...、取消、删除）
    - _Requirements: 10.1_
  - [x] 8.3 迁移 App 首页
    - 替换标语（让 AI 帮你设计一切）
    - 替换错误提示（加载项目失败、创建项目失败、删除项目失败）
    - 替换 Recent Projects 标题和 See All 链接
    - _Requirements: 7.5, 10.1_
  - [x] 8.4 迁移 Profile 页面
    - 替换页面标题（个人中心）
    - _Requirements: 7.1_

- [x] 9. 迁移 points 命名空间文案
  - [x] 9.1 迁移 PointsBalanceIndicator 组件
    - 替换 tooltip 文案（点数余额 · 点击查看详情）
    - _Requirements: 16.1_
  - [x] 9.2 迁移 InsufficientPointsDialog 组件
    - 替换对话框标题（限时优惠！）、描述、按钮文案（稍后再说、立即升级）
    - _Requirements: 16.3_
  - [x] 9.3 迁移 TransactionHistory 组件
    - 替换筛选标签（全部、收入、支出）
    - 替换交易来源名称（注册奖励、AI 设计、图片生成、导出、管理员调整）
    - 替换时间格式化文案（刚刚、分钟前、小时前、天前）
    - 替换空状态和错误状态文案
    - 替换分页文案（第 X / Y 页，共 Z 条、上一页、下一页）
    - _Requirements: 16.2_
  - [x] 9.4 迁移 Pricing 组件
    - 替换定价页面标题和描述
    - 替换计费周期文案（年付、省 20%、按月计费、按年计费）
    - 替换套餐状态文案（暂不可用、推荐、充值入口已关闭）
    - _Requirements: 16.4, 16.5_

- [x] 10. 迁移 errors 命名空间文案
  - [x] 10.1 创建错误码映射工具
    - 创建 `src/lib/i18n/errorMessages.ts`
    - 实现 API 错误码到本地化消息的映射函数
    - _Requirements: 11.1_
  - [x] 10.2 迁移组件中的错误消息
    - 替换 ChatPanel 中的错误消息（请重新登录后再试、Failed to generate image/design、Failed to send message）
    - 替换 App 首页中的错误消息
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 11. Checkpoint - 验证文案迁移完整性
  - 检查所有组件是否已迁移
  - 验证中英文切换正常
  - 确保无遗漏的硬编码文案
  - 如有问题请询问用户

- [x] 12. 迁移无障碍文案
  - [x] 12.1 迁移 aria-label 属性
    - 检查并替换所有 aria-label 硬编码文案（如 LeftToolbar 的 "Canvas tools"）
    - _Requirements: 13.1_
  - [x] 12.2 迁移 alt 和 title 属性
    - 检查并替换所有图片 alt 属性（如 logo 的 "Fluxa"）
    - _Requirements: 13.2, 13.3_

- [ ] 13. 添加属性测试
  - [ ]* 13.1 编写翻译键验证属性测试
    - **Property 1: Translation Key Validation**
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.5**
  - [ ]* 13.2 编写翻译回退属性测试
    - **Property 2: Translation Fallback Behavior**
    - **Validates: Requirements 2.4, 2.5**
  - [ ]* 13.3 编写变量插值属性测试
    - **Property 3: Variable Interpolation**
    - **Validates: Requirements 4.1, 4.3**
  - [ ]* 13.4 编写语言偏好持久化属性测试
    - **Property 6: Locale Preference Persistence**
    - **Validates: Requirements 1.4, 1.5, 6.3, 6.4**

- [ ] 14. 添加单元测试
  - [ ]* 14.1 编写 i18n 配置测试
    - 测试 locales、namespaces 配置正确
    - 测试翻译文件加载
    - _Requirements: 1.1, 2.1, 2.2_
  - [ ]* 14.2 编写 LanguageSwitcher 组件测试
    - 测试组件渲染
    - 测试语言切换功能
    - _Requirements: 6.1, 6.2_

- [ ] 15. Final Checkpoint - 完成验收
  - 运行所有测试确保通过
  - 验证 SSR/CSR 无水合错误
  - 验证语言切换流畅
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 为可选测试任务，可跳过以加快 MVP 进度
- 每个任务引用具体需求以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
- 所有组件目前仍使用硬编码中文文案，需要逐步迁移到使用 `useTranslations` hook
