// GIF 디코더 검증 — 실제 kmoni 프레임을 ffmpeg RGBA 결과와 픽셀 일치 대조.
// 사용: node scripts/gif-decode-check.mjs [장수=5]  (ffmpeg 필요, kmoni 실시간 프레임 직접 fetch)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { decodeGifRgba } from '../server/gif-decode.mjs';

const N = Number(process.argv[2]) || 5;

function jstStamp(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function fetchFrame(ms) {
  const t = jstStamp(ms);
  const url = `http://www.kmoni.bosai.go.jp/data/map_img/RealTimeImg/jma_s/${t.slice(0, 8)}/${t}.jma_s.gif`;
  const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.slice(0, 4).toString() === 'GIF8' ? buf : null;
}

let pass = 0, fail = 0, skipped = 0;
let now = Date.now() - 15000;
for (let i = 0; i < N * 3 && pass + fail < N; i++, now += 1000) {
  const gif = await fetchFrame(now);
  if (!gif) { skipped++; continue; }

  writeFileSync('/tmp/gif-check-in.gif', gif);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', '/tmp/gif-check-in.gif', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '/tmp/gif-check-ref.rgba']);
  const ref = readFileSync('/tmp/gif-check-ref.rgba');
  const mine = decodeGifRgba(gif);

  if (!mine) { fail++; console.log(`[${i}] 디코드 실패 (${gif.length}B)`); continue; }
  if (mine.rgba.length !== ref.length) { fail++; console.log(`[${i}] 크기 불일치 mine=${mine.rgba.length} ref=${ref.length}`); continue; }

  // 디텍터 관점 비교: 투명/불투명 판정 + 불투명 픽셀의 RGB (투명 픽셀의 RGB는 ffmpeg가 흰색으로 채우므로 무시)
  let opaqueDiff = 0, alphaDiff = 0;
  for (let o = 0; o < ref.length; o += 4) {
    const mineT = mine.rgba[o + 3] === 0, refT = ref[o + 3] === 0;
    if (mineT !== refT) { alphaDiff++; continue; }
    if (mineT) continue;
    for (let c = 0; c < 3; c++) if (mine.rgba[o + c] !== ref[o + c]) opaqueDiff++;
  }
  if (opaqueDiff === 0 && alphaDiff === 0) { pass++; console.log(`[${i}] OK ${mine.width}x${mine.height} ${gif.length}B`); }
  else { fail++; console.log(`[${i}] 불일치 — 불투명 RGB ${opaqueDiff}바이트, 투명판정 ${alphaDiff}픽셀`); }
}
rmSync('/tmp/gif-check-in.gif', { force: true });
rmSync('/tmp/gif-check-ref.rgba', { force: true });
console.log(`\n결과: 일치 ${pass} / 불일치 ${fail} / 건너뜀(프레임없음) ${skipped}`);
process.exit(fail === 0 ? 0 : 1);
