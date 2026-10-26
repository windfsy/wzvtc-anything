# Security Policy

## Supported versions

This is a pre-1.0 community project. Security fixes target the latest release only.

## Reporting a vulnerability

Please use GitHub Security Advisories (private vulnerability reporting) for this repository. Do not open a public issue with credentials, tokens, student IDs, phone numbers, cookies, full campus links, or raw logs.

Include:

- affected version / commit
- command and error code / `request_id`
- redacted reproduction steps
- impact

Best-effort response target: 72 hours. No SLA is promised.

## Scope

In scope:

- credential/session storage and keychain handling
- Vault cryptography and reset behavior
- confirm-token and write pipeline
- secret leakage in CLI output, logs, Skill, docs, or fixtures
- command injection / path traversal

Out of scope:

- upstream campus systems' own vulnerabilities
- third-party platform terms-of-service changes
- attacks requiring the user to hand over their master password or token
- CAPTCHA bypass / anti-bot evasion (not supported)

## Safe harbor

Do not access other users' accounts, do not run destructive tests against campus systems, and do not publish credentials or PII. Report privately and allow time for a fix.
