import type { P2PQuakeItem } from '../models';
import { scaleToJmaString } from '../quake-utils';
import { connectWithRetry, type WsRetryHandle } from './ws-connect';
import { TIMING } from '../config';

export class P2pQuakeService {
  p2pQuakeData = $state<P2PQuakeItem | null>(null);
  p2pHistoryList = $state<P2PQuakeItem[]>([]);
  selectedQuake = $state<P2PQuakeItem | null>(null);

  private wsHandle: WsRetryHandle | null = null;

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
      const res = await fetch(`https://api.p2pquake.net/v2/history?codes=551&limit=100&offset=${offset}`);
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

  connectWebSocket(
    onNewQuake: (data: P2PQuakeItem) => void,
    onEewReceived: (mappedEew: any) => void
  ) {
    if (typeof WebSocket === 'undefined') return;
    this.wsHandle?.disconnect();
    this.wsHandle = connectWithRetry('wss://api.p2pquake.net/v2/ws', {
      name: 'P2P',
      onOpen: () => console.log('P2P WebSocket connected successfully'),
      onMessage: (data) => this.handleMessage(data, onNewQuake, onEewReceived)
    });
  }

  private handleMessage(data: any, onNewQuake: (d: P2PQuakeItem) => void, onEewReceived: (e: any) => void): void {
    if (data.code === 551) {
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
    } else if (data.code === 556) {
      const maxScaleFrom = Math.max(...(data.areas?.map((a: any) => a.scaleFrom) || [0]));

      const mappedEew = {
        Title: '緊急地震速報 (P2P)',
        Issue: { Status: '通常' },
        AnnouncedTime: data.time,
        OriginTime: data.earthquake?.originTime,
        Hypocenter: data.earthquake?.hypocenter?.name || '不明',
        Latitude: data.earthquake?.hypocenter?.latitude || 0,
        Longitude: data.earthquake?.hypocenter?.longitude || 0,
        Depth: data.earthquake?.hypocenter?.depth || 0,
        Magunitude: data.earthquake?.hypocenter?.magnitude || 0,
        MaxIntensity: scaleToJmaString(maxScaleFrom),
        areas: data.areas ?? [], // 예보구역 — buildAreaScaleMap이 이걸로 지역 색칠 (누락 시 EEW 지역 색칠이 죽음)
        isWarn: false,
        isCancel: false
      };

      onEewReceived(mappedEew);
    }
  }

  disconnect() {
    this.wsHandle?.disconnect();
    this.wsHandle = null;
  }
}

export const p2pQuakeService = new P2pQuakeService();
