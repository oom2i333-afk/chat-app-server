# WeTalk PWA 图标

此目录包含 PWA 所需的各尺寸图标。目前需要通过以下方式之一生成：

## 方法 1：使用在线工具（推荐）

1. 访问 https://maskable.app/editor 上传你的应用图标
2. 调整安全区域（保证核心图标在圆圈内，不会被裁剪）
3. 导出所有尺寸（48, 72, 96, 128, 144, 152, 192, 384, 512）
4. 将生成的 PNG 文件放入此目录

或使用 https://app-manifest.firebaseapp.com/ 生成整套图标。

## 方法 2：使用 Node.js 自动生成

```bash
# 从项目根目录运行
node tools/generate-icons.mjs
```

这将从 `public/icons/icon-source.svg` 读取 SVG 源文件并输出所有尺寸的 PNG。

## 方法 3：手动快速生成

如果已有 `icon-192.png` 和 `icon-512.png`，可以临时填充缺失的尺寸：

```bash
# 使用 ImageMagick（需先安装）
magick convert icon-512.png -resize 48x48 icon-48.png
magick convert icon-512.png -resize 72x72 icon-72.png
magick convert icon-512.png -resize 96x96 icon-96.png
magick convert icon-512.png -resize 128x128 icon-128.png
magick convert icon-512.png -resize 144x144 icon-144.png
magick convert icon-512.png -resize 152x152 icon-152.png
magick convert icon-512.png -resize 384x384 icon-384.png
```

## 必需图标清单

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| icon-48.png | 48x48 | 通知徽章 (badge) |
| icon-72.png | 72x72 | 小图标 / 通知 |
| icon-96.png | 96x96 | 中等图标 |
| icon-128.png | 128x128 | Chrome 扩展 |
| icon-144.png | 144x144 | 兼容旧版设备 |
| icon-152.png | 152x152 | iOS 启动/桌面 |
| icon-192.png | 192x192 | 主要图标 (maskable) |
| icon-384.png | 384x384 | 大屏适配 |
| icon-512.png | 512x512 | 最大图标 (maskable) |

## 图标设计规范

- 使用 `maskable` 格式：核心内容在直径 `<80%` 的圆圈内
- 建议使用绿色的 WeTalk 气泡图标 + 白色 "W" 文字
- 背景色：`#1aad19` (WeTalk 主题绿)
- SVG 源文件推荐放在：`public/icons/icon-source.svg`
