# 志愿汇（只读）

## 认证

账号 = 志愿汇账号；密码 = 志愿汇密码（第三方平台，独立于学校）。

```bash
wzvtc auth login zyh --password-stdin
wzvtc auth status zyh --probe
```

- 只保存 token，不保存密码。
- 不要把账号/密码发到聊天。
- token 失效：`auth_expired`，让用户重新登录。

## 读取

```bash
wzvtc zyh hours summary
wzvtc zyh hours list --year 2026 --limit 10
```

- `hours summary` 返回信用/荣誉/培训/总时长、积分、排名；不返回姓名/账号。
- `hours list` 返回活动名、签到/签出时间、单次时长。
- 当前没有报名/签到/写入工具。
- 第三方平台可能阻断；遇到 `upstream_blocked`/`rate_limited` 就停止，不绕过。
