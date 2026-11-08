// wolfx EEW WS 서버 수신 — 클라이언트 직접 연결 폐지. 수신 → SSE 'eew' 푸시 + Discord 웹후크.
// 필터/바디는 클라이언트 wolfx-eew.svelte.ts + services/webhook.ts reportEew와 동일 기준.
import { connectWithBackoff } from './ws-feed.mjs';
import { broadcast } from './push.mjs';
import { sendEewReport } from './webhook.mjs';

const WOLFX_WS = 'wss://ws-api.wolfx.jp/jma_eew';
let eewNonce = null; // 서버 발급 nonce — 후속 보 PATCH 병합용

async function reportEew(data) {
  if (!data || data.isCancel || data.isSimulation) return;
  const body = {
    serial: data.Serial,
    originTime: data.OriginTime || data.AnnouncedTime,
    hypocenter: data.Hypocenter,
    mag: data.Magunitude ?? data.Magnitude,
    depth: typeof data.Depth === 'number' ? data.Depth : parseInt(String(data.Depth || 0).replace(/[^\d]/g, ''), 10),
    maxIntensity: data.MaxIntensity,
    isWarn: data.isWarn === true,
    isFinal: data.isFinal === true
  };
  if (eewNonce) body.nonce = eewNonce;
  const res = await sendEewReport(body);
  if (res?.nonce) eewNonce = res.nonce;
}

export function startEewFeed() {
  connectWithBackoff(WOLFX_WS, {
    name: 'EEW',
    onMessage: data => {
      // 클라이언트 wolfx-eew handleMessage 필터와 동일
      if (!(data && (data.type === 'jma_eew' || data.Title || data.Hypocenter || data.CodeType === 'EEW'))) return;
      broadcast('eew', { kind: 'wolfx', data });
      void reportEew(data).catch(err => console.error('[EEW] 웹후크 실패:', err));
    }
  });
}
