import type { P2PQuakeItem, ProcessedHistoryItem } from './models';
import { isUnknownQuake } from './quake-utils';

export function groupHistoryList(list: P2PQuakeItem[], groupUnknown: boolean): ProcessedHistoryItem[] {
  if (!groupUnknown || !list || list.length === 0) {
    return list.map(item => ({ isGroup: false, item }));
  }

  const result: ProcessedHistoryItem[] = [];
  let currentGroup: P2PQuakeItem[] = [];

  const createGroupEntry = (group: P2PQuakeItem[]): ProcessedHistoryItem => {
    if (group.length === 1) {
      return { isGroup: false, item: group[0] };
    }
    const maxScale = Math.max(...group.map(g => g.earthquake?.maxScale ?? -1));
    const informativeItem = group.find(g => !isUnknownQuake(g)) || group[0];
    const primaryItem = group[0];
    const groupKey = `group-${primaryItem.id || primaryItem.earthquake?.time || primaryItem.time || Math.random()}`;
    return {
      isGroup: true,
      groupKey,
      items: [...group],
      latestItem: informativeItem,
      maxScale
    };
  };

  for (const item of list) {
    const itemTime = item.earthquake?.time || item.time;
    if (!itemTime) {
      if (currentGroup.length > 0) {
        result.push(createGroupEntry(currentGroup));
        currentGroup = [];
      }
      result.push({ isGroup: false, item });
      continue;
    }

    if (currentGroup.length === 0) {
      currentGroup.push(item);
    } else {
      const groupTime = currentGroup[0].earthquake?.time || currentGroup[0].time;
      if (itemTime === groupTime) {
        currentGroup.push(item);
      } else {
        result.push(createGroupEntry(currentGroup));
        currentGroup = [item];
      }
    }
  }

  if (currentGroup.length > 0) {
    result.push(createGroupEntry(currentGroup));
  }

  return result;
}
