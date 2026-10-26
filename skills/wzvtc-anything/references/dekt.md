# 第二课堂（读 + 报名/取消）

## 认证

账号 = 学号；密码 = 第二课堂密码（独立于统一认证）。

```bash
wzvtc auth login dekt --password-stdin
wzvtc auth status dekt --probe
```

- 只保存 token，不保存密码。
- 不要把密码发到聊天。
- token 失效：`auth_expired`，让用户重新登录。

## 读取

```bash
wzvtc dekt activity list --page 1 --limit 10
wzvtc dekt activity list --status 3
wzvtc dekt activity get --id <id>
wzvtc dekt transcript get
```

- `activity list` 返回 `{id,name,type,time,place,status,signup_status,capacity,enrollment_id?}`。
- `status=-1` 全部；`status=3` 我已报名。
- `activity get` 返回角色列表与 `already_enrolled`；详情可能含 `enrollment_id`。
- `transcript get` 只返回总学时/排名/班级/专业/学院/类型，不返回姓名/学号。

## 报名

```bash
wzvtc dekt activity enroll --id <id>
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
```

- 默认 dry-run；`preview` 包含活动名/时间/地点/角色。
- CLI 会检查：已报名、名额已满、角色存在。
- 角色默认第一个；可用 `--role <value|text>` 指定。
- confirm token 绑定活动 ID + 角色；角色或活动变化需要重新预览。
- 真实报名可能通知组织者；没有用户明确同意不要执行。
- 成功后回查“我已报名”列表；`unverified` 时让用户手动核对。

## 取消

```bash
wzvtc dekt activity cancel --id <id>
wzvtc dekt activity cancel --id <id> --execute --confirm <token>
```

- 默认 dry-run；省略 `--enrollment-id` 时自动从“我已报名”列表/活动详情查找报名记录。
- 如果找不到报名记录，返回 `precondition_failed`；让用户在官方 App 核对。
- 成功后回查“我已报名”列表与活动详情，确认 `already_enrolled=false`。
