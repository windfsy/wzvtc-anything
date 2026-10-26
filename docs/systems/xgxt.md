# 学工请假

## 认证

学工使用微信移动端 link-code：

```bash
wzvtc auth import xgxt --channel wechat-mobile
wzvtc auth status xgxt --probe
```

把链接粘贴到终端，不要发到聊天。实测同一链接可重复导入，请按密码等价物处理。

## 读取

```bash
wzvtc xgxt leave list --page 1 --limit 10
wzvtc xgxt leave get --id <id>
wzvtc xgxt leave form
```

- `leave form` 返回表单模板、字段和选项；先读它，不要猜字段。
- `leave list` 返回 `is_apply`，`"0"` 表示当前可申请。

## 预览与提交

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
wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
```

- `LeaveAllWhat`（合计节次）必须人工填写；时间是 0–23 小时。
- CLI 会计算 `LeaveDay`/`LeaveHour`，校验时间、晚归/不归、往返时间与联系人。
- 只有 `validation.errors` 为空才返回 confirm token。
- 提交后看 `verification`；`unverified` 时运行 `xgxt leave list` 人工核对。
- 真实提交会产生真实请假记录；执行前请确认。

## 撤销

```bash
wzvtc xgxt leave cancel --id <id>
wzvtc xgxt leave cancel --id <id> --execute --confirm <token>
```

## 已知边界

- 未实现附件上传、销假、留校申请。
- 不做教务课表冲突检测。
- link-code 的 TTL/失效方式未完全确认；按密码处理。
