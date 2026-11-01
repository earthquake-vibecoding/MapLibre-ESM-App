#!/usr/bin/env node
/**
 * 감지 리플레이 — 과거 kmoni 프레임을 실제 detector로 되돌려 재생해 감지 동작을 검증한다.
 *
 * 사용 (dev 서버가 :3000에서 떠 있어야 함):
 *   node scripts/replay.mjs <시작14자리> <끝14자리> [--step 초] [--station CODE] [--type jma_s|jma_b]
 * 예:
 *   node scripts/replay.mjs 20261101031600 20261101032200 --step 2 --station A1502
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [from, to] = pos;
if (!from || !to) {
  console.error('사용: node scripts/replay.mjs <시작14자리> <끝14자리> [--step 초] [--station CODE] [--type 타입]');
  process.exit(1);
}
const step = Number(opt('step', 2));
const type = opt('type', 'jma_s');
const watch = opt('station', null);

// detector.ts를 임시로 번들 (수정 즉시 반영)
const bundle = path.join(os.tmpdir(), 'quake-detector-replay.mjs');
execSync(`npx esbuild src/lib/detector.ts --bundle --format=esm --outfile=${bundle} --log-level=error`, { stdio: 'inherit' });
const { processFrame } = await import(bundle);

// 관측점 + 상태 구성 (loadStations와 동일 구조, 이웃은 30km 최대 5개)
const points = JSON.parse(fs.readFileSync('public/intensity-points-v1.json', 'utf8'))
  .filter((p) => p.Location && !p.IsSuspended && p.Point);
const features = points.map((p) => ({ geometry: null, properties: { code: p.Code, px: p.Point.x, py: p.Point.y, color: 'transparent' } }));
const stations = new Map();
for (const p of points) {
  stations.set(p.Code, {
    code: p.Code, name: p.Name, lonlat: [p.Location.longitude, p.Location.latitude],
    jindo: null, near: [], delta: [], deltaSum: 0, event: null, expireTime: null,
    rawJindoHistory: [], history: [], color: 'transparent',
  });
}
const hav = (a, b) => {
  const dLat = (b[1] - a[1]) * Math.PI / 180, dLon = (b[0] - a[0]) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const arr = [...stations.values()];
for (const s of arr) s.near = arr.filter((o) => o !== s && hav(s.lonlat, o.lonlat) <= 30).slice(0, 5);

// 시각 목록
const times = [];
const d = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T${from.slice(8, 10)}:${from.slice(10, 12)}:${from.slice(12)}+09:00`);
const end = new Date(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T${to.slice(8, 10)}:${to.slice(10, 12)}:${to.slice(12)}+09:00`);
for (let t = d; t <= end; t.setSeconds(t.getSeconds() + step)) {
  const p = (n) => String(n).padStart(2, '0');
  times.push(`${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`);
}

let frames = 0, soundMax = -3, firstEvent = null, lastEvent = null, maxGrids = 0;
for (const t of times) {
  try {
    execSync(`curl -s --max-time 8 "http://localhost:3000/api/realtime-img?time=${t}&type=${type}" -o /tmp/replay.png`, { stdio: 'pipe' });
    execSync('ffmpeg -y -loglevel error -i /tmp/replay.png -f rawvideo -pix_fmt rgba /tmp/replay.rgba', { stdio: 'pipe' });
    const buf = fs.readFileSync('/tmp/replay.rgba');
    const r = processFrame(new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length), 352, 400, features, stations, true);
    frames++;
    if (r.soundJindo > soundMax) soundMax = r.soundJindo;
    const gridCount = [...stations.values()].filter((s) => s.event).length;
    if (gridCount > maxGrids) maxGrids = gridCount;
    if (r.newEventCenter && !firstEvent) firstEvent = { t, center: r.newEventCenter };
    if (r.newEventCenter) lastEvent = { t, center: r.newEventCenter };
    if (watch) {
      const s = stations.get(watch);
      if (s && s.jindo != null) {
        console.log(`${t}  ${s.name}  jindo=${s.jindo.toFixed(2)}  deltaSum=${s.deltaSum.toFixed(2)}  event=${s.event ? 'O' : '-'}`);
      }
    }
  } catch { /* 프레임 없음/다운로드 실패 — 건너뜀 */ }
}

console.log(`\n프레임 ${frames}/${times.length} 처리`);
console.log(`이벤트 생성: ${firstEvent ? `${firstEvent.t} (진앙 추정 ${firstEvent.center.map((v) => v.toFixed(1)).join(', ')})` : '없음'}`);
if (lastEvent && lastEvent !== firstEvent) console.log(`마지막 신규 이벤트: ${lastEvent.t}`);
console.log(`최대 격자 수: ${maxGrids}, 최대 soundJindo: ${soundMax}`);
const js = [...stations.values()].filter((s) => s.jindo != null).map((s) => s.jindo).sort((a, b) => b - a);
console.log(`최종 프레임 계측진도 상위: ${js.slice(0, 8).map((v) => v.toFixed(1)).join(', ')}`);
