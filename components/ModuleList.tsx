
import React, { useState } from 'react';
import { Module, UserProgress, Lesson } from '../types';
import { telegram } from '../services/telegramService';

interface ModuleListProps {
  modules: Module[];
  userProgress: UserProgress;
  onSelectLesson: (lesson: Lesson) => void;
  onBack: () => void;
}

const getYouTubeThumbnail = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) 
      ? `https://img.youtube.com/vi/${match[2]}/mqdefault.jpg` 
      : null;
};

export const ModuleList: React.FC<ModuleListProps> = ({ modules, userProgress, onSelectLesson }) => {
  const [shakingId, setShakingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const handleModuleClick = (module: Module) => {
    const isLevelLocked = userProgress.level < module.minLevel;
    const isAuthenticated = userProgress.isAuthenticated;

    if (isLevelLocked || !isAuthenticated) {
        setShakingId(module.id);
        telegram.haptic('error');
        setTimeout(() => setShakingId(null), 500);
        
        if (!isAuthenticated) telegram.showAlert('Авторизуйтесь, чтобы начать обучение.', 'Доступ закрыт');
        else telegram.showAlert(`Необходим уровень ${module.minLevel}. Выполняйте задания предыдущих модулей.`, 'Рано, боец');
        
        return;
    }

    telegram.haptic('selection');
    // Toggle expansion
    setExpandedId(expandedId === module.id ? null : module.id);
  };

  const handleLessonClick = (e: React.MouseEvent, lesson: Lesson) => {
      e.stopPropagation();
      telegram.haptic('medium');
      onSelectLesson(lesson);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-32">
        {modules.map((module, index) => {
            const isLevelLocked = userProgress.level < module.minLevel;
            const isAuthenticated = userProgress.isAuthenticated;
            const isLocked = (isLevelLocked || !isAuthenticated);
            
            const completedCount = module.lessons.filter(l => userProgress.completedLessonIds.includes(l.id)).length;
            const totalCount = module.lessons.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isCompleted = progressPercent === 100;
            const isExpanded = expandedId === module.id;
            
            const bgImage = module.imageUrl || getYouTubeThumbnail(module.videoUrl);

            // Visual Config based on Category
            const getConfig = (cat: string) => {
                switch(cat) {
                    case 'SALES': return { accent: '#10B981', label: 'ПРОДАЖИ', gradient: 'from-emerald-900', ring: 'ring-emerald-500/50' };
                    case 'PSYCHOLOGY': return { accent: '#8B5CF6', label: 'ПСИХОЛОГИЯ', gradient: 'from-violet-900', ring: 'ring-violet-500/50' };
                    case 'TACTICS': return { accent: '#F43F5E', label: 'ТАКТИКА', gradient: 'from-rose-900', ring: 'ring-rose-500/50' };
                    default: return { accent: '#6366f1', label: 'БАЗА', gradient: 'from-indigo-900', ring: 'ring-indigo-500/50' };
                }
            };

            const style = getConfig(module.category);
            
            return (
                <div 
                    key={module.id}
                    onClick={() => handleModuleClick(module)}
                    className={`
                        group relative w-full overflow-hidden rounded-[2rem]
                        bg-[#16181D] shadow-md hover:shadow-2xl
                        transition-all duration-500 ease-out
                        border border-white/5 cursor-pointer
                        ${shakingId === module.id ? 'animate-shake' : ''}
                        ${isExpanded ? 'row-span-2' : ''}
                    `}
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    {/* EXPANDED CONTENT CONTAINER */}
                    <div className={`relative flex flex-col h-full ${isExpanded ? 'min-h-[400px]' : 'aspect-[16/10]'}`}>
                        
                        {/* BACKGROUND LAYER */}
                        <div className={`absolute inset-0 z-0 transition-all duration-500 ${isExpanded ? 'h-32 opacity-40' : 'h-full opacity-100'}`}>
                            {bgImage ? (
                                <img 
                                    src={bgImage} 
                                    alt={module.title}
                                    className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isLocked ? 'scale-100 grayscale-[0.8]' : 'group-hover:scale-110 opacity-80'}`}
                                />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${style.gradient} to-[#16181D] opacity-40`}></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#16181D] via-[#16181D]/60 to-transparent"></div>
                        </div>

                        {/* TOP BAR */}
                        <div className="relative z-10 p-4 flex justify-between items-start">
                             <div className="flex gap-2">
                                 <span 
                                    className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 shadow-sm"
                                    style={{ backgroundColor: `${style.accent}30`, color: '#fff' }}
                                 >
                                     {style.label}
                                 </span>
                                 {isCompleted && <span className="bg-[#00B050] text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg">✓ DONE</span>}
                             </div>
                             {isLocked && (
                                <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
                                    <span className="text-sm">🔒</span>
                                </div>
                             )}
                        </div>

                        {/* MAIN INFO (Title & Progress) */}
                        <div className={`relative z-10 px-5 transition-all duration-500 ${isExpanded ? 'mt-2 mb-4' : 'mt-auto pb-5'}`}>
                            <h3 className="text-lg font-black text-white leading-tight mb-2 drop-shadow-md">
                                {module.title}
                            </h3>
                            {!isExpanded && (
                                <p className="text-[10px] font-medium text-white/70 line-clamp-2 mb-3">
                                    {module.description}
                                </p>
                            )}

                            {/* Progress Bar */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                                     <div 
                                        className="h-full rounded-full transition-all duration-700 ease-out relative" 
                                        style={{ 
                                            width: `${isLocked ? 0 : progressPercent}%`, 
                                            backgroundColor: style.accent,
                                            boxShadow: `0 0 15px ${style.accent}`
                                        }}
                                     ></div>
                                </div>
                                <span className="text-[10px] font-black" style={{ color: isLocked ? '#64748B' : style.accent }}>
                                    {isLocked ? `L${module.minLevel}` : `${Math.round(progressPercent)}%`}
                                </span>
                            </div>
                        </div>

                        {/* LESSONS LIST (Visible only when expanded) */}
                        {isExpanded && (
                            <div className="relative z-10 px-4 pb-4 space-y-2 flex-1 overflow-y-auto animate-fade-in custom-scrollbar">
                                <p className="text-[10px] text-white/50 mb-3 px-1">{module.description}</p>
                                {module.lessons.map((lesson, lIdx) => {
                                    const isLessonCompleted = userProgress.completedLessonIds.includes(lesson.id);
                                    
                                    return (
                                        <div 
                                            key={lesson.id}
                                            onClick={(e) => handleLessonClick(e, lesson)}
                                            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group/lesson active:scale-[0.98]"
                                        >
                                            <div className={`
                                                w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border
                                                ${isLessonCompleted 
                                                    ? 'bg-[#00B050]/20 border-[#00B050] text-[#00B050]' 
                                                    : 'bg-white/5 border-white/10 text-white/50'
                                                }
                                            `}>
                                                {isLessonCompleted ? '✓' : lIdx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-bold text-white leading-tight group-hover/lesson:text-[#6C5DD3] transition-colors">{lesson.title}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${lesson.homeworkType === 'VIDEO' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        {lesson.homeworkType}
                                                    </span>
                                                    <span className="text-[8px] text-white/40">+{lesson.xpReward} XP</span>
                                                </div>
                                            </div>
                                            <div className="text-white/20 group-hover/lesson:text-white transition-colors">
                                                →
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        {/* Collapse Button (Bottom) */}
                        {isExpanded && (
                            <div className="relative z-10 flex justify-center pb-2">
                                <div className="w-12 h-1 bg-white/20 rounded-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );
};
