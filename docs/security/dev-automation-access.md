# Dev Automation Access Grant

| Field           | Value                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                                                                                  |
| Type            | Security reference and local automation runbook                                                                                                                                         |
| Owner           | Security and Engineering                                                                                                                                                                |
| Audience        | Maintainers, reviewers, and automation agents that need browser access to a local JCode server                                                                                          |
| Scope           | Loopback-only browser automation authentication, startup flags, endpoint behavior, secret handling, and troubleshooting                                                                 |
| Canonical path  | `docs/security/dev-automation-access.md`                                                                                                                                                |
| Last reviewed   | 2026-06-01                                                                                                                                                                              |
| Review cadence  | Event-driven; review when server auth defaults, startup host rules, browser automation setup, pairing/session behavior, or the Server Auth Boundary changes                             |
| Source of truth | `CONTEXT.md`, `AGENTS.md`, `apps/server/src/main.ts`, `apps/server/src/startupAccess.ts`, `apps/server/src/auth/http.ts`, and `apps/server/src/http.ts`                                 |
| Verification    | `bun run fmt:check AGENTS.md docs/security/dev-automation-access.md docs/security/README.md docs/runbooks/local-development.md` plus focused server tests when runtime behavior changes |

## Purpose

The dev automation access grant lets trusted local browser automation authenticate against a local JCode server without asking the operator to copy a one-time pairing code into the test browser.

This is not a replacement for pairing. It is a narrow Server Auth Boundary exception for local development and test automation. Remote-reachable clients, LAN clients, tailnet clients, and wildcard-bound servers must continue through normal pairing.

## When To Use It

Use the grant when all of these are true:

- You are running JCode locally for development or automated browser testing.
- The server is intentionally bound to an explicit loopback host such as `127.0.0.1`, `localhost`, or `::1`.
- The browser automation runs from the same loopback origin as the JCode server.
- You need a normal owner `browser-session-cookie` session for local UI verification.

Do not use the grant when any of these are true:

- The server is bound to `0.0.0.0`, `::`, a LAN address, a tailnet address, or any other remote-reachable host.
- A non-loopback client needs access.
- You are working in a shared, remote, or production-like environment.
- You would need to commit, print, or share the resulting session cookie.

## Startup

The grant is off by default. Enable it only with an explicit loopback host.

```bash
JCODE_HOST=127.0.0.1 JCODE_DEV_AUTOMATION_ACCESS=true bun run dev:server
```

Equivalent server CLI flags:

```bash
--host 127.0.0.1 --dev-automation-access
```

Startup rejects the grant when the host is omitted or remote-reachable. This is intentional: desktop defaults may still be loopback, but automation access must be an explicit opt-in so agents cannot accidentally widen the auth boundary.

## Grant Request

After the server is running on a loopback origin, browser automation can request a session with:

```http
POST /api/auth/automation-access-grant
```

The successful response uses the same shape as a browser-session bootstrap response and includes a `Set-Cookie` header for the normal owner session cookie.

From a same-origin browser context, use a relative fetch so the browser stores the cookie for that origin:

```js
const response = await fetch("/api/auth/automation-access-grant", {
  method: "POST",
  credentials: "include",
});

if (!response.ok) {
  throw new Error(`Automation access grant failed: ${response.status}`);
}
```

Expected JSON body:

```json
{
  "authenticated": true,
  "role": "owner",
  "sessionMethod": "browser-session-cookie",
  "expiresAt": "..."
}
```

Do not commit the returned cookie or copy it into docs, scripts, issue comments, or logs.

## Boundary Checks

The server grants access only when all runtime checks pass:

| Check               | Required value                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| Config opt-in       | `devAutomationAccess` is `true`                                                |
| Server host         | Explicit loopback host: `127.0.0.1`, `localhost`, or `::1`                     |
| Remote address      | Loopback remote address: `127.0.0.1` or `::1`                                  |
| Request host/origin | Same-origin loopback request; absent `Origin` is allowed for non-browser tools |
| Session issued      | Normal owner `browser-session-cookie` session                                  |

When any check fails, the endpoint returns `403` and does not set a session cookie.

## Expected Agent Workflow

1. Start or reuse a JCode server with explicit loopback automation access enabled.
2. Open the loopback JCode origin in the browser automation context.
3. Request `POST /api/auth/automation-access-grant` from that same origin.
4. Continue UI verification with the normal owner browser session.
5. Treat the session cookie as a runtime secret and let it expire or be discarded with the browser context.

If the endpoint returns `403`, do not weaken auth checks. Confirm the host, origin, remote address, and opt-in flag. If those are not all local and explicit, use normal pairing.

## Troubleshooting

| Symptom                                      | Likely cause                                       | Fix                                                                 |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Startup fails with a loopback-host message   | The grant was enabled without an explicit host     | Add `--host 127.0.0.1` or set `JCODE_HOST=127.0.0.1`                |
| Startup rejects `0.0.0.0` or a tailnet host  | The server would be remote-reachable               | Use normal pairing for remote clients, or bind to explicit loopback |
| Endpoint returns `403` from browser tests    | Origin/host is not same-origin loopback            | Navigate to the loopback server origin before requesting the grant  |
| Endpoint returns `403` from a command runner | Missing opt-in or the request appears non-loopback | Check `JCODE_DEV_AUTOMATION_ACCESS`, host, `Origin`, and URL        |
| Browser still appears unauthenticated        | Cookie was not stored in the browser context       | Request from the page origin with `credentials: "include"`          |

## Related Files

- [`../../CONTEXT.md`](../../CONTEXT.md): Server Auth Boundary domain definition.
- [`../../AGENTS.md`](../../AGENTS.md): Short agent-facing usage guidance.
- [`../../apps/server/src/main.ts`](../../apps/server/src/main.ts): startup flag and environment parsing.
- [`../../apps/server/src/startupAccess.ts`](../../apps/server/src/startupAccess.ts): loopback host, remote address, and same-origin checks.
- [`../../apps/server/src/auth/http.ts`](../../apps/server/src/auth/http.ts): shared automation grant predicate and node auth route.
- [`../../apps/server/src/http.ts`](../../apps/server/src/http.ts): production Effect auth route.
