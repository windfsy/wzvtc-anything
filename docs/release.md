# 发布清单

## 发布前

- [ ] 版本号：`package.json` / `src/core/version.ts` / Skill metadata 一致。
- [ ] 移除 `package.json` 的 `"private": true`（当前保留为发布保险）。
- [ ] 发布前运行 `npm view wzvtc-anything version` 校验包名可用性。
- [ ] 配置 npm token / trusted publishing（GitHub Secrets `NPM_TOKEN`）。
- [ ] 在 GitHub 创建仓库并推送（`windfsy/wzvtc-anything`）。
- [ ] `pnpm release:check`：typecheck、test、build、docs build、npm pack。
- [ ] CI 矩阵（Windows/macOS/Ubuntu × Node 22/24）通过。
- [ ] 文档站构建通过；GitHub Pages 已启用。
- [ ] 安全发现已写入文档：学工链接可重放、志愿汇只读、跨平台钥匙串未实机验证。
- [ ] 没有真实凭证/PII 进入仓库、fixtures、日志或文档。

## 发布

> 仅推送 GitHub 源码时，不要打 `v*` tag：tag 会触发 npm 发布流程，而当前 `private: true` 会使其失败。首次 GitHub-only 发布直接推送 `main` 即可。

npm 发布时：

```bash
git tag v1.0.0
git push origin v1.0.0
```

标签触发 `.github/workflows/release.yml`：

- 校验 `private` 已移除。
- 运行 release check。
- `npm publish --provenance --access public`。
- 创建 GitHub Release（手动或后续自动化）。

## 发布后

- [ ] 验证 `npm view wzvtc-anything version`。
- [ ] 在一台干净环境执行 `npx wzvtc-anything version`。
- [ ] 验证 `wzvtc skills install --target claude-code`。
- [ ] 更新 README/文档站的安装版本。
- [ ] 观察 issue 与安全报告；必要时发布 patch。

## 回滚

- npm 包不能被真正“删除”；若需撤回，发布 deprecate + patch 版本。
- 严重安全问题：发布 GitHub Security Advisory，更新文档，必要时下线相关功能。
