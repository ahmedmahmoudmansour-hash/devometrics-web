<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Arabic localization is in progress — write RTL-safe inline styles

This app is being translated to Arabic with full RTL support (`next-intl`,
locale from the `devometrics-locale` cookie — see `lib/i18n/request.ts`).
It's a page-by-page migration in progress, not finished — most of the app
still uses hardcoded English strings and physical-direction CSS. Two rules
for **any new or edited inline `style={{}}`**, regardless of whether the
file you're touching has been converted yet, so this doesn't keep adding
work the Arabic migration has to undo later:

- **Use logical CSS properties, not physical ones**: `paddingInlineStart`/`paddingInlineEnd` instead of `paddingLeft`/`paddingRight`, `insetInlineStart`/`insetInlineEnd` instead of `left`/`right`, `marginInlineStart`/`marginInlineEnd` instead of `marginLeft`/`marginRight`, `textAlign: "start"/"end"` instead of `"left"/"right"`. These are real CSS properties (not a next-intl feature) — React accepts them directly in `style={{}}` via their camelCase form, and they flip automatically under `dir="rtl"` with zero conditional logic. `top`/`bottom` are unaffected by RTL and don't need this treatment.
- **User-facing strings in files that have already been converted** (currently: `components/Navbar.tsx`, `components/Hero.tsx`, `components/Footer.tsx`) **must go through `useTranslations()`**, not a hardcoded literal — add the string to both `messages/en.json` and `messages/ar.json` (genuine Modern Standard Arabic/Fusha, never a regional dialect). Files not yet converted can stay as plain English literals for now; converting a file's strings and its CSS properties happens together, not one without the other, so half-converted files don't linger.
