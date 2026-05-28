<p align="center">
  <img src="./apps/web/public/jcode.png" alt="JCode logo" width="96" />
</p>

# JCode

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/Jay1/jcode/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/Release-Desktop-6f42c1?logo=github&logoColor=white)](https://github.com/Jay1/jcode/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/Jay1/jcode)](./LICENSE)
![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Jay1%2Fjcode?utm_source=oss&utm_medium=github&utm_campaign=Jay1%2Fjcode&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A local cockpit for coding agents, tuned for low-level and cybersecurity workflows.

## Installation

### Linux and macOS

#### Homebrew

```bash
brew tap Jay1/jcode https://github.com/Jay1/jcode
brew install --cask jcode
```

#### Download the latest macOS 

`JCode-<version>-arm64.dmg` or
`JCode-<version>-x64.dmg`, or the latest Linux `JCode-<version>-x64.AppImage`, from
[GitHub Releases](https://github.com/Jay1/jcode/releases).

### Windows

#### Scoop 

If you do not have Scoop yet, follow the [official Scoop installation guide](https://scoop.sh/):

```powershell
scoop bucket add jcode https://github.com/Jay1/scoop-jcode
scoop install jcode
```

#### Winget 

```powershell
winget install Jay1.JCode
```

#### Download the latest Windows

Latest `JCode-<version>-x64.exe` installer from
[GitHub Releases](https://github.com/Jay1/jcode/releases).

## Development

```bash
bun install          # install dependencies
bun run dev          # start the dev server
bun run build        # build all workspaces
bun run typecheck    # type-check the monorepo
```

## Credits

Built from [DPCode](https://github.com/Emanuele-web04/dpcode) and
[T3Code](https://github.com/pingdotgg/t3code), with love <3

See [CREDITS.md](./CREDITS.md) for full attribution.
