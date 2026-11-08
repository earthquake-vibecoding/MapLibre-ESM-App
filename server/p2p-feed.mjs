// P2PQuake WS 서버 수신 — 클라이언트 직접 연결 폐지.
// 551 지진 소식 → SSE 'quake' 푸시 / 556 EEW → SSE 'eew'(areas 포함 — wolfx보다 지역색칠 정확) + Discord 웹후크.
import { connectWithBackoff } from './ws-feed.mjs';
import { broadcast } from './push.mjs';
import { sendEewReport } from './webhook.mjs';

const P2P_WS = 'wss://api.p2pquake.net/v2/ws';
let eewNonce = null;

/** 556 → 웹후크 바디 — 클라이언트 p2p-quake.svelte.ts mappedEew + reportEew와 동일 기준 */
async function reportEew556(data) {
  const maxScaleFrom = Math.max(...(data.areas?.map(a => a.scaleFrom) || [0]));
  const mapped = {
    serial: data.Serial,
    originTime: data.earthquake?.originTime,
    hypocenter: data.earthquake?.hypocenter?.name || '不明',
    mag: data.earthquake?.hypocenter?.magnitude || 0,
    depth: data.earthquake?.hypocenter?.depth || 0,
    maxIntensity: p2pShortAtLeast(maxScaleFrom),
    isWarn: false,
    isFinal: false
  };
  if (eewNonce) mapped.nonce = eewNonce;
  const res = await sendEewReport(mapped);
  if (res?.nonce) eewNonce = res.nonce;
}

// p2p 진도코드 → 짧은 표기 (P2P 공식 스펙: 45=5弱 50=5強 55=6弱 60=6強 70=7)
const P2P_LEVELS = [[70, '7'], [60, '6強'], [55, '6弱'], [50, '5強'], [45, '5弱'], [40, '4'], [30, '3'], [20, '2'], [10, '1']];
function p2pShortAtLeast(scale) {
  for (const [min, short] of P2P_LEVELS) {
    if (scale >= min) return short;
  }
  return '0';
}

export function startP2pFeed() {
  connectWithBackoff(P2P_WS, {
    name: 'P2P',
    onMessage: data => {
      if (data?.code === 551) {
        broadcast('quake', data);
      } else if (data?.code === 556) {
        broadcast('eew', { kind: 'p2p', data });
        void reportEew556(data).catch(err => console.error('[P2P] EEW 웹후크 실패:', err));
      }
    }
  });
}
