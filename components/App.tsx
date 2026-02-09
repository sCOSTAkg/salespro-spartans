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
  const [currentTab, setCurrentTab] = useState<Tab>('welcome');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress>(() => {
    const saved = Storage.get<UserProgress>('userProgress');
    return saved || {
      userId: crypto.randomUUID(),
      username: 'Гость',
      role: 'guest',
      isAuthenticated: false,
      completedLessonIds: [],
      xp: 0,
      level: 1,
      streak: 0,
      completedScenarioIds: [],
      achievements: [],
      currentModule: null,
      joinedDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      telegramId: telegram.initDataUnsafe?.user?.id,
      telegramUsername: telegram.initDataUnsafe?.user?.username
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
        airtable.fetchModules(),
        airtable.fetchMaterials(),
        airtable.fetchStreams(),
        airtable.fetchEvents(),
        airtable.fetchScenarios(),
        airtable.fetchUsers(),
        airtable.fetchNotifications(),
        airtable.fetchConfig()
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
      username,
      isAuthenticated: true,
      role: username.toLowerCase() === 'admin' ? 'admin' : 'student',
      lastActive: new Date().toISOString()
    };
    setUserProgress(updatedUser);
    setCurrentTab('home');
    showToastMessage(`Добро пожаловать, ${username}!`, 'success');
    telegram.haptic('success');
    return true;
  };

  const handleLogout = () => {
    setUserProgress({ ...userProgress, isAuthenticated: false, role: 'guest' });
    setCurrentTab('welcome');
    showToastMessage('Вы вышли из системы', 'info');
  };

  const handleSelectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setCurrentTab('lesson');
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
        lastActive: new Date().toISOString()
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
      case 'welcome': return <Welcome onStart={() => setCurrentTab('auth')} />;
      case 'auth': return <Auth onLogin={handleLogin} onBack={() => setCurrentTab('welcome')} />;
      case 'home': 
        return (
          <HomeDashboard
            onNavigate={setCurrentTab}
            userProgress={userProgress}
            onProfileClick={() => setCurrentTab('profile')}
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
      case 'profile': 
        return <Profile userProgress={userProgress} onUpdateUser={handleUpdateUser} onBack={() => setCurrentTab('home')} onLogout={handleLogout} />;
      case 'admin': 
        return <AdminDashboard onBack={() => setCurrentTab('home')} appConfig={appConfig} onUpdateConfig={setAppConfig} onSync={() => syncData(true)} />;
      case 'curator': 
        return <CuratorDashboard onBack={() => setCurrentTab('home')} allUsers={allUsers} modules={modules} />;
      case 'lesson': 
        return selectedLesson ? (
          <LessonView 
            lesson={selectedLesson} 
            onBack={() => setCurrentTab('home')} 
            onComplete={() => handleCompleteLesson(selectedLesson.id)} 
            isCompleted={userProgress.completedLessonIds.includes(selectedLesson.id)} 
          />
        ) : null;
      case 'materials': return <MaterialsView materials={materials} onBack={() => setCurrentTab('home')} />;
      case 'streams': return <StreamsView streams={streams} onBack={() => setCurrentTab('home')} />;
      case 'arena': return <SalesArena scenarios={scenarios} userProgress={userProgress} onUpdateUser={handleUpdateUser} onBack={() => setCurrentTab('home')} />;
      case 'calendar': return <CalendarView events={events} onBack={() => setCurrentTab('home')} />;
      case 'notebook': return <NotebookView userId={userProgress.userId} onBack={() => setCurrentTab('home')} />;
      case 'habits': return <HabitTracker userId={userProgress.userId} onBack={() => setCurrentTab('home')} />;
      case 'chat': return <ChatAssistant onBack={() => setCurrentTab('home')} />;
      default: return <Welcome onStart={() => setCurrentTab('auth')} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {renderContent()}
      {userProgress.isAuthenticated && currentTab !== 'welcome' && currentTab !== 'auth' && (
        <SmartNav currentTab={currentTab} onNavigate={setCurrentTab} userRole={userProgress.role} />
      )}
      {userProgress.isAuthenticated && (
        <SystemHealthAgent isAirtableConfigured={airtable.isConfigured()} onSync={() => syncData(true)} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;