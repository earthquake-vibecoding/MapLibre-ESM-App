// esbuild --inject용 — Svelte 5 룬 우회.
// 서버 번들은 state.svelte.ts($state)를 끌어들인다(i18n→state) — --define:$state=__stateShim으로 일반 객체화.
export const __stateShim = (v) => v;
