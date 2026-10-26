# Changelog

## 0.3.0-m2

### Added

- 第二课堂报名/取消写入：`dekt activity enroll|cancel`，复用 preview → confirm → execute → verify。
- 通用写管线 `executeConfirmedWrite`，xgxt 同步复用。
- `vault revoke-device`、`vault reset --purge`。
- `skills install --target claude-code|codex|cursor|agents`，支持 `--dest`。
- 文档站（VitePress）、命令参考生成、CI 矩阵、release/docs workflows。
- 学工请假时间/节次校验：`LeaveDay`/`LeaveHour`、`LeaveAllWhat`、晚归/不归、往返时间、联系人。

### Fixed

- 学工 confirm hash 排除服务端生成的 `sysid`，避免预览/提交漂移。
- confirm token 绑定当前账号会话；换号或重新登录后必须重新预览。
- 写操作对 HTML/重定向/5xx/非 JSON 响应标记 `unknown` + `side_effect_possible`，不再误判成功/失败。
- 第二课堂/志愿汇读路径检测登录页与非 JSON 响应，不再静默返回空数据。
- 学工请假列表输出改为摘要字段，不再暴露学号、联系人姓名/电话；新增学号/身份证/座机脱敏规则。
- `schema <command>` 支持按命令过滤；修复文档坏入口。
- 修复 pending/operations ID 路径穿越与 `deepMerge` 原型污染。
- Vault 增加 KDF 参数边界校验；设备密钥解包失败时回退主密码提示。
- 学工已有有效请假时在预览阶段返回 `precondition_failed`。
- 第二课堂报名检查活动状态；取消自动查找 `enrollment_id` 的兜底更完整。

### Known limitations

- 真实钥匙串只在 Windows 验证；macOS/Linux 未实机验证。
- 学工链接实测可重复导入；TTL/失效方式未完全确认。
- 志愿汇只读。
- 未实现附件/销假、第二课堂签到、`vault exec`、`write_policy=human`、Vault 导出/恢复。

## 0.2.0-m1

### Added

- 学工 link-code 读、请假列表/详情/表单、请假预览、提交、撤销、回查。
- 第二课堂只读活动/成绩单；志愿汇只读时长/明细。
- 学工/第二课堂/志愿汇账号密码登录（只存 token）。
- Vault/OS 钥匙串、confirm token、operations 日志、doctor/schema。

## 0.1.0-m0

### Added

- TypeScript CLI 骨架、JSON 信封、错误码、schema、Skill 读取、Vault 初版。
