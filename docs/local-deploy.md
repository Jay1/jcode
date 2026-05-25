# Local Deploy Notes

These notes document the intended shape for a local JCode deployment without
committing Jay-specific runtime state as application defaults.

## Source Path

The target JCode source path is:

```text
/home/jay/code/jcode
```

## Target Service Shape

A local deployment should be a user systemd service with:

- `Restart=always`
- short stop timeout
- control-group kill mode
- a dedicated state directory outside the repo
- a local-only HTTP listener proxied by the user's chosen secure transport

Example values for Jay's battlestation can be kept in local service files, but
the repo should only carry generic examples.

## Auth Mode

Keep JCode app auth enabled for local and tailnet deployments. The browser app
uses pairing credentials to bootstrap owner/client sessions, and the backend
must answer `/api/auth/bootstrap`, `/api/auth/bootstrap/bearer`, and
`/api/auth/session` preflight/requests with CORS headers so a local app origin
can pair against a tailnet backend.

Owner startup pairing URLs are short lived. Do not commit generated pairing
links, session cookies, or tailnet hostnames as defaults.

## Promotion Checklist

Before switching the live service from DPCode to JCode:

1. Build JCode from `/home/jay/code/jcode`.
2. Start it locally with a separate state directory.
3. Verify `/health` and authenticated `/api/auth/session` after pairing.
4. Verify project list, thread open, agent start, and restart recovery.
5. Tag the known-good state.
6. Switch the service path and keep the previous service path as rollback.
