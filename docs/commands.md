# 命令参考

> 由 `pnpm docs:commands` 从 CLI schema 生成；CLI 0.3.0-m2 / schema 1.0。请勿手工编辑。

所有命令默认输出 JSON 信封。写操作默认 dry-run，真实执行必须带 `--execute --confirm <token>`。

## `wzvtc version`

输出版本、schema 版本与 Node 运行环境

- 名称：`version`
- 风险：`meta`

## `wzvtc doctor`

检查 Vault、钥匙串、登录态与运行环境；不主动提示主密码

- 名称：`doctor`
- 风险：`meta`

```json
{
  "type": "object",
  "properties": {
    "probe": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc doctor
wzvtc doctor --probe
```

## `wzvtc schema`

输出机器可读的命令目录

- 名称：`schema`
- 风险：`meta`

```json
{
  "type": "object",
  "properties": {
    "command": {
      "type": "string"
    },
    "compact": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc schema --compact
wzvtc schema xgxt.leave.apply
```

## `wzvtc skills install`

把内置 Skill 安装到 Agent 技能目录

- 名称：`skills.install`
- 风险：`meta`

```json
{
  "type": "object",
  "properties": {
    "target": {
      "type": "string",
      "enum": [
        "claude-code",
        "codex",
        "cursor",
        "agents"
      ]
    },
    "dest": {
      "type": "string"
    }
  },
  "required": [
    "target"
  ]
}
```

示例：

```bash
wzvtc skills install --target claude-code
wzvtc skills install --target agents --dest ./skills
```

## `wzvtc skills path`

输出内置 Agent Skill 目录

- 名称：`skills.path`
- 风险：`meta`

示例：

```bash
wzvtc skills path
```

## `wzvtc skills list`

列出内置 Skill 文件

- 名称：`skills.list`
- 风险：`meta`

示例：

```bash
wzvtc skills list
```

## `wzvtc skills read`

读取 SKILL.md 或 references 文件

- 名称：`skills.read`
- 风险：`meta`

```json
{
  "type": "object",
  "properties": {
    "file": {
      "type": "string",
      "default": "SKILL.md"
    }
  }
}
```

示例：

```bash
wzvtc skills read
wzvtc skills read references/xgxt.md
```

## `wzvtc vault init`

初始化 Vault、设置主密码，可选信任当前设备

- 名称：`vault.init`
- 风险：`vault`

```json
{
  "type": "object",
  "properties": {
    "trust_device": {
      "type": "boolean"
    },
    "password_stdin": {
      "type": "boolean"
    }
  }
}
```

示例：

```bash
wzvtc vault init
wzvtc vault init --trust-device
```

## `wzvtc vault status`

查看 Vault 是否初始化、钥匙串可用性、设备信任和条目数量；不返回明文

- 名称：`vault.status`
- 风险：`vault`

示例：

```bash
wzvtc vault status
```

## `wzvtc vault list`

列出 Vault 条目的元数据，不返回凭证

- 名称：`vault.list`
- 风险：`vault`

示例：

```bash
wzvtc vault list
```

## `wzvtc vault devices`

列出已信任设备的 ID 与创建时间

- 名称：`vault.devices`
- 风险：`vault`

示例：

```bash
wzvtc vault devices
```

## `wzvtc vault trust-device`

为当前设备生成并保存钥匙串设备密钥

- 名称：`vault.trust-device`
- 风险：`vault`

示例：

```bash
wzvtc vault trust-device
```

## `wzvtc vault revoke-device`

撤销指定设备的钥匙串信任

- 名称：`vault.revoke-device`
- 风险：`vault`

```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string"
    },
    "yes": {
      "type": "boolean",
      "default": false
    }
  },
  "required": [
    "device_id"
  ]
}
```

示例：

```bash
wzvtc vault revoke-device <deviceId> --yes
```

## `wzvtc vault reset`

删除 Vault、会话、pending、operations、日志、缓存与设备信任

- 名称：`vault.reset`
- 风险：`vault`

```json
{
  "type": "object",
  "properties": {
    "purge": {
      "type": "boolean"
    },
    "confirm": {
      "type": "string",
      "enum": [
        "RESET"
      ]
    }
  },
  "required": [
    "purge"
  ]
}
```

示例：

```bash
wzvtc vault reset --purge --confirm RESET
```

## `wzvtc auth import xgxt`

从微信学工链接导入一次性 code，换取 token 并写入 Vault

- 名称：`auth.import.xgxt`
- 风险：`auth`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "channel": {
      "type": "string",
      "enum": [
        "wechat-mobile"
      ],
      "default": "wechat-mobile"
    }
  }
}
```

示例：

```bash
wzvtc auth import xgxt --channel wechat-mobile
```

## `wzvtc auth login xgxt`

学工移动端账号密码登录（备用；优先 link-code）；只存 token，不保存密码

- 名称：`auth.login.xgxt`
- 风险：`auth`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "password_stdin": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth login xgxt --password-stdin
```

## `wzvtc auth status xgxt`

查看学工会话是否存在；可选 probe

- 名称：`auth.status.xgxt`
- 风险：`auth`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "probe": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth status xgxt
wzvtc auth status xgxt --probe
```

## `wzvtc xgxt leave list`

查询学工请假列表

- 名称：`xgxt.leave.list`
- 风险：`read`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "page": {
      "type": "integer",
      "default": 1
    },
    "limit": {
      "type": "integer",
      "default": 20,
      "maximum": 100
    }
  }
}
```

示例：

```bash
wzvtc xgxt leave list
wzvtc xgxt leave list --page 2 --limit 10
```

## `wzvtc xgxt leave get`

查询单条学工请假详情

- 名称：`xgxt.leave.get`
- 风险：`read`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc xgxt leave get --id <id>
```

## `wzvtc xgxt leave form`

读取学工请假表单模板与选项，用于字段发现

- 名称：`xgxt.leave.form`
- 风险：`read`
- 认证：`xgxt` / `wechat-mobile`

示例：

```bash
wzvtc xgxt leave form
```

## `wzvtc xgxt leave apply`

预览或提交学工请假申请；默认 dry-run

- 名称：`xgxt.leave.apply`
- 风险：`write`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "input": {
      "type": "string",
      "description": "JSON 文件路径，或 - 表示 stdin"
    },
    "execute": {
      "type": "boolean",
      "default": false
    },
    "confirm": {
      "type": "string",
      "description": "预览返回的 confirm token"
    }
  },
  "required": [
    "input"
  ]
}
```

示例：

```bash
wzvtc xgxt leave apply --input leave.json
wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
```

## `wzvtc xgxt leave cancel`

预览或撤销学工请假申请；默认 dry-run

- 名称：`xgxt.leave.cancel`
- 风险：`write`
- 认证：`xgxt` / `wechat-mobile`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "execute": {
      "type": "boolean",
      "default": false
    },
    "confirm": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc xgxt leave cancel --id <id>
wzvtc xgxt leave cancel --id <id> --execute --confirm <token>
```

## `wzvtc auth login dekt`

账号密码登录第二课堂；只存 token，不保存密码

- 名称：`auth.login.dekt`
- 风险：`auth`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "password_stdin": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth login dekt --password-stdin
```

## `wzvtc auth status dekt`

查看第二课堂会话；可选 probe

- 名称：`auth.status.dekt`
- 风险：`auth`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "probe": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth status dekt --probe
```

## `wzvtc dekt activity list`

查询第二课堂活动列表（只读）

- 名称：`dekt.activity.list`
- 风险：`read`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "page": {
      "type": "integer",
      "default": 1
    },
    "limit": {
      "type": "integer",
      "default": 20,
      "maximum": 100
    },
    "status": {
      "type": "integer",
      "default": -1
    }
  }
}
```

示例：

```bash
wzvtc dekt activity list
wzvtc dekt activity list --status 3
```

## `wzvtc dekt activity get`

查询第二课堂活动详情（只读）

- 名称：`dekt.activity.get`
- 风险：`read`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc dekt activity get --id <id>
```

## `wzvtc dekt activity enroll`

预览或报名第二课堂活动；默认 dry-run

- 名称：`dekt.activity.enroll`
- 风险：`write`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "role": {
      "type": "string"
    },
    "execute": {
      "type": "boolean",
      "default": false
    },
    "confirm": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc dekt activity enroll --id <id>
wzvtc dekt activity enroll --id <id> --execute --confirm <token>
```

## `wzvtc dekt activity cancel`

预览或取消第二课堂报名；默认 dry-run

- 名称：`dekt.activity.cancel`
- 风险：`write`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "enrollment_id": {
      "type": "string"
    },
    "execute": {
      "type": "boolean",
      "default": false
    },
    "confirm": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc dekt activity cancel --id <id>
wzvtc dekt activity cancel --id <id> --execute --confirm <token>
```

## `wzvtc dekt transcript get`

查询第二课堂成绩单与总学时（只读）

- 名称：`dekt.transcript.get`
- 风险：`read`
- 认证：`dekt`

```json
{
  "type": "object",
  "properties": {
    "page": {
      "type": "integer",
      "default": 1
    }
  }
}
```

示例：

```bash
wzvtc dekt transcript get
```

## `wzvtc auth login zyh`

账号密码登录志愿汇；只存 token，不保存密码

- 名称：`auth.login.zyh`
- 风险：`auth`
- 认证：`zyh`

```json
{
  "type": "object",
  "properties": {
    "password_stdin": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth login zyh --password-stdin
```

## `wzvtc auth status zyh`

查看志愿汇会话；可选 probe

- 名称：`auth.status.zyh`
- 风险：`auth`
- 认证：`zyh`

```json
{
  "type": "object",
  "properties": {
    "probe": {
      "type": "boolean",
      "default": false
    }
  }
}
```

示例：

```bash
wzvtc auth status zyh --probe
```

## `wzvtc zyh hours summary`

查询志愿时长汇总（只读）

- 名称：`zyh.hours.summary`
- 风险：`read`
- 认证：`zyh`

示例：

```bash
wzvtc zyh hours summary
```

## `wzvtc zyh hours list`

查询志愿时长明细（只读）

- 名称：`zyh.hours.list`
- 风险：`read`
- 认证：`zyh`

```json
{
  "type": "object",
  "properties": {
    "year": {
      "type": "integer"
    },
    "page": {
      "type": "integer",
      "default": 1
    },
    "limit": {
      "type": "integer",
      "default": 20,
      "maximum": 100
    }
  }
}
```

示例：

```bash
wzvtc zyh hours list --year 2026
```

## `wzvtc operations list`

列出本地写操作日志与对账状态

- 名称：`operations.list`
- 风险：`meta`

示例：

```bash
wzvtc operations list
```

## `wzvtc operations get`

查看单条写操作日志，用于超时后对账

- 名称：`operations.get`
- 风险：`meta`

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

示例：

```bash
wzvtc operations get <id>
```

