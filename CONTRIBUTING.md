# Contributing

Thanks for helping. Read `docs/contributing.md` for the full guide.

Quick checks:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
```

Rules:

- Keep connectors independent; core must not import connectors.
- Every write goes through `executeConfirmedWrite` (preview → confirm token → execute → verify).
- No real credentials, student IDs, phone numbers, cookies, tokens, or full campus links in code, tests, fixtures, logs, issues, or docs.
- Do not add CAPTCHA OCR, anti-bot evasion, credential sharing, or bulk operations.
- 志愿汇 is read-only; writes require a separate compliance/scope discussion.
- One PR per concern; include tests and docs.

Security issues: use GitHub Security Advisories, not public issues.
