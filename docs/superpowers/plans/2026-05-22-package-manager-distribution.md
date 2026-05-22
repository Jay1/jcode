# Package Manager Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Homebrew Cask and Winget packaging templates plus README installation instructions.

## Files

- `Casks/jcode.rb`: Homebrew Cask tap file for macOS DMG releases.
- `packaging/winget/Jay1.JCode/templates/Jay1.JCode.locale.en-US.yaml`: Winget locale metadata template.
- `packaging/winget/Jay1.JCode/templates/Jay1.JCode.installer.yaml`: Winget installer metadata template for the Windows NSIS `.exe`.
- `packaging/winget/Jay1.JCode/templates/Jay1.JCode.yaml`: Winget version metadata template.
- `packaging/winget/Jay1.JCode/README.md`: Maintainer notes for filling and submitting Winget manifests.
- `README.md`: End-user install instructions.

## Steps

- [x] Add the Homebrew Cask file using GitHub Release DMG URLs and current artifact naming.
- [x] Add Winget template files with explicit placeholders for release version, installer URL, and SHA256.
- [x] Add maintainer notes explaining how to turn the Winget templates into a `microsoft/winget-pkgs` submission.
- [x] Update README installation section for direct downloads, Homebrew, and Winget.
- [x] Run formatting or syntax checks where available.
- [x] Run `lsp_diagnostics` if the local environment permits it.
- [x] Review `git diff --check` and final status.
