import { describe, it, expect } from 'vitest';
import {
  validateDetect, buildDetectEmbed, validateEew, buildEewEmbed, nextEewAction
} from './webhook.mjs';

const detectBody = {
  start: Date.UTC(2026, 10, 7, 3, 0, 0),
  end: Date.UTC(2026, 10, 7, 3, 0, 25),
  count: 3,
  maxJindo: 2.3,
  scaleLabel: '3',
  color: '#00BFFF',
  center: [140.5, 36.1]
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
