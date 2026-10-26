# 学工请假

## 认证

```bash
wzvtc auth import xgxt --channel wechat-mobile
wzvtc auth status xgxt --probe
```

学工使用微信移动端 link-code。链接可重复导入，按密码等价物处理；不要分享或截图。

## 读取

```bash
wzvtc xgxt leave list --page 1 --limit 10
wzvtc xgxt leave get --id <id>
wzvtc xgxt leave form
```

- `leave list` 返回摘要字段（不包含学号/联系人电话）。
- `leave get` 返回该记录的详情/表单选项。
- `leave form` 返回新建请假的模板与选项；先用它确认字段名、可选值和必填项。

## 申请

```bash
wzvtc xgxt leave apply --input leave.json
wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
```

- 默认 dry-run，只返回 `preview` + `validation`，不发请求。
- 输入可以是 `{ "Info": { ... } }` 或直接字段对象；CLI 会把它合并到表单模板。
- `LeaveBeginTime`/`LeaveEndTime` 为 0–23 小时；CLI 计算 `LeaveDay`/`LeaveHour`。
- `LeaveAllWhat`（合计节次）必须人工填写；`IsInSchool` 为 `"0"`/`"1"`。
- 只有 `validation.errors` 为空时才返回 `confirm_token`。
- confirm token 绑定输入 hash 与当前账号会话；会话变化或输入变化会导致 `confirmation_expired`。
- 提交成功后返回 `operation_id` 和 `verification`；`unverified` 时让用户核对列表。
- 真实提交会产生真实请假记录；没有用户明确同意不要执行。

## 撤销

```bash
wzvtc xgxt leave cancel --id <id>
wzvtc xgxt leave cancel --id <id> --execute --confirm <token>
```

## 已知边界

- 未实现附件上传、销假、留校申请。
- 不做教务课表冲突检测。
- 回查基于列表摘要的启发式匹配；`unverified` 不是失败，需要人工核对。
- link-code 的 TTL/失效方式尚未完全确认；按密码处理。
