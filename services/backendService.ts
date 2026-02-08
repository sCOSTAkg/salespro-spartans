
import { Storage } from './storage';
import { UserProgress, Module, Material, Stream, CalendarEvent, ArenaScenario, AppNotification, AppConfig } from '../types';
import { Logger } from './logger';
import { COURSE_MODULES, MOCK_EVENTS, MOCK_MATERIALS, MOCK_STREAMS } from '../constants';
import { SCENARIOS } from '../components/SalesArena';
import { airtable } from './airtableService';

type ContentTable = 'modules' | 'materials' | 'streams' | 'events' | 'scenarios' | 'notifications' | 'app_settings';

const SYNC_CHANNEL_NAME = 'salespro_sync_channel';

class BackendService {
  private channel: BroadcastChannel;

  constructor() {
      this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }

  public onSync(callback: () => void) {
      this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_UPDATE') {
              callback();
          }
      };
  }

  private notifySync() {
      this.channel.postMessage({ type: 'SYNC_UPDATE', timestamp: Date.now() });
  }
  
  // --- USER SYNC ---

  async syncUser(localUser: UserProgress): Promise<UserProgress> {
    try {
        const syncedUser = await airtable.syncUser(localUser);
        if (JSON.stringify(syncedUser) !== JSON.stringify(localUser)) {
             this.saveUserLocal(syncedUser);
             return syncedUser;
        }
        return localUser;
    } catch (e) {
        Logger.warn('Backend: User Sync failed, using local.', e);
        return localUser;
    }
  }

  async saveUser(user: UserProgress) {
      const updatedUser = { ...user, lastSyncTimestamp: Date.now() };
      this.saveUserLocal(updatedUser);
      airtable.syncUser(updatedUser).then(synced => {
          if (synced.airtableRecordId !== updatedUser.airtableRecordId) {
              this.saveUserLocal(synced);
          }
      }).catch(e => Logger.error("BG Sync Error", e));
  }

  private saveUserLocal(user: UserProgress) {
    Storage.set('progress', user);
    const allUsers = Storage.get<UserProgress[]>('allUsers', []);
    const idx = allUsers.findIndex(u => u.telegramId === user.telegramId);
    const newAllUsers = [...allUsers];
    if (idx >= 0) newAllUsers[idx] = user;
    else newAllUsers.push(user);
    Storage.set('allUsers', newAllUsers);
    this.notifySync(); 
  }

  // --- CONFIG SYNC ---

  async fetchGlobalConfig(defaultConfig: AppConfig): Promise<AppConfig> {
      try {
          const remoteConfig = await airtable.getConfigRecord();
          if (remoteConfig) {
              Storage.set('appConfig', remoteConfig);
              return remoteConfig;
          }
      } catch (e) {
          Logger.warn('Config fetch failed');
      }
      return Storage.get('appConfig', defaultConfig);
  }

  async saveGlobalConfig(config: AppConfig) {
      Storage.set('appConfig', config);
      this.notifySync();
      await airtable.saveConfig(config);
  }

  // --- CONTENT SYNC (READ) ---

  async fetchAllContent() {
      // Parallel fetch from Airtable
      try {
          const [mods, mats, strs, evts, scens] = await Promise.all([
              airtable.getModulesWithLessons(), // Use new relational fetch
              airtable.getMaterials(),
              airtable.getStreams(),
              airtable.getEvents(),
              airtable.getScenarios()
          ]);

          // Prefer Airtable data if available, otherwise fallback to LocalStorage, then Constants
          const content = {
              modules: mods.length > 0 ? mods : Storage.get('courseModules', COURSE_MODULES),
              materials: mats.length > 0 ? mats : Storage.get('materials', MOCK_MATERIALS),
              streams: strs.length > 0 ? strs : Storage.get('streams', MOCK_STREAMS),
              events: evts.length > 0 ? evts : Storage.get('events', MOCK_EVENTS),
              scenarios: scens.length > 0 ? scens : Storage.get('scenarios', SCENARIOS),
          };

          // Cache everything locally
          Storage.set('courseModules', content.modules);
          Storage.set('materials', content.materials);
          Storage.set('streams', content.streams);
          Storage.set('events', content.events);
          Storage.set('scenarios', content.scenarios);

          return content;

      } catch (e) {
          Logger.warn('Airtable Content Sync failed completely', e);
          return null; // Let App use existing state
      }
  }

  // --- CONTENT SYNC (WRITE) ---

  async saveCollection<T extends { id: string }>(table: ContentTable, items: T[]) {
      // 1. Update LocalStorage immediately for UI responsiveness
      const storageKeyMap: Partial<Record<ContentTable, string>> = {
          'modules': 'courseModules',
          'materials': 'materials',
          'streams': 'streams',
          'events': 'events',
          'scenarios': 'scenarios',
          'notifications': 'local_notifications'
      };
      const key = storageKeyMap[table];
      if (key) {
          Storage.set(key, items);
          this.notifySync();
      }

      // 2. Push to Airtable
      try {
          for (const item of items) {
              switch (table) {
                  case 'modules': await airtable.saveModule(item as unknown as Module); break;
                  case 'materials': await airtable.saveMaterial(item as unknown as Material); break;
                  case 'streams': await airtable.saveStream(item as unknown as Stream); break;
                  case 'events': await airtable.saveEvent(item as unknown as CalendarEvent); break;
                  case 'scenarios': await airtable.saveScenario(item as unknown as ArenaScenario); break;
                  case 'notifications': await airtable.saveNotification(item as unknown as AppNotification); break;
              }
          }
      } catch (e) {
          Logger.error(`Failed to push collection ${table} to Airtable`, e);
      }
  }

  // --- NOTIFICATIONS ---

  async fetchNotifications(): Promise<AppNotification[]> {
      const remote = await airtable.getNotifications();
      if (remote.length > 0) {
          Storage.set('local_notifications', remote);
          return remote;
      }
      return Storage.get<AppNotification[]>('local_notifications', []);
  }

  async sendBroadcast(notification: AppNotification) {
      const current = Storage.get<AppNotification[]>('local_notifications', []);
      Storage.set('local_notifications', [notification, ...current]);
      this.notifySync();
      await airtable.saveNotification(notification);
  }

  // --- CRM ---

  async getLeaderboard(): Promise<UserProgress[]> {
     try {
         const users = await airtable.getAllUsers();
         if (users.length > 0) {
             Storage.set('allUsers', users);
             return users;
         }
     } catch (e) {
         Logger.warn('Failed to fetch leaderboard');
     }
     return Storage.get<UserProgress[]>('allUsers', []);
  }
}

export const Backend = new BackendService();
