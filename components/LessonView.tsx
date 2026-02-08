
import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import ReactMarkdown from 'react-markdown';
import { Lesson, Module, UserProgress, HomeworkType } from '../types';
import { checkHomeworkWithAI } from '../services/geminiService';
import { telegram } from '../services/telegramService';
import { XPService, XP_RULES } from '../services/xpService';

const VideoPlayer = ReactPlayer as unknown as React.ComponentType<any>;

interface LessonViewProps {
  lesson: Lesson;
  isCompleted: boolean;
  onComplete: (lessonId: string, xpBonus: number) => void;
  onBack: () => void;
  onNavigate: (lessonId: string) => void;
  parentModule?: Module | null;
  userProgress: UserProgress;
  onUpdateUser: (data: Partial<UserProgress>) => void;
  onUpdateLesson?: (updatedLesson: Lesson) => void;
}

// Markdown Helper Component
const MarkdownToolbar = ({ onInsert }: { onInsert: (tag: string, placeholder?: string) => void }) => (
    <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => onInsert('**', 'bold')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5 font-bold">B</button>
        <button onClick={() => onInsert('*', 'italic')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5 italic">I</button>
        <button onClick={() => onInsert('\n# ', 'Header')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5">H1</button>
        <button onClick={() => onInsert('\n## ', 'Header')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5">H2</button>
        <button onClick={() => onInsert('[', 'Link](url)')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5">🔗</button>
        <button onClick={() => onInsert('\n- ', 'List Item')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5">List</button>
        <button onClick={() => onInsert('`', 'code')} className="px-2 py-1 bg-white/5 rounded text-[10px] hover:bg-white/10 border border-white/5 font-mono">Code</button>
    </div>
);

// Helper Component for Admin Sections
const EditSection = ({ title, isOpen, onToggle, children, icon, colorClass = "text-white" }: any) => (
  <div className={`bg-[#16181D] border ${isOpen ? 'border-[#6C5DD3]/30' : 'border-white/5'} rounded-2xl overflow-hidden transition-all duration-300 shadow-sm`}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-white/5 active:bg-white/10 transition-colors"
    >
      <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-lg">{icon}</div>
         <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass}`}>{title}</span>
      </div>
      <div className={`w-6 h-6 rounded-full bg-black/20 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : 'text-white/30'}`}>
        ▼
      </div>
    </button>
    <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 space-y-4 border-t border-white/5">
            {children}
        </div>
    </div>
  </div>
);

export const LessonView: React.FC<LessonViewProps> = ({ 
  lesson, 
  isCompleted, 
  onComplete, 
  onBack, 
  onNavigate, 
  parentModule,
  userProgress,
  onUpdateUser,
  onUpdateLesson
}) => {
  // User State
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Admin State
  const isAdmin = userProgress.role === 'ADMIN';
  const [isEditing, setIsEditing] = useState(false);
  const [editedLesson, setEditedLesson] = useState<Lesson>(lesson);
  // Track open sections in edit mode
  const [openSection, setOpenSection] = useState<'info' | 'content' | 'homework'>('content');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const questionsAskedCount = userProgress.stats?.questionsAsked?.[lesson.id] || 0;
  const questionsRemaining = XP_RULES.MAX_QUESTIONS_PER_LESSON - questionsAskedCount;

  // Sync edited state when lesson changes
  useEffect(() => {
      setEditedLesson(lesson);
      setIsVideoReady(false);
      // Reset scroll on lesson change
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
      else window.scrollTo(0, 0);
  }, [lesson]);

  const handleAskQuestion = () => {
      if (!questionText.trim()) return;
      setIsAsking(true);
      setTimeout(() => {
          const result = XPService.askQuestion(userProgress, lesson.id);
          if (result.allowed) {
              onUpdateUser(result.user);
              telegram.showAlert(`Запрос принят. Начислено ${result.xp} XP.`, 'Связь со штабом');
              setQuestionText('');
          } else {
              telegram.showAlert(result.message || 'Лимит исчерпан', 'Ошибка');
          }
          setIsAsking(false);
      }, 800);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    telegram.haptic('medium');

    const contentToSend = lesson.homeworkType === 'TEXT' ? inputText : selectedFile!;
    const result = await checkHomeworkWithAI(contentToSend, lesson.homeworkType, lesson.aiGradingInstruction);

    setIsSubmitting(false);
    if (result.passed) {
        const processResult = XPService.processHomework(userProgress, lesson.id, false); 
        onUpdateUser(processResult.user);
        onComplete(lesson.id, processResult.xp);
        setFeedback(result.feedback);
        telegram.haptic('success');
    } else {
        setFeedback(result.feedback);
        telegram.haptic('error');
    }
  };

  const handleSaveLesson = () => {
      if (onUpdateLesson) {
          onUpdateLesson(editedLesson);
          telegram.haptic('success');
          setIsEditing(false);
      }
  };

  const insertMarkdown = (tag: string, placeholder: string = '') => {
      const textarea = document.getElementById('contentEditor') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = editedLesson.content;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const selection = text.substring(start, end);

      const newContent = before + tag + (selection || placeholder) + (tag.trim().length > 1 && !tag.startsWith('\n') ? tag : '') + after;
      
      setEditedLesson({
          ...editedLesson,
          content: newContent
      });
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, end + tag.length);
      }, 0);
  };

  const videoUrl = lesson.videoUrl || parentModule?.videoUrl;
  const hasVideo = !!videoUrl;

  // Navigation Logic
  const currentIndex = parentModule?.lessons.findIndex(l => l.id === lesson.id) ?? -1;
  const prevLesson = currentIndex > 0 ? parentModule?.lessons[currentIndex - 1] : null;
  const nextLesson = (parentModule && currentIndex < parentModule.lessons.length - 1) ? parentModule.lessons[currentIndex + 1] : null;

  // --- ADMIN EDIT RENDER ---
  if (isEditing && isAdmin) {
      return (
        <div className="flex flex-col min-h-screen bg-[#0F1115] text-white">
            <div className="sticky top-0 z-50 px-6 pt-[calc(var(--safe-top)+10px)] pb-4 flex items-center justify-between bg-[#0F1115]/90 backdrop-blur-md border-b border-white/10 shadow-xl">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-white/10">Отмена</button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6C5DD3] animate-pulse">Режим Редактора</span>
                <button onClick={handleSaveLesson} className="px-4 py-2 rounded-xl bg-[#6C5DD3] text-[10px] font-bold text-white uppercase tracking-widest hover:bg-[#5b4eb5] shadow-lg shadow-[#6C5DD3]/20">Сохранить</button>
            </div>

            <div className="p-4 space-y-4 pb-40 overflow-y-auto">
                {/* 1. Basic Info Section */}
                <EditSection 
                    title="Основная информация" 
                    icon="📋" 
                    isOpen={openSection === 'info'} 
                    onToggle={() => setOpenSection(openSection === 'info' ? 'content' : 'info')}
                >
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Название</label>
                            <input 
                                value={editedLesson.title}
                                onChange={(e) => setEditedLesson({...editedLesson, title: e.target.value})}
                                className="w-full bg-[#1F2128] border border-white/10 p-4 rounded-xl font-bold text-white outline-none focus:border-[#6C5DD3] focus:bg-black/40 transition-all"
                                placeholder="Например: Психология Влияния"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Тизер (Описание)</label>
                            <textarea 
                                value={editedLesson.description}
                                onChange={(e) => setEditedLesson({...editedLesson, description: e.target.value})}
                                className="w-full bg-[#1F2128] border border-white/10 p-4 rounded-xl text-xs font-medium text-white/80 outline-none focus:border-[#6C5DD3] h-20 resize-none focus:bg-black/40 transition-all"
                                placeholder="Отображается в списке модулей..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Видео (YouTube)</label>
                            <div className="flex items-center gap-2 bg-[#1F2128] border border-white/10 rounded-xl p-2 focus-within:border-[#6C5DD3] transition-all">
                                <span className="pl-2 text-lg">📹</span>
                                <input 
                                    value={editedLesson.videoUrl || ''}
                                    onChange={(e) => setEditedLesson({...editedLesson, videoUrl: e.target.value})}
                                    className="w-full bg-transparent p-2 text-xs font-mono text-[#6C5DD3] outline-none"
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                        </div>
                    </div>
                </EditSection>

                {/* 2. Content Section */}
                <EditSection 
                    title="Контент Урока (Markdown)" 
                    icon="📝" 
                    isOpen={openSection === 'content'} 
                    onToggle={() => setOpenSection(openSection === 'content' ? 'homework' : 'content')}
                >
                    <div className="bg-[#1F2128] border border-white/10 rounded-xl p-2 focus-within:border-[#6C5DD3] transition-colors">
                        <MarkdownToolbar onInsert={insertMarkdown} />
                        <textarea 
                            id="contentEditor"
                            value={editedLesson.content}
                            onChange={(e) => setEditedLesson({...editedLesson, content: e.target.value})}
                            className="w-full bg-transparent text-sm font-mono text-white/90 outline-none h-[60vh] font-medium leading-relaxed resize-y focus:bg-black/20 p-2"
                            placeholder="# Заголовок\n\nОсновной текст урока..."
                        />
                    </div>
                </EditSection>

                {/* 3. Homework & AI Section */}
                <EditSection 
                    title="Боевая Задача (ДЗ)" 
                    icon="🎯" 
                    colorClass="text-yellow-500"
                    isOpen={openSection === 'homework'} 
                    onToggle={() => setOpenSection(openSection === 'homework' ? 'info' : 'homework')}
                >
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Формат сдачи</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['TEXT', 'PHOTO', 'VIDEO', 'FILE'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setEditedLesson({...editedLesson, homeworkType: t as HomeworkType})}
                                        className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${editedLesson.homeworkType === t ? 'bg-[#6C5DD3] text-white border-[#6C5DD3]' : 'border-white/10 text-slate-500 hover:bg-white/5'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Текст задания (Для студента)</label>
                            <textarea 
                                value={editedLesson.homeworkTask}
                                onChange={(e) => setEditedLesson({...editedLesson, homeworkTask: e.target.value})}
                                className="w-full bg-[#1F2128] border border-white/10 p-4 rounded-xl text-sm font-medium text-white/80 outline-none focus:border-[#6C5DD3] h-24 resize-none focus:bg-black/40"
                                placeholder="Опишите, что нужно сделать..."
                            />
                        </div>

                        {/* Classified Section */}
                        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                                <span className="text-4xl">🤖</span>
                            </div>
                            <label className="text-[9px] font-black uppercase text-red-400 tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                Инструкция для AI (Скрыто)
                            </label>
                            <textarea 
                                value={editedLesson.aiGradingInstruction}
                                onChange={(e) => setEditedLesson({...editedLesson, aiGradingInstruction: e.target.value})}
                                className="w-full bg-black/40 border border-red-500/20 p-3 rounded-lg text-xs font-mono text-red-100/80 outline-none focus:border-red-500 h-32 resize-none"
                                placeholder="Критерии оценки для ИИ. Пример: 'Проверь уверенность голоса. Отклоняй, если короче 10 слов'."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-yellow-500 tracking-widest ml-1">Награда (XP)</label>
                            <input 
                                type="number"
                                value={editedLesson.xpReward}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setEditedLesson({...editedLesson, xpReward: isNaN(val) ? 0 : val});
                                }}
                                className="w-full bg-[#1F2128] border border-yellow-500/20 p-4 rounded-xl text-xl font-black text-yellow-500 outline-none focus:border-yellow-500 text-center"
                            />
                        </div>
                    </div>
                </EditSection>
            </div>
        </div>
      );
  }

  // --- STANDARD VIEW RENDER ---
  return (
    <div className="flex flex-col min-h-screen bg-body">
      {/* Premium Header */}
      <div className="sticky top-0 z-40 px-6 pt-[calc(var(--safe-top)+10px)] pb-4 flex items-center justify-between island-blur bg-body/80 border-b border-white/5 transition-all">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-surface border border-border-color flex items-center justify-center text-text-primary active:scale-90 transition-all shadow-sm">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="text-center px-4 flex-1">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#6C5DD3] mb-0.5 block">Текущая задача</span>
             <h2 className="text-sm font-black text-text-primary truncate">{lesson.title}</h2>
        </div>
        <div className="flex items-center gap-2">
            {isAdmin && (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="w-10 h-10 rounded-2xl bg-[#6C5DD3]/10 text-[#6C5DD3] flex items-center justify-center border border-[#6C5DD3]/20 hover:bg-[#6C5DD3] hover:text-white transition-all"
                >
                    ✎
                </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-[#6C5DD3]/10 text-[#6C5DD3] flex items-center justify-center font-black text-[10px] border border-[#6C5DD3]/20">
                {lesson.xpReward}
            </div>
        </div>
      </div>

      <div className="px-6 pt-6 pb-40 max-w-2xl mx-auto w-full space-y-8 animate-fade-in">
        
        {/* Video Player Section */}
        {hasVideo && (
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl aspect-video bg-black ring-1 ring-white/5">
                {!isVideoReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#16181D] animate-pulse z-10">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-[#6C5DD3] animate-spin"></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Загрузка данных...</span>
                        </div>
                    </div>
                )}
                <VideoPlayer 
                    url={videoUrl} 
                    width="100%" 
                    height="100%" 
                    controls={true}
                    onReady={() => setIsVideoReady(true)}
                    config={{ youtube: { playerVars: { origin: window.location.origin }}}}
                />
            </div>
        )}

        {/* Content Card */}
        <div className="bg-surface p-8 rounded-[2.5rem] border border-border-color shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6C5DD3]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <div className="markdown-content text-text-primary/90">
                <ReactMarkdown
                    components={{
                        h1: ({node, ...p}) => <h1 className="text-2xl font-black mb-6 text-text-primary tracking-tight" {...p} />,
                        h2: ({node, ...p}) => <h2 className="text-xl font-bold mt-10 mb-4 text-text-primary border-l-4 border-[#6C5DD3] pl-4" {...p} />,
                        p: ({node, ...p}) => <p className="mb-6 leading-relaxed font-medium opacity-80" {...p} />,
                        ul: ({node, ...p}) => <ul className="list-disc pl-6 mb-6 space-y-2 marker:text-[#6C5DD3]" {...p} />,
                        blockquote: ({node, ...p}) => <blockquote className="border-l-4 border-[#6C5DD3] bg-[#6C5DD3]/5 p-5 rounded-2xl italic my-8 text-text-primary/70" {...p} />,
                    }}
                >
                    {lesson.content}
                </ReactMarkdown>
            </div>
        </div>

        {/* Questions Section */}
        <div className="bg-surface p-6 rounded-[2.5rem] border border-border-color shadow-sm space-y-4">
             <div className="flex justify-between items-center">
                 <h3 className="text-text-primary font-black uppercase text-xs tracking-widest">Прямая связь</h3>
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${questionsRemaining > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                     Лимит: {questionsRemaining}/5
                 </span>
             </div>
             <div className="flex gap-2">
                 <input 
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Ваш вопрос Командиру..."
                    disabled={questionsRemaining <= 0 || isAsking}
                    className="flex-1 bg-body border border-border-color rounded-2xl px-5 py-3 text-sm focus:border-[#6C5DD3] outline-none disabled:opacity-50 transition-all"
                 />
                 <button 
                    onClick={handleAskQuestion}
                    disabled={questionsRemaining <= 0 || isAsking || !questionText.trim()}
                    className="bg-[#6C5DD3] text-white rounded-2xl w-12 h-12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                 >
                    {isAsking ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '➤'}
                 </button>
             </div>
        </div>

        {/* Homework Section */}
        {!isCompleted ? (
            <div className="relative rounded-[3rem] overflow-hidden bg-[#16181D] shadow-2xl p-8 group border border-white/5">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#6C5DD3] to-[#FFAB7B]"></div>
                
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[#6C5DD3] flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(108,93,211,0.3)]">
                        {lesson.homeworkType === 'VIDEO' ? '📹' : lesson.homeworkType === 'PHOTO' ? '📸' : '✍️'}
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-white tracking-tight">Боевая задача</h3>
                        <p className="text-[#6C5DD3] text-[9px] font-black uppercase tracking-[0.2em] mt-1">Вердикт выносит AI-Командир</p>
                    </div>
                </div>
                
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-8 italic text-white/80 text-sm leading-relaxed">
                     "{lesson.homeworkTask}"
                </div>
                
                {lesson.homeworkType === 'TEXT' ? (
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Введите отчет о выполнении..."
                        className="w-full bg-black/40 text-white p-5 rounded-2xl border border-white/10 focus:border-[#6C5DD3] outline-none h-48 mb-8 resize-none text-sm transition-all focus:ring-1 focus:ring-[#6C5DD3]/50"
                    />
                ) : (
                    <div onClick={() => fileInputRef.current?.click()} className={`w-full h-40 mb-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile ? 'border-green-500 bg-green-500/5' : 'border-white/10 hover:border-[#6C5DD3] bg-white/5'}`}>
                        <input type="file" ref={fileInputRef} onChange={e => {
                            const f = e.target.files?.[0];
                            if(f) {
                                const r = new FileReader();
                                r.onloadend = () => setSelectedFile(r.result as string);
                                r.readAsDataURL(f);
                            }
                        }} className="hidden" />
                        {selectedFile ? <span className="text-green-500 font-black uppercase text-xs">✓ Материал загружен</span> : <span className="text-white/30 text-xs font-black uppercase">Нажмите для загрузки</span>}
                    </div>
                )}
                
                {feedback && (
                    <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl animate-fade-in backdrop-blur-md">
                        <p className="text-white/90 text-sm leading-relaxed font-medium">👮‍♂️ <span className="font-black uppercase text-[10px] text-red-400 tracking-widest ml-1">Командир:</span> {feedback}</p>
                    </div>
                )}

                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || (lesson.homeworkType === 'TEXT' ? !inputText.trim() : !selectedFile)} 
                    className="w-full py-5 bg-[#6C5DD3] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#6C5DD3]/20 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? 'АНАЛИЗ...' : 'ОТПРАВИТЬ ОТЧЕТ'}
                </button>
            </div>
        ) : (
            <div className="bg-green-500/10 rounded-[3rem] p-12 text-center border border-green-500/20 shadow-inner">
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-xl animate-float">✓</div>
                <h3 className="text-green-500 font-black text-2xl uppercase tracking-tighter mb-2">Задача Выполнена</h3>
                <p className="text-green-500/60 text-xs font-black uppercase tracking-widest">+ {lesson.xpReward} XP получено</p>
            </div>
        )}

        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-border-color">
            <button
                onClick={() => { if (prevLesson) { onNavigate(prevLesson.id); telegram.haptic('selection'); } }}
                disabled={!prevLesson}
                className={`
                    py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2
                    ${!prevLesson 
                        ? 'opacity-30 cursor-not-allowed text-text-secondary border border-border-color bg-surface/50' 
                        : 'bg-surface border border-border-color text-text-primary hover:border-[#6C5DD3] active:scale-95 shadow-sm'
                    }
                `}
            >
                <span>←</span> Назад
            </button>
            
            <button
                onClick={() => { if (nextLesson) { onNavigate(nextLesson.id); telegram.haptic('selection'); } }}
                disabled={!nextLesson}
                className={`
                    py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2
                    ${!nextLesson 
                        ? 'opacity-30 cursor-not-allowed text-text-secondary border border-border-color bg-surface/50' 
                        : 'bg-[#6C5DD3] text-white shadow-lg shadow-[#6C5DD3]/20 active:scale-95 hover:bg-[#5b4eb5]'
                    }
                `}
            >
                Далее <span>→</span>
            </button>
        </div>
      </div>
    </div>
  );
};
