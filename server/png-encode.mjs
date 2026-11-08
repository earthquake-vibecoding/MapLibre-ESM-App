// RGBA → PNG 인코더 (node:zlib만 사용, 의존성 0) + 감지 스냅샷 합성.
// detect-snapshot.ts(client)와 동일 렌더: kmoni 프레임 + #ff2020 2px 사각형 스트로크.

import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** RGBA 바이트 → PNG Buffer (color type 6, filter 0) */
export function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // 10~12: compression/filter/interlace = 0

  // 스캔라인마다 filter 바이트(0) 선행
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const RECT_HALF = 4;
const STROKE = 2;
const RED = [0xff, 0x20, 0x20];

/** 감지 관측소 위치에 빨간 8×8 스트로크 사각형 — detect-snapshot.ts strokeRect(lw2) 패리티 (바깥 1px 포함) */
export function drawDetectRects(rgba, width, height, points) {
  const rect = (cx, cy) => {
    const x0 = Math.round(cx) - RECT_HALF, y0 = Math.round(cy) - RECT_HALF;
    const x1 = x0 + RECT_HALF * 2, y1 = y0 + RECT_HALF * 2;
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const edge = x - x0 < STROKE || x1 - x < STROKE || y - y0 < STROKE || y1 - y < STROKE;
        if (!edge) continue;
        const o = (y * width + x) * 4;
        rgba[o] = RED[0];
        rgba[o + 1] = RED[1];
        rgba[o + 2] = RED[2];
        rgba[o + 3] = 255;
      }
    }
  };
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    rect(p.x, p.y);
  }
}
