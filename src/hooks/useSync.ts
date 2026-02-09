import { useEffect, useRef, useCallback } from 'react';
import { UserProgress, Module, Material, Stream, CalendarEvent, ArenaScenario, AppNotification } from '../types';
import { Backend } from '../services/backendService';
import { Storage } from '../services/storage';
import { telegram } from '../services/telegramService';

interface UseSyncOptions {
  userProgressRef: React.MutableRefObject<UserProgress>;
  setModules: (m: Module[]) => void;
  setMaterials: (m: Material[]) => void;
  setStreams: (s: Stream[]) => void;
  setEvents: (e: CalendarEvent[]) => void;
  setScenarios: (s: ArenaScenario[]) => void;
  setNotifications: (n: AppNotification[]) => void;
  setAllUsers: (u: UserProgress[]) => void;
  setUserProgress: React.Dispatch<React.SetStateAction<UserProgress>>;
}

export function useSync(opts: UseSyncOptions) {
  const syncingRef = useRef(false);

  const syncData = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const content = await Backend.fetchAllContent();
      if (content) {
        if (content.modules.length > 0) opts.setModules(content.modules);
        if (content.materials.length > 0) opts.setMaterials(content.materials);
        if (content.streams.length > 0) opts.setStreams(content.streams);
        if (content.events.length > 0) opts.setEvents(content.events);
        if (content.scenarios.length > 0) opts.setScenarios(content.scenarios);
      }
      const rawNotifs = await Backend.fetchNotifications();
      if (rawNotifs.length > 0) {
        const user = opts.userProgressRef.current;
        const myNotifs = rawNotifs.filter(n => {
          if (n.targetUserId && n.targetUserId !== user.telegramId) return false;
          if (n.targetRole && n.targetRole !== 'ALL' && n.targetRole !== user.role) return false;
          return true;
        });
        opts.setNotifications(myNotifs);
      }
      const remoteUsers = await Backend.getLeaderboard();
      if (remoteUsers.length > 0) opts.setAllUsers(remoteUsers);
      const currentUser = opts.userProgressRef.current;
      if (currentUser.isAuthenticated) {
        const freshUser = await Backend.syncUser(currentUser);
        if (freshUser.xp !== currentUser.xp || freshUser.level !== currentUser.level || freshUser.role !== currentUser.role) {
          opts.setUserProgress(prev => ({ ...prev, xp: freshUser.xp, level: freshUser.level, role: freshUser.role }));
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      syncingRef.current = false;
    }
  }, [opts]);

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 120000);
    return () => clearInterval(interval);
  }, [syncData]);

  return { syncData };
}
