import { useCallback } from 'react';
import { UserProgress } from '../types';
import { Backend } from '../services/backendService';

interface UseAuthOptions {
  userProgress: UserProgress;
  setUserProgress: React.Dispatch<React.SetStateAction<UserProgress>>;
  syncData: () => Promise<void>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function useAuth({ userProgress, setUserProgress, syncData, addToast }: UseAuthOptions) {
  const handleLogin = useCallback(async (userData: any) => {
    addToast('info', 'Синхронизация данных...');
    const tempUser = { ...userProgress, ...userData, isAuthenticated: true };
    const syncedUser = await Backend.syncUser(tempUser);
    setUserProgress(syncedUser);
    Backend.saveUser(syncedUser);
    await syncData();
    addToast('success', 'С возвращением, боец!');
  }, [userProgress, setUserProgress, syncData, addToast]);

  return { handleLogin };
}
