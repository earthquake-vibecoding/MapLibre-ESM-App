import type { EEWMessage } from '../models';
import { connectWithRetry, type WsRetryHandle } from './ws-connect';

export class WolfxEewService {
  eewData = $state<EEWMessage | null>(null);
  isEewDismissed = $state(false);

  private wsHandle: WsRetryHandle | null = null;

  connectWebSocket(onEewUpdate?: (eew: EEWMessage) => void) {
    if (typeof WebSocket === 'undefined') return;
    this.wsHandle?.disconnect();
    this.wsHandle = connectWithRetry('wss://ws-api.wolfx.jp/jma_eew', {
      name: 'WolfX',
      onMessage: (data) => this.handleMessage(data, onEewUpdate)
    });
  }

  private handleMessage(data: any, onEewUpdate?: (eew: EEWMessage) => void): void {
    if (!(data && (data.type === 'jma_eew' || data.Title || data.Hypocenter || data.CodeType === 'EEW'))) return;
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

    // 시뮬레이션 진행 중에는 실제 수신으로 덮지 않음
    const current = this.eewData;
    if (current && (current as any).isSimulation && Date.now() - ((current as any).simulationStartTime || 0) < 120000) return;

    this.eewData = mappedEew;
    this.isEewDismissed = false;
    onEewUpdate?.(mappedEew);
  }

  disconnect() {
    this.wsHandle?.disconnect();
    this.wsHandle = null;
  }
}

export const wolfxEewService = new WolfxEewService();
