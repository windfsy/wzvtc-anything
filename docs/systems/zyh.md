# 志愿汇（只读）

志愿汇是第三方全国平台，当前**只读**；v1 不实现报名、签到或任何写入。

## 认证

```bash
wzvtc auth login zyh --password-stdin
wzvtc auth status zyh --probe
```

账号 = 志愿汇账号；密码 = 志愿汇密码。只保存 token，不保存密码。

## 查询

```bash
wzvtc zyh hours summary
wzvtc zyh hours list --year 2026 --limit 10
```

- `summary` 返回信用/荣誉/培训/总时长、积分、排名。
- `list` 返回活动名、签到/签出时间、单次时长。
- 不返回账号/姓名。

## 合规边界

- 不实现写入、不绕过平台限制、不做反风控伪装。
- 遇到 `upstream_blocked` / `rate_limited` 就停止，改用官方渠道。
- 志愿汇写入属于后续范围变更，当前不承诺。
