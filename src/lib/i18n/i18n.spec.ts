import { describe, it, expect, beforeEach } from 'vitest';
import { t } from './i18n';
import { ui } from '../state.svelte';

describe('t()', () => {
  beforeEach(() => {
    ui.locale = 'ko';
  });

  it('ko → 원문 그대로 (사전 없음)', () => {
    expect(t('진도')).toBe('진도');
    expect(t('{n}건', { n: 5 })).toBe('5건');
  });

  it('en/ja 사전 조회', () => {
    ui.locale = 'en';
    expect(t('진도')).toBe('Intensity');
    ui.locale = 'ja';
    expect(t('진도')).toBe('震度');
  });

  it('파라미터 치환은 번역 후 적용', () => {
    ui.locale = 'en';
    expect(t('{n}건', { n: 7 })).toBe('7 events');
    expect(t('깊이 {d}km', { d: 30 })).toBe('Depth 30km');
  });

  it('사전에 없는 키 → 원문 fallback (치환은 유지)', () => {
    ui.locale = 'en';
    expect(t('없는 키 {n}', { n: 3 })).toBe('없는 키 3');
  });

  it('이미 일본어인 키는 ja에서 원문 노출 (5弱)', () => {
    ui.locale = 'ja';
    expect(t('5弱')).toBe('5弱');
    ui.locale = 'en';
    expect(t('5弱')).toBe('5-');
  });
});
