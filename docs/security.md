# 安全模型

## 本地优先

- 无后端、无遥测、无账号托管。
- 凭证、会话、pending、operations、日志都在本机数据目录。
- 默认数据目录：`~/.wzvtc-anything`（Windows：`%USERPROFILE%\.wzvtc-anything`），可用 `WZVTC_HOME` 重定向。

## Vault

- 主密码经 Argon2id 派生 KEK；随机 DEK 加密条目；AES-256-GCM，每条目独立 nonce。
- 设备密钥随机生成，只存 Windows Credential Manager / macOS Keychain / Linux Secret Service。
- 不落明文 key 文件；无钥匙串时在 TTY 输入主密码。
- 当前不提供明文查看（`vault reveal` 未实现）；Agent Skill 不读取 Vault 文件。

## 写操作

- 默认 dry-run；预览通过后返回一次性 confirm token。
- 真实执行必须 `--execute --confirm <token>`；token 绑定工具、输入 hash、账号与短 TTL。
- 提交后回查；网络错误且 `side_effect_possible=true` 时，先对账再重试。
- 默认 `write_policy=agent`：是否让用户确认由 Agent 按 Skill 策略判断，CLI 不做人类在场证明。
- 被注入的 Agent 若具备 shell 权限，仍可能自行提交；这是默认模式的已知残余风险。`write_policy=human` 计划在后续版本提供。

## 学工链接

- 实测同一条链接可重复导入，按密码等价物处理。
- 不保存完整链接或 code；只保存换来的 token。
- 不要分享、截图或写入日志；怀疑泄露时在微信侧刷新/重登。

## 第三方平台

- 志愿汇只读；不实现写入、不绕过风控、不做反风控伪装。
- 遇到验证码/阻断就停止，改用官方渠道。

## 账号边界

- 仅限本人账号；禁止共享、售卖账号、代他人操作、批量操作。
- 不提供多用户/后端托管。
- 校级推广或官方集成前需取得学校授权。

## 报告安全问题

请使用 GitHub Security Advisories 私密报告，不要在公开 issue 中贴 token、学号、手机号或完整日志。目标 72 小时内确认，最佳努力，不承诺 SLA。
