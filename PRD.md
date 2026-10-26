# WZVTC-Anything CLI 产品需求文档（PRD）

> 把温职大分散的校园系统，变成 Agent 可直接调用的 JSON 能力层。

| 项目 | 内容 |
|---|---|
| 产品名称 | WZVTC-Anything CLI |
| 工作包名 | `wzvtc-anything`（发布前校验 npm 可用性） |
| CLI 命令 | `wzvtc` |
| 数据目录 | `~/.wzvtc-anything`（Windows：`%USERPROFILE%\.wzvtc-anything`） |
| 技术栈 | TypeScript + Node.js（ESM） |
| 许可证 | MIT |
| 文档版本 | v1.1（第三方评审修订） |
| 状态 | 已确认，进入公开发布准备（2026-10-26） |
| 日期 | 2026-10-26 |
| 目标发布 | v1.0 公开发布级（npm + 文档站 + 安全政策 + 支持流程） |

---

## 0. 摘要

WZVTC-Anything CLI 是一个**面向 AI Agent 的校园能力层**：把温州职业技术大学分散在教务、学工、第二课堂、志愿汇、图书馆等系统中的操作，收敛为稳定的 JSON 命令；再通过一个 Agent Skill 把这些命令组织成可理解、可确认、可恢复的工作流。

v1 不追求“覆盖所有系统”，而是用三种真实场景把底座压出来：

- **学工请假**：微信 link-code 导入 → 请假列表 / 详情 / 申请 / 撤销（读 + 写）。
- **第二课堂**：厂商账密登录 → 活动列表 / 详情 / 报名 / 取消 / 成绩单（读 + 写）。
- **志愿汇**：第三方账密登录 → 志愿时长总览 / 明细（只读）。

v1 的工程目标是：

1. **JSON-first**：只接 JSON API，不解析 ASP.NET WebForms，不做 CAS 表单抓取。
2. **本地优先**：无后端；凭证、会话、Vault 全部留在本机；不做多租户、不做凭证托管。
3. **Agent 安全**：CLI 只输出 JSON；写操作必须“预览 → 一次性 confirm token → 显式执行”；默认由 Agent 按 Skill 策略判断是否向用户确认，CLI 通过 token、审计和回查降低误操作。Agent 在 Skill 正常路径下不接触明文密码；同用户恶意进程不在 CLI 防护范围。
4. **可扩展**：新增系统主要是声明 connector；新增鉴权方式主要是实现 provider/ceremony，不改 CLI 和 Skill 主体。
5. **公开发布级**：npm 安装、内置 Skill、多 Agent 安装、文档站、安全政策、版本迁移与 issue 支持。

---

## 1. 背景与问题

### 1.1 校园系统的碎片化

温职大（WZVTC）的学生日常依赖多个系统：

- 统一身份认证（CAS）：`id.wzvtc.cn`，学生侧支持账号密码与手机验证码。
- 学工系统：PC 端 CAS / WebForms；移动端与公众号版本有独立的移动 SPA。
- 第二课堂：厂商平台，账号密码与学校 CAS 相互独立；PC 与移动端形态不同。
- 志愿汇：全国性第三方平台，独立账号体系，与学校无关。
- 教务、图书馆、一表通、体育等：另一批系统，鉴权与协议形态各异。

结果是：

- 学生要记多个入口、多套账号、多种交互；
- 请假、报名等高频事务需要填写复杂表单；
- 每个系统的登录态、过期策略、错误提示都不一致；
- 没有面向个人的官方 API，页面结构变化频繁。

### 1.2 为什么是 Agent + SKILL + CLI

AI Agent 已经成为一种稳定的交互形态。相比让用户逐页点击，Agent 可以：

- 理解“帮我请明天上午的事假”这类自然语言；
- 先查询课表/请假记录，再决定是否能请；
- 生成表单预览，由 Agent 按风险决定是否向用户确认；
- 提交后核验结果，形成闭环。

选择 **SKILL + CLI**，而不是纯 MCP：

- **CLI 是可调试、可组合、可测试的确定性执行层**；Agent 不需要理解页面。
- **Skill 是渐进披露的工作流知识层**；只加载与当前任务相关的系统说明。
- **MCP 不是不好，而是不适合作为 v1 的唯一入口**：工具数量一多，上下文成本显著上升；旧实现曾因 25 个 MCP 工具一次性暴露而移除 MCP。未来如有需要，可以在同一核心之上加 MCP adapter，而不是把 MCP 作为底座。

### 1.3 与既有 `wzvtc-hub` 的关系

作者已有的 `wzvtc-hub`（Python 0.4.0）验证了“CLI + Skill + 多系统 connector”的方向，并沉淀了：

- 输出信封、错误码、退出码；
- 写操作 dry-run；
- Skill 随包分发；
- keyring、会话、CAS、WebVPN、fixtures 脱敏等经验。

但本项目**仅借鉴，不继承**：

- 不复用其命令契约、代码、文档结构；
- 不继承其登录管理设计；
- 不把其端点与字段假设当作最终事实；
- 新项目重新设计认证底座、Vault、CLI 契约和 Skill。

### 1.4 为什么现在可以做

- 学工移动端 SPA 暴露了 JSON API 与 link-code 换 token 的流程，可以绕开老旧的 WebForms。
- 第二课堂与志愿汇都有 JSON 接口，适合 Agent 调用。
- Agent Skills 已成为跨客户端的事实标准（Claude Code、Codex、Cursor、Gemini CLI 等）。
- TypeScript + npm 能提供全平台、低门槛的分发；独立二进制可以后置。

---

## 2. 目标与非目标

### 2.1 产品目标

| ID | 目标 | 说明 |
|---|---|---|
| G1 | Agent 可完成真实校园事务 | 请假、活动报名、志愿时长查询，不只读信息 |
| G2 | 认证与 Vault 成为可复用底座 | 新增系统不再重写登录逻辑 |
| G3 | 写操作安全可控 | 预览、确认、执行、核验四步闭环 |
| G4 | 本地优先、隐私优先 | 无后端、无遥测、凭证不出本机 |
| G5 | 公开发布级质量 | 可安装、可文档化、可支持、可迁移 |
| G6 | 为未来系统留好扩展点 | CAS、二维码、cookie 导入、教务/图书馆均可后加 |

### 2.2 非目标（v1 明确不做）

| ID | 非目标 | 原因 |
|---|---|---|
| N1 | CAS / ASP.NET WebForms 接入 | 页面脆弱、不适合 Agent；移动 JSON 已覆盖 v1 |
| N2 | 教务、图书馆、一表通 | 后置到 v1.1+，避免范围爆炸 |
| N3 | 志愿汇写操作 | 第三方平台合规与风控风险高 |
| N4 | 移动 App / 桌面 GUI | v1 只做 CLI + Skill |
| N5 | 后端、账号托管、多租户 | 与本地优先冲突；安全/合规成本高 |
| N6 | 凭证共享、代办事、批量操作 | 仅限本人账号、个人使用 |
| N7 | Vault 跨设备同步 / 导出 | 钥匙串优先；换设备重新授权 |
| N8 | MCP Server | v1 不提供；未来可作为 adapter |

### 2.3 成功标准

v1 以“**可安装、可闭环、可审计、可公开发布**”为准：

- npm 安装成功；内置 Skill 可一键安装到 Claude Code / Codex / Cursor / 通用 `.agents/skills`。
- Vault 初始化、信任设备、锁定/解锁、人工 reveal 全部可用。
- 学工请假、第二课堂报名、志愿汇查询三条真实链路端到端跑通。
- 所有写操作必须经过预览 + confirm token；无 token 不能提交。token 防误操作，不证明人类已同意；是否向用户确认由 Agent 按 Skill 策略判断。
- `schema` 能描述全部命令；Skill 不需要手抄参数表。
- 错误码、恢复动作、日志与 fixtures 通过安全与隐私检查。
- Windows / macOS / Linux 至少各一次安装与核心命令 smoke test。
- 文档站、README、SECURITY、issue 模板、版本迁移策略、CI齐全。

---

## 3. 用户与场景

### 3.1 目标用户

**首要用户：使用 AI Agent 的温职大学生**

- 已在用 Claude Code、Codex、Cursor、Gemini CLI 等工具；
- 愿意在终端完成一次登录/授权；
- 希望用自然语言完成请假、报名、查询；

**次要用户：愿意扩展 connector 的开发者**

- 能读懂 TypeScript；
- 希望新增一个校园系统时，只写 API 适配与 ToolSpec；
- 不希望重复实现认证、Vault、错误码、Skill。

**未来用户：校级 AI 基础设施的维护者**

- 需要审计、权限、稳定接口；
- v1 不承诺校级部署，但架构不阻挡未来官方合作。

### 3.2 核心 JTBD（Jobs To Be Done）

| ID | 当…… | 我想…… | 这样…… |
|---|---|---|---|
| J1 | 我明天有事不能上课 | 让 Agent 帮我填并提交请假申请 | 不用研究复杂表单和审批规则 |
| J2 | 我想参加第二课堂活动 | 让 Agent 查活动、判断能否报名、帮我报名 | 不错过学分和名额 |
| J3 | 我想知道志愿时长 | 让 Agent 汇总总时长和明细 | 不用登录第三方平台翻页 |
| J4 | 我的登录过期了 | 让 Agent 告诉我怎么恢复，而不是反复重试 | 快速回到任务 |

### 3.3 关键用户旅程

#### 旅程 A：首次安装与初始化

1. 用户已有一个支持 Agent Skills 的 Agent。
2. 一步到位，用户向Agent发送“帮我安装 wzvtc-anything ：npm i -g wzvtc-anything”，然后Agent指导完成后续操作。
3. 或选择人工安装 CLI：`npm i -g wzvtc-anything` 或 `npx wzvtc-anything@latest`，接下来每步操作都有提示。
4. 执行 `wzvtc vault init`：设置主密码；选择是否信任本设备。
5. 安装 Skill：`wzvtc skills install`交互式选择 或 `wzvtc skills install --target claude-code`（或 codex/cursor/agents）。
6. 运行 `wzvtc doctor --json`，确认 vault、keychain、auth、skill 状态。
7. 在 Agent 里说“帮我查一下学工请假记录”，Agent 首次引导完成 link-code 导入。

#### 旅程 B：学工请假

1. Agent 运行 `wzvtc auth status --json`，发现学工未登录。
2. Agent 告诉用户：“请在你自己的终端运行 `wzvtc auth import xgxt --channel wechat`，把微信里学工链接粘贴进去；不要发到聊天里。”
3. 用户完成导入；Agent 运行 `wzvtc xgxt leave list --json` 确认登录态。
4. Agent 收集请假类型、时间、事由、地点、联系人等字段。
5. Agent 调用 `wzvtc xgxt leave apply --input leave.json`（默认 dry-run），拿到预览与 confirm token。
6. Agent 向用户展示摘要：“事假，2026-10-27 08:00–12:00，事由……，确认提交吗？”
7. Agent 判断需要确认并取得用户同意后，调用 `--execute --confirm <token>`。
8. CLI 提交并回查记录；Agent 汇报“已提交，状态：待班主任审批”。

#### 旅程 C：第二课堂报名

1. Agent 运行 `wzvtc dekt activity list --status open --json`。
2. 用户选定活动；Agent 拉详情，检查角色、名额、是否已报名；v1 不做教务课表冲突检测。
3. Agent 预览报名；按风险判断是否请用户确认，再执行。
4. CLI 回查报名状态；Agent 汇报结果。

#### 旅程 D：志愿汇查询

1. Agent 运行 `wzvtc zyh hours summary --json`。
2. 如需明细，运行 `wzvtc zyh hours list --year 2026 --json`。
3. Agent 汇总总时长、星级、最近记录；不提供任何写命令。

#### 旅程 E：会话过期 / 链接过期

1. 业务命令返回 `auth_expired` 或 `link_code_expired`。
2. Agent 不重试，不猜测密码；按 `error.action` 引导用户重新登录/重新复制链接。
3. 用户在终端完成操作后，Agent 重新执行原任务。

---

## 4. 关键决策记录

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| D1 | 与旧项目关系 | 仅借鉴，不继承 | 重新设计底座，避免继承登录/契约债务 |
| D2 | 部署 | 本地优先，无后端 | 隐私、安全、个人使用；降低合规成本 |
| D3 | 协议 | JSON-first | 移动/微信/第三方均有 JSON；避开 WebForms |
| D4 | v1 系统 | 学工、第二课堂、志愿汇 | 三种鉴权形态，覆盖读/写/第三方只读 |
| D5 | v1 鉴权 | 学工 link-code；第二课堂账密；志愿汇账密 | 均可 JSON |
| D6 | 微信其他方案 | v1 不做 | link-code 失败即标记 unsupported，不引入 bridge |
| D7 | CLI 定位 | Agent-first，JSON-only | 不做人类表格；Skill 承担工作流 |
| D8 | 命令结构 | 系统域原语 + `schema` | 可预测、可组合、易生成文档 |
| D9 | 写确认 | dry-run + 一次性 confirm token；默认 Agent 决策，可选 human strict mode（P2） | 防止预览/提交不一致与误操作；人类门禁不作为默认路径 |
| D10 | Vault 根密钥 | 主密码 + OS 钥匙串信任 | 用户要求；不落 device key 文件 |
| D11 | 密码保存 | 首次登录 TTY 询问，默认保存 | 兼顾便利与知情同意 |
| D12 | 分发 | npm + 内置 Skill + 多 Agent 安装 | 全平台、低门槛；独立二进制后置 |
| D13 | Skill 结构 | 单 Skill + 分系统 references | v1 系统少；安装简单、版本一致 |
| D14 | 发布级别 | 公开发布级 | 用户明确要求；需要文档/支持/安全政策 |
| D15 | 许可证 | MIT + 非官方个人使用声明 | 与案例生态一致；边界清晰 |

---

## 5. 产品范围与能力矩阵

### 5.1 v1 能力矩阵

| 系统 | 渠道 | 鉴权 | 数据协议 | v1 读 | v1 写 |
|---|---|---|---|---|---|
| 学工 `xgxt` | 微信/移动端 | link-code 导入 | JSON + Bearer | 请假列表、详情、状态 | 申请、撤销 |
| 第二课堂 `dekt` | 厂商移动/H5 | 厂商账密（RSA） | JSON + Bearer | 活动列表、详情、成绩单 | 报名、取消 |
| 志愿汇 `zyh` | 第三方 H5 | 第三方账密 | JSON + token headers | 时长总览、明细 | 无（只读） |

**v1 不做**：PC CAS、WebForms、教务、图书馆、一表通、志愿汇写操作、其他微信鉴权方式。

### 5.2 功能列表

#### 学工 `xgxt`

| 功能 | 命令 | 风险 | 说明 |
|---|---|---|---|
| 请假列表 | `wzvtc xgxt leave list` | 读 | 分页、状态筛选；默认最近一页 |
| 请假详情 | `wzvtc xgxt leave get` | 读 | 返回结构化字段与审批链 |
| 请假预览 | `wzvtc xgxt leave apply` | 写（默认 dry-run） | 校验字段、生成摘要与 confirm token |
| 请假提交 | `wzvtc xgxt leave apply --execute --confirm` | 写 | 提交并回查 |
| 请假撤销 | `wzvtc xgxt leave cancel` | 写（默认 dry-run） | 仅待审核/可撤销记录；预览后执行 |

v1 表单字段至少覆盖：请假类型、起止时间、事由、外出地点、是否住校、紧急联系人、联系电话、同行人数/交通方式（如接口要求）。附件上传放 v1.1。

#### 第二课堂 `dekt`

| 功能 | 命令 | 风险 | 说明 |
|---|---|---|---|
| 活动列表 | `wzvtc dekt activity list` | 读 | 关键词、类别、状态、分页 |
| 活动详情 | `wzvtc dekt activity get` | 读 | 时间、地点、角色、名额、报名状态 |
| 报名预览 | `wzvtc dekt activity enroll` | 写（默认 dry-run） | 校验资格/角色/重复报名 |
| 报名提交 | `wzvtc dekt activity enroll --execute --confirm` | 写 | 提交并回查 |
| 取消报名 | `wzvtc dekt activity cancel` | 写（默认 dry-run） | 预览后执行 |
| 二课成绩单 | `wzvtc dekt transcript get` | 读 | 总学时、类别、排名；可选明细 |

签到/签退（二维码）放 v1.1；v1 不处理微信 OAuth 回调。

#### 志愿汇 `zyh`

| 功能 | 命令 | 风险 | 说明 |
|---|---|---|---|
| 时长总览 | `wzvtc zyh hours summary` | 读 | 信用/荣誉/总时长、星级、排名 |
| 时长明细 | `wzvtc zyh hours list` | 读 | 按年份/分页；只读 |

v1 不提供志愿汇写命令；`schema` 中不应出现写工具。

### 5.3 优先级

- **P0**：上述全部 v1 能力；Vault、认证、CLI 契约、Skill、分发、验收。
- **P1**：学工附件、第二课堂签到、CAS provider、教务/图书馆、独立二进制、Vault 导出/恢复、profile UI。
- **P2**：移动 companion、MCP adapter、校级部署、更多第三方系统。

---

## 6. 认证与 Vault 设计

### 6.1 核心概念

| 概念 | 含义 |
|---|---|
| Identity | 外部身份：学号、厂商账号、第三方账号、未来的 CAS/微信身份 |
| Account | 身份与系统/渠道的绑定，例如“学工-移动端” |
| Credential | 密码、token、refresh token、一次性 code |
| AuthContext | provider + method + channel + account 的组合 |
| Session | 某个 Account 的可用登录态（token/cookie/headers） |
| Challenge | 等待用户完成的一次认证交互（链接、密码、验证码、二维码） |
| Ceremony | 认证交互方式：link-code、password、未来的 qr/cookie |

### 6.2 认证矩阵

| Provider | Channel | Method | 凭证来源 | 持久化 |
|---|---|---|---|---|
| 学工 | wechat-mobile | link-code import | 用户从微信复制链接，CLI 提取 code | access/refresh token；code 立即丢弃 |
| 第二课堂 | vendor-mobile | password | 用户 TTY 输入；RSA 加密提交 | token；密码按首次询问结果保存 |
| 志愿汇 | third-party-h5 | password | 用户 TTY 输入；正常 H5 客户端请求 | token；密码按首次询问结果保存 |

**扩展点**：provider/ceremony 是接口；未来 CAS、二维码、cookie 导入、OAuth 只需新增实现，不改 CLI/Skill 主体。

### 6.3 学工 link-code 流程

```text
微信 → 公众号 → 学工 → 复制链接（query 中带 openid；实测可重复导入，按密码等价物处理）
        │
        ▼
用户在自己的终端执行：
  wzvtc auth import xgxt --channel wechat
        │
        ▼
CLI 从 stdin 隐藏读取链接
  - 校验 host 是否在 allowlist（xgxt.wzvtc.cn / xgxt-443.webvpn.wzvtc.cn）
  - 只提取 code 参数；丢弃其余 query
  - 不打印、不写日志、不入库
        │
        ▼
POST /PhoneApi/api/Account/Login?code=<code>
  grant_type=password&username=&password=
        │
        ▼
响应 access_token / refresh_token
  - 加密写入 Vault
  - 立即丢弃 code 与完整 URL
        │
        ▼
auth status → authenticated
```

规则：

- code 视为密码等价物；只能从 stdin 读，不能通过 argv、环境变量、聊天或日志传递。
- code 可能一次性或短时效；失败返回 `link_code_expired`，要求重新复制，不重试旧 code。
- link-code 只验证学工；其他系统若验证失败，直接标记该渠道 unsupported，不引入其他微信方案。
- 不保存完整链接；不保存 `openid` 原值；只保存换来的 token。

**M0 gate G0：code 语义必须先确认**

- URL 参数名是 `openid`，但移动 SPA 将其作为 code 换取 token；两者不是一回事。
- 若为一次性/短时授权码：按当前流程；导入后立即交换、丢弃。
- 若为长期 openid/可重放标识：按密码等价物处理；禁止转发到聊天/日志；提示用户清除微信消息/剪贴板；评估是否仍支持该渠道。
- 测试：过期、重放、错误 host/path、缺少参数、开放重定向。
- 未确认前不得把 link-code 宣称为“短期安全凭证”；不得用无害接口替代写语义验证。

> 2026-10-26 实测：同一链接在数分钟后仍能重复导入。至少在确认 TTL/失效方式前，按“可重放/密码等价物”处理；不得在日志、文档或聊天中保留完整链接。CLI 的 `auth import` 已输出该警告。

### 6.4 账密流程

- 第二课堂：TTY 隐藏输入账号密码；按厂商前端要求做 RSA 加密；提交 JSON 登录接口；保存 Bearer token。
- 志愿汇：TTY 隐藏输入；按第三方 H5 客户端正常请求；读取响应头中的访问令牌；只读。
- 密码保存：写操作类 provider（dekt）首次成功登录时 TTY 询问，默认保存；只读 provider（zyh）默认不保存密码，只存 token。用户可拒绝（`--no-save`）或随时 `vault delete`。
- 绝不支持把密码放在 `--password` 参数中；高级人工场景可用 `--password-stdin`，但 Skill 不得使用。

### 6.5 会话生命周期

```text
unauthenticated → authenticating → authenticated
                       │               │
                       │               ├─ token 临近过期 → refresh → authenticated
                       │               ├─ 401 → refresh 一次 → 失败 → expired
                       │               └─ 上游互踢/会话冲突 → expired
                       ▼
                    failed / expired
```

规则：

- 读请求可自动重试一次（仅限幂等、网络错误、限频后的安全重试）。
- 写请求不自动重试；失败后由 Agent 解释并让用户决定。
- 401 只 refresh 一次；失败返回 `auth_expired`，不循环。
- 单会话互踢：标记 `session_conflict`，要求用户重新登录；不重复登录刷屏。
- 并发 refresh 加进程内锁 + 本地文件锁，避免 token 刷新风暴。

### 6.6 Vault 设计

#### 目标与威胁模型

Vault 保护的是：

- 账号密码（用户选择保存时）；
- access token / refresh token；
- 未来的其他校园凭证。

主要威胁：

- 设备丢失/被他人拿到；
- Agent 被 prompt injection，试图读取或外传凭证；
- 本机恶意软件；
- 备份/日志/仓库误泄露；
- 上游系统被攻破（Vault 无法解决，但可限制影响面）。

不解决：

- 已有当前用户权限的恶意进程（除非使用硬件隔离）；
- 用户主动把主密码交给 Agent/聊天；
- 上游系统的服务端泄露。

#### 密钥层级

```text
主密码
  │ Argon2id
  ▼
KEK（Key Encryption Key）
  │ 包裹
  ▼
DEK（随机 256-bit，加密 Vault 条目）
  │
  ├─ 包裹副本 1：KEK（换设备/主密码解锁）
  └─ 包裹副本 2：设备密钥（OS 钥匙串；信任设备免输主密码）

Vault 条目：AES-256-GCM(DEK, nonce, plaintext, AAD=itemId/version)
Device key：仅存 OS 钥匙串，不落文件
```

#### 密码学规格（v1 必须实现）

- KDF：Argon2id，默认 m=64 MiB、t=3、p=1；salt 16 字节随机；参数写入 header 并做上下界校验；禁止降级。
- DEK：32 字节随机；条目加密用 AES-256-GCM；每次加密重新生成 12 字节随机 nonce，绝不复用；AAD 绑定 vault 版本、itemId、itemType。
- KEK：Argon2id 派生 32 字节；用 AES-256-GCM 包裹 DEK；header 参与 AAD/完整性校验。
- 设备包裹：设备密钥随机 32 字节，存 OS 钥匙串；用 AES-256-GCM 包裹 DEK，AAD 绑定 deviceId。
- 版本：header 有显式 version；未知版本直接拒绝，不做静默降级；升级需迁移工具。
- 测试向量：Argon2id RFC 9106、AES-GCM NIST 向量；round-trip、篡改、截断、nonce 重用检测测试。
- 钥匙串同步：macOS 使用 `kSecAttrSynchronizable=false`；Windows Credential Manager 可能随企业漫游；Linux 使用 libsecret collection；文档说明设备绑定并非硬件级。
- 文件：POSIX `0600/0700`、Windows 当前用户 ACL；原子写入；保留一版加密备份；`vault reset --purge` 清除备份。
- 内存：使用 Buffer；尽量缩短明文生命周期；不做无法保证的“零化”承诺；绝不写日志。

#### 文件布局

```text
~/.wzvtc-anything/
├── config.json          # 非敏感配置（profile、语言、输出偏好）
├── vault.json           # 加密 Vault（头部 + 加密条目）
├── pending/             # 待确认写操作（短 TTL，0600）
├── operations/          # 写操作日志与对账状态（0600）
├── logs/
│   └── audit.jsonl      # 脱敏审计日志，默认保留 30 天
├── cache/               # 非敏感缓存（可清空）
└── profiles/            # 非敏感 profile 元数据
```

- `vault.json` 不含明文；不做明文导出。
- `pending/` 只放 hash、最小摘要、过期时间；摘要中的姓名/手机号/事由等敏感字段脱敏或省略；不放密码/token。
- 文件权限：POSIX `0600`/`0700`；Windows 使用当前用户 ACL。
- 原子写入：临时文件 + rename；保留上一版加密备份，避免写坏。

#### 设备信任（Trust this device）

- 首次 `vault init` 设置主密码，生成 DEK，并用 KEK 包裹。
- 选择“信任此设备”时：
  - 生成随机 32 字节设备密钥；
  - 存入 OS 钥匙串：service `wzvtc-anything`，account `device:<deviceId>`；
  - 用设备密钥包裹 DEK，记录在 `vault.json` 头部；
  - 之后同一设备自动解锁，无需输入主密码。
- `vault devices`：列出设备 ID/创建时间/最后使用时间（不含密钥）；`vault revoke-device <deviceId>` 删除对应钥匙串条目和包裹副本。
- 新设备/未信任设备：必须输入主密码解锁；可再选择信任。
- 钥匙串不可用（无头 Linux、沙箱）：
  - 不静默降级、不写明文 key 文件；
  - 业务命令返回 `master_password_required`（`keychain_unavailable` 作为诊断上下文）；
  - 每条需要 Vault 的业务命令都必须在 TTY 下输入主密码；v1 不跨进程缓存解锁态；
  - Agent 场景由人类在自己的终端重跑命令并输入主密码；Agent 不得索取主密码。
- 主密码轮换：`vault rotate-master` 重新包裹 DEK；默认撤销所有设备包裹并要求重新信任，`--keep-devices` 才保留。
- 设备丢失/全部钥匙串丢失：
  - 只有把 `vault.json` 安全复制到新设备时，主密码才能解锁；v1 不做导出/同步，因此设备丢失且无备份 = 只能 `vault reset` 重登；
  - 主密码也忘记：v1 无恢复；只能 `vault reset` 删除 Vault 并重新登录；
  - 信任设备仍可用时，允许在该设备上轮换主密码（设备密钥即信任根）。
- Vault 不做导出/同步；未来如需，另做加密备份格式。

#### 密码与 token 存储策略

- token/refresh token：成功登录后默认写入 Vault。
- 密码：写操作类 provider（dekt）首次成功登录时 TTY 询问，默认保存；只读 provider（zyh）默认不保存密码，只存 token；`--no-save` 可拒绝；`vault delete` 可删除。
- link-code 的一次性 code：永不保存；只保存换来的 token。
- 主密码永不进入 argv、环境变量、Skill、日志或聊天；仅 TTY 隐藏输入。

#### Vault 命令（人类与 Agent 的边界）

| 命令 | 谁执行 | 说明 |
|---|---|---|
| `wzvtc vault init` | 人类 | 设置主密码、创建 Vault、生成 DEK、可选信任设备 |
| `wzvtc vault unlock` | 人类 | 验证主密码并检查 Vault 完整性；不跨进程保持解锁 |
| `wzvtc vault exec -- <command>` | 人类 | 无钥匙串时的受控入口：输入主密码并在同一进程执行一条命令；不跨进程缓存 |
| `wzvtc vault lock` | 人类 | 撤销当前设备的钥匙串信任，使后续命令必须输入主密码；不删除 Vault |
| `wzvtc vault status` | Agent 可调用 | 只返回 initialized、keychain 可用性、当前设备是否信任、信任设备数量；不声称跨进程 unlocked |
| `wzvtc vault list` | Agent 可调用 | 只返回 provider/account/credential 类型，不返回明文 |
| `wzvtc vault devices` | Agent 可调用 | 只返回 deviceId/创建时间/最后使用时间；不返回密钥 |
| `wzvtc vault reveal <id>` | 仅人类 | 必须主密码 + TTY；写入 TTY/安全提示，不写 stdout；如用剪贴板 30 秒后清除；写审计日志 |
| `wzvtc vault trust-device` | 人类 | 生成设备密钥并写入钥匙串 |
| `wzvtc vault revoke-device <deviceId>` | 人类 | 撤销指定设备信任；删除对应钥匙串条目和包裹副本 |
| `wzvtc vault delete <id>` | 人类 | 删除单条凭证；需确认；写审计日志 |
| `wzvtc vault rotate-master` | 人类 | 轮换主密码，重新包裹 DEK；默认撤销所有设备包裹，`--keep-devices` 才保留 |
| `wzvtc vault reset --purge` | 人类 | 删除 Vault、会话、pending、operations、logs、cache、旧备份、钥匙串设备条目；不可逆；需输入确认字样 |
| `wzvtc vault audit` | 人类 | 查看脱敏审计事件 |

> v1 不引入 unlock daemon。无钥匙串时，业务命令返回 `master_password_required`；人类在终端用 `wzvtc vault exec -- <原命令>` 输入主密码并执行。`vault unlock` 只做验证，不跨进程缓存解锁态。Agent 场景返回 `master_password_required`，由人类在自己的终端执行。

**Skill 禁止**：调用 `vault reveal`；索取主密码；读取 Vault 文件；把凭证写入聊天。Agent 只能使用业务命令和 `vault status/list`。

### 6.7 安全不变量

1. 任何业务命令不得把 token/密码/cookie 输出到 stdout/stderr/日志。
2. 错误信息中的手机号、学号、Cookie、Authorization 必须脱敏。
3. 不允许明文 key 文件；设备密钥只进 OS 钥匙串。
4. 不允许 `--password` 参数；密码只从 TTY 或受控 stdin 进入。
5. 不允许自动识别/绕过验证码；遇到验证码暂停，由用户完成。
6. 不允许 UA 伪装、反检测、绕过限频；使用正常客户端行为，遇到阻断就失败。
7. 写操作必须经过确认协议；不允许隐式提交。
8. Vault reveal 仅人类；在 Skill 正常路径下 Agent 不接触明文。同用户恶意进程、被注入且具备 shell 与钥匙串访问权限的 Agent 不在 CLI 防护范围内；需要硬隔离时依赖 OS 沙箱/权限或可选 strict mode。
9. 仓库、fixtures、日志、issue 模板不得含真实学号、姓名、手机号、token、cookie。
10. CI 跑 secret 扫描；发布前做依赖审计与 SBOM。

---

## 7. CLI 产品契约

### 7.1 设计原则

- **Agent-first**：默认输出 JSON；不做人类表格、颜色、进度条。
- **可预测**：命令路径稳定；参数用 Zod schema 校验；错误码稳定。
- **可组合**：CLI 提供系统域原语，Skill 负责跨系统编排。
- **可自省**：`schema` 输出全部命令、参数、风险、认证要求。
- **可恢复**：每个错误都有 `action`；Agent 不需要猜。
- **省 token**：紧凑输出、字段裁剪、分页、长文本截断。

### 7.2 命令结构

```text
wzvtc
├── version
├── doctor
├── schema
├── skills
│   ├── list / path / read
│   ├── install --target <claude-code|codex|cursor|agents>
│   └── validate
├── vault
│   ├── init / unlock / exec / lock / status / list / devices / reveal
│   ├── trust-device / revoke-device / delete
│   ├── rotate-master / reset --purge / audit
├── auth
│   ├── status
│   ├── login <provider>
│   ├── import <provider> --channel <channel>
│   ├── logout <provider> [--purge]
│   └── probe <provider>
├── operations
│   ├── list
│   ├── get <id>
│   └── reconcile <id>
├── config
│   ├── get / set / list
├── xgxt
│   └── leave list / get / apply / cancel
├── dekt
│   ├── activity list / get / enroll / cancel
│   └── transcript get
└── zyh
    └── hours summary / list
```

全局参数：

- `--profile <name>`：默认 `default`；v1 数据模型支持多 profile，UI 只做单 profile。
- `--timeout <seconds>`：默认 20s。
- `--json`：兼容/显式标志；默认已是 JSON，传入等同于 no-op。
- `--pretty`：仅调试用，输出缩进 JSON；业务契约不变。
- `--trace`：把脱敏诊断写到 stderr 或日志；不输出秘密。
- `--fields <a,b>`：裁剪 `data` 顶层字段。
- `--limit/--cursor`：列表分页；具体由工具 schema 定义。
- `write_policy`：`agent`（默认）| `human`（P2 严格模式，需人类 TTY 确认）；可通过 `config set` 设置。

补充契约：

- `doctor` 只要成功报告状态就退出 0；健康状态放在 `data.healthy`，退出 3 仅用于 CLI 无法读取自身配置。
- 人类命令（`vault init/unlock/exec/reveal`、`auth login/import`）可向 stderr 输出提示，stdout 仍输出 JSON 结果；秘密绝不写 stdout。
- `wechat` 是 `wechat-mobile` 的别名；规范 channel 为 `wechat-mobile`。
- `--pretty` 仅调试用，不属于 Agent 契约；stdout 默认单行 JSON。

### 7.3 输出信封

成功：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "schema_version": "1.0",
    "cli_version": "1.0.0",
    "request_id": "uuid",
    "next_cursor": null
  }
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "auth_required",
    "message": "尚未登录学工系统",
    "action": {
      "type": "run_command",
      "command": "wzvtc auth import xgxt --channel wechat-mobile",
      "message": "请用户在自己的终端运行",
      "requires_user": true
    },
    "retryable": false,
    "side_effect_possible": false,
    "details": {}
  },
  "meta": {
    "schema_version": "1.0",
    "cli_version": "1.0.0",
    "request_id": "uuid"
  }
}
```

规则：

- 只输出单行紧凑 JSON；`--pretty` 才缩进。
- 结果只写 stdout；诊断、警告、进度写 stderr；stderr 不得含秘密。
- `null` 字段省略；空数组保留 `[]`。
- 不在 `data` 中输出原始 HTML、Cookie、Authorization、密码。
- `error.action` 是结构化对象：`{type: run_command|ask_user|reauth|wait|none, command?, message, requires_user}`；`side_effect_possible` 表示请求可能已产生副作用。
- 时间使用 ISO 8601 + `+08:00`；日期使用 `YYYY-MM-DD`。
- ID 一律字符串，避免大整数精度问题。
- 大列表默认 20 条；最大 100；长文本截断并标记 `truncated: true`；详情命令获取全文。
- `meta.next_cursor` 为不透明字符串；`has_more` 可选。

### 7.4 退出码

| 码 | 含义 | 典型场景 |
|---|---|---|
| 0 | 成功 | 命令完成 |
| 1 | 业务失败 | 前置条件不满足、上游变化、核验失败 |
| 2 | 用法/校验错误 | 未知命令、缺参数、schema 校验失败 |
| 3 | 需要用户动作 | 未登录、Vault 锁定、钥匙串不可用、code 过期 |
| 4 | 需要确认 | 写操作预览完成但未带 confirm token |
| 5 | 可重试 | 限频、网络错误 |

Agent 应以 `error.code` 为主分支，退出码只用于 shell/CI。

### 7.5 错误码与动作

| code | 退出码 | 含义 | Agent 应做什么 |
|---|---|---|---|
| `usage_error` | 2 | 命令/参数用法错误 | 用 `schema` 纠正参数，不重试原命令 |
| `invalid_input` | 2 | 字段校验失败 | 按 `details.field` 修正后重新预览 |
| `auth_required` | 3 | 未登录 | 让用户在终端 `auth login/import` |
| `auth_expired` | 3 | 登录态过期/刷新失败 | 让用户重新登录，不重试旧 token |
| `vault_locked` | 3 | Vault 未解锁 | 让用户在自己的终端重跑命令并输入主密码；不要索取主密码 |
| `master_password_required` | 3 | 需要主密码 | 仅人类可执行；由用户在 TTY 输入，Agent 不得索取/转述 |
| `keychain_unavailable` | 3 | 钥匙串不可用 | 让用户在自己的终端输入主密码或换到有钥匙串的环境 |
| `link_code_expired` | 3 | 一次性 code 过期/无效 | 让用户重新复制微信链接 |
| `confirmation_required` | 4 | 写操作需要 confirm token | 展示预览；由 Agent 按风险决定是否向用户确认，再执行 |
| `confirmation_expired` | 4 | confirm token 过期/已用 | 重新预览，不要复用 |
| `precondition_failed` | 1 | 当前状态不允许 | 先查最新状态，向用户解释 |
| `rate_limited` | 5 | 上游限频 | 等 `retry_after_seconds` 再试；不要并发重试 |
| `upstream_changed` | 1 | 页面/接口结构疑似变化 | 提示升级/反馈 issue，不盲目重试 |
| `network_error` | 5 | 超时/不可达 | 检查网络/WebVPN；读可重试一次；写操作置 `side_effect_possible` 并先对账 |
| `unsupported_channel` | 1 | 渠道不支持 | 换渠道或标记系统不支持 |
| `session_conflict` | 3 | 被其他登录互踢 | 让用户重新登录；不要循环 |
| `verification_failed` | 1 | 写后回查不一致 | 展示状态，让用户决定是否人工核对 |
| `vault_not_initialized` | 3 | Vault 未初始化 | 让用户运行 `vault init` |
| `vault_corrupt` | 1 | Vault 损坏/版本未知 | 不要覆盖；保留文件，提示恢复或 `vault reset --purge` |
| `not_found` | 1 | 记录不存在 | 刷新列表并确认 ID，不重试旧 ID |
| `unsupported_feature` | 1 | 功能明确不支持 | 说明边界，不重试、不伪造成功 |
| `upstream_blocked` | 1 | 第三方平台阻断 | 停止自动化；提示使用官方渠道；不绕过 |
| `internal_error` | 1 | 未分类 | 带 `request_id` 反馈 |

### 7.6 写操作确认协议

```text
1. 预览（默认）：
   wzvtc xgxt leave apply --input leave.json
   → data.preview：人类可读摘要（Agent 转述给用户）
   → data.confirm_token：一次性 token
   → data.expires_at：10 分钟后

2. 执行：
   wzvtc xgxt leave apply --input leave.json --execute --confirm <token>
   → 校验 token 与 input hash、account、tool 一致
   → 提交
   → 回查
   → data.result + data.verification
```

规则：

- confirm token 绑定：tool 名、input hash、account、profile、session、预览时间。
- TTL 10 分钟；单次使用；使用后删除 `pending/<id>.json`。
- 输入变化 → hash 不匹配 → `confirmation_expired`（重新预览）。
- 上游状态变化 → `precondition_failed`；不自动重试。
- 提交后必须回查；`verification.status = verified | unverified`。
- confirm token 是**防误操作协议**，不是“证明人类已同意”的密码学证明。默认 `write_policy=agent`：是否向用户确认由 Agent 按 Skill 策略判断；高风险操作（请假提交/撤销）Skill 要求先展示摘要并取得用户确认。CLI 不做人类在场校验；如用户需要硬门禁，可启用 P2 的 `write_policy=human` 严格模式（独立 TTY 确认）。
- 写操作日志只记录 tool、account、结果码、request_id；不记录表单正文中的敏感个人信息。
- `--input <file>` 也支持 `--input -` 从 stdin 读取；文件模式在 git 工作区/云同步目录下给出警告；优先使用 0700 临时文件并在执行后删除；不要把含 PII 的表单留在 cwd。

#### 7.6.1 写策略与信任模型

- `write_policy=agent`（默认）：Agent 是操作者，按 Skill 策略决定是否向用户确认；CLI 只做 schema、预览、token、审计、回查，不证明人类在场。
- `write_policy=human`（P2）：高风险操作需人类在独立 TTY 执行 `wzvtc confirm <preview-id>`（主密码/OS 生物识别）后才可执行；v1 不默认启用。
- 残余风险：被注入的 Agent 若具备 shell 权限，可以自行预览并执行写操作；这是默认模式的已知风险，通过最小权限、可信 Agent、审计与预览摘要降低。
- “Agent 不接触明文”只承诺 Skill 正常路径；同用户恶意进程可读取钥匙串/Vault，需要 OS 沙箱或硬件隔离；CLI 不承诺防御这类进程。

#### 7.6.2 写操作日志与超时对账

- 预览创建 `pending/<id>.json`；执行创建 `operations/<id>.json`，状态为 `pending | submitted | verified | failed | unknown`。
- 若提交后响应丢失/超时：状态置 `unknown`；返回 `network_error` + `side_effect_possible: true`；不自动重试。
- Agent 必须先运行 `wzvtc operations get <id>` 或重新读取上游状态（请假列表/报名状态）对账，再决定是否重试或重新预览。
- `wzvtc operations list/get/reconcile` 为本地只读/对账命令；`reconcile` 只读上游，不写。
- 写操作永不自动重试；只有确认上游未受理后，才允许重新预览/提交。

### 7.7 `schema` 契约

`schema` 是 CLI 与 Skill 的唯一事实来源：

```json
{
  "schema_version": "1.0",
  "cli_version": "1.0.0",
  "commands": [
    {
      "name": "xgxt.leave.apply",
      "path": ["xgxt", "leave", "apply"],
      "description": "预览或提交学工请假申请；默认 dry-run",
      "risk": "write",
      "auth": { "provider": "xgxt", "channel": "wechat-mobile" },
      "input_schema": {},
      "output_schema": {},
      "examples": []
    }
  ]
}
```

- 由 registry 自动生成；禁止手写命令参考。
- `schema --system xgxt` / `--command xgxt.leave.apply` 可过滤。
- `schema --compact` 只返回 name/path/risk/auth/一行 description，不含完整 JSON Schema；Skill 默认用 compact 或按命令查询。
- Skill references 只写“何时用、坑、示例”，不复制完整参数表。
- 文档站的命令参考也从 schema 生成。

### 7.8 省 token 设计

- 默认字段裁剪：列表只返回摘要字段；详情才返回全量。
- 长文本默认截断 2000 字符，标记 `truncated`。
- 列表默认 20 条，最大 100；`next_cursor` 翻页。
- 不返回原始 HTML、调试堆栈、完整 Cookie。
- `--fields` 只裁剪顶层 `data` 字段；嵌套裁剪由工具 schema 定义。
- 错误只返回必要 `details`，不返回上游整页。

---

## 8. Skill 设计

### 8.1 包结构

```text
skills/
└── wzvtc-anything/
    ├── SKILL.md
    └── references/
        ├── auth-vault.md
        ├── xgxt.md
        ├── dekt.md
        └── zyh.md
```

- 随 CLI 包分发，版本与 CLI 一致。
- `wzvtc skills list/path/read` 可读取；`wzvtc skills install --target` 安装到 Agent 目录。
- 兼容 `npx skills add`（skills.sh 生态）。
- 未来系统变多时，再拆成 base + 领域 skill；v1 保持单 Skill。

### 8.2 Frontmatter

```yaml
---
name: wzvtc-anything
description: "Use when the user asks for Wenzhou Vocational and Technical University (WZVTC / 温职大) campus services, including 帮我请假、查请假记录、学工系统、第二课堂活动、活动报名、二课成绩单、志愿汇时长、志愿记录、校园系统登录恢复. Handles auth guidance, previews, and safe write confirmation; do not use for non-WZVTC services."
metadata:
  version: "1.0.0"
  requires:
    bins: ["wzvtc"]
---
```

要求：

- `name` = 目录名，小写、连字符。
- `description` ≤1024 字符，包含“做什么 + 何时用 + 不做什么”。
- 正文 <500 行 / <5000 tokens；细节进 references。

### 8.3 核心规则（写入 SKILL.md）

1. **先体检**：会话内首次任务、或出现认证/Vault 错误时跑 `wzvtc doctor --json`（或 `vault status` + `auth status`）；不要每轮都跑，避免增加轮次。
2. **不碰密码**：绝不向用户索取主密码、账号密码、token、cookie；绝不把用户发来的秘密转述/写入聊天。如果用户主动发来秘密，不要使用、不要复述，提醒其在终端输入并建议清除聊天记录。需要登录时，让用户在自己的终端执行 `wzvtc auth login` / `auth import`。
3. **不读明文**：绝不调用 `vault reveal`；绝不读取 Vault 文件；只使用业务命令和 `vault status/list`。
4. **写操作四步**：预览 → 由 Agent 按风险决定是否向用户展示摘要并取得确认 → `--execute --confirm`；读取 `side_effect_possible`，为 true 时先对账再决定是否重试；绝不盲目重试。
5. **错误按动作处理**：按 `error.code` 执行 `error.action`；不猜、不循环重试、不伪造成功。
6. **命令自省**：用 `wzvtc schema --compact` 或 `wzvtc schema <command>` 获取参数；不在 Skill 中硬编码参数表。
7. **链接导入**：让用户在自己的终端运行 `wzvtc auth import xgxt --channel wechat`，把链接粘贴到终端；不要发到聊天里。
8. **输出简洁**：向用户汇报摘要与关键状态，不倾倒 JSON；保留 `request_id` 便于排障。
9. **不做未授权操作**：不共享账号、不代他人操作、不批量、不绕过验证码/风控。
10. **版本检查**：`doctor` 发现 skill/CLI 版本不一致时，提示升级后再继续。

### 8.4 工作流

#### 请假申请

1. `wzvtc auth status --json`；若未登录，引导 link-code 导入。
2. `wzvtc xgxt leave list --json`；检查是否已有有效请假。
3. 收集字段：类型、起止、事由、地点、联系人、是否住校等；只问缺失项。
4. `wzvtc xgxt leave apply --input <file>` 预览。
5. 向用户展示摘要与风险（审批链、时间范围是否与已有请假冲突；v1 不查教务课表）；问“确认提交吗？”
6. Agent 判断需要确认并取得用户同意后 `--execute --confirm <token>`。
7. 汇报结果与 `verification`；如失败，按错误码解释。

#### 第二课堂报名

1. 登录态检查。
2. `wzvtc dekt activity list --status open --json`。
3. `wzvtc dekt activity get --id <id> --json`；检查名额、角色、时间。
4. 预览报名；Agent 按风险判断是否请用户确认，再执行；回查报名状态。
5. 汇报“已报名/待审批/失败原因”。

#### 志愿汇查询

1. 登录态检查。
2. `wzvtc zyh hours summary --json`。
3. 如需明细，`wzvtc zyh hours list --year <year> --json`。
4. 汇总总时长、星级、最近记录；不提供写操作。

#### 恢复登录

1. 读 `error.code`。
2. `auth_required`/`auth_expired`：让用户终端登录；不要问密码。
3. `vault_locked`/`master_password_required`：让用户在自己的终端用 `wzvtc vault exec -- <原命令>` 输入主密码；如果设备已信任，先检查钥匙串是否可用。
4. `link_code_expired`：让用户重新复制微信链接并重新导入。
5. `keychain_unavailable`：解释无头/沙箱限制，让用户在自己的终端用 `vault exec` 输入主密码，或换到有钥匙串的环境。
6. 恢复后重跑原任务。

### 8.5 References 内容

路由规则（先读 reference，再执行）：

| 触发 | 先读 |
|---|---|
| 认证、Vault、错误恢复 | `auth-vault.md` |
| 学工、请假、审批状态 | `xgxt.md` |
| 第二课堂、活动、报名、成绩单 | `dekt.md` |
| 志愿汇、志愿时长、记录 | `zyh.md` |

| 文件 | 内容 |
|---|---|
| `auth-vault.md` | 认证状态机、Vault 命令、错误动作、人类/Agent 边界、常见恢复 |
| `xgxt.md` | 请假字段、状态、审批链、前置条件、错误语义、示例 |
| `dekt.md` | 活动字段、角色、报名/取消规则、成绩单、错误语义 |
| `zyh.md` | 只读边界、时长字段、分页、第三方风险说明 |

References 只写 Agent 不看就会做错的内容；不复制完整参数表。

### 8.6 安装目标

| Target | 目标目录/方式 |
|---|---|
| `claude-code` | `~/.claude/skills/wzvtc-anything`（或项目 `.claude/skills`） |
| `codex` | `~/.codex/skills/wzvtc-anything` |
| `cursor` | Cursor 支持的 skills 目录 |
| `agents` | `~/.agents/skills/wzvtc-anything`（跨 runtime 通用） |

- `wzvtc skills install --target <target>` 复制/链接技能目录。
- `wzvtc skills validate` 检查 frontmatter、references、命令存在性。
- CI 运行 `skills-ref validate` 或等价校验。

---

## 9. 系统集成规格

> 说明：以下端点是研究阶段从公开页面/旧项目文档得到的线索，M0 必须用脱敏账号重新验证。不得把旧项目代码当作最终实现。不得在仓库中出现真实 token、学号、姓名、手机号。

### 9.1 Connector 契约

```ts
interface Connector {
  id: string;
  displayName: string;
  authBindings: AuthBinding[];
  tools: ToolSpec[];
  probe(ctx: AuthContext): Promise<ProbeResult>;
}

interface AuthBinding {
  provider: string;
  channel: "wechat-mobile" | "vendor-mobile" | "third-party-h5";
  method: "link-code" | "password";
  credentialRef: string;
}

interface ToolSpec<I, O> {
  name: string;                 // 全局唯一，如 xgxt.leave.apply
  path: string[];               // ["xgxt","leave","apply"]
  description: string;
  risk: "read" | "write";
  input: ZodType<I>;
  output: ZodType<O>;
  preview?: (input: I, ctx: Ctx) => Promise<Preview>;
  execute?: (input: I, ctx: Ctx) => Promise<O>;
  verify?: (input: I, result: O, ctx: Ctx) => Promise<Verification>;
  examples: string[];
}
```

要求：

- 能力只声明一次；CLI、schema、docs、Skill 引用从 registry 派生。
- connector 之间零依赖；共享逻辑进 core。
- API/解析集中在 connector；不得在 CLI 层写业务逻辑。
- 读/写工具都必须有稳定错误码；写工具必须有 preview/execute/verify。

### 9.2 学工 `xgxt`

**渠道**：微信/移动端 SPA。

**认证**：link-code。

**研究线索（M0 重验）**：

- 登录交换：`POST /PhoneApi/api/Account/Login?code=<code>`；form `grant_type=password&username=&password=`。
- 请假列表：`GET /PhoneApi/api/Leave/GetAllLeaveManageList?pageIndex=<n>`。
- 请假详情/表单选项：`GET /PhoneApi/api/Leave/AllLeaveManageInfo?Id=<id>`。
- 提交：`POST /PhoneApi/api/Leave/SaveAllLeaveManage`，form `model=<serialized>`。
- 撤销：`GET /PhoneApi/api/Leave/DelAllLeaveManage?Id=<id>`。
- 后续请求：`Authorization: Bearer <access_token>`。
- 领域/渠道：`xgxt.wzvtc.cn`；备用 `xgxt-443.webvpn.wzvtc.cn`（M0 验证是否需要）。

**工具**：

- `xgxt.leave.list`：分页、状态筛选；返回摘要字段。
- `xgxt.leave.get`：详情 + 审批链；字段脱敏。
- `xgxt.leave.apply`：写；preview 校验字段与状态；execute 提交；verify 回查。
- `xgxt.leave.cancel`：写；preview 展示目标记录；execute 撤销；verify 回查。

**表单校验（v1 至少）**：

- 结束时间 > 开始时间；请假时段合法。
- 事由必填；类型必填；地点/联系人按上游要求。
- 已存在有效请假时，申请返回 `precondition_failed`。
- 晚归/不归等规则按上游提示映射为 `invalid_input`。

**附件**：v1.1；v1 若上游强制附件，则明确 `unsupported`，不静默失败。

**限频**：保守串行；写操作不并发；遇到 `rate_limited` 等 `retry_after_seconds`。

### 9.3 第二课堂 `dekt`

**渠道**：厂商移动/H5。

**认证**：厂商账号密码（RSA 加密）。

**研究线索（M0 重验）**：

- 登录：厂商 `PhoneApi/api/Account/Login`；密码按前端 RSA 公钥加密；返回 `access_token`。
- 活动列表：`StuAction/GetActivityList`；`pageIndex`、`ActivityName`、`ActivityType`、`Status`。
- 活动详情：`StuAction/GetActivityInfo`；返回角色、名额、报名状态。
- 报名：`StuAction/SaveActivityStudentsApply`。
- 取消：`StuAction/DelActivityStudentsApply`。
- 成绩单：`StuAction/GetMyJudgeXSActionScoreList` / `GetJudgeXSActionScore`。
- 后续请求：`Authorization: Bearer <token>`。

**工具**：

- `dekt.activity.list/get/enroll/cancel`。
- `dekt.transcript.get`。

**规则**：

- 报名前检查：名额、角色、是否已报名、活动时间是否与用户提供的已知安排冲突；v1 不查教务课表。
- 重复报名 → `precondition_failed`，不自动取消/重报。
- 取消报名 → 预览目标活动与报名记录；执行后回查。
- 签到/签退 v1.1；v1 不处理微信 OAuth 回调。

### 9.4 志愿汇 `zyh`

**渠道**：第三方 H5。

**认证**：独立账号密码。

**研究线索（M0 重验）**：

- 登录：`POST https://ogmapi.zyh365.com/api/userCenter/login.do`；账号密码；成功读取响应头访问令牌与用户 ID。
- 时长总览：`volunteerinfo/getvolunteerbyId.do`。
- 时长明细：`activity/hoursList.do`；按年份、分页。
- 后续请求：平台要求的正常 H5 客户端请求头；不添加反检测伪装。

**工具**：

- `zyh.hours.summary`。
- `zyh.hours.list`。

**规则**：

- v1 标记为 `experimental`：配置项 `zyh.enabled` 可关闭；公开发布前必须完成 ToS/合规复核；若平台阻断或条款不允许，直接从 v1 移除，不做绕过。
- 只读；schema 中不出现写工具。
- 第三方平台可能变更/风控；遇到阻断返回 `rate_limited`/`upstream_blocked`，不重试风暴。
- 不在 PRD/代码中固化任何绕过风控的头或 UA；使用平台正常客户端行为；如仍被阻断，标记 unsupported 并提示用户使用官方渠道。

### 9.5 研究假设与 M0 验证清单

| ID | 未知点 | 验证方式 | 失败处理 |
|---|---|---|---|
| S1 | link-code 是授权码还是长期 openid；TTL/重放 | 已观察同一链接数分钟后可重复导入；改用本人账号做受控写测试（提交后立即撤销） | 按可重放/密码等价物处理；仍需确认实际 TTL/失效方式，不得用无害接口替代写验证 |
| S2 | 学工 refresh token 刷新端点与有效期 | 查公开 SPA/抓包；测试刷新 | 若不可刷新，过期即 `auth_expired` |
| S3 | 学工 WebVPN 是否必需 | 直连 vs WebVPN 对比 | 失败则提示 WebVPN 或标记 unsupported |
| S4 | 第二课堂 token 刷新、报名/取消字段 | 公开前端 + 本人账号测试 | 记录到 connector notes；必要时仅读 |
| S5 | 志愿汇限频/合规边界 | 小流量只读测试 | 若阻断，v1 移除志愿汇 |
| S6 | 学工请假字段/附件要求 | 公开 SPA + 本人测试 | v1 不支持附件则明确提示 |
| S7 | 钥匙串在 Windows/macOS/Linux 的可用性 | 三平台 smoke test | 无钥匙串则主密码解锁；不落文件 |
| S8 | npm 包名可用性 | `npm view` / 搜索 | 换名但 CLI 仍为 `wzvtc` |

---

## 10. 架构与技术方案

### 10.1 分层

```text
CLI (commander) 
  → Registry (ToolSpec → commands / schema / docs)
    → Connectors (xgxt / dekt / zyh)
      → Core (http, auth, vault, session, errors, config, log)
Skill (wzvtc-anything + references)
```

依赖严格单向：CLI → Registry → Connectors → Core。Core 不得 import 上层；connector 之间零依赖。

### 10.2 模块

```text
src/
├── cli/                 # 命令入口、全局参数、JSON 输出、退出码
├── registry/            # ToolSpec 注册、schema 生成、命令派生
├── connectors/
│   ├── xgxt/
│   ├── dekt/
│   └── zyh/
├── core/
│   ├── http/            # fetch/undici、超时、限频、重试策略
│   ├── auth/            # AuthBroker、providers、ceremonies、session
│   ├── vault/           # crypto、keychain、vault store、device trust
│   ├── errors/          # typed errors、error codes、redaction
│   ├── config/          # profile、paths、config
│   ├── log/             # audit log、trace、redaction
│   └── schema/          # JSON schema / Zod 转换
├── skills/wzvtc-anything/
└── main.ts
```

### 10.3 技术栈建议

| 层 | 选择 | 理由 |
|---|---|---|
| Runtime | Node.js >=22（测试 22/24） | LTS、fetch/undici、跨平台；后续可评估 24 |
| Language | TypeScript ESM | 类型安全、生态、Agent 工具链 |
| CLI | Commander.js | 成熟、轻量、易生成命令；也可评估 clipanion |
| Validation | Zod | schema 与运行时校验同源 |
| HTTP | undici / native fetch | 标准、可控制超时/代理 |
| Crypto | Node `crypto` + `@noble/hashes`/`hash-wasm`（Argon2id） | 不加 native 依赖；AES-256-GCM 用 Node |
| Keychain | 抽象 `KeychainProvider`；评估 `@napi-rs/keyring` | 预编译跨平台；避免已停维护的 keytar |
| Build | tsup / unbuild | ESM、声明文件、快速 |
| Test | Vitest + MSW | 单测、HTTP fixture、CLI 集成 |
| Lint/Format | Biome | 快速、单一工具 |
| Package | pnpm | 可复现、快 |
| Release | Changesets + GitHub Actions + npm provenance | 公开级发布 |
| Docs | VitePress / Astro Starlight | 静态文档站、GitHub Pages |
| Skill 校验 | `skills-ref` 或自写 validator | 符合 Agent Skills 规范 |

> 不在 v1 引入 Playwright、MCP SDK、数据库、服务端框架。

### 10.4 数据模型（概念）

| 实体 | 关键字段 |
|---|---|
| Profile | name, createdAt |
| Identity | id, kind, provider, subject（学号/账号 ID）, displayName |
| Account | id, profile, system, channel, identityId, remoteUserId |
| Credential | id, accountId, type（password/token/refresh）, secretRef, expiresAt |
| Session | id, accountId, authContextId, status, expiresAt, lastValidatedAt |
| AuthChallenge | id, provider, method, channel, status, expiresAt, payloadRef |
| VaultHeader | version, kdf（Argon2id params）, salt, wrappedDekByKek, deviceWraps[], createdAt |
| VaultItem | id, accountId, type, nonce, ciphertext, aad, createdAt |
| ToolSpec | name, path, description, risk, auth, input/output schema, examples |

- v1 数据模型支持 `profile`；UI 只做 `default`。
- Vault 的 keychain account 包含 profile，避免不同 profile 串凭证。
- Session 不落明文；token 加密在 Vault 中；进程内只持有必要字段。

### 10.5 写操作管线

```text
Schema 校验
  → 读取当前状态（如需）
  → 领域校验
  → preview（摘要 + payload hash）
  → 写 pending/<id>.json（0600，TTL 10min）
  → 返回 confirm_token
  → [Agent 按风险判断是否请用户确认]
  → execute：校验 token/hash/account → 提交
  → verify：回查
  → 删除 pending
  → 输出 result + verification
```

### 10.6 配置与数据目录

```text
~/.wzvtc-anything/
├── config.json
├── vault.json
├── pending/
├── logs/audit.jsonl
├── cache/
└── profiles/
```

- `WZVTC_HOME` 可重定向数据目录（测试/多环境）。
- 配置只放非敏感项：默认 profile、输出偏好、超时、日志级别。
- 日志默认 30 天；用户可清空；不记录密码/token/cookie/完整 PII。
- 不做遥测；不自动上传任何数据。

### 10.7 跨平台

- Windows 10/11、macOS 13+、Ubuntu 22.04+。
- 路径使用 `node:path`；不假设 `/tmp`、`chmod`、POSIX shell。
- 钥匙串后端：Windows Credential Manager/DPAPI、macOS Keychain、Linux Secret Service（libsecret）。
- 无钥匙串：不落文件；走主密码解锁或明确失败。
- 终端：业务命令不依赖 TTY；人类命令（vault init/unlock/reveal/auth login）要求 TTY。
- 编码统一 UTF-8；输出 JSON 不做本地化键名；消息中文。

### 10.8 性能目标

- CLI 冷启动 < 1.5s（不含网络）。
- 单次读命令额外开销 < 300ms（不含上游）。
- 列表默认 20 条；输出默认 < 25k tokens。
- 大文本截断；详情命令按需拉全量。
- 不在启动时加载全部 connectors；按命令懒加载。

### 10.9 版本与兼容

- Semver；`schema_version` 独立于 `cli_version`。
- 破坏性变更：major；至少一个 minor 的弃用警告与迁移说明。
- `doctor` 检查 CLI/Skill/schema 版本一致性。
- `schema` 变更需 changelog；Skill 引用命令必须存在。

---

## 11. 安全、隐私与合规

### 11.1 威胁模型

| 威胁 | 影响 | 缓解 |
|---|---|---|
| 设备丢失 | Vault 文件被拷走 | 主密码 Argon2id；设备密钥在钥匙串；无明文 key 文件 |
| 本机恶意软件 | 读取 Vault/钥匙串 | OS 权限、钥匙串保护、审计；无法完全防御同用户恶意进程 |
| Prompt injection | Agent 读取/外传凭证 | Vault reveal 仅人类；Skill 禁止读取；CLI 不输出秘密；写确认 |
| Token 泄露 | 账号被冒用 | 本地加密、短期 token、refresh、登出清除、审计 |
| 上游变更 | 功能失效 | 错误码 `upstream_changed`、fixtures、版本化 connector |
| 第三方平台 | ToS/风控/封号 | 只读、正常客户端行为、限频、可移除 |
| 日志/仓库泄露 | PII/凭证暴露 | 脱敏、secret 扫描、fixtures 白名单、无真实数据 |
| Agent 误写/被注入 | 错误提交 | 预览 + confirm token + 回查 + 审计；默认 Agent 决策，接受残余风险；可选 human strict mode |

### 11.2 隐私

- 本地优先；无后端、无遥测、无账号托管。
- 最小化采集：只请求完成任务所需字段；不抓取无关个人信息。
- 日志脱敏：学号、姓名、手机号、Cookie、Authorization、code 一律不落明文。
- fixtures：只保留白名单字段；CI 扫描真实学号/手机号/token 模式。
- 数据保留：token 至过期/登出；审计日志默认 30 天；用户可清空。
- 不把用户数据用于训练、分析、共享。

### 11.3 合规边界

- 第三方非官方工具，与温职大任何部门无隶属关系。
- 仅限本人账号；禁止共享/售卖账号、代他人操作、批量操作。
- 遵守学校网络与系统管理规定；遇到学校要求，配合调整/下线。
- 不绕过验证码、不做反风控伪装、不突破访问控制。
- 志愿汇只读；遵守其平台条款；如被阻断，移除支持。
- 校级推广/官方集成前，需取得学校授权。
- 许可证 MIT；免责声明随 README/文档站发布。

### 11.4 免责声明（建议文案）

> 本项目为第三方非官方工具，与温州职业技术大学任何部门无关。仅限本人账号使用，禁止共享、售卖账号或代他人操作。使用者应遵守学校及第三方平台的管理规定。本项目不绕过验证码、不做反风控伪装、不保证接口稳定性；因使用产生的后果由使用者自行承担。校级推广或官方集成前，请先取得学校授权。

### 11.5 发布与支持

- **安全披露**：使用 GitHub Security Advisories 私密报告；README/SECURITY 提供入口；目标 72 小时内确认，最佳努力，不承诺 SLA。
- **Issue 模板**：bug、feature、connector request、security；要求附 `request_id`、版本、脱敏日志，不附真实凭证。
- **支持边界**：单维护者、最佳努力；不做 24/7 支持；破坏性变更走 semver major，并提供迁移说明。
- **数据删除**：`vault reset --purge` 删除 Vault、会话、pending、operations、旧备份、钥匙串设备条目；`logs clear`/`cache clear` 删除日志与缓存；执行后不可恢复。
- **设备丢失**：v1 不做跨设备恢复；如有另一台已信任设备可轮换主密码；否则 reset 并重新登录所有系统。
- **第三方 kill switch**：`zyh.enabled` 可关闭；平台阻断/条款不允许时从 v1 移除并发布公告。
- **发布渠道**：npm provenance、GitHub Release、文档站；不提供非官方镜像下载指引。

---

## 12. 验收标准与测试计划

### 12.1 公开发布门禁

- [ ] npm 包可安装（`npx wzvtc-anything@latest --version`）。
- [ ] `wzvtc skills install --target` 在四个目标可用。
- [ ] `wzvtc vault init/unlock/trust-device/revoke-device` 可用；无明文 key 文件。
- [ ] `wzvtc auth import xgxt` + 请假列表/详情/申请/撤销真实跑通。
- [ ] `wzvtc auth login dekt` + 活动列表/详情/报名/取消真实跑通。
- [ ] `wzvtc auth login zyh` + 时长总览/明细真实跑通。
- [ ] 所有写操作预览 + confirm token；无 token 不能提交。
- [ ] 写后回查；`verification` 字段正确。
- [ ] `schema` 覆盖全部命令；Skill 不手抄参数表。
- [ ] 错误码/动作表覆盖认证、Vault、限频、上游变化、输入错误。
- [ ] 志愿汇 ToS/合规复核通过；否则从 v1 移除并更新文档。
- [ ] 三平台 smoke test：Windows/macOS/Linux；Node 22/24。
- [ ] 无 secrets 进入仓库/日志/fixtures；CI secret 扫描通过。
- [ ] 依赖审计无 high/critical；npm provenance；SBOM。
- [ ] README、文档站、SECURITY、issue 模板、迁移策略齐全。
- [ ] 至少一次真实端到端证据（脱敏截图/日志摘要）。

### 12.2 Given / When / Then

| ID | Given | When | Then |
|---|---|---|---|
| AC-01 | 已安装 CLI，Vault 已初始化 | 运行 `wzvtc doctor --json` | 返回 vault/keychain/auth/skill 状态；退出 0 |
| AC-02 | Vault 未初始化 | 运行任意业务命令 | `vault_not_initialized`/`auth_required` + 可执行 action；不崩溃 |
| AC-03 | 用户有有效学工链接 | `auth import xgxt --channel wechat` 粘贴链接 | 换取 token；`auth status` authenticated；code 未落盘 |
| AC-04 | 链接 code 过期 | 导入 | `link_code_expired`；提示重新复制；不重试旧 code |
| AC-05 | 学工已登录 | `xgxt leave list` | 返回分页摘要；无敏感字段；JSON 信封 |
| AC-06 | 表单合法 | `xgxt leave apply`（默认） | 返回 preview + confirm_token + expires_at；不提交 |
| AC-07 | 已预览 | 不带 token 执行 `--execute` | `confirmation_required`；不提交 |
| AC-08 | 已预览 | 输入变化后带旧 token 执行 | `confirmation_expired`/hash mismatch；不提交 |
| AC-09 | 已预览，Agent 按 Skill 策略取得用户确认 | 带正确 token 执行 | 提交并回查；`verification.status=verified` |
| AC-10 | 已有有效请假 | 再次申请 | `precondition_failed`；不重复提交 |
| AC-11 | 第二课堂已登录 | 报名活动 | 预览/确认/执行/回查；重复报名被拒 |
| AC-12 | 志愿汇已登录 | 查询时长 | 只读结果；`schema` 无写命令 |
| AC-13 | 会话过期 | 任意业务命令 | `auth_expired`；不循环重试；引导重新登录 |
| AC-14 | 钥匙串不可用 | 业务命令 | `master_password_required`/`keychain_unavailable`；提示用 `vault exec` 在终端输入主密码；不落明文 |
| AC-15 | Agent 被诱导读取凭证 | Skill 运行 | 拒绝；不调用 `vault reveal`；不输出秘密 |
| AC-16 | 列表很大 | `hours list` | 默认 20 条；cursor 翻页；长文本截断标记 |
| AC-17 | 日志开启 | 完成读写 | audit 日志无密码/token/cookie/完整 PII |
| AC-18 | 三平台安装 | 运行 smoke test | 版本、doctor、schema、help 正常 |
| AC-19 | 写提交后响应丢失 | 命令超时/断网 | `network_error` + `side_effect_possible=true`；不自动重试；`operations get` 显示 unknown；对账后再决定 |
| AC-20 | link-code 被判定为长期/可重放 | 导入/重放测试 | 按密码等价物处理并告警；不保存完整 URL；评估是否支持该渠道 |
| AC-21 | 志愿汇被平台阻断或合规不允许 | 发布前复核 | 关闭 `zyh.enabled` 或从 v1 移除；不做绕过 |

### 12.3 测试矩阵

| 类型 | 内容 | 工具 |
|---|---|---|
| 单元 | Vault crypto、KDF 参数、token 包裹、confirm token、错误映射 | Vitest |
| 契约 | ToolSpec schema、输出信封、退出码、schema 生成 | Vitest + JSON Schema |
| 集成 | connector HTTP fixtures、分页、错误、限频 | MSW/fixtures |
| CLI | 命令派生、参数校验、JSON 输出、退出码 | execa + Vitest |
| Skill | frontmatter、references、命令存在性、触发描述 | skills-ref / 自写 validator |
| 跨平台 | Windows/macOS/Linux smoke | GitHub Actions matrix |
| 安全 | secret 扫描、依赖审计、日志/ fixtures 检查 | gitleaks/trivy/npm audit |
| E2E | 三条真实链路（人工、脱敏证据） | 手工 + 录屏/日志摘要 |

### 12.4 Agent Golden Tasks

1. “帮我查一下我有没有还没销假的请假记录。”
2. “帮我填一张明天上午的事假申请，先给我预览，不要提交。”
3. “确认提交刚才的请假申请。”
4. “第二课堂有哪些可报名的活动？帮我报名第一个。”
5. “我这个月志愿时长多少？列最近五条记录。”
6. “我的登录过期了，帮我恢复。”

指标：

- 6 个任务中，5 个可完全由 Agent 完成（需要用户登录/确认的除外）。
- 写操作 100% 经过预览 + confirm token；高风险操作按 Skill 策略向用户确认（软约束，非技术门禁）。
- 无秘密进入模型上下文/日志。
- 每个任务平均 ≤8 轮；输出 ≤20k tokens。
- 错误场景给出正确 `action`，不循环重试。

### 12.5 发布流程

1. Changesets 生成版本与 changelog。
2. CI：lint、typecheck、unit、integration、skill validate、secret scan、跨平台 smoke。
3. 安全审查：依赖、日志、fixtures、权限。
4. `npm publish --provenance`（GitHub Actions OIDC）。
5. 文档站更新；GitHub Release；迁移说明。
6. 发布后 7 天观察 issue；必要时 patch。

---

## 13. 里程碑

> 单人心态排期，质量优先；M0–M4 约 10–14 周，以下为阶段，不是硬承诺。

### M0：可行性 spike（2–3 周）

- 先做 G0：link-code 是授权码还是长期 openid、TTL、重放、WebVPN 依赖。
- 学工：link-code + 请假列表/详情 + 受控写测试（提交后立即撤销并清理痕迹）。
- 第二课堂：登录 + 报名/取消受控测试；志愿汇只读。
- 三平台钥匙串可用性；confirm token 本地流程；npm 包名。
- 输出：spike 报告、脱敏 fixtures、最终端点/字段表、是否砍功能的结论。

**退出条件**：G0 有结论；学工/第二课堂写测试成功并清理；S1–S3、S7 有结论；S4–S6/S8 可滚入 M1/M2。若 link-code 语义不可接受或学工写测试失败，先重新评估 v1 范围，不进入 M2。

### M1：核心底座（2–3 周）

- TypeScript 项目、CLI/registry/schema、JSON 信封、错误码、退出码。
- Vault（Argon2id/AES-GCM/钥匙串/设备信任）、auth broker、session、confirm token、审计日志。
- `doctor`、`version`、`config`。

**退出条件**：AC-01/02/14/17 通过；crypto 测试向量通过。

### M2：Connectors（2–3 周）

- xgxt：leave list/get/apply/cancel；preview/execute/verify。
- dekt：activity list/get/enroll/cancel；transcript get。
- zyh：hours summary/list。
- fixtures、错误映射、限频、日志脱敏。

**退出条件**：AC-05–AC-12 通过；真实 E2E 证据。

### M3：Skill 与文档（1–2 周）

- 单 Skill + references；四个安装目标。
- 文档站：quickstart、命令参考（schema 生成）、认证/Vault、FAQ、安全。
- Agent golden tasks 调优。

**退出条件**：AC-15/16 通过；新用户按文档 15 分钟内完成首次请假预览。

### M4：公开发布（2 周）

- CI 矩阵、依赖审计、secret 扫描、SBOM、npm provenance。
- issue 模板、SECURITY、迁移策略、支持说明。
- v1.0.0 发布。

**退出条件**：公开发布门禁全部通过。

### 范围切割顺序（如果排期紧张）

1. 先砍志愿汇（experimental/合规未决）。
2. 再砍第二课堂写操作，只保留查询。
3. 再砍 Codex/Cursor 专属安装，只保留 Claude Code + 通用 `.agents`。
4. 再砍文档站扩展页，保留 quickstart + 命令参考。
5. 最低公开版：学工 link-code + 请假读写 + 三平台钥匙串 + Claude Code/通用 agents。

### v1.1 候选

- 学工附件、第二课堂签到、CAS provider、教务/图书馆、独立二进制、Vault 导出/恢复、profile UI、更多 Agent。
- 是否做 MCP adapter，视用户需求。

---

## 14. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| link-code 可重放/长期 openid | 高 | 高 | 实测同一链接可重复导入；按密码等价物处理；禁止日志/聊天保留；导入后立即交换；失败不重试 |
| 上游 JSON 变更 | 高 | 高 | connector 隔离、fixtures、`upstream_changed`、快速 patch |
| 志愿汇风控/ToS | 中 | 中 | 只读、正常客户端、限频；`zyh.enabled` 可关闭；必要时移除 |
| 钥匙串在 Linux/沙箱不可用 | 中 | 中 | 明确错误 + `vault exec` 主密码；文档说明 |
| 原生 keychain 依赖安装失败 | 中 | 中 | 预编译库/OS 命令抽象；M0 验证 |
| Node 版本门槛 | 中 | 中 | Node >=22；npx；v1.1 独立二进制 |
| 秘密泄露到日志/上下文 | 中 | 高 | Vault、redaction、Skill 禁止 reveal、CI 扫描；同用户恶意进程不在防护范围 |
| Agent 擅自提交 | 中 | 高 | confirm token + Skill 规则 + 审计；默认 Agent 决策，接受残余风险；可选 human strict mode |
| Prompt injection 驱使 Agent 读写 | 中 | 高 | 上游内容标为不可信；预览/审计；不执行文内指令；可选 human strict mode |
| 主密码/设备丢失 | 低 | 高 | 无跨设备恢复；`vault reset --purge` 重登；文档警示 |
| 学校合规/公开分发压力 | 中 | 高 | MIT + 非官方声明；个人使用；配合学校 |
| 单人维护负担 | 高 | 中 | 只做 3 系统；声明式 connector；生成文档 |
| 性能/上下文成本 | 低 | 中 | 懒加载、字段裁剪、分页、25k token 上限 |

---

## 15. 开放问题与待验证项

1. 学工 link-code 是授权码还是长期 openid、TTL/重放、refresh 端点与 WebVPN 依赖（S1/S2/S3）。
2. 第二课堂 token 刷新、报名/取消字段、是否存在 link-code（S4）。
3. 志愿汇限频与平台条款边界（S5）。
4. 学工请假完整字段、附件是否强制（S6）。
5. 三平台钥匙串库选型与 CI 可行性（S7）。
6. npm 包名 `wzvtc-anything` 是否可用；否则换名但保持 bin `wzvtc`（S8）。
7. 文档站域名与托管（GitHub Pages 默认）。
8. 学校授权/沟通策略；公开发布后的响应流程。
9. Vault 恢复策略是否在 v1.1 增加恢复码/导出。
10. 是否在 v1 暴露 `--profile` UI（数据模型已支持）。
11. Agent 目标清单是否需要加入 Gemini CLI、OpenClaw 等。
12. 志愿汇是否保留到 v1：若合规/风控不可接受，降级为 v1.1 或移除。
13. SECURITY 联系渠道、目标响应时间、issue 支持边界与文档站域名。

---

## 16. 评审修订记录（2026-10-26）

> 实现状态（2026-10-26）：学工/第二课堂写闭环、志愿汇只读、Vault/钥匙串、confirm token 与 operations 已实现；CAS/WebForms、附件、销假、第二课堂签到、志愿汇写入、MCP、`vault exec`、`write_policy=human`、Vault reveal/rotate 未实现。详见 §2.2、§13、§16.2。

第三方独立评审后，PRD 做了以下修订：

### 16.1 已修

- **确认模型**：从“用户确认是硬门禁”改为“默认 Agent 按 Skill 策略判断 + confirm token + 审计 + 回查”；`write_policy=human` 作为 P2 可选严格模式。删除“100% 经用户确认”的强承诺。
- **明文边界**：把“Agent 永远拿不到明文”限定为“Skill 正常路径”；承认同用户恶意进程/被注入且具备 shell 的 Agent 不在 CLI 防护范围。
- **link-code**：新增 G0 语义门禁；区分一次性授权码与长期 openid；要求重放/重定向测试；不得用无害接口替代写验证。
- **Vault 生命周期**：明确“vault 文件丢失=只能 reset 重登”；新增 `vault devices/exec/delete`；`rotate-master` 默认撤销设备包裹；`reset --purge` 清除备份与钥匙串；补充密码学规格与钥匙串同步注意。
- **写超时**：新增 operation journal 与 `operations get/reconcile`；提交后响应丢失时 `side_effect_possible=true`，先对账再重试。
- **CLI 契约**：补齐 `skills read`、`vault delete/devices/exec`、`operations`；补 `vault_not_initialized/vault_corrupt/not_found/unsupported_feature/upstream_blocked`；`error.action` 改为结构化对象；新增 `side_effect_possible`；`schema --compact`；`doctor` 退出码；`wechat` 别名说明。
- **Skill**：description 加入“温职大/帮我请假/报名第二课堂/查志愿时长”等触发词；新增 references 路由；`doctor` 不再每轮执行；写操作读取 `side_effect_possible`。
- **范围与合规**：第二课堂不再声称做教务课表冲突检测；志愿汇标记 experimental + 发布前合规复核；密码保存对只读 provider 默认不保存；`--input` 增加 stdin/临时文件/PII 警告。
- **排期**：M0 调整为 2–3 周，M0–M4 约 10–14 周；新增范围切割顺序。

### 16.2 仍待验证/后置

- `write_policy=human` 的具体 UX（TTY confirm、OS 生物识别）为 P2。
- Vault 导出/恢复码（v1.1；v1 不做跨设备恢复）；Vault header 版本迁移工具也后置，v1 拒绝未知版本。
- 志愿汇 ToS/合规结论；若不允许，从 v1 移除。
- Cursor/Codex 的 skills 目标路径需 M0 实测。
- link-code 已观察“同一链接可重复导入”（2026-10-26）；仍需确认 TTL/失效方式与 refresh，产品按密码等价物处理。
- npm 包名、SECURITY 联系渠道、文档站域名待定。
- 第二课堂/志愿汇的端点与字段需 M0 用本人账号复验；不得把旧项目文档当最终事实。

---

## 附录 A：调研来源

### A.1 Agent Skills 与工具设计

- Agent Skills Specification：https://agentskills.io/specification
- Agent Skills Best Practices：https://agentskills.io/skill-creation/best-practices
- Optimizing Descriptions：https://agentskills.io/skill-creation/optimizing-descriptions
- Using Scripts：https://agentskills.io/skill-creation/using-scripts
- Claude Code Skills 文档：https://code.claude.com/docs/en/skills
- Anthropic：Equipping agents for the real world with Agent Skills：https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Anthropic：Writing effective tools for agents：https://www.anthropic.com/engineering/writing-tools-for-agents
- MCP Specification（工具安全/人类在环）：https://modelcontextprotocol.io/specification
- CLI Guidelines：https://clig.dev/
- Rewrite your CLI for AI Agents：https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/

### A.2 参考项目

- larksuite/cli：https://github.com/larksuite/cli
- SYSU-Anything：https://github.com/qybaihe/SYSU-Anything
- sufe-cli：https://github.com/ChengJiale150/sufe-cli
- cloudflare/security-audit-skill：https://github.com/cloudflare/security-audit-skill
- rea：https://github.com/morluto/rea
- wzvtc-hub（仅参考，不继承）：https://github.com/windfsy/wzvtc-hub

### A.3 温职大系统

- 学校官网：https://www.wzvtc.cn/
- 统一身份认证集成系统：https://id.wzvtc.cn/cas/help/integrationSystem.html
- CAS 登录页（公开）：https://id.wzvtc.cn/cas/login
- 教务处/教务系统入口：https://jwc.wzvtc.cn/jwxtdl/
- 办事大厅：https://www.wzvtc.cn/List/45.html
- 学工移动端 SPA（公开静态资源）：https://xgxt.wzvtc.cn/Phone/index.html

### A.4 Context7 查询

- `/anthropics/claude-code`：Skill 结构、frontmatter、渐进披露、最佳实践。
- `/modelcontextprotocol/modelcontextprotocol`：工具粒度、人类在环、安全考虑。
- 结论：MCP 适合标准化工具暴露，但 v1 选择 CLI + SKILL，以降低上下文成本、提高可调试性与组合性。

---

## 附录 B：案例对比与借鉴

| 项目 | 模式 | 借鉴 | 不照搬 |
|---|---|---|---|
| larksuite/cli | Go CLI + 26 领域 Skill + 共享认证 + 三层命令 + keychain/DPoP | 共享 auth skill、schema/affordance、风险确认、版本随包、多 profile | 规模、Go 实现、DPoP（上游不支持） |
| SYSU-Anything | CLI + Skill + references + 多 Agent 分发 | 每系统登录检查、预览再写、跨 Agent 安装、Apple 生态扩展思路 | 浏览器/Apple 集成、具体实现 |
| sufe-cli | Python CLI + Playwright + 分领域 Skill | 认证必须用户执行、敏感操作提示 | Playwright 重依赖、页面自动化 |
| cloudflare/security-audit-skill | 多阶段 Skill + 校验脚本 + JSON 结果 | 工作流分阶段、机器可读输出、独立校验 | 安全审计领域逻辑 |
| rea | MCP + CLI + 紧凑 schema | CLI/MCP 共用能力、compact schema 控上下文 | MCP 优先、复杂逆向工具 |
| wzvtc-hub | Python CLI + Skill + 4 connector + 移除 MCP | 输出/错误/写确认/脱敏经验 | 命令契约、登录管理、端点假设 |

---

## 附录 C：术语表

| 术语 | 含义 |
|---|---|
| Agent | 能调用工具、执行多步任务的 AI 客户端 |
| Skill | 按 Agent Skills 规范组织的指令/资源包，渐进披露 |
| CLI | 命令行接口；本项目是 Agent 的确定性执行层 |
| Connector | 一个校园系统的 API 适配与 ToolSpec 集合 |
| ToolSpec | 对单个能力的声明：名称、参数、风险、认证、执行/预览 |
| Vault | 本地加密凭证库；主密码 + 设备钥匙串解锁 |
| Keychain | 操作系统凭证存储（Windows Credential Manager / macOS Keychain / libsecret） |
| Link-code | 微信/移动端链接中的一次性 code，用于换 token |
| Confirm token | 写操作预览后的一次性确认令牌，绑定输入与账号 |
| Ceremony | 认证交互方式（link-code/password/qr/cookie） |
| Channel | 系统渠道（PC/微信/移动 H5/第三方 H5） |
| Progressive disclosure | 先加载元数据，按需加载正文与 references |
| Golden task | 用于评测 Agent 的固定任务集 |

---

## 附录 D：公开 README/文档站建议目录

```text
docs/
├── index.md                 # 一句话 + 快速开始
├── quickstart.md            # 安装、Vault、Skill、首次登录
├── concepts/
│   ├── auth.md              # 认证与渠道
│   ├── vault.md             # Vault 与设备信任
│   └── safety.md            # 写确认与 Agent 边界
├── commands/                # 由 schema 生成
├── systems/
│   ├── xgxt.md
│   ├── dekt.md
│   └── zyh.md
├── security.md
├── faq.md
├── contributing.md
└── changelog.md
```

---

## 结论

v1 的核心不是“接了多少系统”，而是把 **认证异构、凭证安全、Agent 写操作** 这三件难事做成可复用的底座：

- 用 link-code + 账密覆盖三种真实鉴权；
- 用 Vault + OS 钥匙串把凭证留在本机；
- 用 JSON-only CLI + schema 让 Agent 可发现、可组合；
- 用 dry-run + confirm token + 回查把写操作变成可审计流程；
- 用单 Skill + references 控制上下文成本；
- 用公开发布级工程把项目从“个人脚本”提升为“可被别人安全使用的基础设施”。

教务、图书馆、CAS、志愿汇写操作都不是 v1 的失败，而是底座成立后的自然扩展。
