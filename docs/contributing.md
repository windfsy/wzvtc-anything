# 贡献指南

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

文档：

```bash
pnpm docs:dev
pnpm docs:build
```

## 代码边界

- CLI → registry → connectors → core，依赖单向；connector 之间零依赖。
- 业务逻辑放 connector；CLI 只做参数、输出与编排。
- 写操作必须走 `executeConfirmedWrite`：preview → confirm token → execute → verify。
- 能力只声明一次；schema/docs/Skill 从声明派生，避免手抄参数表。

## 安全

- 仓库、fixtures、日志、测试、issue 不得含真实学号、姓名、手机号、token、cookie、完整链接。
- 不提交 `.har`、抓包原始数据或 `.wzvtc-anything` 数据目录。
- 不做 CAPTCHA OCR、不绕过风控、不做反检测伪装。
- 第三方平台（志愿汇）保持只读；写入需要单独的范围与合规评估。

## PR

- 一个 PR 只做一件事；附带测试与文档。
- 新 connector 需要：脱敏 fixtures、错误映射、至少一条 mock 测试、更新 Skill reference。
- 破坏性变更走 semver major，并写迁移说明。
