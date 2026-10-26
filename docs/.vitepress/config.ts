import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'WZVTC-Anything CLI',
  description: '把温职大校园系统变成 Agent 可调用的 JSON 能力层',
  base: '/wzvtc-anything/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '快速开始', link: '/quickstart' },
      { text: '系统', link: '/systems/xgxt' },
      { text: '安全', link: '/security' },
      { text: '命令', link: '/commands' },
      { text: '限制', link: '/limitations' },
      {
        text: 'GitHub',
        link: 'https://github.com/windfsy/wzvtc-anything',
      },
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '快速开始', link: '/quickstart' },
          { text: '命令参考', link: '/commands' },
          { text: '常见问题', link: '/faq' },
        ],
      },
      {
        text: '系统',
        items: [
          { text: '学工请假', link: '/systems/xgxt' },
          { text: '第二课堂', link: '/systems/dekt' },
          { text: '志愿汇（只读）', link: '/systems/zyh' },
        ],
      },
      {
        text: '安全与发布',
        items: [
          { text: '安全模型', link: '/security' },
          { text: '边界与限制', link: '/limitations' },
          { text: '发布清单', link: '/release' },
          { text: '贡献指南', link: '/contributing' },
        ],
      },
    ],
    outline: { level: [2, 3], label: '本页目录' },
    search: { provider: 'local' },
    footer: {
      message: '第三方非官方项目，仅限本人账号使用。',
      copyright: 'MIT License',
    },
  },
});
