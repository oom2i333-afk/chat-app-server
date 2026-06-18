/**
 * WeTalk PWA 图标生成器
 *
 * 用法：
 *   1. 确保已安装 node-canvas: npm install canvas
 *   2. node tools/generate-icons.mjs
 *
 * 如果不想安装 canvas，可以跳过此脚本，使用 README.md 中的在线工具方法。
 * 这里也提供 SVG 转 PNG 的 Sharp 方案。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');
const SVG_PATH = join(ICONS_DIR, 'icon-source.svg');
const SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Sharp 未安装。请运行: npm install sharp');
    console.error('或者使用在线工具生成图标（详见 icons/README.md）');
    process.exit(1);
  }

  const svgBuffer = readFileSync(SVG_PATH);
  mkdirSync(ICONS_DIR, { recursive: true });

  for (const size of SIZES) {
    const filename = `icon-${size}.png`;
    const filepath = join(ICONS_DIR, filename);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(filepath);
    console.log(`✓ 已生成: ${filename} (${size}x${size})`);
  }

  console.log('\n所有图标生成完成！');
}

generate().catch(console.error);
