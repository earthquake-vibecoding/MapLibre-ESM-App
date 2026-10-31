import type { EEWMessage } from '../models';

export class WolfxEewService {
  eewData = $state<EEWMessage | null>(null);
  isEewDismissed = $state(false);

  private wolfxWs: WebSocket | null = null;
  private isIntentionalDisconnect = false;

  connectWebSocket(onEewUpdate?: (eew: EEWMessage) => void) {
    if (typeof WebSocket === 'undefined') return;
    // 재접속 시 이전 소켓 잔존 방지
    const old = this.wolfxWs;
    if (old) {
      this.wolfxWs = null;
      try {
        old.onclose = null;
        old.close();
      } catch {
        // ignore
      }
    }
    this.isIntentionalDisconnect = false;
    try {
      const ws = new WebSocket('wss://ws-api.wolfx.jp/jma_eew');
      this.wolfxWs = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === 'jma_eew' || data.Title || data.Hypocenter || data.CodeType === 'EEW')) {
            const mappedEew: EEWMessage = {
              Title: data.Title || (data.isWarn ? '緊急地震速報 (警報)' : '緊急地震速報 (予報)'),
              Issue: { Status: data.Issue?.Status || (data.isFinal ? '最終報' : (data.Serial ? `第${data.Serial}報` : '속보')) },
              OriginTime: data.OriginTime || data.AnnouncedTime,
              ReportTime: data.ReportTime || new Date().toISOString(),
              ReportNum: data.Serial || 1,
              isFinal: !!data.isFinal,
              Hypocenter: data.Hypocenter || '不明',
              Latitude: typeof data.Latitude === 'number' ? data.Latitude : parseFloat(data.Latitude || 0),
              Longitude: typeof data.Longitude === 'number' ? data.Longitude : parseFloat(data.Longitude || 0),
              Magunitude: data.Magunitude || data.Magnitude || 0,
              Depth: typeof data.Depth === 'number' ? data.Depth : parseInt(String(data.Depth || 0).replace(/[^\d]/g, ''), 10),
              MaxIntensity: data.MaxIntensity || '不明',
              isWarn: !!data.isWarn,
              isCancel: !!data.isCancel
            };

            const current = this.eewData;
            if (!(current && (current as any).isSimulation && Date.now() - ((current as any).simulationStartTime || 0) < 120000)) {
              this.eewData = mappedEew;
              this.isEewDismissed = false;
              if (onEewUpdate) {
                onEewUpdate(mappedEew);
              }
            }
          }
        } catch (e) {
          console.warn('WolfX EEW WS parse error', e);
        }
      };

      ws.onclose = () => {
        // 재접속은 setTimeout 사용: 백그라운드 탭에서 rAF가 멈춰도 재접속이 유지되도록
        if (this.wolfxWs !== ws || this.isIntentionalDisconnect) return;
        setTimeout(() => {
          if (!this.isIntentionalDisconnect) {
            this.connectWebSocket(onEewUpdate);
          }
        }, 5000);
      };

      ws.onerror = () => {
        // Silently handle error; onclose will handle reconnection automatically
      };
    } catch (e) {
      console.warn('Failed to connect WolfX WS', e);
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.wolfxWs) {
      this.wolfxWs.close();
      this.wolfxWs = null;
    }
  }
}

export const wolfxEewService = new WolfxEewService();
