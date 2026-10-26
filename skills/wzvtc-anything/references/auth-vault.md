# 认证与 Vault

## 人类与 Agent 的边界

- **人类**负责：`vault init`、输入主密码、复制学工链接、必要时信任/撤销设备。
- **Agent** 可以：`doctor`、`vault status/list/devices`、`auth status`、业务命令、预览写操作。
- **Agent 不得**：索取或转述主密码、读取 `vault.json`、把链接/token 写入聊天或日志。

## 初始化

```bash
wzvtc vault init
```

- 主密码至少 8 位；Vault 文件位于 `~/.wzvtc-anything/vault.json`。
- 选择“信任此设备”后，设备密钥只存操作系统钥匙串，不落文件。
- 不信任设备时，每次需要 Vault 的命令都要在 TTY 输入主密码；Agent 非 TTY 场景返回 `master_password_required`。

## 设备与清理

```bash
wzvtc vault status
wzvtc vault devices
wzvtc vault revoke-device <deviceId> --yes
wzvtc vault reset --purge --confirm RESET
```

- `revoke-device` 删除指定设备的钥匙串信任；撤销当前设备后下次需要主密码。
- `reset --purge` 删除 Vault、会话、pending、operations、日志、缓存和设备信任，不可恢复。
- 这两条命令属于高风险操作，只在用户明确要求时执行。

## 学工链接导入

```bash
wzvtc auth import xgxt --channel wechat-mobile
```

- 从微信公众号的学工系统复制链接；输入隐藏，不回显。
- 实测同一链接可重复导入，按密码等价物处理；不要分享、截图或写入日志。
- 成功后只保存 access/refresh token，不保存链接或 code。
- 如怀疑链接泄露，让用户重新登录微信/刷新公众号会话，使旧链接尽快失效。

## 学工移动端账密（备用，仅人类）

```bash
wzvtc auth login xgxt --password-stdin
```

- stdin 两行：账号、密码；只保存 token，不保存密码。
- 统一认证密码不一定等于学工移动端密码；失败不要反复重试，优先使用 link-code。

## 第二课堂

```bash
wzvtc auth login dekt --password-stdin
wzvtc auth status dekt --probe
```

- 账号 = 学号，密码 = 第二课堂密码；只保存 token。
- 支持活动读取与报名/取消；写入必须经过预览与用户确认。

## 志愿汇（只读）

```bash
wzvtc auth login zyh --password-stdin
wzvtc auth status zyh --probe
```

- 账号 = 志愿汇账号，密码 = 志愿汇密码；只保存 token。
- 只读；不实现报名/签到等写入。

## 状态

```bash
wzvtc vault status
wzvtc auth status xgxt
wzvtc auth status xgxt --probe
wzvtc doctor
```

- `vault status` 不返回明文。
- `auth status` 默认只报告 token 是否存在；`--probe` 调用对应接口验证。
- `doctor` 不主动提示主密码。

## 常见错误

- `vault_corrupt`：不要覆盖文件；备份后让用户决定是否 `vault reset --purge`。
- `master_password_invalid`：让用户重试；不要猜测密码。
- `keychain_unavailable`：无头/沙箱环境；让用户在 TTY 输入主密码。
- `confirmation_expired`：token 过期、已用或账号会话变化；重新预览。
