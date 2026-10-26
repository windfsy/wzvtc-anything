# WZVTC-Anything CLI

![status](https://img.shields.io/badge/status-pre--release-orange)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen)

面向 AI Agent 的温州职业技术大学校园服务命令行工具。

WZVTC-Anything CLI 将校园系统的查询与事务操作封装为稳定的 JSON 命令，并通过 Agent Skill 组织为可组合的工作流。CLI 负责认证、Vault、确定性执行与安全确认；Agent 负责自然语言理解、参数收集与流程编排。

> 本项目为第三方非官方工具，与温州职业技术大学任何部门无隶属关系。仅限本人账号使用，不得共享、售卖账号或代他人操作。

## 功能概览

- **学工系统**：请假记录、请假表单、申请预览/提交、撤销；微信 link-code 认证。
- **第二课堂**：活动列表、活动详情、报名、取消、成绩单；账号密码认证。
- **志愿汇**：志愿时长汇总与明细；第三方账号密码认证，只读。
- **本地 Vault**：主密码 + Argon2id + AES-256-GCM；设备密钥仅存 OS 钥匙串。
- **受控写操作**：预览 → 一次性 confirm token → 执行 → 回查；operation 日志支持对账。
- **Agent Skill**：单 Skill + 分系统 references，可安装到 Claude Code、Codex、Cursor 等 Agent。
- **跨平台**：Node.js ESM，支持 Windows、macOS、Linux。

## 支持矩阵

| 系统 | 认证 | 读取 | 写入 | 状态 |
|---|---|---|---|---|
| 学工 `xgxt` | 微信 link-code | 请假列表/详情/表单 | 申请、撤销 | 已验证 |
| 第二课堂 `dekt` | 厂商账号密码 | 活动/成绩单 | 报名、取消 | 已验证 |
| 志愿汇 `zyh` | 第三方账号密码 | 时长汇总/明细 | 无（只读） | 已验证 |

写操作默认 dry-run；真实执行必须显式提供预览返回的 confirm token。

## 环境要求

- Node.js **>= 22.12**
- Windows、macOS 或 Linux
- 支持 Agent Skills 的 Agent（可选，用于自然语言交互）

## 安装

### 从源码安装

```bash
git clone https://github.com/windfsy/wzvtc-anything.git
cd wzvtc-anything
pnpm install
pnpm build
npm link
wzvtc version
```

### 从 npm 安装（发布后）

```bash
npm install -g wzvtc-anything
wzvtc version
```

当前版本尚未发布至 npm；发布前请使用源码安装。

## 快速开始

### 1. 初始化 Vault

由用户在终端执行：

```bash
wzvtc vault init
wzvtc vault status
wzvtc doctor
```

- 主密码至少 8 位。
- 选择“信任此设备”后，设备密钥写入操作系统钥匙串，不落文件。
- 未信任设备时，需要 Vault 的命令会在 TTY 中要求输入主密码。

### 2. 安装 Agent Skill

```bash
wzvtc skills install --target claude-code
# 可选：codex、cursor、agents
wzvtc skills list
```

### 3. 登录或导入凭证

学工（微信链接）：

```bash
wzvtc auth import xgxt --channel wechat-mobile
```

第二课堂：

```bash
wzvtc auth login dekt --password-stdin
```

志愿汇（只读）：

```bash
wzvtc auth login zyh --password-stdin
```

`--password-stdin` 读取两行：账号、密码。凭证仅用于换取 token；Vault 不保存密码。

## 常用命令

```bash
# 学工
wzvtc xgxt leave list --limit 10
wzvtc xgxt leave form
wzvtc xgxt leave get --id <id>
wzvtc xgxt leave apply --input leave.json
wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
wzvtc xgxt leave cancel --id <id>

# 第二课堂
wzvtc dekt activity list --limit 10
wzvtc dekt activity get --id <id>
wzvtc dekt activity enroll --id <id>
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
wzvtc dekt transcript get

# 志愿汇（只读）
wzvtc zyh hours summary
wzvtc zyh hours list --year 2026
```

完整命令与参数见 [命令参考](https://windfsy.github.io/wzvtc-anything/commands)，或在终端运行：

```bash
wzvtc schema --compact
wzvtc schema <command>
```

## 安全与隐私

- **本地优先**：无后端、无遥测、无账号托管；凭证与会话不离开本机。
- **Vault**：Argon2id + AES-256-GCM；设备密钥仅存操作系统钥匙串，不写明文 key 文件。
- **写操作**：默认 dry-run；confirm token 绑定命令、输入 hash、账号与短 TTL；提交后回查。
- **学工链接**：实测可重复导入，按密码等价物处理；不得通过聊天、日志或截图传播。
- **志愿汇**：只读；不实现写入，不绕过平台风控。
- **安全边界**：不识别 CAPTCHA、不做反风控伪装、不共享账号、不提供多用户/服务端托管。

默认写策略为 `write_policy=agent`：是否让用户确认由 Agent 按 Skill 策略判断。被注入且具备 shell 权限的 Agent 仍可能自行提交，这是已知残余风险；严格人工确认模式计划在后续版本提供。

完整威胁模型见 [安全模型](https://windfsy.github.io/wzvtc-anything/security)。

## 数据目录与清理

默认数据目录：

- Windows：`%USERPROFILE%\.wzvtc-anything`
- macOS/Linux：`~/.wzvtc-anything`

可通过 `WZVTC_HOME` 重定向。

```bash
wzvtc vault devices
wzvtc vault revoke-device <deviceId> --yes
wzvtc vault reset --purge --confirm RESET
```

`vault reset --purge` 删除 Vault、会话、pending、operations、日志、缓存与设备信任，不可恢复。

## 支持范围与限制

- 学工：未实现附件上传、销假、留校申请；不做教务课表冲突检测。
- 第二课堂：未实现签到/签退；审批流与部分字段以真实响应为准。
- 志愿汇：只读，不提供写入。
- 未实现 CAS/WebForms、MCP、`vault exec`、`write_policy=human`、Vault 导出/恢复。
- 真实钥匙串仅在 Windows 完成实机验证；macOS/Linux 依赖 CI 代码级验证与 `wzvtc doctor`。
- 上游系统无面向个人的官方 API，接口可能变化；本项目不承诺可用性 SLA。

完整边界见 [限制](https://windfsy.github.io/wzvtc-anything/limitations)。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
pnpm release:check
```

- 55 个自动化测试；覆盖链接解析、Vault、confirm token、账号绑定、写结果分类、学工/第二课堂客户端与写管线。
- 文档站基于 VitePress；命令参考由 schema 生成。
- CI：Windows/macOS/Ubuntu × Node 22/24，执行 typecheck、test、build、schema smoke 与 npm pack。
- 发布流程见 [发布清单](https://windfsy.github.io/wzvtc-anything/release)。

## 文档

- [快速开始](https://windfsy.github.io/wzvtc-anything/quickstart)
- [命令参考](https://windfsy.github.io/wzvtc-anything/commands)
- [学工请假](https://windfsy.github.io/wzvtc-anything/systems/xgxt)
- [第二课堂](https://windfsy.github.io/wzvtc-anything/systems/dekt)
- [志愿汇](https://windfsy.github.io/wzvtc-anything/systems/zyh)
- [安全模型](https://windfsy.github.io/wzvtc-anything/security)
- [限制](https://windfsy.github.io/wzvtc-anything/limitations)

## 贡献

参见 [CONTRIBUTING.md](https://github.com/windfsy/wzvtc-anything/blob/main/CONTRIBUTING.md)。提交前请确保不包含真实学号、姓名、手机号、token、cookie 或完整校园链接。

## 安全报告

请使用 GitHub Security Advisories 私密报告，不要在公开 issue 中披露凭证或个人信息。参见 [SECURITY.md](https://github.com/windfsy/wzvtc-anything/blob/main/SECURITY.md)。

## License

[MIT](https://github.com/windfsy/wzvtc-anything/blob/main/LICENSE)

本项目为第三方非官方工具，与温州职业技术大学任何部门无隶属关系。使用者应遵守学校及第三方平台的管理规定；因使用产生的后果由使用者自行承担。
