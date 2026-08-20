# AI auto — 设计系统

**Date:** 2026-08-20
**Version:** 1.0
**Status:** Draft

---

## 1. 设计原则

1. **清晰优先**：信息密度高，数据展示为主，不追求花哨
2. **信任感**：佣金/提现/核销涉及钱，设计必须专业可靠
3. **低门槛**：商家多为中小老板，操作要极简
4. **移动友好**：分享员后台以手机为主，商家后台 PC 为主
5. **品牌一致**：所有端使用统一设计令牌

---

## 2. 色彩系统

### 2.1 主色板（Primary Palette）

```
Primary-900: #1a365d   /* 深蓝 - 最重要的按钮/导航 active 状态 */
Primary-800: #2c5282   /* 主蓝 - 主要按钮/链接 */
Primary-700: #3182ce   /* 中蓝 - 交互元素 hover */
Primary-600: #4299e1   /* 亮蓝 - 次要交互 */
Primary-500: #63b3ed   /* 浅蓝 - 背景/徽章 */
Primary-100: #ebf8ff   /* 极浅蓝 - hover 背景/选中行 */
Primary-50:  #f0f9ff   /* 最浅蓝 - 页面背景 */
```

### 2.2 成功色板（Success）

```
Success-900: #22543d   /* 深绿 */
Success-700: #276749   /* 主绿 - 成功/入账 */
Success-500: #48bb78   /* 中绿 - 上线/确认 */
Success-300: #9ae6b4   /* 浅绿 - 成功徽章背景 */
Success-100: #f0fff4   /* 极浅绿 - 成功背景 */
```

### 2.3 警告色板（Warning）

```
Warning-900: #744210   /* 深橙 */
Warning-700: #b7791f   /* 主橙 - 审核中/待处理 */
Warning-500: #ed8936   /* 中橙 - 告警 */
Warning-300: #faf089   /* 浅橙 - 警告背景 */
Warning-100: #fffff0   /* 极浅黄 - 警告背景 */
```

### 2.4 危险色板（Danger）*

```
Danger-900: #742a2a   /* 深红 */
Danger-700: #c53030   /* 主红 - 拒绝/失败 */
Danger-500: #e53e3e   /* 中红 - 危险操作按钮 */
Danger-300: #feb2b2   /* 浅红 - 错误背景 */
Danger-100: #fff5f5   /* 极浅红 - 错误背景 */
```

### 2.5 中性色板（Neutral）

```
Neutral-900: #1a202c   /* 标题文字 */
Neutral-700: #2d3748   /* 正文 */
Neutral-600: #4a5568   /* 次要文字 */
Neutral-500: #718096   /* 占位文字 */
Neutral-400: #a0aec0   /* 边框 */
Neutral-300: #cbd5e0   /* 分割线 */
Neutral-200: #e2e8f0   /* 卡片边框 */
Neutral-100: #edf2f7   /* 页面背景 */
Neutral-50:  #f7fafc   /* 卡片背景/输入框 */
White:       #ffffff   /* 纯白 - 卡片/模态框 */
```

### 2.6 佣金相关特殊色

```
Commission-Gold: #d69e2e   /* 佣金金额高亮（金色）*/
Commission-Orange: #dd6b20 /* 佣金待结算（橙）*/
Commission-Blue: #3182ce  /* 已到账（蓝/绿）*/
```

---

## 3. 字体系统

### 3.1 字体族

```
中文主字体: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif
数字/英文: "SF Pro Display", "DIN Alternate", "Roboto", sans-serif
代码/金额: "JetBrains Mono", "SF Mono", monospace
```

### 3.2 字号（Type Scale）

```
Text-3xl:  30px / 行高 38px  /* 大标题（H1）*/
Text-2xl:  24px / 行高 32px  /* 页面标题（H2）*/
Text-xl:   20px / 行高 28px  /* 卡片标题（H3）*/
Text-lg:   18px / 行高 26px  /* 重要数据 */
Text-md:   16px / 行高 24px  /* 正文 */
Text-sm:   14px / 行高 20px  /* 次要文字/标签 */
Text-xs:   12px / 行高 16px  /* 说明文字/备注 */
Text-2xs:  10px / 行高 14px  /* 徽章文字 */
```

### 3.3 字重（Font Weight）

```
Font-Bold:   700   /* 标题/数据高亮 */
Font-Semibold: 600  /* 重要标签/按钮文字 */
Font-Medium:  500   /* 正文/输入框 */
Font-Regular: 400   /* 说明文字 */
```

### 3.4 金额显示规范

所有金额统一使用 monospace 字体，大数字用千分位分隔：

```
¥12,345.00   /* 金额：¥ + 千分位 + 2位小数 */
¥2.3万       /* 大金额用万 */
```

---

## 4. 间距系统

基于 4px 网格：

```
Space-1:  4px   /* 紧凑间距 */
Space-2:  8px   /* 组件内间距 */
Space-3:  12px  /* 标签与内容间距 */
Space-4:  16px  /* 元素间标准间距 */
Space-5:  20px  /* 区块内间距 */
Space-6:  24px  /* 卡片内边距 */
Space-8:  32px  /* 区块间距 */
Space-10: 40px  /* 大区块间距 */
Space-12: 48px  /* 页面区块间距 */
Space-16: 64px  /* 页面最大间距 */
```

---

## 5. 圆角系统

```
Radius-none: 0px     /* 输入框/表格（直角）*/
Radius-sm:   4px    /* 小标签/徽章 */
Radius-md:   8px    /* 按钮/卡片 */
Radius-lg:   12px   /* 模态框/大卡片 */
Radius-xl:   16px   /* Banner / 特殊卡片 */
Radius-full: 9999px /* 圆形头像/胶囊按钮 */
```

---

## 6. 阴影系统

```
Shadow-sm:   0 1px 2px 0 rgba(0,0,0,0.05)
             /* 卡片默认/输入框 focus */
Shadow-md:   0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)
             /* 卡片 hover/弹窗 */
Shadow-lg:   0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)
             /* 模态框/大卡片浮起 */
Shadow-xl:   0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)
             /* 侧边栏浮起/大模态框 */
```

---

## 7. 动效规范

### 7.1 时长（Duration）

```
Duration-instant:  50ms   /* 微交互反馈（按钮按下）*/
Duration-fast:    150ms  /* 按钮 hover/切换 */
Duration-normal:   250ms  /* 模态框/展开/收起 */
Duration-slow:     400ms  /* 页面切换 */
```

### 7.2 缓动曲线（Easing）

```
Easing-standard: cubic-bezier(0.4, 0, 0.2, 1)   /* 标准 UI 动效 */
Easing-decelerate: cubic-bezier(0, 0, 0.2, 1)    /* 元素进入 */
Easing-accelerate: cubic-bezier(0.4, 0, 1, 1)    /* 元素退出 */
```

---

## 8. 组件规范

### 8.1 按钮（Button）

| Variant   | Background  | Text        | Border      | Use                 |
| --------- | ----------- | ----------- | ----------- | ------------------- |
| Primary   | Primary-800 | White       | none        | 主要操作            |
| Secondary | Transparent | Primary-800 | Primary-200 | 次要操作            |
| Ghost     | Transparent | Neutral-700 | none        | 文字按钮            |
| Danger    | Danger-700  | White       | none        | 删除/封禁等危险操作 |
| Disabled  | Neutral-300 | Neutral-500 | none        | 禁用状态            |

按钮高度：PC 端 40px（默认）/ 32px（小）/ 48px（大）; Mobile 端 44px（移动端最小点击区域）

### 8.2 输入框（Input）

```
默认:   Border Neutral-300, Background White
Focus:  Border Primary-500, Shadow-sm (Primary-100)
Error:  Border Danger-500, Background Danger-100
Disabled: Background Neutral-100, Text Neutral-500
```

### 8.3 卡片（Card）

```
默认:   Background White, Border Neutral-200, Shadow-sm, Radius-md
Hover:  Shadow-md, 稍微上移 2px
Active:  Border Primary-300
```

### 8.4 徽章（Badge）

| 类型        | 颜色                             |
| ----------- | -------------------------------- |
| 成功/已结算 | Success-300 bg, Success-700 text |
| 警告/待处理 | Warning-300 bg, Warning-700 text |
| 危险/失败   | Danger-300 bg, Danger-700 text   |
| 信息/进行中 | Primary-100 bg, Primary-700 text |
| 默认/草稿   | Neutral-200 bg, Neutral-700 text |

### 8.5 数据表格（Table）

- 斑马纹：奇数行 Neutral-50
- 悬停行：Primary-50
- 表头：Neutral-100 背景，Text-sm，字重 600
- 单元格：Text-md，行高 48px
- 固定列：左侧操作列 Background White, Shadow-sm

### 8.6 空状态（Empty State）

- 图标：80px × 80px，配色 Neutral-300
- 主文案：Text-lg，Neutral-700，字重 500
- 副文案：Text-sm，Neutral-500
- 操作按钮：Primary 按钮

### 8.7 加载状态（Loading）

- 骨架屏优先（Skeleton）
- 次选 Spinner（Primary-500）
- 禁止：loading 动画不要用 gif

---

## 9. 响应式断点

```
Mobile:   < 640px   /* 分享员后台主断点 */
Tablet:   640-1024px /* 商家后台偶用 */
Desktop:  1024-1440px /* 商家后台主断点 */
Wide:     > 1440px  /* 大屏统计报表 */
```

---

## 10. 导航规范

### 商家后台（PC）

- 左侧固定导航栏，宽度 240px
- 收缩模式：64px（只显示图标）
- 顶部：Logo + 商户名 + 通知图标 + 头像下拉菜单
- 面包屑：首页 > 当前页

### 分享员后台（Mobile）

- 底部 Tab 导航（4-5个主要 Tab）
- 顶部：头像/昵称 + 通知图标
- 胶囊式 Tab：用于子页面内部分类

### C端小程序（Mobile）

- 微信原生导航（无自定义顶部栏）
- 底部 Tab 导航（4个主要 Tab）
- 页面内：标准卡片列表

---

## 11. 图标规范

- 图标库：Heroicons（线性风格为主）
- 图标尺寸：16px（表格内）/ 20px（按钮旁）/ 24px（导航）/ 32px（空状态）
- 图标颜色：跟随文字颜色（inherit）

---

## 12. 平台特定规范

### 微信小程序

- 主色：#07c160（微信绿）
- 按钮：微信绿色或白色边框
- 字体：系统字体
- 导航栏：微信原生

### 商家后台 / 运营后台

- 主色：Primary-800
- 深色顶部栏（Primary-900）配白色文字
- 数据仪表盘用卡片网格布局

---

_设计系统由 Claude Code 生成，基于 Ant Design Pro 和 Tailwind 规范调优，适用于 AI auto 平台。_
