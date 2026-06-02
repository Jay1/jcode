# JCode Context

## Glossary

### JCode

JCode is an independent local-first coding-agent cockpit built around day-to-day OpenCode workflow. It packages a web UI, local server, desktop shell, and provider integrations so a maintainer can manage coding-agent sessions from a local machine rather than a hosted multi-tenant product.

Committed defaults should optimize for local utility, fast recovery, safe public repository hygiene, and publishable configuration. Do not assume hosted SaaS guarantees or enterprise multi-user tenancy unless a future ADR changes that product boundary.

### Cockpit

A cockpit is the user-facing control surface for coding-agent work. In JCode this includes chat threads, terminal and workspace surfaces, split views, provider/model controls, git actions, approvals, runtime status, and notifications.

The cockpit coordinates local tools and provider runtimes; it should not leak raw provider protocol details directly into ordinary user-facing concepts.

### Skill Library

The Skill Library is the settings-native surface for discovering and managing coding-agent skills across providers such as OpenCode and Codex.

Its first version should be a read-only installed-skills inventory with provider source and concise descriptions. The UI may reserve space for future management actions, but installing, uninstalling, and searching remote skill catalogs such as skills.sh belong to later iterations.

The Skill Library should feel unified, but provider source boundaries remain explicit. The first design should include an all-installed overview while preserving provider groupings because OpenCode, Codex, Claude, Pi, and future providers can expose different metadata and management capabilities.

Skill cards optimize for recognition in the first iteration. A card should make the skill's name, source provider, and use case scannable at a glance; full prompt content, dependency details, file paths, and management operations belong outside the card or in future detail surfaces.

The first Skill Library should use a search-first command-library layout rather than a carousel. Provider-grouped lists must remain the complete browse path so large installed-skill sets stay contained and scannable.

### Chat-Output Scannability

Chat-output scannability is the cockpit quality that lets a maintainer quickly distinguish headings, file paths, commands, CSS or theme tokens, success states, pending states, and errors inside assistant output.

When improving Catppuccin chat rendering, optimize scannability first and Catppuccin palette faithfulness second. Catppuccin colors should carry semantic meaning rather than decorate the transcript uniformly.

Semantic coloring in chat output should use subtle accents by default. Headings, links, inline-code roles, and statuses may receive color, while body text remains calm and readable.

Inline code chips should use detected meaning when the role is clear. File paths may use blue, CSS or theme tokens teal, commands lavender, success states green, pending states yellow or peach, and error states red.

New semantic chat-color grammar should be proven on Catppuccin first, with a reusable cookbook that lets maintainers port the same roles to other themes later without redesigning the system.

The cookbook unit for semantic chat coloring is role-based tokens. Roles such as chat file, chat token, chat command, chat success, chat warning, and chat error are stable; each theme maps its palette into those roles.

Role detection must be conservative. Color only obvious patterns and leave unknown inline code neutral to avoid turning chat output into a noisy rainbow.

For the first semantic chat-color pass, keep existing code-block syntax highlighting and only align code-block containers, backgrounds, and copy controls with the Catppuccin surface system.

The success test for semantic chat coloring is screenshot-level scannability: in a representative assistant response, headings, file paths, theme tokens, statuses, and errors are distinguishable at a glance without making ordinary body text colorful.

### Keybindings

Keybindings are the user-facing command shortcuts that let the cockpit react to keyboard input. They map a command, shortcut, and optional context condition into the active behavior the web and desktop clients use.

Keybindings should be editable from a first-class Settings surface. The persisted keybindings file remains the durable source and advanced escape hatch, but ordinary keybinding discovery and editing should not require opening JSON directly.

### Provider

A provider is a coding-agent runtime family that can execute turns for a thread. Current provider kinds include Codex, Claude Agent, Cursor, Gemini, Kilo, OpenCode, and Pi.

Provider-specific behavior belongs behind server provider/runtime boundaries. Shared UI and persistence should use canonical contracts instead of raw provider-specific event payloads.

### Provider Runtime Event

A provider runtime event is the canonical event shape emitted by provider adapters and consumed by orchestration. It normalizes provider sessions, threads, turns, content deltas, tool lifecycle updates, permission or user-input requests, task progress, warnings, and errors.

Provider adapters should emit canonical lifecycle events instead of leaking raw provider events directly to the UI. Preserve event ordering and turn lifecycle semantics when changing provider adapters or event contracts.

### Orchestration

Orchestration is the server-owned layer that accepts client commands, ingests provider runtime events, maintains projected project/thread state, and streams snapshots or deltas to the web and desktop clients.

The durable orchestration aggregates are projects and threads. Commands and events use explicit actors such as client, server, and provider.

### Project

A project is a cockpit container rooted at a workspace path. It groups threads, default model selection, project scripts, and display metadata under a stable project id.

Project kind distinguishes normal workspace-backed projects from the internal `chat` kind. The `chat` kind is JCode's hidden Home chat container: it backs general chat rows at the user's home directory until a first send targets an existing workspace project or creates a real workspace project. Do not treat `chat` as a separate user-facing project category unless product language changes.

### Project Folder

A project folder is a user-configured parent directory whose direct child folders can be suggested when adding projects from the sidebar. It is not itself a project and does not automatically import every child folder; it only feeds the add-project suggestion list.

For the first version, JCode uses one project folder, stores it in server settings, shows direct child folders only, and hides folders that already exist as projects. Manual path entry remains available so users can add projects outside the configured folder.

### Thread

A thread is the primary unit of coding-agent conversation and work. It belongs to a project and carries title, provider model selection, runtime mode, interaction mode, environment mode, branch/worktree metadata, messages, proposed plans, activity, latest turn state, session status, and optional parent/fork/handoff/subagent relationships.

Threads may be pinned, archived, deleted, forked, handed off, associated with pull requests, or shown in split views. Treat a thread as more than a chat transcript: it is also the local work context for a provider session, terminal state, checkpoints, approvals, and git workflows.

### Turn

A turn is one provider execution attempt in a thread. User messages queue or steer turns, provider runtimes emit turn started/completed/aborted events, and orchestration attaches assistant output, task progress, diffs, checkpoints, approvals, and errors to the turn lifecycle.

Turn dispatch defaults to queue. Steer is the urgent redirect path and should not be treated as ordinary message submission.

### Provider Session

A provider session is the runtime connection between a provider and a thread. It records provider kind, runtime mode, current status, active turn, resume cursor, model/cwd details, timestamps, and last error.

Provider session health is not the same thing as local CLI freshness. OpenCode-compatible providers can run against external or remote runtimes, so runtime update state must be derived from the actual runtime path rather than the local `opencode` binary alone.

### ACP Integration

ACP integration is JCode's Agent Client Protocol support layer for providers that speak ACP over stdio/RPC. It wraps protocol initialization, authentication, session creation, permission requests, elicitation, file access, terminal operations, extension requests, and notifications.

Treat generated ACP schema bindings as protocol-bound artifacts. Domain decisions should live in provider adapters and contracts; generated schema files should only change through the generator or with a documented reason.

### Runtime Mode

Runtime mode controls how much autonomy a provider has while executing a thread. `full-access` is the default local-utility mode; `approval-required` is the constrained mode for flows that require explicit user approval before sensitive actions.

Runtime mode is thread/session state and should be kept distinct from provider identity, model selection, and interaction mode.

### Interaction Mode

Interaction mode controls the style of a provider turn. `default` is ordinary execution; `plan` asks the provider to produce or refine a plan before implementation.

Plan mode can create actionable proposed plans that may later be implemented or handed off, so UI should preserve the distinction between a plan and an ordinary assistant response.

### Thread Environment

A thread environment describes whether a thread works in the project's local workspace or an associated git worktree. `local` uses the project workspace root. `worktree` uses branch/worktree metadata and may be created for isolated implementation or pull-request preparation.

Worktree identity includes path, branch, and sometimes a detached ref. Normalize workspace roots for comparison without changing the stored display path.

### Handoff

A handoff is a relationship from one thread to another that carries source-thread context into a new thread. Handoff flows may create a new worktree or reuse an associated worktree, and they track bootstrap status so imported context is not confused with native messages.

Use handoff when continuity of work matters across threads; use fork language when the source relationship is a branch of conversation rather than an operational transfer.

### Checkpoint

A checkpoint is a captured work-state reference associated with a turn. Checkpoints support diff inspection and revert/rollback flows for thread work.

Checkpoint status can be ready, missing, or error. UI and server behavior should distinguish a missing checkpoint from a failed revert or a provider error.

### Terminal Session

A terminal session is a PTY-like local shell surface scoped to a thread and terminal id. Terminals can be opened, written to, resized, restarted, cleared, and closed over the shared server/web contract.

The default terminal id is `default`, but the cockpit supports multiple terminals, tabs, split terminal groups, terminal attention states, and terminal-first thread entry points.

### Managed Terminal Agent

A managed terminal agent is a terminal process whose command identity and hook events can be attributed to a known CLI such as Codex or Claude. JCode uses environment variables and OSC hook events to infer run state, attention/review status, and presentation metadata.

Managed terminal metadata helps the cockpit explain terminal activity, but it is separate from provider runtime events and should not be treated as the canonical provider turn lifecycle.

### Workspace Page

A workspace page is a terminal-first cockpit surface that is not itself a project. It has a synthetic workspace id, title, layout preset, and stable terminal scope for terminal-only workflows.

Do not confuse a workspace page with a project workspace root. A project maps to a filesystem root and owns threads; a workspace page is UI state for terminal layout and navigation.

### Split View

A split view is a recursive pane tree for viewing multiple thread surfaces together, currently bounded to a shallow grid. It belongs to an owner project, has a source thread, and can hold thread panes plus contextual right panels such as browser or diff.

Split view is a cockpit layout concept, not a separate orchestration aggregate.

### Composer Draft

A composer draft is the persisted pending input state for a project/thread/provider entry point. It can include selected provider/model options, runtime mode, interaction mode, environment mode, attachments, terminal context placeholders, and queued chat turns.

Drafts prevent user input loss and help bootstrap new or temporary threads. They should not be treated as committed orchestration messages until sent.

### Contract Package

The contract package defines the shared RPC, WebSocket, runtime event, provider, terminal, git, project, and orchestration schemas used across server, web, desktop, and scripts.

Contract changes are cross-cutting. When exported event or RPC shapes change, verify at least one affected consumer in addition to the package's own tests.

### Shared Package

The shared package contains pure utilities and domain helpers reused across apps, such as chat-thread title normalization, worktree handoff decisions, thread/workspace path comparison, model helpers, shell helpers, and tool-output summaries.

Prefer keeping reusable domain logic here when it is independent of React, server effects, process state, or persistence.

### Desktop Shell

The desktop shell is the Electron packaging boundary for local distribution. It owns the main process, preload bridge, desktop entry point, packaging config, and smoke checks while consuming the same server/web contracts as browser usage.

Treat preload bridge changes as API changes because they alter expectations between desktop main process, renderer, and shared contracts.

### Release Retention Policy

Release retention is the public GitHub distribution policy for desktop release pages and compiled installer assets. JCode should keep the latest public stable GitHub Release and, during active testing, the latest prerelease GitHub Release visible for download.

Older GitHub Release pages and their assets are disposable distribution outputs. Git tags and published npm package versions are durable audit and ecosystem records and should not be deleted by release pruning automation.

Release pruning runs after the new release is published. If pruning fails, the release workflow should fail loudly so maintainers know the public GitHub retention policy was not satisfied.

Historical changelog content remains in git and in the app's generated Release history. GitHub Releases is a latest-package distribution surface, not the long-term changelog archive.

Prerelease history is disposable. Publishing a prerelease should prune older prereleases, and publishing a stable release should prune all older stable and prerelease release pages.

Release workflow artifacts are job-to-job transport outputs, not distribution packages. They should use one-day retention so GitHub does not keep stale compiled bundles beyond the release run.

### Release Note Source

The release note source is the curated, per-version changelog record that explains what shipped in maintainer and user language. It is the source of truth for both the GitHub Release body and the in-app What's New / Release history surfaces.

GitHub-generated release notes are supporting automation, not the canonical changelog style. Avoid maintaining separate handwritten release summaries for GitHub and the app because they drift.

Release note sources are authored as per-version Markdown files with structured frontmatter under `docs/releases/`. The Markdown is the human editing surface; generated TypeScript app data and GitHub release bodies are derived outputs.

JCode release notes should be product-first and extremely concise. They should explain the useful user-visible outcome without screenshots and without dumping commit-level implementation detail.

The compact release note template is: title, one-sentence summary, three to five highlights, optional important fixes, and optional upgrade note. Omit empty sections rather than publishing filler.

Release-note generation is enforced strictly. A release version must have a matching source file, and generated release outputs must be current before the release workflow can publish packages.

The generated app release-history TypeScript data is committed because the app consumes it at build time. The GitHub Release body is generated during the release workflow from the same source file and should not be committed as a duplicate artifact.

Release-note validation runs in both normal CI and the release workflow. CI catches stale generated app data during review; the release workflow blocks publishing when the target version lacks a valid release note source.

### Server Auth Boundary

The server auth boundary describes how the local server decides whether a browser, desktop shell, or remote-reachable client may access JCode. Current policies distinguish desktop-managed local usage, loopback browser usage, remote-reachable usage, and explicit unsafe no-auth operation.

Authentication defaults must preserve local-first safety and publishable configuration. Pairing credentials, bearer tokens, session cookies, and websocket tokens are runtime secrets and must not become committed defaults.

A dev automation access grant is an explicit local-only owner session grant for trusted browser automation. It may mint a normal owner browser session only when opt-in config is enabled, the server is intentionally loopback-bound, and the request is same-origin loopback/local; remote-reachable binds and non-loopback clients must continue through normal pairing.

### Project Direction

JCode is independently directed. OpenCode is the engine boundary; JCode's local-first coding-agent cockpit workflow is the product boundary. DPCode and T3Code are historical lineage and optional external references, not active product philosophy.

Do not blindly merge external work into `main`. Review any outside idea on short-lived feature branches or with the upstream delta ledger, test it, and keep only small JCode-native pieces.

### Upstream Delta Ledger

A local-first workflow for tracking new PRs and releases from historical-lineage projects such as DPCode and T3Code. It records what has already been seen so maintainers can review only new external-reference activity. It does not merge, cherry-pick, or create import branches automatically; adaptation decisions remain manual and JCode-directed.

Ledger state is local-only by default and belongs under `.jcode/upstream-watch/`. Committed repository files may define the tool, upstream list, and runbook, but personal cursors and review logs should not be committed unless explicitly exported as a human summary.

For pull requests, “new” means updated since the ledger cursor, not only created or merged since the last run. This intentionally catches new PRs, reopened PRs, merge events, and metadata changes that may affect import strategy.

For releases, “new” means published since the ledger cursor. Draft creation and later release-note or asset edits are not part of the default delta signal.

Pull request delta reports default to triage fields: upstream repo, PR number, title, state, updated and merged timestamps, author, labels, URL, and base/head branches. Diff stats or changed-file lists may be optional deeper inspection modes, but they are not part of the default ledger pass.
