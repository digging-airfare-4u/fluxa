# Fluxa Public Launch — Post-P0 Gap Analysis

> **Date:** 2026-03-25
> **Context:** P0 public launch plan (`2026-03-24-public-launch-p0.md`) is complete. This document captures gaps found outside the P0 scope that affect launch quality and long-term product health.

---

## High Severity / Launch Blocking

### G1: No Per-Publication OG / SEO Social Sharing Previews

When a publication URL is shared on WeChat, Twitter, or any messaging platform, the preview card shows generic Fluxa brand metadata (title: "Fluxa - AI Design Generator", no og:image). The shared link carries no cover image, title, or description from the publication itself.

**Files affected:**
- `src/app/app/discover/[id]/page.tsx` — no `generateMetadata` export
- `src/app/layout.tsx` — generic `<head>` metadata only
- No `public/og-image.png` or equivalent

**Impact:** Social sharing is a core growth mechanism. Generic previews make shared links lifeless and reduce click-through from discovery.

**Recommendation:** Add per-page `generateMetadata` in `src/app/app/discover/[id]/page.tsx` that pulls title, description, and cover image from the publication data. For dynamic OG image generation, consider using `@vercel/og` or a similar solution.

---

### G2: No In-App Notification System

There is zero notification infrastructure. When someone likes a publication, comments on it, follows the creator, or when points run critically low, the creator has no in-app way to know — they must manually check their publications or profile.

**What exists:** `sonner` toasts for transient events (payment reload, remix failure). Social actions are persisted to the database.

**What's missing:** Notification store, notification API route, realtime subscription to notification events, notification center UI, and notification preferences.

**Impact:** The social loop is one-directional. Creators publish into a void. This undermines the discovery-as-growth-loop premise entirely — a creator has no reason to return if their work gets engagement they never see.

**Recommendation:** This is a P1 item. Minimal viable version: Supabase Realtime subscription on an `notifications` table + a notification bell icon in the header with an unread count + a dropdown showing recent items. Email notifications can follow.

---

### G3: Editor Share Button is Not Wired

`TopToolbar` has a `Share2` button with an `onShare` prop. `EditorLayout` receives `onShare` but has no handler for it. The publish flow (`src/components/share/ShareDialog.tsx`, `src/components/share/PublishForm.tsx`) exists as a dialog shell but may not be connected to the toolbar.

**Impact:** A creator inside the editor has no UI path to publish their work. The entire creator → discovery loop is blocked at the last mile.

**Recommendation:** Verify whether `EditorLayout` correctly wires `onShare` to `<ShareDialog>`. If `ShareDialog` exists but is disconnected, this is a small fix. If the publish component is missing entirely, it needs to be built as part of P0 completion.

---

### G4: No Password Reset Flow

There is no "forgot password" link in `AuthDialog` or `/auth`. Supabase supports `supabase.auth.resetPasswordForEmail()` but has no UI trigger.

**Impact:** Any user who forgets their password is permanently locked out. Generates support burden and churn.

**Recommendation:** Add a "Forgot password?" link in `AuthDialog` that shows an email input, sends the reset email via Supabase, and shows a "check your email" state. Also add a dedicated reset-password page (`/auth/reset-password`) to handle the reset token callback.

---

### G5: Post-Payment Points Arrival Is Opaque

After payment succeeds, `CheckoutDialog` shows `CheckCircle2` + `{t('pricing.done')}`, then reloads after 1.5s. The user lands on their updated points page but never sees an explicit statement of what they bought, what they received, and what it enables.

**What exists:** `fetchPoints()` is called on success, refreshing the store.

**What's missing:** No intermediate success state explains the causal relationship: "Your 500 points have been added. That's enough for approximately X generations with [model name]."

**Impact:** Users may not trust that points arrived correctly, especially if there's any server-side delay. Directly undermines commercial trust even if the ledger is correct.

**Recommendation:** Replace the generic "done" success state with a clear result screen: points added, what it buys, a link to start creating.

---

## Medium Severity / Quality

### G6: Landing Page Has No Product Explanation

A first-time visitor from search or referral sees a visually impressive landing page with floating sample images and a "Get Started" CTA — but no explanation of what Fluxa is, what it produces, or who it's for.

**What exists:** `src/app/page.tsx` with a tagline from `t('hero.tagline')` and a hero section.

**What's missing:** A concise "what is Fluxa" section explaining the value proposition: AI-powered visual design generation, remix from existing works, share and discover. This is especially critical on mobile where floating images may not render clearly.

**Impact:** Activation drop-off. Users who don't immediately understand the value won't complete auth.

---

### G7: New Creators Have No Initial Visibility Path

The discover feed supports `latest` and `popular` sorting. A new creator with 0 likes always appears below established creators with existing engagement. There is no featured section, trending signal, "Editor's Picks," or new-creator landing path.

**Impact:** Discovery is structurally unfavorable to newcomers. Suppresses creator motivation and long-term content supply.

**Recommendation:** P1/P2 item. Consider: a "New This Week" section, a "Fresh Creator" signal, or a randomized "Explore" tab that surfaces low-engagement-high-quality content.

---

### G8: Auth Page Language Is Hardcoded Chinese

`/auth` page contains hardcoded Chinese strings ("登录你的账户", "创建新账户", "邮箱", "密码"). `AuthDialog` uses `useTranslations()` with i18n keys. The two auth entry points have different language models.

**Impact:** Confusing for mixed-language users. Hardcoded strings cannot be translated for international users.

**Recommendation:** Migrate the auth page to use `useTranslations()` or consolidate to always use `AuthDialog` instead of a separate page.

---

### G9: No Email Confirmation Resend

On registration, `setSuccess(t('register.success'))` shows a message asking the user to check their email. If the email is missed or the address is mistyped, there is no UI to resend the confirmation link.

**Impact:** User activation failure. The user is stuck with no recovery path.

**Recommendation:** Add a "resend confirmation email" link in the login error state when "Email not confirmed" occurs, or show a dedicated "check your email" screen after registration with a resend option.

---

### G10: TopToolbar Has Hardcoded Chinese Tooltips

`TopToolbar` contains hardcoded Chinese strings: `分享`, `编辑元素`, `编辑文字`. Other editor components use `useTranslations()`.

**Impact:** Minor i18n inconsistency. Signals incomplete internationalization work.

**Recommendation:** Replace with `useTranslations()` keys. Quick fix.

---

### G11: No Account Deletion Flow

No UI or API route exists to delete a user account. Supabase has the capability (`admin.deleteUser`) but nothing surfaces it.

**Impact:** GDPR requirement for many jurisdictions. Also a baseline user trust expectation.

**Recommendation:** P1 item. Add a "Delete Account" option in the profile with confirmation steps and a server-side API route.

---

## Lower Severity / Long-Term Quality

### G12: Realtime Disconnect Shows No User Feedback

The app subscribes to Supabase Realtime for ops, jobs, messages, and points. Error callbacks (`catch`, `onError`) log to console. If realtime disconnects, the user sees no indication.

**Impact:** Silent desync. Canvas operations may stop syncing without the user knowing.

**Recommendation:** Add a subtle "Reconnecting..." banner or dot when Supabase realtime channel state changes to `closed` or `buffered`. Minimal UI, high trust value.

---

### G13: External QR Code Rendering Has No Fallback

`CheckoutDialog` renders WeChat/payment QR codes using `https://api.qrserver.com/v1/create-qr-code/`. If this service is blocked or slow in China, the payment flow breaks.

**Impact:** Payment failure for Chinese users relying on WeChat QR codes.

**Recommendation:** Generate QR codes server-side or self-host a QR rendering utility. The P0 plan notes this gap in spec section 11.9 but it remains unresolved.

---

### G14: No User-Facing Content Reporting

Users have no way to report publications that violate community standards. The only moderation path is operator intervention via Supabase dashboard.

**Impact:** If abusive content appears and spreads, there is no user-facing channel to flag it. Could lead to brand damage.

**Recommendation:** P2 item. Add a "Report" option on publication cards and detail views that opens a modal with reason selection and optional description, submitting to an API route that creates a moderation ticket.

---

### G15: Editor TopToolbar Has Incorrect Mobile Offset

`TopToolbar` uses `className="mr-[380px]"` on the right section to accommodate the layer panel width. On mobile, where the layer panel is hidden, this pushes toolbar controls far off-screen.

**Impact:** Broken toolbar layout on mobile in the editor.

**Recommendation:** Add responsive classes that remove or adjust the right margin on mobile breakpoints.

---

## Summary

| ID | Severity | Gap |
|---|---|---|
| G1 | **High** | No per-publication OG/SEO previews |
| G2 | **High** | No in-app notification system |
| G3 | **High** | Editor share button not wired |
| G4 | **High** | No password reset |
| G5 | **High** | Post-payment points arrival opaque |
| G6 | Medium | Landing page no product explanation |
| G7 | Medium | New creators have no visibility path |
| G8 | Medium | Auth page hardcoded Chinese |
| G9 | Medium | No email confirmation resend |
| G10 | Medium | TopToolbar hardcoded Chinese tooltips |
| G11 | Medium | No account deletion |
| G12 | Low | Realtime disconnect no user feedback |
| G13 | Low | External QR code has no fallback |
| G14 | Low | No user-facing content reporting |
| G15 | Low | Editor toolbar broken on mobile |

---

## Recommended Next Steps

1. **Before P0 execution (optional):** G3 (share button wiring) should be verified — if the publish flow is actually disconnected, it is a P0 blocker in disguise and should be folded into Package 3.
2. **After P0:** G1 (OG/SEO), G4 (password reset), G9 (email resend), G10 (i18n tooltips) are relatively small and high-value — consider adding them to a P1 plan.
3. **P1:** G2 (notifications), G11 (account deletion), G6 (landing explanation)
4. **P2:** G7 (creator visibility), G14 (content reporting), G13 (QR fallback)
