# Sentry Theme Palette Design

## Goal

Refine the bundled `sentry` dark theme so JCode chrome uses source-backed Sentry product colors instead of the current mismatched purple, teal, and yellow palette.

## Source Context

Sentry exposes current product dark-mode tokens in `getsentry/sentry` under `static/app/utils/theme/scraps/theme/dark.tsx` and `static/app/utils/theme/scraps/tokens/color.tsx`.

Relevant dark product roles:

- `background.primary`: `#2E2936`
- `background.secondary`: `#24202B`
- `background.tertiary`: `#1B1821`
- `background.overlay`: `#393442`
- `background.accent.vibrant`: `#7553FF`
- neutral border/elevation steps: `#46404F`, `#554E60`

The public sentry.io marketing palette uses deeper brand colors such as `#1F1633`, `#181225`, and `#150F23`, but JCode's issue is app chrome cohesion, so the product app token ladder is the better fit.

## Palette Direction

Use a restrained product-app Sentry look:

- Canvas: `#1B1821`
- Sidebar, topbar, and base panels: `#24202B`
- Composer and card surfaces: `#2E2936`
- Header and hover surfaces: `#393442`
- Active and structural borders: `#46404F`
- Primary accent, links, command, chip, and skill: `#7553FF`
- Success: `#3DDC97`
- Error: `#FF6363`
- Warning: `#FFB938`
- Primary ink: `#F8F7FA`

## Implementation Scope

Update only the Sentry theme data and tests:

- `apps/web/src/theme/theme.logic.ts`: hand-authored Sentry depth override.
- `apps/web/src/theme/theme.seed.generated.ts`: bundled Sentry seed values.
- `apps/web/src/theme/theme.logic.test.ts`: locked hand-authored token expectations.
- `apps/web/src/components/ThemeTokens.browser.tsx`: browser token expectation.

No component layout, typography, or token-derivation behavior changes are needed.

## Verification

Run focused web theme tests and formatting checks for touched source files.
