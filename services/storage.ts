
import { Logger } from './logger';

// Key prefix to avoid collisions
const PREFIX = 'salesPro_';

class StorageService {
  /**
   * Safe setItem with try-catch for QuotaExceededError
   */
  set<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(`${PREFIX}${key}`, serialized);
      return true;
    } catch (error) {
      // Check if error is QuotaExceededError
      if (error instanceof DOMException && (
          error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          
          Logger.warn(`Storage Quota Exceeded for key: ${key}. Attempting clean save.`);

          // Attempt recovery: If it's an object with potentially heavy fields, strip them
          if (typeof value === 'object' && value !== null) {
             const safeValue = { ...value } as any;
             // Remove common heavy fields
             if ('originalPhoto' in safeValue) delete safeValue.originalPhoto;
             if ('originalPhotoBase64' in safeValue) delete safeValue.originalPhotoBase64;
             if ('avatarUrl' in safeValue && safeValue.avatarUrl?.length > 1000) delete safeValue.avatarUrl; // Keep only if it's a short URL
             
             try {
                localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(safeValue));
                return true;
             } catch (retryError) {
                Logger.error('Critical storage failure even after cleaning', retryError);
             }
          }
      } else {
          Logger.error(`Storage Error for key: ${key}`, error);
      }
      return false;
    }
  }

  /**
   * Get item with type safety
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(`${PREFIX}${key}`);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      Logger.error(`Error reading key: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Remove item
   */
  remove(key: string) {
    localStorage.removeItem(`${PREFIX}${key}`);
  }

  /**
   * Clear all app specific keys
   */
  clear() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    Logger.info('Storage cleared');
  }
}

export const Storage = new StorageService();
