import type { P2PQuakeItem } from '../models';
import { jmaShortAtLeast } from '../quake/jma-utils';
import { TIMING, NET } from '../config';

export class P2pQuakeService {
  p2pQuakeData = $state<P2PQuakeItem | null>(null);
  p2pHistoryList = $state<P2PQuakeItem[]>([]);
  selectedQuake = $state<P2PQuakeItem | null>(null);

  private sortHistory(list: P2PQuakeItem[]): P2PQuakeItem[] {
    return [...list].sort((a, b) => {
      const timeA = a.earthquake?.time || a.time || '';
      const timeB = b.earthquake?.time || b.time || '';
      return timeB.localeCompare(timeA);
    });
  }

  private mergeInitial(existing: P2PQuakeItem[], sortedData: P2PQuakeItem[]): P2PQuakeItem[] {
    if (!existing || existing.length === 0) return sortedData;
    const restIds = new Set(sortedData.map(d => d.id).filter(Boolean));
    const restTimes = new Set(sortedData.map(d => d.time).filter(Boolean));

    const realtimeOnly = existing.filter(item => {
      if (item.id && restIds.has(item.id)) return false;
      if (item.time && restTimes.has(item.time)) return false;
      return true;
    });

    return this.sortHistory([...realtimeOnly, ...sortedData]).slice(0, 100);
  }

  async fetchHistory(offset = 0): Promise<P2PQuakeItem[]> {
    try {
      const res = await fetch(`${NET.p2pHistoryBase}${offset}`);
      if (res.ok) {
        const data: P2PQuakeItem[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const sortedData = this.sortHistory(data);
          if (offset === 0) {
            this.p2pHistoryList = this.mergeInitial(this.p2pHistoryList, sortedData);

            if (this.p2pHistoryList.length > 0 && !this.selectedQuake) {
              this.p2pQuakeData = this.p2pHistoryList[0];
              this.selectedQuake = this.p2pHistoryList[0];
            }
          } else {
            this.p2pHistoryList = this.sortHistory([
              ...this.p2pHistoryList,
              ...sortedData.filter(d => !d.id || !this.p2pHistoryList.some(i => i.id === d.id))
            ]);
          }
          return sortedData;
        }
      }
    } catch (e) {
      console.warn('P2PQuake history fetch error', e);
    }
    return [];
  }

  /** SSE 'quake' 수신 — 구 WS handleMessage 551 분기와 동일 (서버 p2p-feed.mjs가 릴레이) */
  ingest551(data: any, onNewQuake: (d: P2PQuakeItem) => void): void {
    if (data?.code !== 551) return;
    this.p2pQuakeData = data;
    this.selectedQuake = data;

    const filtered = this.p2pHistoryList.filter(item => {
      if (data.id && item.id === data.id) return false;
      if (data.time && item.time === data.time) return false;
      if (data.earthquake?.time && item.earthquake?.time === data.earthquake?.time && item.issue?.type === data.issue?.type) return false;
      return true;
    });
    this.p2pHistoryList = this.sortHistory([data, ...filtered]).slice(0, 100);

    onNewQuake(data);

    setTimeout(() => {
      if (this.p2pQuakeData?.id === data.id) {
        this.p2pQuakeData = null;
      }
    }, TIMING.p2pKeepMs);
  }

  /** SSE 'eew'(kind p2p) 수신 — 구 handleMessage 556 분기와 동일 매핑. 556 외엔 null */
  map556ToEew(data: any): any | null {
    if (data?.code !== 556) return null;
    const maxScaleFrom = Math.max(...(data.areas?.map((a: any) => a.scaleFrom) || [0]));

    return {
      Title: '緊急地震速報 (P2P)',
      Issue: { Status: '通常' },
      AnnouncedTime: data.time,
      OriginTime: data.earthquake?.originTime,
      Hypocenter: data.earthquake?.hypocenter?.name || '不明',
      Latitude: data.earthquake?.hypocenter?.latitude || 0,
      Longitude: data.earthquake?.hypocenter?.longitude || 0,
      Depth: data.earthquake?.hypocenter?.depth || 0,
      Magunitude: data.earthquake?.hypocenter?.magnitude || 0,
      MaxIntensity: jmaShortAtLeast(maxScaleFrom),
      areas: data.areas ?? [], // 예보구역 — buildAreaScaleMap이 이걸로 지역 색칠 (누락 시 EEW 지역 색칠이 죽음)
      isWarn: false,
      isCancel: false
    };
  }
}

export const p2pQuakeService = new P2pQuakeService();
