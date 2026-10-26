# 第二课堂

## 认证

账号 = 学号；密码 = 第二课堂密码（独立于统一认证）。

```bash
wzvtc auth login dekt --password-stdin
wzvtc auth status dekt --probe
```

只保存 token，不保存密码。

## 读取

```bash
wzvtc dekt activity list --page 1 --limit 10
wzvtc dekt activity list --status 3
wzvtc dekt activity get --id <id>
wzvtc dekt transcript get
```

- `status=3` 是“我已报名”。
- 成绩单输出不包含姓名/学号。

## 报名

```bash
wzvtc dekt activity enroll --id <id>
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
```

- 默认 dry-run；检查已报名、名额已满、角色存在。
- 角色默认第一个；可用 `--role <id|名称>` 指定。
- 真实报名可能通知组织者；执行前请确认。
- 成功后回查“我已报名”列表。

## 取消

```bash
wzvtc dekt activity cancel --id <id>
wzvtc dekt activity cancel --id <id> --execute --confirm <token>
```

- 省略 `--enrollment-id` 时自动从列表/详情查找报名记录。
- 成功后回查列表与活动详情。

## 已知边界

- 未实现签到/签退。
- 报名审批流、附件、部分活动字段仍以真实响应为准。
