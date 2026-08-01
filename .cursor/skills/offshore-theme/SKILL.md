---
name: offshore-theme
description: >-
  Apply or swap the Offshore CRM frontend visual theme (Admin/Crew/Superadmin).
  Use when the user asks for a new theme, redesign look, color change, dashboard
  style, or references a theme mockup/screenshot. Keeps future theme swaps
  token-cheap by documenting only the files and variables to edit.
---

# Offshore Theme Swap

Client changes themes often. **Do not re-analyze the whole app.** Edit tokens + shell chrome only unless they ask for layout changes.

## Current theme (v4 — Blue / White + dropdown nav)

Light blue-white product look with expandable sidebar dropdowns (Crew, Flights, Projects).

| Token | Value |
|-------|--------|
| Background | `#F3F6FB` / HSL `214 32% 97%` |
| Card / sidebar | `#FFFFFF` |
| Primary (blue) | `#1A56DB` / HSL `214 84% 40%` |
| Text | near-black / muted gray |
| Radius | `0.875rem` |
| Nav | Accordion dropdowns; active child = solid primary pill |

**Default mode:** light.

## Files to touch (only these)

1. [`src/index.css`](../../src/index.css) — `:root` + `.dark` CSS variables (shadcn tokens)
2. [`src/components/app/AppShell.tsx`](../../src/components/app/AppShell.tsx) — sidebar/header + dropdown animation
3. [`src/components/app/navConfig.ts`](../../src/components/app/navConfig.ts) — nav items + `children` for dropdowns
4. [`src/pages/RigsPage.css`](../../src/pages/RigsPage.css) — `.subsea-shell` local vars (`--shell`, `--blue`, …)
5. Optional: ViewTabs / PageHeader if chrome drifts

Wire dropdown targets with query params (e.g. `/crew?view=available`) — pages read `useSearchParams`.

## History

| Version | Look | Notes |
|---------|------|--------|
| v1 | Dark Subsea / icon rail | Legacy |
| v2 | Shared AppShell + blue primary | UX redesign |
| v3 | Soft teal dashboard | Rejected by client |
| v4 | Blue/white + sidebar dropdowns | Current |
