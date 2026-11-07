import { describe, it, expect } from 'vitest';
import {
  validateDetect, buildDetectEmbed, validateEew, buildEewEmbed, nextEewAction, extractPngDataUrl
} from './webhook.mjs';

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

describe('PNG 첨부 검증', () => {
  const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  it('유효 data URL → Buffer', () => {
    const buf = extractPngDataUrl(`data:image/png;base64,${TINY_PNG}`);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
  it('형식 위반/과대 용량 거부', () => {
    expect(extractPngDataUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toBeNull();
    expect(extractPngDataUrl('javascript:alert(1)')).toBeNull();
    expect(extractPngDataUrl(undefined)).toBeNull();
    expect(extractPngDataUrl(`data:image/png;base64,${'A'.repeat(1_000_000)}`)).toBeNull();
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

describe('EEW 메시지 병합', () => {
  const last = { id: '123', originTime: '2026/11/07 12:00:00' };
  it('같은 지진 후속 보는 patch, 새 지진/첫 보는 post', () => {
    expect(nextEewAction(last, '2026/11/07 12:00:00')).toBe('patch');
    expect(nextEewAction(last, '2026/11/07 13:00:00')).toBe('post');
    expect(nextEewAction(null, '2026/11/07 12:00:00')).toBe('post');
  });
});
