import { useEffect } from 'react';
import { UserProgress } from '../types';
import { Storage } from '../services/storage';
import { Backend } from '../services/backendService';

export function useAutoSave(userProgress: UserProgress) {
  useEffect(() => {
    Storage.set('progress', userProgress);
    const timer = setTimeout(() => {
      if (userProgress.isAuthenticated) Backend.saveUser(userProgress);
    }, 2000);
    return () => clearTimeout(timer);
  }, [userProgress]);
}
