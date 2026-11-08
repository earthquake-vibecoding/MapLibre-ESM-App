import { describe, it, expect, beforeEach } from 'vitest';
import { getJindoBadgeStyle, getJindoString, getIntensityColor, getJindoFromColor } from './jma-utils';
import { ui } from '../state.svelte';

describe('jma-utils', () => {
  // 로케일 고정 — node의 navigator.language(en-US)가 loadLocale 기본값을 바꾸지 않게
  beforeEach(() => {
    ui.locale = 'ko';
  });

  it('should return correct badge style for JMA scale 70 (진도 7)', () => {
    const style = getJindoBadgeStyle(70);
    expect(style.label).toBe('진도 7');
  });

  it('should format JMA scale strings per P2P spec codes', () => {
    expect(getJindoString(45)).toBe('5弱');
    expect(getJindoString(50)).toBe('5強');
    expect(getJindoString(55)).toBe('6弱');
    expect(getJindoString(60)).toBe('6強');
    expect(getJindoString(70)).toBe('7');
  });

  it('should return intensity color', () => {
    expect(getIntensityColor(70)).toBe('#A00020');
  });

  it('should parse black as -3 jindo', () => {
    expect(getJindoFromColor(0, 0, 0)).toBe(-3);
  });
});
