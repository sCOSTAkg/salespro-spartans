
import React from 'react';
import ReactPlayer from 'react-player';
import { Tab, UserProgress, Lesson, Material, Stream, ArenaScenario, AppNotification, Module, AppConfig } from '../types';
import { ModuleList } from './ModuleList';
import { telegram } from '../services/telegramService';

// Fix for ReactPlayer in Vite
const VideoPlayer = ReactPlayer as unknown as React.ComponentType<any>;

interface HomeDashboardProps {
  onNavigate: (tab: Tab) => void;
  userProgress: UserProgress;
  onProfileClick: () => void;
  modules: Module[];
  materials: Material[];
  streams: Stream[];
  scenarios: ArenaScenario[];
  onSelectLesson: (lesson: Lesson) => void;
  onUpdateUser: (data: Partial<UserProgress>) => void;
  allUsers: UserProgress[];
  notifications?: AppNotification[];
  appConfig?: AppConfig;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ 
  onNavigate, 
  userProgress, 
  onProfileClick,
  modules,
  onSelectLesson,
  appConfig
}) => {
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = userProgress.completedLessonIds.length;
  const overallProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const isAuthenticated = userProgress.isAuthenticated;

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 5) return 'Ночной дозор';
      if (hour < 12) return 'Доброе утро';
      if (hour < 18) return 'Добрый день';
      return 'Добрый вечер';
  };

  const handleCommandClick = (tab: Tab) => {
      // Allow navigation for everyone (Teaser Mode)
      telegram.haptic('selection');
      onNavigate(tab);
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300 relative overflow-hidden">
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -right-[20%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[120px] animate-blob"></div>
          <div className="absolute top-[40%] -left-[20%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-[10%] right-[20%] w-[50%] h-[50%] bg-orange-500/5 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
          {/* Subtle texture kept */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      {/* HEADER */}
      <div className="px-6 pt-[calc(var(--safe-top)+16px)] flex justify-between items-center sticky top-0 z-40 pb-4 backdrop-blur-xl bg-body/60 border-b border-white/5 transition-all">
          <div className="flex items-center gap-4" onClick={onProfileClick}>
              <div className="relative group cursor-pointer">
                  <div className={`absolute -inset-0.5 bg-gradient-to-tr ${isAuthenticated ? 'from-[#6C5DD3] to-[#FFAB7B]' : 'from-slate-500 to-slate-700'} rounded-full opacity-60 group-hover:opacity-100 transition duration-300 blur-sm`}></div>
                  <img 
                    src={userProgress.avatarUrl || `https://ui-avatars.com/api/?name=${userProgress.name}&background=random`} 
                    className={`relative w-10 h-10 rounded-full object-cover border border-surface shadow-lg ${!isAuthenticated ? 'grayscale' : ''}`} 
                  />
                  {isAuthenticated && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full animate-pulse"></div>}
              </div>
              <div className="cursor-pointer">
                  <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest mb-0.5">{getGreeting()}</p>
                  <h1 className="text-base font-black text-text-primary leading-none tracking-tight">{userProgress.name}</h1>
              </div>
          </div>
          {!isAuthenticated && (
              <button onClick={onProfileClick} className="px-4 py-2 rounded-xl bg-[#6C5DD3] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#6C5DD3]/20 animate-pulse">
                  Войти
              </button>
          )}
      </div>

      <div className="px-6 pt-6 pb-36 space-y-8 animate-fade-in max-w-4xl mx-auto relative z-10">
        
        {/* MAIN WIDGET: WELCOME (Unauth) OR PROGRESS (Auth) */}
        {!isAuthenticated ? (
            <div className="relative bg-[#16181D] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 group animate-slide-up">
                {/* Welcome Video Widget */}
                {appConfig?.welcomeVideoUrl && appConfig.welcomeVideoUrl.length > 5 && (
                    <div className="relative aspect-video w-full bg-black">
                        <VideoPlayer 
                            url={appConfig.welcomeVideoUrl} 
                            width="100%" 
                            height="100%" 
                            light={true}
                            playing={true}
                            playIcon={
                                <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform group-hover:scale-110 cursor-pointer">
                                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                            }
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#16181D] via-transparent to-transparent pointer-events-none"></div>
                    </div>
                )}
                
                <div className="p-6 relative">
                    <h2 className="text-2xl font-black text-white mb-2 leading-tight">Академия Продаж</h2>
                    <p className="text-white/60 text-sm leading-relaxed mb-4 font-medium">
                        {appConfig?.welcomeMessage || "Элитная подготовка. Смотрите программу курса ниже, но доступ к материалам откроется после авторизации."}
                    </p>
                    <button 
                        onClick={onProfileClick}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <span>Начать Путь</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                </div>
            </div>
        ) : (
            <div className="relative bg-[#16181D] rounded-[2.5rem] p-6 shadow-xl border border-white/5 overflow-hidden group animate-slide-up">
                 {/* Progress Widget */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-[#6C5DD3]/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-[#6C5DD3]/15 transition-colors duration-500"></div>
                 
                 <div className="flex justify-between items-start mb-8 relative z-10">
                     <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00B050] animate-pulse"></span>
                            <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Статус обучения</span>
                         </div>
                         <h2 className="text-4xl font-black text-white tracking-tight">{overallProgress}<span className="text-2xl text-white/30">%</span></h2>
                     </div>
                     <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/10 shadow-inner text-[#6C5DD3]">
                         🛡️
                     </div>
                 </div>

                 <div className="relative w-full bg-white/5 rounded-full h-3 mb-6 overflow-hidden border border-white/5">
                     <div className="absolute inset-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                     <div 
                        className="bg-gradient-to-r from-[#6C5DD3] to-[#A090FF] h-full rounded-full transition-all duration-1000 relative" 
                        style={{ width: `${overallProgress}%` }}
                     >
                         <div className="absolute top-0 left-0 w-full h-full bg-white/30 animate-[shimmer_2s_infinite]"></div>
                     </div>
                 </div>

                 <button 
                    onClick={() => {
                        const firstIncomplete = modules.flatMap(m => m.lessons).find(l => !userProgress.completedLessonIds.includes(l.id));
                        if(firstIncomplete) {
                            onSelectLesson(firstIncomplete);
                        } else if (modules[0]?.lessons[0]) {
                            onSelectLesson(modules[0].lessons[0]);
                        }
                    }}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                 >
                     <span>Продолжить</span>
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </button>
            </div>
        )}

        {/* COMMAND PANELS (GRID) */}
        <div>
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Командный Пункт</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {[
                    { id: Tab.ARENA, title: 'АРЕНА', icon: '⚔️', color: 'from-red-500/20 to-red-600/5', border: 'border-red-500/20', text: 'text-red-500', desc: 'Симуляции' },
                    { id: Tab.HABITS, title: 'ТРЕКЕР', icon: '🔥', color: 'from-orange-500/20 to-orange-600/5', border: 'border-orange-500/20', text: 'text-orange-500', desc: 'Дисциплина' },
                    { id: Tab.STREAMS, title: 'ЭФИРЫ', icon: '📹', color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/20', text: 'text-purple-500', desc: 'Записи' },
                    { id: Tab.NOTEBOOK, title: 'БЛОКНОТ', icon: '📝', color: 'from-green-500/20 to-green-600/5', border: 'border-green-500/20', text: 'text-green-500', desc: 'Заметки' },
                ].map((item, i) => (
                    <button 
                        key={item.id}
                        onClick={() => handleCommandClick(item.id)}
                        className={`
                            relative bg-surface p-5 rounded-[2rem] text-left border 
                            hover:border-opacity-50 transition-all active:scale-95 group overflow-hidden shadow-sm animate-slide-up
                            ${item.border}
                        `}
                        style={{ animationDelay: `${i*0.1}s` }}
                    >
                        {!isAuthenticated && (
                            <div className="absolute top-3 right-3 z-20">
                                <span className="text-[10px] font-black uppercase text-text-secondary opacity-50 bg-body px-2 py-1 rounded-lg">Demo</span>
                            </div>
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between min-h-[90px]">
                            <div className="flex justify-between items-start">
                                <div className={`w-10 h-10 rounded-2xl bg-body flex items-center justify-center text-xl shadow-inner ${isAuthenticated ? item.text : 'text-gray-400'}`}>
                                    {item.icon}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-black text-text-primary text-sm tracking-wide">{item.title}</h4>
                                <p className="text-[9px] text-text-secondary font-bold uppercase tracking-wider opacity-60">{item.desc}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* MODULES LIST - ALWAYS VISIBLE BUT LOCKED */}
        <div className="space-y-4">
             <div className="flex flex-col gap-4 px-1">
                 <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Программа</h3>
                        <span className="text-[9px] font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg border border-border-color">
                            {modules.length}
                        </span>
                    </div>
                    
                    <button 
                        onClick={() => { telegram.haptic('selection'); onNavigate(Tab.MODULES); }}
                        className="text-[10px] font-bold transition-colors flex items-center gap-1 active:scale-95 py-2 px-1 text-[#6C5DD3] hover:text-[#5b4eb5]"
                    >
                        Все модули
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                 </div>
             </div>
             {/* Pass minimal props, ModuleList handles locking logic internally */}
             <ModuleList modules={modules} userProgress={userProgress} onSelectLesson={onSelectLesson} onBack={() => {}} />
        </div>
      </div>
    </div>
  );
};
