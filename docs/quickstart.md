# 快速开始

## 环境要求

- Node.js **>= 22.12**
- Windows / macOS / Linux
- 一个支持 Agent Skills 的 Agent（Claude Code、Codex、Cursor 等）

## 安装 CLI

发布到 npm 后：

```bash
npm i -g wzvtc-anything
wzvtc version
```

从源码开发：

```bash
git clone https://github.com/windfsy/wzvtc-anything.git
cd wzvtc-anything
pnpm install
pnpm build
npm link
wzvtc version
```

## 初始化 Vault（由人执行）

```bash
wzvtc vault init
```

- 设置至少 8 位的主密码。
- 选择“信任此设备”后，设备密钥只存 OS 钥匙串，不落文件。
- 不信任设备时，后续需要 Vault 的命令会在 TTY 要求主密码。

检查：

```bash
wzvtc vault status
wzvtc doctor
```

## 安装 Agent Skill

```bash
wzvtc skills install --target claude-code
# 或 codex / cursor / agents
wzvtc skills list
```

## 登录 / 导入

### 学工

从微信公众号复制学工链接，在**自己的终端**运行：

```bash
wzvtc auth import xgxt --channel wechat-mobile
```

链接实测可重复导入，请按密码等价物处理；不要发到聊天、截图或日志。

### 第二课堂

```bash
wzvtc auth login dekt --password-stdin
```

stdin 两行：账号、密码；只保存 token，不保存密码。

### 志愿汇（只读）

```bash
wzvtc auth login zyh --password-stdin
```

## 常用命令

```bash
wzvtc doctor
wzvtc auth status xgxt --probe
wzvtc xgxt leave list --limit 10
wzvtc xgxt leave form
wzvtc xgxt leave apply --input leave.json
wzvtc dekt activity list --limit 10
wzvtc dekt activity enroll --id <id>
wzvtc zyh hours summary
wzvtc zyh hours list --year 2026
```

写操作默认 dry-run；真实执行：

```bash
wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
```

## 清理

```bash
wzvtc vault devices
wzvtc vault revoke-device <deviceId> --yes
wzvtc vault reset --purge --confirm RESET
```

`reset --purge` 会删除 Vault、会话、pending、operations、日志、缓存与设备信任，**不可恢复**。

## 进一步阅读

- [学工请假](/systems/xgxt)
- [第二课堂](/systems/dekt)
- [志愿汇](/systems/zyh)
- [安全模型](/security)
- [限制](/limitations)
- [命令参考](/commands)
