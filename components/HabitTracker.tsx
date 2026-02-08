
import React, { useState, useEffect } from 'react';
import { Habit, Goal, SmartNavAction } from '../types';
import { telegram } from '../services/telegramService';
import { XPService } from '../services/xpService';

interface HabitTrackerProps {
    habits: Habit[];
    goals: Goal[];
    onUpdateHabits: (newHabits: Habit[]) => void;
    onUpdateGoals: (newGoals: Goal[]) => void;
    onXPEarned: (amount: number) => void;
    onBack: () => void;
    setNavAction?: (action: SmartNavAction | null) => void;
    isAuthenticated?: boolean;
}

type TabType = 'HABITS' | 'GOALS';

export const HabitTracker: React.FC<HabitTrackerProps> = ({ 
    habits, goals, onUpdateHabits, onUpdateGoals, onXPEarned, onBack, setNavAction, isAuthenticated 
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('HABITS');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // --- EDIT STATE ---
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // --- FORM STATE ---
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIcon, setFormIcon] = useState('🔥');
    
    // Goal Specific
    const [formTarget, setFormTarget] = useState('');
    const [formUnit, setFormUnit] = useState('₽');

    const today = new Date().toISOString().split('T')[0];

    // --- ICONS SELECTOR ---
    const AVAILABLE_ICONS = ['🔥', '💧', '💪', '📚', '🧘', '💰', '🧠', '🥦', '🏃', '💤', '🎯', '🚀', '⭐', '💎'];

    // --- SMART NAV INTEGRATION ---
    useEffect(() => {
        if (!setNavAction) return;

        if (isAuthenticated) {
            if (isModalOpen) {
                setNavAction({
                    label: editingId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ',
                    onClick: handleSave,
                    variant: 'success',
                    icon: '💾'
                });
            } else {
                setNavAction({
                    label: activeTab === 'HABITS' ? 'НОВАЯ ПРИВЫЧКА' : 'НОВАЯ ЦЕЛЬ',
                    onClick: () => openModal(),
                    variant: 'primary',
                    icon: '+'
                });
            }
        } else {
            setNavAction(null);
        }

        return () => { setNavAction(null); };
    }, [activeTab, isModalOpen, formTitle, formTarget, formUnit, formIcon, formDescription, editingId, isAuthenticated]);

    // --- LOGIC ---

    const openModal = (item?: Habit | Goal) => {
        if (item) {
            // Edit Mode
            setEditingId(item.id);
            setFormTitle(item.title);
            if ('description' in item) setFormDescription(item.description || '');
            if ('icon' in item) setFormIcon(item.icon);
            if ('targetValue' in item) setFormTarget(item.targetValue.toString());
            if ('unit' in item) setFormUnit(item.unit);
        } else {
            // Create Mode
            setEditingId(null);
            setFormTitle('');
            setFormDescription('');
            setFormIcon('🔥');
            setFormTarget('');
            setFormUnit('₽');
        }
        setIsModalOpen(true);
        telegram.haptic('selection');
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSave = () => {
        if (!formTitle.trim()) {
            telegram.haptic('error');
            return;
        }

        if (activeTab === 'HABITS') {
            if (editingId) {
                // Update Habit
                const updated = habits.map(h => h.id === editingId ? { ...h, title: formTitle, description: formDescription, icon: formIcon } : h);
                onUpdateHabits(updated);
            } else {
                // Create Habit
                const newHabit: Habit = {
                    id: Date.now().toString(),
                    title: formTitle,
                    description: formDescription,
                    streak: 0,
                    completedDates: [],
                    targetDaysPerWeek: 7,
                    icon: formIcon
                };
                onUpdateHabits([...habits, newHabit]);
            }
        } else {
            // Goals
            if (!formTarget) { telegram.haptic('error'); return; }
            
            if (editingId) {
                // Update Goal
                const updated = goals.map(g => g.id === editingId ? { ...g, title: formTitle, targetValue: parseFloat(formTarget), unit: formUnit } : g);
                onUpdateGoals(updated);
            } else {
                // Create Goal
                const newGoal: Goal = {
                    id: Date.now().toString(),
                    title: formTitle,
                    currentValue: 0,
                    targetValue: parseFloat(formTarget),
                    unit: formUnit,
                    isCompleted: false,
                    colorStart: '#6C5DD3',
                    colorEnd: '#FFAB7B'
                };
                onUpdateGoals([...goals, newGoal]);
            }
        }
        closeModal();
        telegram.haptic('success');
    };

    const toggleHabit = (habitId: string, date: string) => {
        telegram.haptic('selection');
        const updated = habits.map(h => {
            if (h.id === habitId) {
                const isCompleted = h.completedDates.includes(date);
                let newDates = isCompleted 
                    ? h.completedDates.filter(d => d !== date)
                    : [...h.completedDates, date];
                
                return { ...h, completedDates: newDates, streak: newDates.length }; // Streak logic simplified
            }
            return h;
        });
        onUpdateHabits(updated);
    };

    const deleteItem = (id: string) => {
        if(confirm('Удалить элемент?')) {
            if (activeTab === 'HABITS') {
                onUpdateHabits(habits.filter(h => h.id !== id));
            } else {
                onUpdateGoals(goals.filter(g => g.id !== id));
            }
            telegram.haptic('warning');
        }
    };
    
    const updateGoalProgress = (id: string, amount: number) => {
        const updated = goals.map(g => {
            if (g.id === id) {
                const newValue = Math.min(g.targetValue, Math.max(0, g.currentValue + amount));
                const wasCompleted = g.isCompleted;
                const isNowCompleted = newValue >= g.targetValue;
                
                if (!wasCompleted && isNowCompleted) {
                    telegram.haptic('success');
                    telegram.showAlert(`🏆 ЦЕЛЬ ДОСТИГНУТА: ${g.title}`, 'ЛЕГЕНДА');
                    onXPEarned(500);
                } else if (amount > 0) {
                    telegram.haptic('light');
                }

                return { ...g, currentValue: newValue, isCompleted: isNowCompleted };
            }
            return g;
        });
        onUpdateGoals(updated);
    };

    const getCalendarDays = () => {
        const days = [];
        for (let i = -3; i <= 3; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    };
    const calendarDays = getCalendarDays();

    // --- TEASER RENDER IF NOT AUTHENTICATED ---
    if (!isAuthenticated) {
        return (
            <div className="flex flex-col h-full bg-body text-text-primary animate-fade-in relative p-6">
                <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-surface border border-border-color flex items-center justify-center text-text-primary mb-6">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-text-primary uppercase tracking-tight">Трекер Дисциплины</h2>
                    <p className="text-text-secondary text-sm mt-2">Развивай полезные привычки и ставь амбициозные цели.</p>
                </div>
                
                {/* Blurred Demo Content */}
                <div className="relative overflow-hidden rounded-[2.5rem] border border-border-color bg-surface h-[300px]">
                    <div className="absolute inset-0 z-10 bg-body/20 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-[#6C5DD3] rounded-full flex items-center justify-center text-3xl mb-4 shadow-lg shadow-[#6C5DD3]/30">🔒</div>
                        <h3 className="text-xl font-black text-text-primary uppercase mb-2">Доступ закрыт</h3>
                        <p className="text-text-secondary text-xs mb-6">Авторизуйтесь, чтобы отслеживать свой прогресс и получать награды.</p>
                        <button onClick={onBack} className="px-6 py-3 bg-[#6C5DD3] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">Войти в профиль</button>
                    </div>
                    {/* Fake Data Background */}
                    <div className="p-4 space-y-3 opacity-30 pointer-events-none filter blur-sm">
                        <div className="bg-body h-20 rounded-2xl w-full"></div>
                        <div className="bg-body h-20 rounded-2xl w-full"></div>
                        <div className="bg-body h-20 rounded-2xl w-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-body text-text-primary animate-fade-in relative">
            {/* Header */}
            <div className="px-6 pt-[calc(var(--safe-top)+10px)] pb-4 flex items-center justify-between bg-body/90 backdrop-blur-md sticky top-0 z-20 border-b border-border-color">
                <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-surface border border-border-color flex items-center justify-center active:scale-90 transition-transform text-text-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex bg-surface p-1 rounded-xl border border-border-color">
                    <button 
                        onClick={() => setActiveTab('HABITS')}
                        className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'HABITS' ? 'bg-[#6C5DD3] text-white shadow-lg' : 'text-text-secondary'}`}
                    >
                        Привычки
                    </button>
                    <button 
                        onClick={() => setActiveTab('GOALS')}
                        className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'GOALS' ? 'bg-[#6C5DD3] text-white shadow-lg' : 'text-text-secondary'}`}
                    >
                        Цели
                    </button>
                </div>
                <div className="w-10"></div> 
            </div>

            <div className="p-4 pb-40 overflow-y-auto space-y-4 custom-scrollbar">
                
                {/* --- HABITS VIEW --- */}
                {activeTab === 'HABITS' && (
                    <div className="space-y-4 animate-slide-up">
                        {/* Scrollable Calendar Header for Mobile */}
                        <div className="bg-surface px-4 py-4 rounded-3xl border border-border-color shadow-sm overflow-x-auto no-scrollbar">
                            <div className="flex justify-between min-w-[300px]">
                                {calendarDays.map((d, i) => {
                                    const iso = d.toISOString().split('T')[0];
                                    const isToday = iso === today;
                                    return (
                                        <div key={i} className={`flex flex-col items-center gap-2 ${isToday ? 'opacity-100 scale-110' : 'opacity-50'}`}>
                                            <span className="text-[9px] font-black uppercase text-text-secondary">{['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()]}</span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border transition-all ${isToday ? 'bg-[#6C5DD3] text-white border-[#6C5DD3] shadow-lg shadow-[#6C5DD3]/30' : 'border-border-color bg-body text-text-primary'}`}>
                                                {d.getDate()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {habits.length === 0 && (
                            <div className="text-center py-20 opacity-40">
                                <span className="text-6xl block mb-4 grayscale">🧘</span>
                                <p className="text-sm font-black uppercase tracking-widest text-text-secondary">Дисциплина начинается здесь</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {habits.map((habit) => (
                                <div key={habit.id} className="bg-surface border border-border-color rounded-3xl p-4 relative group shadow-sm transition-all hover:shadow-md">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => openModal(habit)}>
                                            <div className="w-12 h-12 rounded-2xl bg-body border border-border-color flex items-center justify-center text-2xl shadow-inner">
                                                {habit.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-text-primary leading-tight">{habit.title}</h3>
                                                {habit.description && <p className="text-[10px] text-text-secondary line-clamp-1 mt-0.5">{habit.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide bg-orange-500/10 text-orange-500 px-2 py-1 rounded-lg border border-orange-500/20">
                                                <span>🔥</span> 
                                                <span>{habit.streak}</span>
                                            </div>
                                            <button onClick={() => deleteItem(habit.id)} className="text-[9px] text-red-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Удалить</button>
                                        </div>
                                    </div>

                                    {/* Interaction Row - Adaptive */}
                                    <div className="flex justify-between items-center bg-body/50 rounded-2xl p-2 overflow-x-auto no-scrollbar">
                                        <div className="flex justify-between w-full min-w-[280px]">
                                            {calendarDays.map((d, i) => {
                                                const iso = d.toISOString().split('T')[0];
                                                const isDone = habit.completedDates.includes(iso);
                                                const isFuture = d > new Date();
                                                const isToday = iso === today;
                                                
                                                if (isToday) {
                                                    return (
                                                        <button 
                                                            key={i}
                                                            onClick={() => toggleHabit(habit.id, today)}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${isDone ? 'bg-[#00B050] text-white scale-110' : 'bg-surface border border-border-color text-text-secondary hover:border-[#6C5DD3]'}`}
                                                        >
                                                            {isDone ? '✓' : ''}
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <div key={i} className={`w-10 h-10 flex items-center justify-center`}>
                                                        <div className={`w-2 h-2 rounded-full ${isFuture ? 'bg-border-color' : isDone ? 'bg-[#00B050]' : 'bg-red-500/20'}`}></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- GOALS VIEW --- */}
                {activeTab === 'GOALS' && (
                    <div className="space-y-4 animate-slide-up">
                        {goals.length === 0 && (
                            <div className="text-center py-20 opacity-40">
                                <span className="text-6xl block mb-4 grayscale">🎯</span>
                                <p className="text-sm font-black uppercase tracking-widest text-text-secondary">Цели не заданы</p>
                            </div>
                        )}

                        <div className="grid gap-4">
                            {goals.map((goal) => {
                                const percent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
                                const step = goal.targetValue > 1000 ? 1000 : goal.targetValue > 100 ? 100 : 1;

                                return (
                                    <div key={goal.id} className="bg-surface border border-border-color rounded-[2.5rem] p-6 relative overflow-hidden shadow-lg group">
                                        {/* Progress Background */}
                                        <div className="absolute bottom-0 left-0 h-1.5 w-full bg-body">
                                            <div 
                                                className="h-full transition-all duration-1000 ease-out relative"
                                                style={{ 
                                                    width: `${percent}%`,
                                                    background: `linear-gradient(to right, ${goal.colorStart || '#6C5DD3'}, ${goal.colorEnd || '#FFAB7B'})` 
                                                }}
                                            >
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-md"></div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start mb-6">
                                            <div onClick={() => openModal(goal)} className="cursor-pointer">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-lg text-text-primary">{goal.title}</h3>
                                                    {goal.isCompleted && <span className="text-lg animate-bounce">🏆</span>}
                                                </div>
                                                <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">
                                                    {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()} {goal.unit}
                                                </p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-3xl font-black text-[#6C5DD3]">{percent}%</span>
                                            </div>
                                        </div>

                                        {/* Controls */}
                                        {!goal.isCompleted ? (
                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={() => updateGoalProgress(goal.id, step)}
                                                    className="flex-1 py-3 bg-body hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[10px] font-black border border-border-color active:scale-95 transition-all text-text-primary"
                                                >
                                                    +{step.toLocaleString()} {goal.unit}
                                                </button>
                                                <button 
                                                    onClick={() => updateGoalProgress(goal.id, step * 5)}
                                                    className="flex-1 py-3 bg-body hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[10px] font-black border border-border-color active:scale-95 transition-all text-text-primary"
                                                >
                                                    +{ (step * 5).toLocaleString() } {goal.unit}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="py-3 bg-[#00B050]/10 text-[#00B050] text-center rounded-xl text-xs font-black uppercase tracking-[0.2em] border border-[#00B050]/20 animate-pulse">
                                                ДОСТИГНУТО
                                            </div>
                                        )}
                                        
                                        <button onClick={() => deleteItem(goal.id)} className="absolute top-4 right-4 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">✕</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-end sm:items-center justify-center animate-fade-in pb-0 sm:pb-10">
                    <div className="w-full sm:max-w-sm bg-surface rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 pb-12 border-t border-border-color shadow-2xl animate-slide-up">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-text-primary">
                                {editingId ? 'Редактировать' : 'Создать'}
                            </h3>
                            <button onClick={closeModal} className="w-8 h-8 rounded-full bg-body flex items-center justify-center text-text-secondary hover:text-text-primary">✕</button>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-text-secondary ml-2">Название</label>
                                <input 
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Например: Бег по утрам"
                                    className="w-full bg-body border border-border-color p-4 rounded-2xl text-text-primary font-bold outline-none focus:border-[#6C5DD3] transition-colors"
                                    autoFocus
                                />
                            </div>

                            {activeTab === 'HABITS' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-text-secondary ml-2">Описание</label>
                                        <input 
                                            value={formDescription}
                                            onChange={e => setFormDescription(e.target.value)}
                                            placeholder="Детали (опционально)"
                                            className="w-full bg-body border border-border-color p-4 rounded-2xl text-xs text-text-primary outline-none focus:border-[#6C5DD3] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-text-secondary mb-2 block ml-2">Иконка</label>
                                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                            {AVAILABLE_ICONS.map(icon => (
                                                <button 
                                                    key={icon}
                                                    onClick={() => setFormIcon(icon)}
                                                    className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl border transition-all ${formIcon === icon ? 'bg-[#6C5DD3] border-[#6C5DD3] shadow-lg shadow-[#6C5DD3]/30 scale-110' : 'bg-body border-border-color'}`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'GOALS' && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[9px] font-black uppercase text-text-secondary ml-2">Цель (число)</label>
                                        <input 
                                            type="number"
                                            value={formTarget}
                                            onChange={e => setFormTarget(e.target.value)}
                                            placeholder="100000"
                                            className="w-full bg-body border border-border-color p-4 rounded-2xl text-text-primary font-bold outline-none focus:border-[#6C5DD3]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-text-secondary ml-2">Ед.изм.</label>
                                        <select 
                                            value={formUnit}
                                            onChange={e => setFormUnit(e.target.value)}
                                            className="w-full bg-body border border-border-color p-4 rounded-2xl text-text-primary font-bold outline-none h-[58px]"
                                        >
                                            <option value="₽">₽</option>
                                            <option value="$">$</option>
                                            <option value="km">км</option>
                                            <option value="kg">кг</option>
                                            <option value="#">шт</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            
                            <div className="pt-4 text-center">
                                <p className="text-text-secondary/50 text-[9px] font-black uppercase tracking-widest">
                                    Нажмите кнопку "Сохранить" внизу
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
