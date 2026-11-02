# Dependency security review · 2026-11-02

npm audit currently reports 15 moderate dependency nodes caused by GHSA-g3hv-75wg-m249 (minimatch), with no reported high/critical findings. These are not 15 independent exploits. They remain reported by npm; this project does not claim to have patched upstream minimatch.

The official registry reports electron-builder 26.18.0 as the current release, already pinned here. The advisory describes amplification when an attacker controls a glob pattern and optimizationLevel >= 2. The installed app-builder-lib/out/fileMatcher.js sets {dot:true}; minimatch defaults optimizationLevel to 1. The universal builder matcher likewise uses trusted build configuration, and this app targets separate Windows x64 / macOS arm64 builds, not a universal merge. App users and the local event API cannot supply glob build patterns.

The older transitive minimatch majors expose different CommonJS APIs. A global major-version override or npm audit fix --force would risk breaking packaging; npm's suggested electron-builder 20.23.1 is an unrelated downgrade. No such override or downgrade was made.

A narrow temporary exception is recorded in security/audit-exceptions.json, expires 2026-12-02, and only allows this advisory at moderate-or-lower severity for the named development nodes. npm run audit:check queries the official registry and fails on a new/unresolved advisory, a production dependency, higher severity, unknown package or expired exception. A failed/unavailable audit is never treated as a pass. This is risk containment for an Alpha build, not vulnerability removal.

Before changing glob configuration, accepting external patterns, updating the build chain or publishing a stable release, remove or re-review the exception and run the full clean-install/packaging checks. Keep GitHub workflows without signing/release credentials on pull_request runs. Do not use pull_request_target to execute untrusted code.

npm does not provide complete coverage of Chromium/Electron native vulnerabilities. Track Electron upstream security releases separately. Runtime network and account adapters are reviewed separately from build-time dependency advisories.

Sources: https://github.com/advisories/GHSA-g3hv-75wg-m249 ; official npm registry metadata for electron-builder. The reviewed installed matcher and advisory are the basis for this scoped decision.
