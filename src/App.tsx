import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeDashboard } from './components/HomeDashboard';
import { NotebookView } from './components/NotebookView';
import { MaterialsView } from './components/MaterialsView';
import { ModuleList } from './components/ModuleList';
import { Tab } from './types';

const Profile = React.lazy(() => import('./components/Profile').then(m => ({ default: m.Profile })));
const LessonView = React.lazy(() => import('./components/LessonView').then(m => ({ default: m.LessonView })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SalesArena = React.lazy(() => import('./components/SalesArena').then(m => ({ default: m.SalesArena })));
const HabitTracker = React.lazy(() => import('./components/HabitTracker').then(m => ({ default: m.HabitTracker })));
const VideoHub = React.lazy(() => import('./components/VideoHub').then(m => ({ default: m.VideoHub })));

const Loading = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-[#6C5DD3] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Type-safe outlet context hook
export function useAppContext() {
  return useOutletContext<any>();
}

// --- Page wrappers (thin, connect outlet context to components) ---

const HomePage = () => {
  const ctx = useAppContext();
  if (ctx.activeLesson) {
    return (
      <Suspense fallback={<Loading />}>
        <div className="animate-slide-up min-h-full bg-body relative z-10">
          <LessonView
            lesson={ctx.activeLesson}
            isCompleted={ctx.userProgress.completedLessonIds.includes(ctx.activeLesson.id)}
            onComplete={ctx.handleCompleteLesson}
            onBack={() => ctx.setSelectedLessonId(null)}
            onNavigate={(id: string) => ctx.setSelectedLessonId(id)}
            parentModule={ctx.activeModule}
            userProgress={ctx.userProgress}
            onUpdateUser={ctx.handleUpdateUser}
            onUpdateLesson={ctx.handleUpdateLesson}
          />
        </div>
      </Suspense>
    );
  }
  return (
    <HomeDashboard
      onNavigate={ctx.setActiveTab}
      userProgress={ctx.userProgress}
      onProfileClick={() => ctx.setActiveTab(Tab.PROFILE)}
      modules={ctx.modules}
      materials={ctx.materials}
      streams={ctx.streams}
      scenarios={ctx.scenarios}
      onSelectLesson={(l: any) => ctx.setSelectedLessonId(l.id)}
      onUpdateUser={ctx.handleUpdateUser}
      allUsers={ctx.allUsers}
      notifications={ctx.notifications}
      appConfig={ctx.appConfig}
    />
  );
};

const ArenaPage = () => {
  const ctx = useAppContext();
  return <SalesArena userProgress={ctx.userProgress} />;
};

const HabitsPage = () => {
  const ctx = useAppContext();
  return (
    <HabitTracker
      habits={ctx.userProgress.habits || []}
      goals={ctx.userProgress.goals || []}
      onUpdateHabits={(h: any) => ctx.handleUpdateUser({ habits: h })}
      onUpdateGoals={(g: any) => ctx.handleUpdateUser({ goals: g })}
      onXPEarned={ctx.handleXPEarned}
      onBack={() => ctx.setActiveTab(Tab.HOME)}
      setNavAction={ctx.setNavAction}
      isAuthenticated={ctx.userProgress.isAuthenticated}
    />
  );
};

const NotebookPage = () => {
  const ctx = useAppContext();
  return (
    <NotebookView
      entries={ctx.userProgress.notebook}
      onUpdate={(e: any) => ctx.handleUpdateUser({ notebook: e })}
      onBack={() => ctx.setActiveTab(Tab.HOME)}
      onXPEarned={ctx.handleXPEarned}
      setNavAction={ctx.setNavAction}
    />
  );
};

const MaterialsPage = () => {
  const ctx = useAppContext();
  return <MaterialsView materials={ctx.materials} onBack={() => ctx.setActiveTab(Tab.HOME)} userProgress={ctx.userProgress} />;
};

const StreamsPage = () => {
  const ctx = useAppContext();
  return (
    <VideoHub
      streams={ctx.streams}
      onBack={() => ctx.setActiveTab(Tab.HOME)}
      userProgress={ctx.userProgress}
      onUpdateUser={ctx.handleUpdateUser}
      setNavAction={ctx.setNavAction}
    />
  );
};

const ModulesPage = () => {
  const ctx = useAppContext();
  return (
    <div className="px-4 pt-6 pb-28 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => ctx.setActiveTab(Tab.HOME)} className="w-10 h-10 rounded-xl bg-surface border border-border-color flex items-center justify-center active:scale-95 transition-transform">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-text-primary">Все модули</h1>
      </div>
      <ModuleList modules={ctx.modules} userProgress={ctx.userProgress} onSelectLesson={(l: any) => ctx.setSelectedLessonId(l.id)} onBack={() => ctx.setActiveTab(Tab.HOME)} />
    </div>
  );
};

const ProfilePage = () => {
  const ctx = useAppContext();
  return (
    <Profile
      userProgress={ctx.userProgress}
      onLogout={ctx.handleLogout}
      allUsers={ctx.allUsers}
      onUpdateUser={ctx.handleUpdateUser}
      events={ctx.events}
      onLogin={ctx.handleLogin}
      onNavigate={ctx.setActiveTab}
      setNavAction={ctx.setNavAction}
    />
  );
};

const AdminPage = () => {
  const ctx = useAppContext();
  if (ctx.userProgress.role !== 'ADMIN') return <Navigate to="/" replace />;
  return (
    <AdminDashboard
      config={ctx.appConfig}
      onUpdateConfig={ctx.handleUpdateConfig}
      modules={ctx.modules}
      onUpdateModules={ctx.handleUpdateModules}
      materials={ctx.materials}
      onUpdateMaterials={ctx.handleUpdateMaterials}
      streams={ctx.streams}
      onUpdateStreams={ctx.handleUpdateStreams}
      events={ctx.events}
      onUpdateEvents={ctx.handleUpdateEvents}
      scenarios={ctx.scenarios}
      onUpdateScenarios={ctx.handleUpdateScenarios}
      users={ctx.allUsers}
      onUpdateUsers={ctx.handleUpdateAllUsers}
      currentUser={ctx.userProgress}
      activeSubTab={ctx.adminSubTab}
      onSendBroadcast={ctx.handleSendBroadcast}
      notifications={ctx.notifications}
      onClearNotifications={ctx.handleClearNotifications}
      addToast={ctx.addToast}
    />
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/notebook" element={<NotebookPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/streams" element={<StreamsPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
