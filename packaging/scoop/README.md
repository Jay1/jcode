# Scoop Package Notes

These files prepare JCode for installation from a Scoop bucket.

Before publishing or updating the bucket manifest:

1. Publish a GitHub Release with the Windows installer asset, for example `JCode-0.0.50-x64.exe`.
2. Compute the installer SHA256 with `sha256sum JCode-0.0.50-x64.exe` or `Get-FileHash -Algorithm SHA256`.
3. Generate the manifest:

```bash
node scripts/generate-scoop-manifest.ts --version 0.0.50 --hash <sha256>
```

4. Copy `packaging/scoop/jcode.json` into the JCode Scoop bucket repository.
5. Commit and push the bucket update.

The generated manifest wraps the current Windows NSIS installer and passes `/D=$dir` so the app installs into Scoop's managed app directory. End-user `scoop install jcode` commands require a published Scoop bucket that contains the generated `jcode.json` manifest.
