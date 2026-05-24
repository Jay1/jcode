<p align="center">
  <img src="./apps/web/public/jcode.png" alt="JCode logo" width="96" />
</p>

# JCode

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/Jay1/jcode/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/Release-Desktop-6f42c1?logo=github&logoColor=white)](https://github.com/Jay1/jcode/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/Jay1/jcode)](./LICENSE)
![Bun](https://img.shields.io/badge/Bun-1.3.9-000000?logo=bun&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24.13-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Jay1/jcode?utm_source=oss&utm_medium=github&utm_campaign=Jay1%2Fjcode&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

JCode is a local cockpit for coding agents tuned for low-level & cybersecurity related day-to-day workflow.

It is a small Bun/TypeScript monorepo with a web UI, desktop packaging, and a
local server that manages coding-agent sessions.

## Installation

Desktop builds are published from GitHub Releases. Package-manager installs become
available after the corresponding Homebrew tap and Winget manifests are published.

### macOS

Install with Homebrew after the JCode tap is published:

```bash
brew tap Jay1/jcode https://github.com/Jay1/jcode
brew install --cask jcode
```

Until then, download the latest `JCode-<version>-arm64.dmg` or
`JCode-<version>-x64.dmg` from
[GitHub Releases](https://github.com/Jay1/jcode/releases).

### Windows

Install with Winget after the `Jay1.JCode` package is accepted into the Windows
Package Manager community repository:

```powershell
winget install Jay1.JCode
```

Until then, download the latest `JCode-<version>-x64.exe` installer from
[GitHub Releases](https://github.com/Jay1/jcode/releases).

## Development

Common commands:

```bash
bun install
bun run build
bun run typecheck
bun run dev
```

## Credits

Built from [DPCode](https://github.com/Emanuele-web04/dpcode) and
[T3Code](https://github.com/pingdotgg/t3code), with love ❤️ you made my life a little bit easier.

See [CREDITS.md](./CREDITS.md) for complete attribution notes.
