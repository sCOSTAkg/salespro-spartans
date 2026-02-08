
import React, { useRef, useEffect, useState } from 'react';
import { Tab, UserRole, AppNotification, SmartNavAction } from '../types';
import { telegram } from '../services/telegramService';

interface SmartNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  role: UserRole;
  adminSubTab: string;
  setAdminSubTab: (tab: string) => void;
  isLessonActive: boolean;
  onExitLesson: () => void;
  notifications: AppNotification[];
  onClearNotifications: () => void;
  action?: SmartNavAction | null; 
}

export const SmartNav: React.FC<SmartNavProps> = ({ 
  activeTab, 
  setActiveTab, 
  role,
  adminSubTab,
  setAdminSubTab,
  isLessonActive,
  onExitLesson,
  notifications,
  onClearNotifications,
  action
}) => {
  const [expandedPanel, setExpandedPanel] = useState<'NONE' | 'ADMIN' | 'NOTIFICATIONS'>('NONE');
  
  // Swipe State
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const swipeThreshold = 40;

  const isMainTab = [Tab.HOME, Tab.PROFILE, Tab.ADMIN_DASHBOARD].includes(activeTab);
  const showBackButton = isLessonActive || (!isMainTab && !isLessonActive);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
      if (activeTab === Tab.ADMIN_DASHBOARD) {
          setExpandedPanel('ADMIN');
      } else if (expandedPanel === 'ADMIN') {
          setExpandedPanel('NONE');
      }
  }, [activeTab]);

  const toggleNotifications = () => {
      telegram.haptic('selection');
      setExpandedPanel(prev => prev === 'NOTIFICATIONS' ? 'NONE' : 'NOTIFICATIONS');
  };

  const handleBack = () => {
      telegram.haptic('medium');
      if (expandedPanel !== 'NONE') {
          setExpandedPanel('NONE');
          return;
      }
      if (isLessonActive) onExitLesson();
      else if (!isMainTab) setActiveTab(Tab.HOME);
  };

  const handleTabClick = (tab: Tab) => {
      telegram.haptic('selection');
      if (isLessonActive) onExitLesson(); 
      setActiveTab(tab);
      if (tab !== Tab.ADMIN_DASHBOARD && expandedPanel === 'ADMIN') setExpandedPanel('NONE');
      if (expandedPanel === 'NOTIFICATIONS') setExpandedPanel('NONE');
  };

  // --- SWIPE HANDLERS ---
  const onTouchStart = (e: React.TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      
      const deltaX = touchEnd.x - touchStart.current.x;
      const deltaY = touchEnd.y - touchStart.current.y;

      // Swipe Right (Back)
      if (deltaX > swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
          handleBack();
      }
      
      // Swipe Down (Collapse)
      if (deltaY > swipeThreshold) {
          if (expandedPanel !== 'NONE') {
              setExpandedPanel('NONE');
              telegram.haptic('light');
          }
      }

      touchStart.current = null;
  };

  // --- RENDER HELPERS ---

  const renderAdminLinks = () => (
      <div className="flex gap-2 px-2 pb-2 justify-center animate-fade-in w-full overflow-x-auto no-scrollbar">
         {[
            { id: 'OVERVIEW', icon: '📊' },
            { id: 'COURSE', icon: '🎓' },
            { id: 'ARENA', icon: '⚔️' },
            { id: 'STREAMS', icon: '📡' }, // Added Streams/Events
            { id: 'USERS', icon: '👥' },
            { id: 'SETTINGS', icon: '⚙️' },
         ].map(link => (
             <button
                key={link.id}
                onClick={() => { telegram.haptic('light'); setAdminSubTab(link.id); }}
                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                    adminSubTab === link.id 
                    ? 'bg-[#6C5DD3] text-white scale-110 shadow-lg shadow-[#6C5DD3]/40' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
             >
                 <span className="text-sm">{link.icon}</span>
             </button>
         ))}
      </div>
  );

  const renderNotifications = () => (
      <div className="px-4 pb-4 pt-1 max-h-[50vh] overflow-y-auto custom-scrollbar animate-fade-in w-full">
          <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">Центр связи</span>
              <button onClick={onClearNotifications} className="text-[9px] text-white/40 font-bold hover:text-white transition-colors">Очистить</button>
          </div>
          {notifications.length === 0 ? (
              <div className="py-4 text-center text-white/20 text-[10px] font-bold uppercase">Нет новых сообщений</div>
          ) : (
              <div className="space-y-2">
                  {notifications.map(n => (
                      <div key={n.id} className={`p-3 rounded-2xl flex gap-3 transition-all ${
                          n.type === 'ALERT' ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5 border border-white/5'
                      }`}>
                          <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${n.type === 'ALERT' ? 'bg-red-500' : 'bg-[#6C5DD3]'}`}></div>
                          <div className="flex-1">
                              <h4 className="text-[11px] font-bold text-white leading-tight mb-0.5">{n.title}</h4>
                              <p className="text-[9px] text-white/60 leading-snug">{n.message}</p>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );

  const renderAction = () => {
      if (!action) return null;
      
      const variantClasses = {
          primary: 'bg-[#6C5DD3]',
          success: 'bg-[#00B050]',
          danger: 'bg-red-600'
      };
      
      return (
          <button 
              onClick={action.onClick}
              disabled={action.loading}
              className={`
                  h-[44px] px-6 flex items-center justify-center gap-2 rounded-full
                  text-white font-black uppercase text-[10px] tracking-widest shadow-lg
                  active:scale-95 transition-all duration-300 w-full
                  ${variantClasses[action.variant || 'primary']}
              `}
          >
              {action.loading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                  <>
                      {action.icon && <span className="text-sm">{action.icon}</span>}
                      <span>{action.label}</span>
                  </>
              )}
          </button>
      );
  };

  const isExpanded = expandedPanel !== 'NONE';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center pointer-events-none pb-[calc(var(--safe-bottom)+12px)]">
      <div 
        className="relative flex items-end justify-center w-full max-w-[360px] h-[60px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div 
            className={`
                pointer-events-auto bg-[#0F1115]/95 backdrop-blur-2xl
                shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10
                flex flex-col justify-end items-center overflow-hidden z-20
                transition-[width,height,border-radius,transform] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]
                ${isExpanded 
                    ? 'w-[92%] h-auto min-h-[60px] rounded-[30px] pb-2' 
                    : action ? 'w-[200px] h-[52px] rounded-full' : 'w-[220px] h-[52px] rounded-full' 
                }
            `}
        >
            <div className={`transition-all duration-300 w-full ${isExpanded ? 'opacity-100 delay-100 pt-4' : 'opacity-0 h-0 pointer-events-none'}`}>
                {expandedPanel === 'ADMIN' && renderAdminLinks()}
                {expandedPanel === 'NOTIFICATIONS' && renderNotifications()}
            </div>

            <div className={`w-full flex items-center justify-between px-1.5 h-full transition-all duration-300 ${isExpanded && expandedPanel === 'NOTIFICATIONS' ? 'opacity-0 hidden' : 'opacity-100'}`}>
                
                {showBackButton && (
                    <button 
                        onClick={handleBack}
                        className="w-10 h-10 flex-shrink-0 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                )}

                <div className="flex-1 flex items-center justify-center h-full">
                    {action ? (
                        <div className="animate-scale-in w-full px-1">
                            {renderAction()}
                        </div>
                    ) : (
                        <div className="flex items-center gap-6">
                            <NavButton isActive={activeTab === Tab.HOME} onClick={() => handleTabClick(Tab.HOME)} icon={<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />} />
                            
                            <NavButton isActive={activeTab === Tab.PROFILE} onClick={() => handleTabClick(Tab.PROFILE)} icon={<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />} extraIcon={<circle cx="12" cy="7" r="4" />} />

                            {role === 'ADMIN' && (
                                <NavButton isActive={activeTab === Tab.ADMIN_DASHBOARD} onClick={() => handleTabClick(Tab.ADMIN_DASHBOARD)} icon={<path d="M12 2a10 10 0 1 0 10 10 M12 2v10l4.24-4.24" />} isAdmin />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <button
            onClick={toggleNotifications}
            className={`
                pointer-events-auto absolute right-4 bottom-0 z-10
                w-[52px] h-[52px] rounded-full 
                bg-[#0F1115]/95 backdrop-blur-2xl border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.3)]
                flex items-center justify-center text-white
                transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]
                ${isExpanded 
                    ? 'translate-x-[-100px] scale-50 opacity-0' 
                    : 'translate-x-0 scale-100 opacity-100'
                }
            `}
        >
            <div className="relative">
                <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0F1115] animate-pulse"></span>
                )}
            </div>
        </button>

      </div>
    </div>
  );
};

const NavButton = ({ isActive, onClick, icon, extraIcon }: any) => {
    return (
        <button 
          onClick={onClick} 
          className={`
            relative w-10 h-10 flex items-center justify-center transition-all duration-300 group
            ${isActive ? 'text-white scale-110' : 'text-white/40 hover:text-white'}
          `}
        >
          {isActive && (
             <div className="absolute -bottom-1 w-1 h-1 bg-[#6C5DD3] rounded-full shadow-[0_0_8px_#6C5DD3]"></div>
          )}
          
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              {icon}
              {extraIcon}
          </svg>
        </button>
    );
};
