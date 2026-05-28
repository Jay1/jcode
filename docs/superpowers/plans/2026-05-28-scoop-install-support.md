# Scoop Install Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Scoop packaging support and update installation documentation for Linux, macOS, and Windows users.

## Files

- `scripts/generate-scoop-manifest.ts`: Generates a concrete Scoop manifest from a release version and Windows installer SHA256.
- `scripts/generate-scoop-manifest.test.ts`: Covers manifest rendering and hash validation.
- `packaging/scoop/templates/jcode.json`: Placeholder Scoop manifest template for bucket publication.
- `packaging/scoop/README.md`: Maintainer instructions for publishing or updating the Scoop manifest.
- `package.json`: Adds a convenience `release:scoop` command for maintainers.
- `README.md`: End-user installation instructions.

## Steps

- [x] Add a failing test for Scoop manifest rendering and validation.
- [x] Add the Scoop manifest generator.
- [x] Add a placeholder Scoop manifest and maintainer notes.
- [x] Update README installation sections for Linux/macOS Homebrew and Windows Scoop/Winget.
- [x] Run focused tests and available formatting/type checks.
- [x] Run Aikido security scan on changed first-party code.
