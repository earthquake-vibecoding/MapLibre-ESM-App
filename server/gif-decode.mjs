// 최소 GIF 디코더 — kmoni 프레임 전용 (단일 프레임 팔레트 GIF → RGBA).
// 첫 이미지 디스크립터만 디코드. 인터레이스/로컬 팔레트/GCE 투명색 지원. 의존성 0.
// 검증: scripts/gif-decode-check.mjs가 ffmpeg RGBA 결과와 픽셀 일치 대조.

const MAX_CODE = 4096;

function parseBlocks(buf, p) {
  // 서브블록 체인 → 하나의 Uint8Array로 합침 (p는 첫 서브블록 크기 바이트)
  const chunks = [];
  let total = 0;
  while (p < buf.length) {
    const size = buf[p++];
    if (size === 0) break;
    chunks.push(buf.subarray(p, p + size));
    total += size;
    p += size;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** GIF LZW 압축 해제 → 인덱스 배열. 손상 시 null */
function lzwDecode(minSize, data, pixelCount) {
  if (minSize < 2 || minSize > 8) return null;
  const clear = 1 << minSize;
  const eoi = clear + 1;
  let codeSize = minSize + 1;
  let codeMask = (1 << codeSize) - 1;
  const prefix = new Int32Array(MAX_CODE);
  const suffix = new Uint8Array(MAX_CODE);
  const stack = new Uint8Array(MAX_CODE);
  const out = new Uint8Array(pixelCount);
  let avail = eoi + 1;
  let prev = -1;
  let op = 0;
  let cur = 0, bits = 0, pos = 0;

  while (op < pixelCount) {
    while (bits < codeSize) {
      if (pos >= data.length) return null; // 잘린 스트림
      cur |= data[pos++] << bits;
      bits += 8;
    }
    const code = cur & codeMask;
    cur >>= codeSize;
    bits -= codeSize;

    if (code === clear) {
      codeSize = minSize + 1;
      codeMask = (1 << codeSize) - 1;
      avail = eoi + 1;
      prev = -1;
      continue;
    }
    if (code === eoi) break;
    if (code > avail) return null; // 미정의 코드 — 손상

    // code의 문자열을 스택에 역순 채움 → 순서대로 출력
    let sp = stack.length;
    let chase = code;
    const kwk = code === avail; // KwKwK: 미정의 코드 = prev문자열 + 그 첫 문자
    if (kwk) chase = prev;
    while (chase >= clear) {
      stack[--sp] = suffix[chase];
      chase = prefix[chase];
    }
    stack[--sp] = chase;
    const firstChar = chase;
    for (let i = sp; i < stack.length && op < pixelCount; i++) out[op++] = stack[i];
    if (kwk) out[op++] = firstChar; // KwKwK 첫 문자는 문자열 끝에 추가

    // 테이블 갱신: prev + firstChar(code) = 새 항목
    if (prev >= 0 && avail < MAX_CODE) {
      prefix[avail] = prev;
      suffix[avail] = firstChar;
      avail++;
      if ((avail & codeMask) === 0 && codeSize < 12) {
        codeSize++;
        codeMask = (1 << codeSize) - 1;
      }
    }
    prev = code;
  }
  return out;
}

/**
 * GIF 바이트 → {width, height, rgba: Uint8ClampedArray}
 * 지원: 단일 프레임, 팔레트 컬러. 실패/미지원 형식이면 null.
 */
export function decodeGifRgba(buf) {
  if (buf.length < 14 || buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x38) return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  const screenFlags = buf[10];
  let p = 13;

  let gct = null;
  if (screenFlags & 0x80) {
    const gctSize = 1 << ((screenFlags & 0x07) + 1);
    gct = buf.subarray(p, p + gctSize * 3);
    p += gctSize * 3;
  }

  let transparentIdx = -1;
  while (p < buf.length) {
    const b = buf[p];
    if (b === 0x3b) break; // trailer
    if (b === 0x21) {
      const label = buf[p + 1];
      if (label === 0xf9 && buf[p + 2] >= 4 && buf[p + 3] & 0x01) {
        transparentIdx = buf[p + 6]; // GCE: 투명 인덱스
      }
      p += 2;
      while (p < buf.length && buf[p] !== 0) p += buf[p] + 1;
      p++;
    } else if (b === 0x2c) {
      const flags = buf[p + 9];
      const ix = buf.readUInt16LE(p + 1), iy = buf.readUInt16LE(p + 3);
      const iw = buf.readUInt16LE(p + 5), ih = buf.readUInt16LE(p + 7);
      p += 10;
      let palette = gct;
      if (flags & 0x80) {
        const lpSize = 1 << ((flags & 0x07) + 1);
        palette = buf.subarray(p, p + lpSize * 3);
        p += lpSize * 3;
      }
      if (!palette) return null;
      const minSize = buf[p++];
      const indices = lzwDecode(minSize, parseBlocks(buf, p), iw * ih);
      if (!indices) return null;

      const rgba = new Uint8ClampedArray(width * height * 4);
      // 행 순서 (인터레이스 패스)
      const interlaced = !!(flags & 0x40);
      let src = 0;
      for (let pass = 0; pass < (interlaced ? 4 : 1); pass++) {
        const rowStep = interlaced ? [8, 8, 4, 2][pass] : 1;
        const rowStart = interlaced ? [0, 4, 2, 1][pass] : 0;
        for (let y = rowStart; y < ih && src < iw * ih; y += rowStep) {
          const dy = iy + y;
          if (dy >= height) continue;
          for (let x = 0; x < iw; x++) {
            const idx = indices[src++];
            const o = (dy * width + ix + x) * 4;
            rgba[o] = palette[idx * 3];
            rgba[o + 1] = palette[idx * 3 + 1];
            rgba[o + 2] = palette[idx * 3 + 2];
            rgba[o + 3] = idx === transparentIdx ? 0 : 255;
          }
        }
      }
      return { width, height, rgba };
    } else {
      return null; // 알 수 없는 블록
    }
  }
  return null;
}
