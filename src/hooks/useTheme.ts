import { useEffect } from 'react';
import { AppTheme } from '../types';
import { telegram } from '../services/telegramService';

export function useTheme(theme: AppTheme) {
  useEffect(() => {
    const root = document.documentElement;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (theme === 'DARK') {
      root.classList.add('dark');
      telegram.setBackgroundColor('#000000');
      telegram.setHeaderColor('#000000');
      themeMeta?.setAttribute('content', '#000000');
    } else {
      root.classList.remove('dark');
      telegram.setBackgroundColor('#F2F2F7');
      telegram.setHeaderColor('#F2F2F7');
      themeMeta?.setAttribute('content', '#F2F2F7');
    }
  }, [theme]);
}
