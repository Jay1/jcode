# Appearance Regression Testing

| Field           | Value                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Status          | Active                                                                                                             |
| Type            | Testing reference                                                                                                  |
| Owner           | Engineering                                                                                                        |
| Audience        | Engineers, reviewers, and automation agents                                                                        |
| Scope           | Appearance settings, theme tokens, wordmark rendering, chat prose fonts, and inline/code font behavior             |
| Canonical path  | `docs/testing/appearance-regressions.md`                                                                           |
| Last reviewed   | 2026-05-31                                                                                                         |
| Review cadence  | Event-driven; review when Appearance settings, theme token derivation, chat rendering, or browser test setup moves |
| Source of truth | `apps/web/src/appSettings.ts`, Appearance route controls, font hooks, theme token logic, and chat renderer tests   |
| Verification    | Contract tests first; one focused browser canary for computed style behavior; full CI before merge                 |

## Purpose

Appearance regressions are user-visible and easy to reintroduce when token names, settings labels, or renderer inheritance change independently. Stabilize them by testing the contract chain, not just the final symptom.

The chain is:

```text
Appearance setting -> app setting field -> CSS override variable -> semantic CSS token -> rendered surface
```

## Locked Contracts

| Contract            | Source setting                      | CSS variable/token path                                      | User-visible surface                             |
| ------------------- | ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| UI font             | `settings.uiFontFamily`             | `--app-font-ui-override` -> `--font-ui-family`               | App UI and normal chat prose                     |
| Chat code font      | `settings.chatCodeFontFamily`       | `--app-font-chat-code-override` -> `--font-chat-code-family` | Inline code, code blocks, and code-like surfaces |
| Chat body font      | `getChatTranscriptTextStyle()`      | `--font-chat-body-family` -> `--font-ui-family`              | Assistant and user chat prose                    |
| Wordmark prefix     | `APP_WORDMARK_PREFIX` and theme CSS | `--app-wordmark-prefix`                                      | Blood-red `J` in navbar and compact chrome       |
| Theme code fallback | active theme fonts                  | `--theme-font-code-family` -> `--font-chat-code-family`      | Code when no explicit Code font is set           |
| Theme UI fallback   | active theme fonts                  | `--theme-font-ui-family` -> `--font-ui-family`               | UI/prose when no explicit UI font is set         |

## Test Layers

| Layer               | What it should prove                                                                        | Preferred file shape                                      |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pure contract tests | Variable names, fallback chains, settings-source mappings, and helper set/remove behavior   | `apps/web/src/**/<domain>.test.ts`                        |
| Renderer tests      | Components emit semantic tokens rather than raw theme/code variables                        | Colocated `*.test.tsx` with static markup or source reads |
| Browser canary      | Computed styles change on real DOM elements in Chromium                                     | One focused `*.browser.tsx` per user-visible surface      |
| Full CI gate        | The same behavior survives repo formatting, typecheck, unit tests, browser tests, and build | GitHub Actions / root CI scripts                          |

Keep browser coverage deliberately small. One stable computed-style canary is better than many screenshot-like checks that make local runs heavy and flaky.

## Regression Matrix

| When changing this                                           | Add or update this proof                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `uiFontFamily` setting or `useUIFont()`                      | Contract test for `--app-font-ui-override`; browser proof that chat prose follows UI font           |
| `chatCodeFontFamily` or `useChatCodeFont()`                  | Contract test for `--app-font-chat-code-override`; browser proof that inline code follows Code font |
| Chat markdown or transcript wrappers                         | Renderer test that prose uses `--font-chat-body-family`; browser proof for computed prose font      |
| Inline code, fenced code, diffs, terminal-like code surfaces | Renderer/static test that the surface uses `--font-chat-code-family`                                |
| Theme token generation                                       | Theme logic test that required `--app-*`, `--theme-font-*`, and wordmark tokens are present         |
| Wordmark rendering                                           | Structure test for `APP_WORDMARK_PREFIX`; theme test for blood-red `--app-wordmark-prefix`          |

## Commands

Use focused commands while developing:

```bash
bun run --cwd apps/web test:local src/hooks/appearanceFontOverrides.test.ts
bun run --cwd apps/web test:local src/components/chat/MessagesTimeline.test.tsx
bun run --cwd apps/web test:browser:local src/components/chat/ChatTranscriptPane.browser.tsx
```

Use broader gates before merging Appearance changes:

```bash
bun run fmt:check:local
bun run --cwd apps/web typecheck
bun run --cwd apps/web build
```

Run full CI-equivalent commands when release or merge confidence requires it. Prefer the `:local` variants during workstation development to avoid saturating CPU and browser resources.

## Review Checklist

- Does the test assert the intended contract, not an incidental implementation detail?
- Does prose remain separate from inline/code font behavior?
- Does the browser test use computed styles on real rendered elements?
- Does the test avoid screenshots, timing assumptions, and broad app startup unless those are the behavior under review?
- Is the doc updated when the Appearance contract changes?
