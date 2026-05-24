# JCode Context

## Glossary

### Upstream Delta Ledger

A local-first workflow for tracking new PRs and releases from upstream source-material projects such as DPCode and T3Code. It records what has already been seen so maintainers can review only new upstream activity. It does not merge, cherry-pick, or create import branches automatically; import decisions remain manual and strategy-driven.

Ledger state is local-only by default and belongs under `.jcode/upstream-watch/`. Committed repository files may define the tool, upstream list, and runbook, but personal cursors and review logs should not be committed unless explicitly exported as a human summary.

For pull requests, “new” means updated since the ledger cursor, not only created or merged since the last run. This intentionally catches new PRs, reopened PRs, merge events, and metadata changes that may affect import strategy.

For releases, “new” means published since the ledger cursor. Draft creation and later release-note or asset edits are not part of the default delta signal.

Pull request delta reports default to triage fields: upstream repo, PR number, title, state, updated and merged timestamps, author, labels, URL, and base/head branches. Diff stats or changed-file lists may be optional deeper inspection modes, but they are not part of the default ledger pass.
