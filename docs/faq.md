# 常见问题

## 需要什么环境？

Node.js >= 22.12；Windows/macOS/Linux。Agent 需要支持 Agent Skills（Claude Code、Codex、Cursor 等）。

## `wzvtc` 命令找不到？

从源码安装后执行 `npm link`；或使用 `node dist/main.js ...`。确认 `node -v` 满足要求。

## Vault 初始化后为什么还要钥匙串？

“信任此设备”会把设备密钥放进 OS 钥匙串，后续命令自动解锁；不信任则每次在 TTY 输入主密码。

## `keychain_unavailable` 怎么办？

无头/沙箱/Linux 缺少 Secret Service 时会这样。请在 TTY 重跑命令并输入主密码；或换到有钥匙串的环境。

## 学工链接怎么获取？

从微信公众号打开学工系统，复制带鉴权的链接，在终端运行 `wzvtc auth import xgxt --channel wechat-mobile` 粘贴。不要把链接发到聊天。链接可重放，按密码处理。

## confirm token 是什么？

写操作预览后的一次性确认令牌，绑定工具、输入 hash 和账号，短 TTL。真实执行：`--execute --confirm <token>`。过期或输入变化会返回 `confirmation_expired`。

## 为什么第二课堂/学工写操作没有直接执行？

默认 dry-run；需要先预览。是否让用户确认由 Agent 按 Skill 策略判断；真实提交会产生真实记录。

## 志愿汇能报名/签到吗？

不能。当前只读；写入不在范围内，且涉及第三方平台合规/风控。

## 怎么删除本地数据？

```bash
wzvtc vault reset --purge --confirm RESET
```

会删除 Vault、会话、pending、operations、日志、缓存和设备信任，不可恢复。

## 怎么报告问题？

使用 GitHub Issues；安全问题使用 Security Advisories。附 `request_id`、版本与脱敏日志，不要附密码/token/链接。
