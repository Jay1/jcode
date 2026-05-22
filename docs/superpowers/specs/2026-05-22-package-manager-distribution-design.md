# Package Manager Distribution Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repository-local Homebrew Cask and Winget release templates plus end-user README installation instructions for JCode desktop releases.

## Context

JCode publishes desktop artifacts through `.github/workflows/release.yml` from version tags matching `v*.*.*`. The release workflow builds macOS DMGs for `arm64` and `x64`, a Linux AppImage, and a Windows NSIS installer. Artifact names come from `scripts/build-desktop-artifact.ts` and use `JCode-${version}-${arch}.${ext}`.

There are currently no public GitHub Releases in this repository, so package-manager manifests can be prepared in the repo, but public package-manager installation will only work after a release exists and external publication happens.

## Recommended Approach

Use a repo-local packaging directory:

- `Casks/jcode.rb` for the Homebrew Cask source file.
- `packaging/winget/Jay1.JCode/templates/` for Winget submission templates.
- `README.md` for user-facing install instructions.

## Design Decisions

- Homebrew Cask targets GitHub Release DMG assets using `version` and `arch` interpolation.
- Homebrew Cask keeps `sha256 :no_check` until the project starts producing immutable checksums in release automation or the tap maintainer fills them manually.
- Winget manifests are templates, not final submission files, because Winget requires the final installer SHA256 from a published `.exe` asset.
- README states direct downloads are available from GitHub Releases and that `brew`/`winget` commands are available only after publishing to a tap or Winget community repository.

## Acceptance Criteria

- README explains end-user install options for macOS and Windows without implying unavailable registry publication.
- Homebrew Cask file points at the macOS GitHub Release DMG artifact naming convention.
- Winget templates include the package metadata and Windows installer URL/SHA placeholders a release owner must fill.
- Files are formatted and easy to validate manually.
