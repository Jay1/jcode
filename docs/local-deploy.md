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

For Jay's current tailnet-only deployment, app auth may be disabled at the
service layer because network access is already restricted.

For a public/default setup, app auth should remain enabled.

## Promotion Checklist

Before switching the live service from DPCode to JCode:

1. Build JCode from `/home/jay/code/jcode`.
2. Start it locally with a separate state directory.
3. Verify project list, thread open, agent start, and restart recovery.
4. Tag the known-good state.
5. Switch the service path and keep the previous DPCode service path as rollback.
