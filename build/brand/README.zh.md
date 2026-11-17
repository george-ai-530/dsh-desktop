# COWIN 品牌素材源（可替换目录）

本目录是应用品牌素材的**权威替换入口**。把官方素材放进这里，跑几条命令即可完成全套替换；应用安装包内消费的成品文件都在 `build/` 上一级，无需手改代码。

## 目录内容

| 文件 | 是什么 | 渲染出什么（在 build/ 上级） |
| --- | --- | --- |
| `brand-mark.svg` | 单色轨道 mark（侧边栏/英雄区/启动页共用） | `startup-brand.svg`（启动页 + Host 等待页）、应用内 mark |
| `app-icon.svg` | 全彩应用图标源（1024×1024 圆角白底） | `app-icon.png`、`icon.png`、`icon.ico`[*](#注意事项)、打包内 favicon/apple-touch-icon |
| `logo-wordmark.svg` | "COWIN 珂阳" 轮廓字 lockup（蓝 `#0052D9` + 橙 `#E37318` 分组） | `logo-light.png`、`logo-dark.png`（dark 版蓝自动换 `#366EF4`）、侧边栏字标 |

启动页图像是 `build/startup-brand.svg`（品牌蓝单色 mark，655×548）。替换官方启动 logo 有两种方式，见下文路线 A 第 4 步与路线 B。

## 替换流程

### 路线 A：官方 SVG 源（推荐）

1. 用官方文件**覆盖**本目录的三个 SVG（文件名不变）。
2. 依次执行：

```bash
npm run brand:render      # SVG → PNG + 生成默认 startup-brand.svg（已存在则跳过）
npm run icons:generate    # app-icon.png → icon.ico（icns 需在 macOS/CI 上再跑）
npm run brand:sync        # 同步 SVG 路径到侧边栏/英雄区/onboarding 的内嵌常量
```

3. **官方启动 logo**：直接把官方 SVG 覆盖到 `build/startup-brand.svg`（注意是上一级目录，不是本目录）。`brand:render` 遇到已存在的 `startup-brand.svg` 会跳过，不会覆盖你的官方文件；删掉它再重跑可回到品牌蓝生成版。
4. 重新打包（`npm run package:dir`）即可看到全部新品牌。

> `node scripts/release/outline-wordmark.mjs` 只用于从系统字体重新生成**默认**的 `logo-wordmark.svg`（Arial Bold + 微软雅黑 Bold 轮廓）。替换官方字标时不要跑它——它会用默认字标覆盖你放入的 SVG。

### 路线 B：直接覆盖成品

设计同事只给成品位图时，跳过渲染脚本，直接替换 `build/` 上一级的：

- `app-icon.png`（1024×1024，含透明边距与圆角）、`icon.png`（1254×1254）
- `logo-light.png` / `logo-dark.png`（336×192，透明底）
- `startup-brand.svg`（官方启动 logo，见上）

然后只需 `npm run icons:generate`（从 app-icon.png 重新生成 ico/icns），再打包。

## 各文件契约（路线 A 必读）

- **`brand-mark.svg`**：整个图形必须是**恰好一个 `<path>`** 的填充轮廓（弧线画成环形扇区 subpath、圆点用圆形 subpath，禁止 stroke），画布 1000×1000。`npm run brand:sync` 按第一个 `d="…"` 提取，把同一个 `d` 同步进 `packages/dsh-desktop-client-ui/client.js` 和 `packages/dsh-desktop-onboarding/client.js` 的 `BRAND_MARK_PATH`，并解析 SVG 注释里的紧界 bounds（`x … y … w … h …`）写入 `BRAND_MARK_VIEWBOX`——注释格式不能丢；`brand:render` 生成启动页 SVG 时也依赖同一份注释。
- **`app-icon.svg`**：1024×1024 画布、约 89px 透明边距 + 846px 圆角底（rx≈200）。保持此画布契约，`icon.png` 的 1254×1254 尺寸与安装包资源布局才不会变。
- **`logo-wordmark.svg`**：文字必须已转轮廓 path；蓝色组放在 `<g fill="#0052D9">`，橙色组放 `<g fill="#E37318">`。`brand:sync` 从蓝色组提取侧边栏单色字标（latin 部分），锚点不符会大声失败。
- **启动 logo（`build/startup-brand.svg`）**：官方 SVG 保持矢量、任意宽高比都可以（启动页按图片固有比例缩放，宽约 280px）。若宽高比与默认（655:548）差异较大，同步修改 `build/splash.html` 的 `<img>` width/height 与 `src/preload/boot-cover.ts` 的 `MARK_ASPECT_RATIO` 和 `mark.width/height`。

## 注意事项

- `icon.icns` 只能在 macOS/CI 生成（`icons:generate` 在 Windows 上会跳过并提示）。
- 路线 B 覆盖 PNG 后，`npm run brand:render` 会用 SVG 源再次覆盖这些 PNG——两选一，不要混用（`startup-brand.svg` 例外：存在即跳过）。
- 手机配对页与打包内 favicon/apple-touch-icon 在 `npm ci`（postinstall）时从 `build/icon.png`、`logo-light/dark.png` 自动注入，替换成品后重跑 `node scripts/release/install-brand-assets.mjs` 即可刷新。

## 当前状态（2026-11-17）：成品来自官方位图

应用成品已按**路线 B** 替换为官方 COWIN 珂阳位图：

- 权威输入是 `build/brand/source/cowin-logo.jpg`（官方位图，本目录 `source/` 子目录）。`node scripts/release/render-official-logo-assets.mjs` 从它生成 `build/` 上一级的 `app-icon.png`、`icon.png`、`logo-light.png`、`logo-dark.png` 和 `startup-brand.svg`（紧界裁切、白底转透明、JPEG 噪声抑制；dark 版蓝自动提亮为 `#366EF4`，橙色不变）。
- 之后再跑 `npm run icons:generate`（从新 `app-icon.png` 重建 `icon.ico`；`icon.icns` 需在 macOS/CI 上补跑）和 `node scripts/release/install-brand-assets.mjs`（刷新注入到 Web 前端 dist 的 favicon/apple-touch-icon/manifest/明暗 logo，并把模型输出占位的鲸鱼遮罩换成 loading 圆环、把「深度求索中」改写为「深度思考中」）。
- `npm run brand:sync` 除内嵌矢量外，还会把 `hero-light.png` / `hero-dark.png`（本目录，官方位图渲染，高 96px）以 base64 同步进 `dsh-desktop-client-ui/client.js` 的 `HERO_MARK_*_DATA`——新对话 hero 图标即这两张随主题深浅切换的官方位图。
- 启动页与 Host 等待页的 mark 宽高比是 **742:378**：`build/splash.html` 的 `<img width height>` 与 `src/preload/boot-cover.ts` 的 `MARK_ASPECT_RATIO` / `mark.width` / `mark.height` 已同步（`test/boot-cover.test.ts` 有对应断言）。
- **不要**在替换后再跑 `npm run brand:render`：它会用本目录的 SVG 源覆盖官方成品 PNG（`startup-brand.svg` 例外，存在即跳过）。`brand:sync` 与 `client.js` 内嵌矢量常量不受本次替换影响，继续使用 `brand-mark.svg` / `logo-wordmark.svg` 的 COWIN 重绘版（侧边栏单色 mark、onboarding、shimmer 遮罩保持矢量管线）。
