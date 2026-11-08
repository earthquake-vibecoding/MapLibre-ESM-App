// 수제 i18n — 한국어 원문을 키로 쓰는 3개국어(ko/en/ja) 사전 조회 (외부 의존성 0).
// t()가 ui.locale($state)을 읽으므로 템플릿/이펙트 안에서 자동 반응형.
// 사전에 없는 키는 한국어 원문 그대로 반환(우아한 저하).
import { ui } from '../state.svelte';
import type { Locale } from '../state.svelte';
import { DICT_EN } from './dict-en';
import { DICT_JA } from './dict-ja';

export type { Locale };

const DICTS: Record<Exclude<Locale, 'ko'>, Record<string, string>> = { en: DICT_EN, ja: DICT_JA };

export function t(key: string, params?: Record<string, string | number | undefined>): string {
  const dict = DICTS[ui.locale as Exclude<Locale, 'ko'>];
  let out = (ui.locale !== 'ko' && dict[key]) || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}
