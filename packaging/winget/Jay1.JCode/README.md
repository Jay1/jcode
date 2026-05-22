# Winget Package Notes

These files are templates for submitting JCode to the Windows Package Manager Community Repository.

Before submission:

1. Publish a GitHub Release with the Windows installer asset, for example `JCode-0.0.47-x64.exe`.
2. Compute the installer SHA256 with `sha256sum JCode-0.0.47-x64.exe` or `Get-FileHash -Algorithm SHA256`.
3. Copy the files from `templates/` into a versioned Winget manifest directory.
4. Replace every `{{VERSION}}`, `{{RELEASE_DATE}}`, and `{{INSTALLER_SHA256_X64}}` placeholder.
5. Validate and submit with `wingetcreate` or a PR to `microsoft/winget-pkgs`.

End-user `winget install Jay1.JCode` commands will only work after Microsoft accepts and publishes the package.
