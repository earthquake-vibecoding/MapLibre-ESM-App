import { jmaShortAtLeast } from '../quake/jma-utils';
import { TIMING, KEYS } from '../config';
import { t } from '../i18n/i18n';

export class NotificationService {
  permission = $state<NotificationPermission>('default');
  isEnabled = $state(true);

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
      try {
        const savedEnabled = localStorage.getItem(KEYS.notifyEnabled);
        if (savedEnabled !== null) {
          this.isEnabled = savedEnabled === 'true';
        }
      } catch {
        // ignore storage errors
      }
    } else {
      this.permission = 'denied';
      this.isEnabled = false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      this.permission = res;
      if (res === 'granted') {
        this.setEnabled(true);
        this.sendNotification(t('🔔 지진 알림이 활성화되었습니다'), {
          body: t('흔들림 감지, 지진 정보 및 EEW(긴급지진속보) 발생 시 브라우저 알림을 받게 됩니다.'),
          tag: 'notification-test'
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      return false;
    }
  }

  toggleEnabled(): void {
    const next = !this.isEnabled;
    if (next && this.permission !== 'granted') {
      this.requestPermission();
    } else {
      this.setEnabled(next);
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(KEYS.notifyEnabled, String(enabled));
      } catch {
        // ignore
      }
    }
  }

  sendNotification(title: string, options?: NotificationOptions): Notification | null {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }

    if (!this.isEnabled || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const initOpts: NotificationOptions = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      };
      const notification = new Notification(title, initOpts);

      notification.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus();
        }
        notification.close();
      };

      return notification;
    } catch (e) {
      console.warn('Failed to trigger browser notification:', e);
      return null;
    }
  }

  // 1. EEW (긴급지진속보) 알림
  notifyEew(eew: any): void {
    if (!eew) return;
    const isSim = eew.isSimulation ? t('[모의] ') : '';
    const title = `🚨 ${isSim}${t('EEW 긴급지진속보')}`;
    const location = eew.Hypocenter || t('지진 발생');
    const mag = eew.Magunitude ? `M${eew.Magunitude}` : t('규모 미상');
    const maxInt = eew.MaxIntensity ? t('최대진도 {v}', { v: eew.MaxIntensity }) : '';
    const body = `${t('진원지: {v}', { v: location })} | ${mag} | ${maxInt}\n${t('즉시 안전한 장소로 대피하십시오.')}`;

    this.sendNotification(title, {
      body,
      tag: `eew-${eew.OriginTime || eew.AnnouncedTime || Date.now()}`,
      requireInteraction: true
    });
  }

  // 2. 지진 정보 (P2PQuake / Earthquake Info) 알림
  notifyQuake(quake: any): void {
    if (!quake) return;
    const name = quake.earthquake?.hypocenter?.name || t('지진 정보');
    const mag = quake.earthquake?.hypocenter?.magnitude;
    const magStr = mag !== undefined && mag !== -1 ? `M${mag}` : '';
    const depth = quake.earthquake?.hypocenter?.depth;
    const depthStr = depth !== undefined && depth !== -1 ? t('깊이 {d}km', { d: depth }) : '';
    const maxScale = quake.earthquake?.maxScale;
    const maxScaleStr = maxScale !== undefined && maxScale !== -1 ? t('최대진도 {v}', { v: jmaShortAtLeast(maxScale) }) : '';

    const title = t('📢 신규 지진 정보');
    const details = [name, magStr, depthStr, maxScaleStr].filter(Boolean).join(' | ');
    const body = details ? details : t('새로운 지진 정보가 수신되었습니다.');

    this.sendNotification(title, {
      body,
      tag: `quake-${quake.id || quake.earthquake?.time || Date.now()}`
    });
  }

  private lastShakingNotify = 0;

  // 3. 흔들림 감지 (Shaking Detection) 알림 — 감지 프레임마다 호출되므로 60초 레이트리밋 (도배 방지)
  notifyShakingDetection(intensity: number | string, _locationCount?: number): void {
    const now = Date.now();
    if (now - this.lastShakingNotify < TIMING.notifyGapMs) return;
    this.lastShakingNotify = now;

    const title = t('⚡ 실시간 지진 흔들림 감지');
    const body = t('관측망에서 진도 {v} 수준의 주요 흔들림이 감지되었습니다.', { v: intensity });

    this.sendNotification(title, {
      body,
      tag: 'shaking-alert' // 고정 tag — 60초 간격 갱신이 알림 목록에 쌓이지 않고 교체됨
    });
  }
}

export const notificationService = new NotificationService();
