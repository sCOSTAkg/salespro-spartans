

// Wrapper for Telegram WebApp API
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        version: string;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        showPopup: (params: {
            title?: string;
            message: string;
            buttons?: { id?: string; type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }[]
        }, callback?: (button_id: string) => void) => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: any;
        isExpanded: boolean;
        viewportHeight: number;
        platform: string;
      };
    };
  }
}

class TelegramService {
  private webApp = window.Telegram?.WebApp;

  constructor() {
    if (this.webApp) {
      this.webApp.ready();
      try {
        this.webApp.expand(); // Always try to expand to full height
      } catch (e) {
        console.error('Telegram expand failed', e);
      }
    }
  }

  get isAvailable() {
    return !!this.webApp;
  }

  get user() {
    return this.webApp?.initDataUnsafe?.user;
  }

  get platform() {
      return this.webApp?.platform || 'unknown';
  }

  get version() {
      return this.webApp?.version || '6.0';
  }

  isVersionAtLeast(minVersion: string): boolean {
    if (!this.webApp) return false;
    const [vMajor, vMinor] = this.webApp.version.split('.').map(Number);
    const [minMajor, minMinor] = minVersion.split('.').map(Number);
    
    if (vMajor > minMajor) return true;
    if (vMajor === minMajor && vMinor >= minMinor) return true;
    return false;
  }

  // Haptic Feedback
  haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') {
    if (!this.webApp) return;
    // HapticFeedback is supported in version 6.1+
    if (!this.isVersionAtLeast('6.1')) return;

    try {
      switch (type) {
        case 'light':
        case 'medium':
        case 'heavy':
          this.webApp.HapticFeedback.impactOccurred(type);
          break;
        case 'success':
        case 'error':
        case 'warning':
          this.webApp.HapticFeedback.notificationOccurred(type);
          break;
        case 'selection':
          this.webApp.HapticFeedback.selectionChanged();
          break;
      }
    } catch (e) {
      console.error('Haptic feedback error', e);
    }
  }

  // Alert Popup
  showAlert(message: string, title: string = 'Info') {
      // showPopup is supported in version 6.2+
      if (this.webApp && this.isVersionAtLeast('6.2')) {
          try {
            this.webApp.showPopup({
                title,
                message,
                buttons: [{ type: 'ok' }]
            });
          } catch (e) {
            console.error('Show popup error', e);
            alert(`${title}\n\n${message}`);
          }
      } else {
          // Fallback for older versions or web
          alert(`${title}\n\n${message}`);
      }
  }

  // Close the Mini App
  close() {
    this.webApp?.close();
  }

  setHeaderColor(color: string) {
    this.webApp?.setHeaderColor?.(color);
  }

  setBackgroundColor(color: string) {
    this.webApp?.setBackgroundColor?.(color);
  }
}

export const telegram = new TelegramService();