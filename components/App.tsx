import React, { useState, useEffect } from 'react';
import { Welcome } from './Welcome';
import { Auth } from './Auth';
import { HomeDashboard } from './HomeDashboard';
import { Profile } from './Profile';
import { AdminDashboard } from './AdminDashboard';
import { CuratorDashboard } from './CuratorDashboard';
import { LessonView } from './LessonView';
import { MaterialsView } from './MaterialsView';
import { StreamsView } from './StreamsView';
import { SalesArena } from './SalesArena';
import { CalendarView } from './CalendarView';
import { NotebookView } from './NotebookView';
import { HabitTracker } from './HabitTracker';
import { SmartNav } from './SmartNav';
import { SystemHealthAgent } from './SystemHealthAgent';
import { ChatAssistant } from './ChatAssistant';
import { Toast } from './Toast';
import {
  Tab,
  UserProgress,
  Module,
  Lesson,
  Material,
  Stream,
  CalendarEvent,
  ArenaScenario,
  AppNotification,
  AppConfig
} from '../types';
import { airtable } from '../services/airtableService';
import { Storage } from '../services/storage';
import { Logger } from '../services/logger';
import { telegram } from '../services/telegramService';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.WELCOME);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [adminSubTab, setAdminSubTab] = useState<string>('OVERVIEW');
  const [userProgress, setUserProgress] = useState<UserProgress>(() => {
    const saved = Storage.get<UserProgress>('userProgress');
    return saved || {
      name: 'Гость',
      role: 'STUDENT' as const,
      isAuthenticated: false,
      completedLessonIds: [],
      submittedHomeworks: [],
      xp: 0,
      level: 1,
      chatHistory: [],
      theme: 'DARK' as const,
      notifications: {
        pushEnabled: false,
        telegramSync: false,
        deadlineReminders: true,
        chatNotifications: true
      },
      notebook: [],
      habits: [],
      goals: [],
      stats: {
        storiesPosted: 0,
        questionsAsked: {},
        referralsCount: 0,
        streamsVisited: [],
        homeworksSpeed: {},
        initiativesCount: 0
      },
      telegramId: telegram.user?.id?.toString(),
      telegramUsername: telegram.user?.username
    };
  });

  const [modules, setModules] = useState<Module[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scenarios, setScenarios] = useState<ArenaScenario[]>([]);
  const [allUsers, setAllUsers] = useState<UserProgress[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);

  const syncData = async (showToast = false) => {
    if (!airtable.isConfigured()) {
      Logger.warn('Airtable not configured. Using local data only.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [
        fetchedModules,
        fetchedMaterials,
        fetchedStreams,
        fetchedEvents,
        fetchedScenarios,
        fetchedUsers,
        fetchedNotifications,
        fetchedConfig
      ] = await Promise.all([
        airtable.getModulesWithLessons(),
        airtable.getMaterials(),
        airtable.getStreams(),
        airtable.getEvents(),
        airtable.getScenarios(),
        airtable.getAllUsers(),
        airtable.getNotifications(),
        airtable.getConfigRecord()
      ]);

      setModules(fetchedModules);
      setMaterials(fetchedMaterials);
      setStreams(fetchedStreams);
      setEvents(fetchedEvents);
      setScenarios(fetchedScenarios);
      setAllUsers(fetchedUsers);
      setNotifications(fetchedNotifications);
      if (fetchedConfig) setAppConfig(fetchedConfig);

      if (showToast) showToastMessage('Данные синхронизированы', 'success');
      Logger.info('Data synced from Airtable');
    } catch (error) {
      Logger.error('Failed to sync data', error);
      if (showToast) showToastMessage('Ошибка синхронизации', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { syncData(); }, []);
  useEffect(() => { Storage.set('userProgress', userProgress); }, [userProgress]);
  useEffect(() => {
    if (userProgress.isAuthenticated && airtable.isConfigured()) {
      airtable.syncUser(userProgress).catch(err => Logger.error('Failed to sync user', err));
    }
  }, [userProgress]);

  const showToastMessage = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (username: string, password: string): boolean => {
    if (!username || !password) {
      showToastMessage('Введите имя пользователя и пароль', 'error');
      return false;
    }
    const updatedUser: UserProgress = {
      ...userProgress,
      name: username,
      isAuthenticated: true,
      role: username.toLowerCase() === 'admin' ? 'ADMIN' : 'STUDENT',
      lastSyncTimestamp: Date.now()
    };
    setUserProgress(updatedUser);
    setCurrentTab(Tab.HOME);
    showToastMessage(`Добро пожаловать, ${username}!`, 'success');
    telegram.haptic('success');
    return true;
  };

  const handleLogout = () => {
    setUserProgress({ ...userProgress, isAuthenticated: false, role: 'STUDENT' });
    setCurrentTab(Tab.WELCOME);
    showToastMessage('Вы вышли из системы', 'info');
  };

  const handleSelectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setCurrentTab(Tab.LESSON);
  };

  const handleCompleteLesson = (lessonId: string) => {
    if (!userProgress.completedLessonIds.includes(lessonId)) {
      const newCompletedIds = [...userProgress.completedLessonIds, lessonId];
      const xpGain = 10;
      setUserProgress({
        ...userProgress,
        completedLessonIds: newCompletedIds,
        xp: userProgress.xp + xpGain,
        level: Math.floor((userProgress.xp + xpGain) / 100) + 1,
        lastSyncTimestamp: Date.now()
      });
      showToastMessage(`Урок завершён! +${xpGain} XP`, 'success');
      telegram.haptic('success');
    }
  };

  const handleUpdateUser = (data: Partial<UserProgress>) => {
    setUserProgress({ ...userProgress, ...data });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Загрузка...</div>
        </div>
      );
    }

    switch (currentTab) {
      case Tab.WELCOME: return <Welcome onStart={() => setCurrentTab(Tab.AUTH)} />;
      case Tab.AUTH: return <Auth onLogin={handleLogin} onBack={() => setCurrentTab(Tab.WELCOME)} />;
      case Tab.HOME:
        return (
          <HomeDashboard
            onNavigate={setCurrentTab}
            userProgress={userProgress}
            onProfileClick={() => setCurrentTab(Tab.PROFILE)}
            modules={modules}
            materials={materials}
            streams={streams}
            scenarios={scenarios}
            onSelectLesson={handleSelectLesson}
            onUpdateUser={handleUpdateUser}
            allUsers={allUsers}
            notifications={notifications}
            appConfig={appConfig || undefined}
          />
        );
      case Tab.PROFILE:
        return <Profile userProgress={userProgress} onUpdateUser={handleUpdateUser} onBack={() => setCurrentTab(Tab.HOME)} onLogout={handleLogout} />;
      case Tab.ADMIN_DASHBOARD:
        return <AdminDashboard onBack={() => setCurrentTab(Tab.HOME)} appConfig={appConfig} onUpdateConfig={setAppConfig} onSync={() => syncData(true)} />;
      case Tab.CURATOR:
        return <CuratorDashboard onBack={() => setCurrentTab(Tab.HOME)} allUsers={allUsers} modules={modules} />;
      case Tab.LESSON:
        return selectedLesson ? (
          <LessonView
            lesson={selectedLesson}
            onBack={() => setCurrentTab(Tab.HOME)}
            onComplete={() => handleCompleteLesson(selectedLesson.id)}
            isCompleted={userProgress.completedLessonIds.includes(selectedLesson.id)}
          />
        ) : null;
      case Tab.MATERIALS: return <MaterialsView materials={materials} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.STREAMS: return <StreamsView streams={streams} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.ARENA: return <SalesArena scenarios={scenarios} userProgress={userProgress} onUpdateUser={handleUpdateUser} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.CALENDAR: return <CalendarView events={events} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.NOTEBOOK: return <NotebookView userId={userProgress.telegramId || 'local'} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.HABITS: return <HabitTracker userId={userProgress.telegramId || 'local'} onBack={() => setCurrentTab(Tab.HOME)} />;
      case Tab.CHAT: return <ChatAssistant onBack={() => setCurrentTab(Tab.HOME)} />;
      default: return <Welcome onStart={() => setCurrentTab(Tab.AUTH)} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {renderContent()}
      {userProgress.isAuthenticated && currentTab !== Tab.WELCOME && currentTab !== Tab.AUTH && (
        <SmartNav
          activeTab={currentTab}
          setActiveTab={setCurrentTab}
          role={userProgress.role}
          adminSubTab={adminSubTab}
          setAdminSubTab={setAdminSubTab}
          isLessonActive={currentTab === Tab.LESSON}
          onExitLesson={() => setCurrentTab(Tab.HOME)}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
        />
      )}
      {userProgress.isAuthenticated && (
        <SystemHealthAgent isAirtableConfigured={airtable.isConfigured()} onSync={() => syncData(true)} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
