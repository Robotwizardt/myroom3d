// 裁图小工具：node scripts/crop_shot.cjs <in.png> <x> <y> <w> <h> <out.png>
const fs = require('fs');
const { PNG } = require('playwright-core/lib/utilsBundle');

const [inPath, x, y, w, h, outPath] = process.argv.slice(2);
const png = PNG.sync.read(fs.readFileSync(inPath));
const [xi, yi, wi, hi] = [x, y, w, h].map(Number);
const out = new PNG({ width: wi, height: hi });
PNG.bitblt(png, out, xi, yi, wi, hi, 0, 0);
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`裁出 ${outPath}  ${wi}x${hi}（源 ${png.width}x${png.height}）`);
