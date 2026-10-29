# 角色生理状态引擎 · P5R Edition

基于 [koofer-zia/sillytavern-life-state](https://github.com/koofer-zia/sillytavern-life-state) v5.70 的前端改版，面向 SillyTavern / TauriTavern 原生扩展。让角色手册在进入聊天前就准备就绪，以统一深色底面、黑白剪纸、红色操作反馈、女性 Q 版图标与怪盗风格转场重新组织界面。

**版本：5.71.3 · 非官方派生版本**

5.71.3 统一窗口背景与头像构图：移除白色顶栏、红色装饰角块、独立头像相框，以及玩法和设置中交替出现的白色底板。女性图标改为小幅黑白剪影，红色集中在选中状态与操作反馈；保留分层动效及 5.71.2 的桌面拖动、独立位置记忆。

[下载安装包](https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public/releases/latest) · [反馈问题](https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public/issues) · [原版说明](upstream/README-v5.70.md)

![进入聊天前的角色手册](docs/screenshots/welcome.png)

## 本次改进

- **入口随宿主启动出现**：未选择聊天也能打开欢迎页，提前调整主题、动效和新聊天默认追踪项目。
- **完整的黑白红主题**：顶栏、侧栏与内容共用深色底面和细微网点纹理，白色承载拼贴文字与轮廓，红色标识当前导航与操作状态。状态、人物、玩法、设置、二级分类、人物编辑器、应用角色和弹窗均做适配。
- **女性 Q 版图标**：使用参考项目里的黑白图标，装饰入口、菜单、欢迎页与页头。页头和侧栏使用透明底剪影，以细白边融入背景；设置里可以切换入口和欢迎页图标。全部为女性角色，不使用彩色立绘，不改动聊天人物头像。
- **分层动效**：窗口展开边界、拼贴标题与女性插图按顺序落位，底面保持稳定。前进与返回方向相反，二级页使用局部反馈；输入、勾选和数据刷新不重播导航。连续点击会取消过期动画；支持关闭动效并遵循系统的减少动态效果设置。详见[动效设计与参考](docs/motion.md)。
- **保留操作上下文**：各页保留滚动位置，编辑草稿与输入焦点在刷新时恢复。转场中的表单保持固定点击位置。
- **桌面窗口拖动**：按住顶部标题栏文字或空白处移动，关闭与设置按钮保留点击功能。拖动不会误触收起；入口与展开窗口分别保存位置，刷新后恢复，调整浏览器大小时限制在可见范围内。
- **手机适配**：窄屏底部导航、单列内容和独立滚动，兼顾横屏与小屏。
- **界面与聊天分别管理**：切换聊天立即清理旧人物展示，显示读取中或失败重试；退出聊天仍保留入口，停用扩展时释放窗口、事件和动画。

原有状态计算、人物档案、聊天存储格式和三种分析方式沿用上游实现。本次改动集中在前端展示与生命周期。旧「墨青」「晴白」设置自动映射到 P5R，仍保留暮紫与原版布局选项。

## 安装

先停用旧原生扩展或酒馆助手脚本并刷新，再安装本版；同一时间只运行一份。切换前建议备份聊天和设置。

在酒馆的「扩展 → 安装扩展」中粘贴：

```text
https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public
```

安装后启用并刷新，未进入聊天也应看到悬浮入口。已有聊天继续使用原来的状态记录与设置。

也可以从 [Releases](https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public/releases) 下载 `sillytavern-life-state-p5r-5.71.3.zip`，将其中的整个扩展文件夹放进宿主的第三方扩展目录，再刷新并启用。SillyTavern 常见目录为 `data/<用户>/extensions/`；TauriTavern 的实际目录由应用数据位置决定，优先使用应用内的扩展管理器。

**本版提供原生扩展，不提供酒馆助手 JSON 导入文件。** GitHub 自动生成的 Source code 也不是助手脚本。

## 使用

1. 未选择聊天时，打开手册的「设置」，调整主题、动效、Q 版装饰图标和新聊天默认追踪项目。
2. 进入聊天后，在「设置 → 内容设置」调整当前聊天的追踪范围；已有聊天不会被新默认设置覆盖。
3. 在「人物」页扫描或手动建立档案，也可以开启自动建档。
4. 在「状态」页查看角色状态，在「玩法」页选择分类、编辑搭配并选择应用角色。
5. 在「设置 → 运行模式」选择内置、外接协作或外接独立分析；外接模型使用原有 API 设置流程。

「设置 → 界面外观」可以切换主题、图标、动效、入口大小，以及悬浮或正文下显示。点击关闭按钮或按 Escape 收起手册。按住入口可拖动；电脑上展开后，按住顶部白色标题栏的文字或空白处可移动窗口。两种状态的位置分别保存，拖动时会限制在屏幕范围内。

更新时使用扩展管理器更新并刷新。手动安装时替换整个扩展文件夹，避免混用不同版本的入口、运行文件和样式。停用扩展不会清除聊天记录。

## 预览

截图使用本仓库的浏览器模拟宿主和示例人物，不包含真实聊天，也不调用模型。

[桌面动效录屏](https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public/releases/download/v5.71.3/motion-desktop.mp4) · [手机动效录屏](https://github.com/shirimcclane837-collab/sillytavern-life-state-p5r-public/releases/download/v5.71.3/motion-mobile.mp4) · [手机人物编辑器](docs/screenshots/mobile-editor.png)

![统一背景与头像构图](docs/screenshots/status.png)

![玩法库](docs/screenshots/play.png)

| 人物档案 | 人物编辑器 |
| --- | --- |
| ![人物](docs/screenshots/people.png) | ![编辑器](docs/screenshots/character-editor.png) |

| 玩法详情与应用角色 | 设置 |
| --- | --- |
| ![玩法详情](docs/screenshots/play-editor.png) | ![设置](docs/screenshots/settings.png) |

<img src="docs/screenshots/mobile.png" width="320" alt="手机状态页：底部导航与独立滚动" />

## 开发与验证

安装扩展无需 Node.js 或构建。开发环境建议使用 Node.js 20+：

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run preview
```

预览默认在 `http://127.0.0.1:4173`，是无模型调用的模拟宿主。测试也使用该模拟宿主；已有系统 Chromium 时可运行 `CHROMIUM_PATH=/usr/bin/chromium npm test`。

| 文件 | 职责 |
| --- | --- |
| `index.js` | 原生扩展启停与宿主就绪事件 |
| `src/runtime.js` | 原有引擎、聊天适配、数据与界面编排 |
| `src/ui/view.js` | 空状态、转场、动效偏好、滚动位置与窗口行为 |
| `src/ui/art.js` | 女性 Q 版图标、拼贴标题、主题装饰 |
| `src/ui/p5r.css` | 样式入口，加载基础布局与完整组件适配 |
| `src/ui/assets/` | 黑白图标与来源说明 |
| `tests/frontend.spec.js` | 浏览器交互与生命周期回归测试 |
| `tests/dragging.spec.js` | 桌面拖动、位置恢复、边界与触摸入口回归测试 |
| `tests/fixtures/` | 模拟宿主、示例状态和本地 API 桩 |
| `scripts/build.mjs` | 可安装目录和 SHA-256 文件清单 |
| `upstream/` | 原版 README 与 v5.70 签名档案 |

修改受完整性检查保护的运行函数后，先审查修改，再执行 `npm run integrity` 更新**派生版本**的函数指纹，随后运行 `npm run check` 与 `npm test`。`npm run build` 将安装文件和 `checksums.json` 输出到 `release/sillytavern-life-state-p5r-5.71.3/`。

22 项 Chromium 测试覆盖无聊天启动、默认设置、聊天切换、启停、输入草稿和焦点、快速导航、动画中断、减少动效、旧异步操作失效、失败重试、弹窗保存、图标持久化、人物编辑保存、六个玩法分类与应用角色，以及桌面和三种小屏尺寸。动效测试检查前进与返回方向、阅读区域位置与透明度，以及数据刷新不触发转场。5.71.2 新增标题栏空白处拖动、拖后点击、独立位置保存与刷新恢复、屏幕边缘与窗口缩放、失去焦点，以及 Chromium 原生触摸事件模拟的入口拖动和取消测试；手机触摸未做真机验证。

适配基线沿用上游的 SillyTavern 1.18.0 原生接口，并核对了 TauriTavern 扩展加载接口。**本次验证未包含真实模型调用，也未完成 TauriTavern 原生桌面应用端到端运行**；这些场景需要在实际宿主中验证。

## 来源与署名

原作者：**koofer（类脑社区）／[koofer-zia](https://github.com/koofer-zia)**。基于上游提交 `31b518b`（v5.70），保留原作者署名、水印、原版说明及签名档案。

原作者发布声明：**「请保留作者署名；未经作者许可，请勿修改后重新发布。」** 派生版本标识不代表原作者对本版的授权或背书，也不增加上游未授予的许可。

P5R 前端改版维护：[shirimcclane837-collab](https://github.com/shirimcclane837-collab)。视觉和黑白图标参考 [q-mona/p5-ui](https://github.com/q-mona/p5-ui) 及其 [文档](https://p5ui.morna.cn/)。图标由原项目的内嵌 PNG 原样提取，详见 [素材来源](src/ui/assets/NOTICE.md)。Persona 5 / Persona 5 Royal 相关美术属于原权利人 ATLUS / SEGA。

界面使用原生 DOM、CSS 和 Web Animations，不引入 Vue 组件库、远程字体或外部图片请求。本项目与原游戏及参考项目无关联或背书关系。

`upstream/signature-v5.70.json` 仅为原版签名存档，**不能验证本版**。本版采用独立的派生构建完整性标识与安装包 SHA-256 清单，不冒充上游官方签名。
