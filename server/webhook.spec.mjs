import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { validateDetect, buildDetectEmbed, validateEew, buildEewEmbed } from './webhook.mjs';
import { encodePng, drawDetectBounds } from './png-encode.mjs';

const detectBody = {
  start: Date.UTC(2026, 10, 7, 3, 0, 0),
  end: Date.UTC(2026, 10, 7, 3, 0, 25),
  count: 3,
  maxJindo: 2.3,
  scaleLabel: '3',
  color: '#00BFFF',
  center: [140.5, 36.1],
  top: { name: '大阪', region: '大阪府', jindo: 2.3 }
};

describe('detect 임베드', () => {
  it('유효 바디 → 임베드 조립 (색/관츙소 수/JST 시각)', () => {
    const v = validateDetect(detectBody);
    expect(v).not.toBeNull();
    const e = buildDetectEmbed(v);
    expect(e.title).toContain('흔들림 감지');
    expect(e.color).toBe(0x00bfff);
    expect(e.fields.some(f => f.value.includes('3개소'))).toBe(true);
    // UTC 03:00 + 9h = JST 12:00
    expect(e.fields.some(f => f.value.includes('12:00:00'))).toBe(true);
    expect(e.fields.some(f => f.value.includes('36.10'))).toBe(true);
  });

  it('top 관측소/데이터 소스 필드 조립', () => {
    const e = buildDetectEmbed(validateDetect(detectBody));
    const topField = e.fields.find(f => f.name === '감지 격자 관측소');
    expect(topField.value).toContain('大阪府 大阪');
    expect(topField.value).toContain('2.3');
    expect(e.fields.some(f => f.value === '강진모니터(K-moni)')).toBe(true);
  });

  it('top 누락 허용, 이름만 있으면 채택', () => {
    expect(buildDetectEmbed(validateDetect({ ...detectBody, top: null })).fields.some(f => f.name === '감지 격자 관측소')).toBe(false);
    const v = validateDetect({ ...detectBody, top: { name: 'X' } });
    expect(buildDetectEmbed(v).fields.some(f => f.name === '감지 격자 관측소')).toBe(true);
  });

  it('중심 좌표 누락 허용', () => {
    const v = validateDetect({ ...detectBody, center: undefined });
    expect(v?.center).toBeNull();
    expect(buildDetectEmbed(v).fields.some(f => f.name === '중심(위도, 경도)')).toBe(false);
  });

  it('필수 숫자 누락/색상 포맷 위반 처리', () => {
    expect(validateDetect({ ...detectBody, maxJindo: 'x' })).toBeNull();
    expect(validateDetect(null)).toBeNull();
    const v = validateDetect({ ...detectBody, color: 'javascript:alert(1)' });
    expect(buildDetectEmbed(v).color).toBe(0x95a5a6);
  });
});

describe('감지 스냅샷 합성 (png-encode)', () => {
  it('RGBA → PNG 서명 + inflate 역검증 + 빨간 박스 반영', () => {
    const W = 64, H = 48;
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = i % 256; rgba[i * 4 + 1] = 10; rgba[i * 4 + 2] = 20; rgba[i * 4 + 3] = 255;
    }
    drawDetectBounds(rgba, W, H, [{ x: 20, y: 20 }]);
    const png = encodePng(rgba, W, H);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // 청크 파싱: IHDR 이후 IDAT 전부 → inflate → filter 바이트(0) 제외하고 원본 RGBA와 일치
    const idat = [];
    let p = 8;
    while (p < png.length) {
      const len = png.readUInt32BE(p);
      const type = png.toString('ascii', p + 4, p + 8);
      if (type === 'IDAT') idat.push(png.subarray(p + 8, p + 8 + len));
      p += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    expect(raw.length).toBe(H * (W * 4 + 1));
    const red = [0xff, 0x20, 0x20];
    let rectRed = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = y * (W * 4 + 1) + 1 + x * 4;
        expect([raw[o], raw[o + 1], raw[o + 2]]).toEqual(
          [rgba[(y * W + x) * 4], rgba[(y * W + x) * 4 + 1], rgba[(y * W + x) * 4 + 2]]
        );
        if (raw[o] === red[0] && raw[o + 1] === red[1] && raw[o + 2] === red[2]) rectRed++;
      }
    }
    expect(rectRed).toBeGreaterThan(0); // 사각형이 그려졌는지
  });

  it('drawDetectBounds — 감지 점들 전체를 감싸는 바운딩 박스 외곽선을 그린다', () => {
    const W = 64, H = 48;
    const rgba = new Uint8ClampedArray(W * H * 4);
    drawDetectBounds(rgba, W, H, [{ x: 10, y: 10 }, { x: 40, y: 30 }]);
    const red = [0xff, 0x20, 0x20];
    const at = (x, y) => [rgba[(y * W + x) * 4], rgba[(y * W + x) * 4 + 1], rgba[(y * W + x) * 4 + 2]];

    expect(at(10, 2)).toEqual(red);   // 최소 점(10,10)에서 패딩 8px 밖 — 박스 상단 외곽선
    expect(at(10, 38)).toEqual(red);  // 최대 점(40,30) + 패딩 8px — 박스 하단 외곽선
    expect(at(25, 20)).toEqual([0, 0, 0]); // 두 점 사이 박스 내부는 미표기
  });
});

describe('eew 임베드', () => {
  const eewBody = {
    serial: 2,
    originTime: '2026/11/07 12:00:00',
    hypocenter: '테스트 해역',
    mag: 5.1,
    depth: 10,
    maxIntensity: '4',
    isWarn: true,
    isFinal: false
  };

  it('경보 태그/규모/깊이 필드 조립', () => {
    const v = validateEew(eewBody);
    expect(v).not.toBeNull();
    const e = buildEewEmbed(v);
    expect(e.title).toContain('제2보');
    expect(e.title).toContain('경보');
    expect(e.color).toBe(0xe74c3c);
    expect(e.fields.some(f => f.value.includes('M5.1'))).toBe(true);
  });

  it('최종보 태그', () => {
    const e = buildEewEmbed(validateEew({ ...eewBody, isFinal: true, isWarn: false }));
    expect(e.title).toContain('최종보');
  });

  it('진원지/OriginTime 없으면 거부 (PATCH 병합 키 보호)', () => {
    expect(validateEew({ ...eewBody, hypocenter: '  ' })).toBeNull();
    expect(validateEew({ ...eewBody, originTime: undefined })).toBeNull();
    expect(validateEew(null)).toBeNull();
  });
});

describe('EEW 병합 키 보호', () => {
  it('originTime 없으면 거부 — PATCH 병합 키라 필수', () => {
    expect(validateEew({ serial: 1, hypocenter: 'x', originTime: undefined })).toBeNull();
  });
});
