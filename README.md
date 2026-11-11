# Ambient Gallery · 氛围图墙

主面板背后的一层会呼吸的图片墙。每个窗口最多 **20 张图**轮播；默认是**程序生成的简易图**（不依赖任何素材），点一下即可换成**你自己的本地图片**；其中一个窗口可以**隐蔽地播放本地视频**。

所有图片与视频都只存在本机，不上传、不联网。

---

## 它做了什么

- **点缀式阵列，不是表格**：默认 4×3 = 12 个窗口，但列宽、行高、每块尺寸、落位、倾角都是确定性地抖动过的 —— 大小不一、疏密错落，像客厅电视墙上的装饰画，而不是等分网格。每块另有上限（26% × 34%），无论行多行少都不会长成一大块板子。
- **只占面板中段**：整面墙横向默认落在面板宽度的 **20%–80%** 之间（可在设置里各自调），左右两侧是阅读留白；纵向从 7% 到 93%，左右边缘还有渐变淡出。
- **每格动态轮播**：一个窗口里可以放最多 20 张图，按设定间隔交叉淡入（1.6s 过渡）。每个窗口的首帧延迟带确定性相位偏移，所以整面墙是「涟漪式」亮起，而不是整齐地闪。
- **满 20 张之后**：再选图不会失败 —— 新图进、最旧的自动轮换出去（滚动窗口语义，两端都按 `.slice(-20)` 执行）。
- **默认就有内容**：没有放图时，每个窗口用 canvas 现场生成 3 张不同母题（光池／条纹／弧线）的渐变图，同一格每次刷新都一致（种子来自窗口编号）。
- **点选本地图片**：进入「布置」模式后，点击任一窗口即可多选本地图片，或直接把文件拖进窗口。
- **隐蔽视频窗**：其中一个窗口可以是视频（默认第 12 个窗口，可改位置或关闭）。它常态下与其他窗口一样低浓度、静音循环；只有在布置模式下才会显示出播放控件。
- **底层、不挡操作**：整面墙挂在 `shell.overlay` 上，根节点 `pointer-events:none`，每格低透明度 + `mix-blend-mode`，文字从上面流过依然清晰；它从不拦截点击、滚动或键盘输入。

## 装

```bash
dsh plugin --profile web add dsh-ambient-gallery
```

或从源码目录安装：设置 → 插件 → 安装本地包，指向本目录。

## 用

1. 右下角有一个很淡的圆钮（悬停才明显），点它进入**布置模式**。
2. 布置模式下：点任意窗口选图（可多选）、拖文件进窗口、调列数／行数／左边界／右边界／浓度／间隔／模糊。
3. 点「完成」退出布置模式，图墙回到背景里。

设置 → **氛围图墙** 里有同一组控件（还带说明），可以整体隐藏图墙、恢复默认、清空全部。

## 存储与接口

- 状态：`~/.dsh/ambient-gallery/state.json`（config + 每格的帧列表）
- 媒体：`~/.dsh/ambient-gallery/media/`（导入时重命名为随机 id，客户端文件名只作为展示信息保留）
- 路由（Host 半，仅本机 loopback 可访问）：
  - `GET/POST /plugins/dsh-ambient-gallery/state`
  - `POST /plugins/dsh-ambient-gallery/import`（原始文件体 + `X-File-Name`）
  - `GET/HEAD /plugins/dsh-ambient-gallery/media/<id>.<ext>`（支持 `Range`，视频可流式 seek）
  - `POST /plugins/dsh-ambient-gallery/remove?id=<id>`

图片走 HTTP 而不是 `localStorage`／data URL，是因为手机照片几张就会撞到 5MB 配额，而视频 base64 进内存既慢又会重复持有。

## 兼容性

`engines.dsh: ">=0.2.0-rc.2 <0.3.0-0"`，`engines.node: ">=18"`。四个 peer 依赖全部 optional。

## 已知取舍

- 图墙在 `shell.overlay` 里，而宿主的 overlay 层（`z-index:20`）恒在各列之上、且中心列自带不透明底色 —— 所以「画在内容下面」在实现上做不到，只能用**低浓度 + 混合模式**做出视觉底纹的效果，同时保证永不拦截事件。这是刻意选择，不是遗漏。
- 布置模式期间图墙会临时接管鼠标（否则无法点击选图），退出后立刻恢复穿透。
- `prefers-reduced-motion: reduce` 时图墙自动隐藏轮播与整面墙。

## 开发

```bash
node --check lib/index.js
node --check lib/client.js
node tools/gallery-smoke.mjs lib/client.js   # 离线：加载器 / 槽位注册 / 渲染
node tools/gallery-probe.mjs                 # 端到端：20 张上限、合并、Range、视频
```

`tools/make-icon.py` 用 Pillow 从 `icon.svg` 的几何重绘 `assets/icon-180.png`（同一套五窗格与播放三角），所以图标是「一份设计，两种格式」，不会各自漂移。

装入 profile 后，Host 改动需要 `plugin_manager set_plugin enabled=false → true` 重载。

## License

MIT
