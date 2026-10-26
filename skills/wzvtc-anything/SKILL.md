---
name: wzvtc-anything
description: "Use when the user asks for Wenzhou Vocational and Technical University (WZVTC / 温职大) campus services, including 学工请假、请假记录、第二课堂活动、活动报名、二课成绩单、志愿汇时长、志愿记录、校园系统登录恢复. Supports xgxt read/preview/submit/cancel, dekt read/enroll/cancel/transcript, zyh hours read-only; guides auth, previews, and safe write confirmation; do not use for non-WZVTC services."
metadata:
  version: "0.3.0-m2"
  requires:
    bins: ["wzvtc"]
---

# WZVTC Anything

当前实现：

- 学工：link-code 认证、请假详情/表单、请假预览/提交/撤销；真实提交需用户明确确认。
- 第二课堂：读活动列表/详情/成绩单 + 报名/取消预览/执行（受控写）。
- 志愿汇：只读时长汇总/明细；写入未实现。
- 未实现：CAS/WebForms、附件、销假、MCP。

## 核心规则

1. **先看状态**：会话内首次任务或遇到认证/Vault 错误时，运行 `wzvtc doctor`；不要每轮都跑。
2. **不碰秘密**：绝不向用户索取主密码、账号密码、token、cookie、微信链接。需要认证时，让用户在**自己的终端**运行：
   - 学工：`wzvtc auth import xgxt --channel wechat-mobile`
   - 第二课堂：`wzvtc auth login dekt --password-stdin`
   - 志愿汇：`wzvtc auth login zyh --password-stdin`
   - Vault：`wzvtc vault init` / 重跑命令并输入主密码
   如果用户把链接/密码发到聊天，不要使用、不要复述，提醒其在终端输入并清理聊天记录。
3. **写操作默认 dry-run**：先预览；只有 `validation.errors` 为空才会拿到 `confirm_token`；是否让用户确认由 Agent 按风险判断；真实提交必须带 `--execute --confirm <token>`。
4. **提交后核对**：写操作返回 `verification`；`unverified` 时让用户运行 `wzvtc xgxt leave list` 手动核对。
5. **错误按动作处理**：读取 `error.code` 和 `error.action`；不要循环重试。`side_effect_possible=true` 时先对账。
6. **写入边界**：志愿汇只读；第二课堂报名/取消必须 preview → confirm token → execute，并在成功后回查“我已报名”列表；不要假装成功。
7. **命令自省**：用 `wzvtc schema --compact` 或 `wzvtc schema <command>` 获取参数；不要手抄参数表。
8. **不绕过平台限制**：遇到验证码/风控/阻断就停止，让用户使用官方渠道。

## 学工请假

### 1. 检查状态

```bash
wzvtc doctor
wzvtc auth status xgxt --probe
```

- 没有 Vault：让用户运行 `wzvtc vault init`。
- 没有会话：让用户在自己的终端运行 `wzvtc auth import xgxt --channel wechat-mobile`。
- 学工链接实测可重复导入，按密码等价物处理；不要发到聊天/截图。
- 会话过期：重新导入链接，不要重试旧 token。

### 2. 查看字段与现有记录

```bash
wzvtc xgxt leave list --page 1 --limit 10
wzvtc xgxt leave get --id <id>
wzvtc xgxt leave form
```

`leave form` 返回表单模板与选项。不要凭空编造字段。

### 3. 预览申请

准备 JSON（字段以 `leave form` 为准）：

```json
{
  "Info": {
    "LeaveTypeList": ["02048007"],
    "LeaveTypeText": "事假",
    "LeaveTypeTwo": "02062003",
    "LeaveTypeTwoText": "课假",
    "LeaveBeginDate": "2026-11-02",
    "LeaveBeginTime": "8",
    "LeaveEndDate": "2026-11-02",
    "LeaveEndTime": "12",
    "LeaveAllWhat": "4",
    "IsInSchool": "1",
    "OutWhere": "1",
    "LeaveThing": "家中有事",
    "OutAddress": "温州市区"
  }
}
```

```bash
wzvtc xgxt leave apply --input leave.json
```

- `LeaveAllWhat`（合计节次）必须人工填写；`LeaveBeginTime`/`LeaveEndTime` 为 0–23 小时。
- 输出包含 `preview.summary`、`preview.info`、`validation`、`ready_to_submit`、`confirm_token`、`expires_at`。
- 如果 `validation.errors` 非空，不会返回 confirm token；先修正字段并重新预览。
- `validation.warnings` 不阻塞预览，但执行时部分会变成错误（如联系人缺失）。
- 向用户展示摘要和风险；不要自动提交。

### 4. 确认提交

```bash
wzvtc xgxt leave apply --input leave.json --execute --confirm <confirm_token>
```

- `confirm_token` 绑定输入 hash 与当前账号会话；输入变化或重新登录会导致 `confirmation_expired`。
- 提交后返回 `operation_id` 与 `verification`。
- 如果 `verification.unverified`，让用户运行 `wzvtc xgxt leave list` 核对。
- 真实提交会产生真实请假记录；没有用户明确同意时不要执行。

### 5. 撤销

```bash
wzvtc xgxt leave cancel --id <id>
wzvtc xgxt leave cancel --id <id> --execute --confirm <confirm_token>
```

## 第二课堂（读 + 报名/取消）

### 读取

```bash
wzvtc auth status dekt --probe
wzvtc dekt activity list --page 1 --limit 10
wzvtc dekt activity list --status 3
wzvtc dekt activity get --id <id>
wzvtc dekt transcript get
```

- 输出已去掉成绩单中的姓名/学号。
- `status=3` 是“我已报名”。

### 报名

```bash
wzvtc dekt activity enroll --id <id> [--role <角色>]
```

- 默认 dry-run，返回 `preview` + `confirm_token`。
- 检查活动是否可报名、名额是否已满、是否已报名；角色默认第一个。
- 向用户展示活动名/时间/地点/角色，确认后再执行：

```bash
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
```

- 成功后回查“我已报名”列表；`unverified` 时让用户核对。
- 报名/取消会真实影响活动，可能通知组织者；没有用户明确同意不要执行。

### 取消

```bash
wzvtc dekt activity cancel --id <id>
wzvtc dekt activity cancel --id <id> --execute --confirm <token>
```

- 省略 `--enrollment-id` 时自动从“我已报名”列表/活动详情查找报名记录。
- 成功后回查列表与活动详情，确认 `already_enrolled=false`。

## 志愿汇（只读）

```bash
wzvtc auth status zyh --probe
wzvtc zyh hours summary
wzvtc zyh hours list --year 2026 --limit 10
```

- 只读；没有写入工具。
- 只汇总时长/记录，不输出账号、姓名。
- 平台阻断时停止，不绕过。

## 错误恢复

| code | 动作 |
|---|---|
| `vault_not_initialized` | 让用户运行 `wzvtc vault init` |
| `vault_locked` / `master_password_required` | 让用户在自己的终端重跑命令并输入主密码 |
| `keychain_unavailable` | 解释无头/沙箱限制，让用户在 TTY 输入主密码 |
| `auth_required` | 让用户执行对应的 `auth import` / `auth login` |
| `auth_expired` | 让用户重新登录；不要重试旧 token |
| `link_code_expired` | 让用户重新复制微信链接 |
| `confirmation_required` | 先预览；不要直接提交 |
| `confirmation_expired` | 重新预览，不要复用 token |
| `invalid_input` + `validation.errors` | 按错误字段修正后重新预览 |
| `precondition_failed` | 先查最新状态；不要盲目重试 |
| `network_error` + `side_effect_possible=true` | 先 `operations get` 或读上游状态对账 |
| `upstream_blocked` | 停止自动化，提示官方渠道 |

## References

- 认证与 Vault：`references/auth-vault.md`
- 学工请假：`references/xgxt.md`
- 第二课堂：`references/dekt.md`
- 志愿汇：`references/zyh.md`
