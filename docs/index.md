---
layout: home

hero:
  name: WZVTC-Anything CLI
  text: 把温职大校园系统变成 Agent 可调用的 JSON 能力层
  tagline: 学工请假、第二课堂报名、志愿时长查询；本地 Vault + confirm token + OS 钥匙串。
  actions:
    - theme: brand
      text: 快速开始
      link: /quickstart
    - theme: alt
      text: GitHub
      link: https://github.com/windfsy/wzvtc-anything
    - theme: alt
      text: 命令参考
      link: /commands

features:
  - title: Agent-native
    details: 默认 JSON 信封、稳定错误码、schema 自省；跨系统编排交给 Agent Skill。
  - title: 本地 Vault
    details: 主密码 + Argon2id + AES-256-GCM；设备密钥只进 OS 钥匙串，不落文件。
  - title: 受控写
    details: 所有写操作预览 → 一次性 confirm token → 执行 → 回查；operation 日志可对账。
  - title: 真实闭环
    details: 学工请假提交/撤销、第二课堂报名/取消均已用真实账号完成受控 E2E。
  - title: 只读边界
    details: 志愿汇只读；不做 CAPTCHA OCR、不做反风控伪装、不共享账号。
  - title: MIT
    details: 第三方非官方项目，仅限本人账号使用；与学校无隶属关系。
---

> [!WARNING]
> 本项目是第三方非官方工具，仅限本人账号使用。学工链接实测可重复导入，请按密码等价物处理，不要分享或截图。志愿汇当前只读。完整边界见 [安全模型](/security) 与 [限制](/limitations)。
