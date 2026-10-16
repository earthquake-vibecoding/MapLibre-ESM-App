import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// 원본 Angular 마크업과 동일한 마우스 전용 패널(drag handle, GIF 확대 등)이라
// 키보드 접근성 경고는 의도적 오버라이드 — 필터링
const IGNORED = new Set([
  'a11y_click_events_have_key_events',
  'a11y_no_static_element_interactions',
  'a11y_no_noninteractive_element_interactions',
  'a11y_consider_explicit_label',
]);

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    if (IGNORED.has(warning.code)) return;
    handler(warning);
  },
};
