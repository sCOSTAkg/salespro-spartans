import React from 'react';
import { Outlet } from 'react-router-dom';
import { SmartNav } from '../components/SmartNav';
import { Toast, ToastMessage } from '../components/Toast';
import { useAppState } from '../hooks/useAppState';
import { useSync } from '../hooks/useSync';
import { useTheme } from '../hooks/useTheme';
import { useAutoSave } from '../hooks/useAutoSave';
import { useAuth } from '../hooks/useAuth';
import { Tab } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';

const ROUTE_TO_TAB: Record<string, Tab> = {
  '/': Tab.HOME,
  '/modules': Tab.MODULES,
  '/materials': Tab.MATERIALS,
  '/rating': Tab.RATING,
  '/arena': Tab.ARENA,
  '/streams': Tab.STREAMS,
  '/notebook': Tab.NOTEBOOK,
  '/habits': Tab.HABITS,
  '/profile': Tab.PROFILE,
  '/admin': Tab.ADMIN_DASHBOARD,
};

const TAB_TO_ROUTE: Record<Tab, string> = {
  [Tab.HOME]: '/',
  [Tab.MODULES]: '/modules',
  [Tab.MATERIALS]: '/materials',
  [Tab.RATING]: '/rating',
  [Tab.ARENA]: '/arena',
  [Tab.STREAMS]: '/streams',
  [Tab.NOTEBOOK]: '/notebook',
  [Tab.HABITS]: '/habits',
  [Tab.PROFILE]: '/profile',
  [Tab.ADMIN_DASHBOARD]: '/admin',
};

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useAppState();
  const { syncData } = useSync({
    userProgressRef: state.userProgressRef,
    setModules: state.setModules,
    setMaterials: state.setMaterials,
    setStreams: state.setStreams,
    setEvents: state.setEvents,
    setScenarios: state.setScenarios,
    setNotifications: state.setNotifications,
    setAllUsers: state.setAllUsers,
    setUserProgress: state.setUserProgress,
  });
  const { handleLogin } = useAuth({
    userProgress: state.userProgress,
    setUserProgress: state.setUserProgress,
    syncData,
    addToast: state.addToast,
  });

  useTheme(state.userProgress.theme);
  useAutoSave(state.userProgress);

  const activeTab = ROUTE_TO_TAB[location.pathname] || Tab.HOME;
  const setActiveTab = (tab: Tab) => navigate(TAB_TO_ROUTE[tab] || '/');

  return (
    <div className="flex flex-col h-[100dvh] bg-body text-text-primary transition-colors duration-300 overflow-hidden relative">
      <div className="fixed top-[var(--safe-top)] left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {state.toasts.map(t => (
          <Toast key={t.id} toast={t} onRemove={state.removeToast} onClick={() => state.handleNavigate(t.link)} />
        ))}
      </div>
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative z-10">
        <Outlet context={{ ...state, setActiveTab, handleLogin, syncData }} />
      </main>
      <SmartNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={state.userProgress.role}
        adminSubTab={state.adminSubTab}
        setAdminSubTab={(t) => state.setAdminSubTab(t)}
        isLessonActive={!!state.selectedLessonId}
        onExitLesson={() => state.setSelectedLessonId(null)}
        notifications={state.notifications}
        onClearNotifications={state.handleClearNotifications}
        action={state.navAction}
      />
    </div>
  );
};
