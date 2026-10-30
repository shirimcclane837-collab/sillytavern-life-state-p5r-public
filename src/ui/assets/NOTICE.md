# 主题素材来源

`party/*.png` 来自 [q-mona/p5-ui 的 p5-icon-party.js](https://github.com/q-mona/p5-ui/blob/da890e83579d0cbf9bfe2f571223e39948e90381/src/assets/svgs/p5-icon-party.js)，提交 `da890e83579d0cbf9bfe2f571223e39948e90381`。这些文件是其中 SVG symbol 内嵌 PNG 数据的原样解码，图像像素未修改，作为用户指定的 P5R 主题装饰使用。横条仅采用其中 11 位女性角色的黑白图标。

`makoto-menu.png` 于 2026-10-30 使用 GPT-Image 生成。按用户提供的 Persona 5 主菜单截图构图，将人物设为新岛真（Queen），使用头部网点、纯黑衣装、延伸至画面边缘的前臂与直线红白分色。图片保留白色手掌和前臂作为实际 React 菜单的承载区域，没有烘焙文字或选择／返回提示。这是 AI 生成的衍生图，不是官方游戏画面或从游戏提取的立绘。

`fonts/life-state-menu.woff` 是 Noto Serif CJK SC Bold 的字形子集，用于英文菜单；`fonts/life-state-glyphs.woff` 是 Noto Sans CJK SC Black 2.004 的八个中文菜单字形子集。来源为 [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk)，版权属于 Adobe 及字体中的原署名者；遵循 [SIL Open Font License 1.1](fonts/OFL.txt)。子集的字体族名分别改为 Life State Menu 与 Life State Glyphs，字形轮廓保留原设计。字体随扩展本地安装。

Persona 5 / Persona 5 Royal 角色及相关美术属于原权利人 ATLUS / SEGA；素材整理来源为 q-mona/p5-ui。本项目不主张这些图片的所有权，不为其添加新的授权，也不代表原权利人或参考项目背书。

插画与头像仅装饰主题，不会写入聊天人物档案。其余界面几何形状通过 CSS 和内联 SVG 实现，交互动画使用 Framer Motion。
