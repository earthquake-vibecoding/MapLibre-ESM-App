import { p2pQuakeService } from './services/p2p-quake.svelte';
import { wolfxEewService } from './services/wolfx-eew.svelte';
import { notificationService } from './services/notification.svelte';
import { soundService } from './services/sound';
import { ui } from './state.svelte';
import { getQuakeUniqueKey } from './quake-utils';
import { focusOnEarthquake } from './focus';
import type { AppController } from './app-controller';

let lastSeenQuakeId: string | null = null;

export interface QuakeFeedHandlers {
  onInitialQuake: (item: any) => void;
  onNewQuake: (item: any) => void;
  onEew: (mappedEew: any) => void;
}

export function createFeedHandlers(c: AppController): QuakeFeedHandlers {
  return {
    onInitialQuake: (item) => {
      c.updateEpicenter(item);
      c.updateAreaIntensity(item);
      c.setTab('earthquake');
    },
    onNewQuake: (data) => handleNewQuake(c, data),
    onEew: (mappedEew) => handleEew(c, mappedEew)
  };
}

function handleNewQuake(c: AppController, data: any): void {
  soundService.playShindoAudio(data.earthquake?.maxScale);
  notificationService.notifyQuake(data);
  c.setTab('earthquake');
  c.updateEpicenter(data);
  c.updateAreaIntensity(data);
  focusOnEarthquake(c.mapCtl, data, c.areaData?.areaForecastGeoJSON);
}

function handleEew(c: AppController, mappedEew: any): void {
  if (!mappedEew) return;
  const eewKey = `${mappedEew.AnnouncedTime || ''}_${mappedEew.OriginTime || ''}_${mappedEew.Hypocenter || ''}_${mappedEew.MaxIntensity || ''}`;
  const now = Date.now();

  wolfxEewService.eewData = mappedEew;
  wolfxEewService.isEewDismissed = false;
  c.updateEpicenter();
  c.updateAreaIntensity(mappedEew);
  c.updateVisibility();

  if (eewKey !== c.lastEewKey || (now - c.lastEewTime > 10000)) {
    c.lastEewKey = eewKey;
    c.lastEewTime = now;
    soundService.playShindoAudio(mappedEew.MaxIntensity);
    notificationService.notifyEew(mappedEew);
  }
}

export async function startQuakeFeed(handlers: QuakeFeedHandlers): Promise<void> {
  ui.historyOffset = 0;
  const history = await p2pQuakeService.fetchHistory(0);
  if (history.length > 0) {
    const latest = history[0];
    lastSeenQuakeId = getQuakeUniqueKey(latest);
    p2pQuakeService.selectedQuake = latest;
    handlers.onInitialQuake(latest);
  }

  p2pQuakeService.connectWebSocket(
    (data) => {
      const newKey = getQuakeUniqueKey(data);
      if (newKey && newKey !== lastSeenQuakeId) {
        lastSeenQuakeId = newKey;
        p2pQuakeService.selectedQuake = data;
        handlers.onNewQuake(data);
      }
    },
    (mappedEew) => handlers.onEew(mappedEew)
  );

  wolfxEewService.connectWebSocket((_mappedEew) => handlers.onEew(_mappedEew));

  if (typeof window !== 'undefined') {
    setInterval(async () => {
      const updatedHistory = await p2pQuakeService.fetchHistory(0);
      if (updatedHistory.length > 0) {
        const newest = updatedHistory[0];
        const newKey = getQuakeUniqueKey(newest);
        if (newKey && newKey !== lastSeenQuakeId) {
          lastSeenQuakeId = newKey;
          p2pQuakeService.selectedQuake = newest;
          handlers.onNewQuake(newest);
        }
      }
    }, 20000);
  }
}
