import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserProgress, AppConfig, Module, Material, Stream,
  CalendarEvent, ArenaScenario, AppNotification, Lesson,
  SmartNavAction, Habit, Goal
} from '../types';
import { Storage } from '../services/storage';
import { Backend } from '../services/backendService';
import { XPService } from '../services/xpService';
import { SCENARIOS } from '../components/SalesArena';
import { telegram } from '../services/telegramService';
import { ToastMessage } from '../components/Toast';

const DEFAULT_CONFIG: AppConfig = {
  appName: 'SalesPro: 300 Spartans',
  appDescription: 'Elite Sales Academy',
  primaryColor: '#6C5DD3',
  systemInstruction: 'Ты — Командир элитного отряда продаж "300 Спартанцев". Твоя задача: сделать из новобранца настоящую машину продаж. СТИЛЬ: Жесткий, военный, вдохновляющий.',
  welcomeVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  welcomeMessage: 'Добро пожаловать в Спарту. Здесь куется характер.',
  integrations: {
    telegramBotToken: '',
    googleDriveFolderId: '',
    crmWebhookUrl: '',
    aiModelVersion: 'gemini-3-flash-preview',
    databaseUrl: '',
    airtablePat: '',
    airtableBaseId: '',
    airtableTableName: 'Users'
  },
  features: { enableRealTimeSync: true, autoApproveHomework: false, maintenanceMode: false, allowStudentChat: true, publicLeaderboard: true },
  aiConfig: { activeProvider: 'GOOGLE_GEMINI', apiKeys: {}, modelOverrides: {} },
  systemAgent: { enabled: false, autoFix: false, monitoringInterval: 20000, sensitivity: 'LOW', autonomyLevel: 'PASSIVE' }
};

const DEFAULT_USER: UserProgress = {
  name: 'Новобранец',
  role: 'STUDENT',
  isAuthenticated: false,
  xp: 0,
  level: 1,
  completedLessonIds: [],
  submittedHomeworks: [],
  chatHistory: [],
  theme: 'LIGHT',
  notifications: { pushEnabled: false, telegramSync: false, deadlineReminders: true, chatNotifications: true },
  notebook: [],
  habits: [],
  goals: [],
  stats: XPService.getInitStats()
};

export function useAppState() {
  const navigate = useNavigate();

  const [adminSubTab, setAdminSubTab] = useState<string>('OVERVIEW');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [navAction, setNavAction] = useState<SmartNavAction | null>(null);

  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const cfg = Storage.get<AppConfig>('appConfig', DEFAULT_CONFIG);
    const envPat = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_AIRTABLE_PAT : '';
    const envBase = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_AIRTABLE_BASE_ID : '';
    if (envPat || envBase) {
      return { ...cfg, integrations: { ...cfg.integrations, airtablePat: envPat || cfg.integrations.airtablePat, airtableBaseId: envBase || cfg.integrations.airtableBaseId } };
    }
    return cfg;
  });
  const [modules, setModules] = useState<Module[]>(() => Storage.get<Module[]>('courseModules', []));
  const [materials, setMaterials] = useState<Material[]>(() => Storage.get<Material[]>('materials', []));
  const [streams, setStreams] = useState<Stream[]>(() => Storage.get<Stream[]>('streams', []));
  const [events, setEvents] = useState<CalendarEvent[]>(() => Storage.get<CalendarEvent[]>('events', []));
  const [scenarios, setScenarios] = useState<ArenaScenario[]>(() => Storage.get<ArenaScenario[]>('scenarios', SCENARIOS));
  const [allUsers, setAllUsers] = useState<UserProgress[]>(() => Storage.get<UserProgress[]>('allUsers', []));
  const [userProgress, setUserProgress] = useState<UserProgress>(() => Storage.get<UserProgress>('progress', DEFAULT_USER));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => Storage.get<AppNotification[]>('local_notifications', []));

  const userProgressRef = useRef(userProgress);
  userProgressRef.current = userProgress;

  const activeLesson = useMemo(() =>
    selectedLessonId ? modules.flatMap(m => m.lessons).find(l => l.id === selectedLessonId) : null,
    [selectedLessonId, modules]
  );
  const activeModule = useMemo(() =>
    activeLesson ? modules.find(m => m.lessons.some(l => l.id === activeLesson.id)) : null,
    [activeLesson, modules]
  );

  // --- Toast helpers ---
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string, link?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, link }]);
    if (telegram.isAvailable) telegram.haptic(type === 'error' ? 'error' : 'success');
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // --- Handlers ---
  const handleUpdateUser = useCallback((data: Partial<UserProgress>) => setUserProgress(prev => ({ ...prev, ...data })), []);
  const handleUpdateModules = useCallback((m: Module[]) => { setModules(m); Backend.saveCollection('modules', m); }, []);
  const handleUpdateMaterials = useCallback((m: Material[]) => { setMaterials(m); Backend.saveCollection('materials', m); }, []);
  const handleUpdateStreams = useCallback((s: Stream[]) => { setStreams(s); Backend.saveCollection('streams', s); }, []);
  const handleUpdateEvents = useCallback((e: CalendarEvent[]) => { setEvents(e); Backend.saveCollection('events', e); }, []);
  const handleUpdateScenarios = useCallback((s: ArenaScenario[]) => { setScenarios(s); Backend.saveCollection('scenarios', s); }, []);
  const handleUpdateConfig = useCallback((c: AppConfig) => { setAppConfig(c); Backend.saveGlobalConfig(c); }, []);
  const handleUpdateAllUsers = useCallback((u: UserProgress[]) => { setAllUsers(u); Storage.set('allUsers', u); }, []);

  const handleSendBroadcast = useCallback((n: AppNotification) => {
    Backend.sendBroadcast(n);
    setNotifications(prev => [n, ...prev]);
    addToast('success', 'Оповещение отправлено');
  }, [addToast]);

  const handleClearNotifications = useCallback(() => {
    Storage.set('local_notifications', []);
    setNotifications([]);
    Backend.saveCollection('notifications', []);
    addToast('info', 'История очищена');
  }, [addToast]);

  const handleUpdateLesson = useCallback((updatedLesson: Lesson) => {
    setModules(prev => {
      const updated = prev.map(m => m.lessons.some(l => l.id === updatedLesson.id)
        ? { ...m, lessons: m.lessons.map(l => l.id === updatedLesson.id ? updatedLesson : l) } : m);
      Backend.saveCollection('modules', updated);
      return updated;
    });
    addToast('success', 'Урок обновлен');
  }, [addToast]);

  const handleCompleteLesson = useCallback((lessonId: string, xpBonus: number) => {
    setUserProgress(prev => {
      const newXp = prev.xp + xpBonus;
      return { ...prev, xp: newXp, level: Math.floor(newXp / 1000) + 1, completedLessonIds: [...prev.completedLessonIds, lessonId] };
    });
    addToast('success', `Урок пройден! +${xpBonus} XP`);
    setSelectedLessonId(null);
  }, [addToast]);

  const handleXPEarned = useCallback((amount: number) => {
    setUserProgress(prev => { const newXp = prev.xp + amount; return { ...prev, xp: newXp, level: Math.floor(newXp / 1000) + 1 }; });
    addToast('success', `+${amount} XP`);
  }, [addToast]);

  const handleLogout = useCallback(() => {
    setUserProgress({ ...DEFAULT_USER });
    navigate('/');
  }, [navigate]);

  const handleNavigate = useCallback((link?: string) => {
    if (!link) return;
    if (link.startsWith('http')) { window.open(link, '_blank'); }
    else { navigate(link); }
  }, [navigate]);

  return {
    // State
    appConfig, modules, materials, streams, events, scenarios,
    allUsers, userProgress, notifications, toasts,
    adminSubTab, selectedLessonId, navAction,
    activeLesson, activeModule, userProgressRef,
    // Setters
    setAdminSubTab, setSelectedLessonId, setNavAction,
    setAppConfig, setModules, setMaterials, setStreams,
    setEvents, setScenarios, setAllUsers, setUserProgress,
    setNotifications,
    // Handlers
    addToast, removeToast, handleUpdateUser, handleUpdateModules,
    handleUpdateMaterials, handleUpdateStreams, handleUpdateEvents,
    handleUpdateScenarios, handleUpdateConfig, handleUpdateAllUsers,
    handleSendBroadcast, handleClearNotifications, handleUpdateLesson,
    handleCompleteLesson, handleXPEarned, handleLogout, handleNavigate,
  };
}
