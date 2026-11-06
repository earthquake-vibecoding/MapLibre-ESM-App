import { TIMING } from '../config';

/** USGS 글로벌 지진 — 해외지진 탭용 */
export interface OverseasQuake {
  id: string;
  mag: number;
  place: string;
  time: number; // epoch ms
  depth: number; // km
  lonlat: [number, number];
}

// 일본 본토+근해 — p2p 피드가 커버하므로 해외 목록에서 제외
const JAPAN_BBOX = { lonMin: 123, lonMax: 146, latMin: 24, latMax: 46 };
const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
const MAX_ITEMS = 60;

export class UsgsService {
  quakes = $state<OverseasQuake[]>([]);
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetchLatest(): Promise<void> {
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) return;
      const feed: any = await res.json();
      const list: OverseasQuake[] = (feed?.features ?? [])
        .filter((f: any) => f.properties?.type === 'earthquake' && typeof f.properties?.mag === 'number')
        .filter((f: any) => {
          const [lon, lat] = f.geometry?.coordinates ?? [];
          // 좌표 누락 feature 제외 — 통과시키면 아래 map에서 TypeError로 피드 전체 갱신이 죽음
          if (typeof lon !== 'number' || typeof lat !== 'number') return false;
          return !(lon >= JAPAN_BBOX.lonMin && lon <= JAPAN_BBOX.lonMax && lat >= JAPAN_BBOX.latMin && lat <= JAPAN_BBOX.latMax);
        })
        .map((f: any) => ({
          id: String(f.id),
          mag: f.properties.mag,
          place: f.properties.place ?? '',
          time: f.properties.time,
          depth: f.geometry?.coordinates?.[2] ?? 0,
          lonlat: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number]
        }));
      this.quakes = list.sort((a, b) => b.time - a.time).slice(0, MAX_ITEMS);
    } catch (e) {
      console.warn('USGS feed fetch error', e);
    }
  }

  start(): void {
    this.stop();
    this.fetchLatest();
    this.timer = setInterval(() => this.fetchLatest(), TIMING.usgsPollMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const usgsService = new UsgsService();
