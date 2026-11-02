# Security policy

This Alpha has no paid support or security-response SLA. Supported source version: 0.2.1-alpha.1. macOS remains experimental until native runtime validation is complete.

Do not put credentials, bridge.json, server.token, account identifiers or private conversations in a public issue. Use GitHub private vulnerability reporting if enabled for this repository. If it is not available, open a minimal request for a private contact without exploit details or secrets. Rotate any credential that has already been disclosed.

Run npm run audit:check for the registry audit policy and npm run check:release before a source push. Current build-only exceptions and their expiry are documented in docs/DEPENDENCY_SECURITY.md. A scoped exception is not a patched dependency or a security certification.

The application does not approve tool permissions. Approval stays in the original Agent application. System encryption protects stored DeepSeek keys; token files and raw diagnostic profiles must not be shared.
