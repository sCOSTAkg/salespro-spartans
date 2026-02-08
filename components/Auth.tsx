
import React, { useState, useRef, useEffect } from 'react';
import { generateSpartanAvatar } from '../services/geminiService';
import { telegram } from '../services/telegramService';
import { Button } from './Button';
import { UserProgress, UserDossier } from '../types';
import { Backend } from '../services/backendService';

interface AuthProps {
  onLogin: (data: any) => void;
  existingUsers?: UserProgress[];
}

type AuthStep = 'CHECKING' | 'AUTH_FORM' | 'IDENTITY' | 'DOSSIER' | 'SCANNING' | 'FINALIZING';

export const Auth: React.FC<AuthProps> = ({ onLogin, existingUsers = [] }) => {
  const [step, setStep] = useState<AuthStep>('CHECKING');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Identity Data
  const [realName, setRealName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Dossier Data (Split into parts for UX)
  const [dossierStep, setDossierStep] = useState<number>(0); // 0: Bio, 1: Social, 2: Goals
  const [dossier, setDossier] = useState<UserDossier>({
      height: '',
      weight: '',
      birthDate: '',
      location: '',
      livingSituation: 'ALONE',
      workExperience: '',
      incomeGoal: '',
      courseExpectations: '',
      courseGoals: '',
      motivation: ''
  });

  const defaultArmorStyle = 'Classic Bronze';
  
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isShake, setIsShake] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dossierContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initAuth = async () => {
        if (telegram.isAvailable && telegram.user) {
            const tgUser = telegram.user;
            const tgId = tgUser.id.toString();
            setLoadingText('АВТОМАТИЧЕСКАЯ ИДЕНТИФИКАЦИЯ...');
            await new Promise(r => setTimeout(r, 600));

            let user = existingUsers.find(u => u.telegramId === tgId);
            if (!user && tgUser.username) {
                 user = existingUsers.find(u => u.telegramUsername?.toLowerCase() === tgUser.username?.toLowerCase());
            }
            if (!user) {
                const checkUser = await Backend.syncUser({ telegramId: tgId, name: '' } as UserProgress);
                if (checkUser.name) user = checkUser;
            }

            if (user) {
                telegram.haptic('success');
                onLogin({ 
                    ...user, 
                    telegramId: tgId, 
                    isAuthenticated: true,
                    isRegistration: false 
                });
            } else {
                telegram.haptic('light');
                const combinedName = `${tgUser.first_name} ${tgUser.last_name || ''}`.trim();
                setRealName(combinedName);
                setUsername(tgUser.username || `user_${tgId}`);
                setIsRegisterMode(true);
                setStep('IDENTITY');
            }
        } else {
            setStep('AUTH_FORM');
            if (telegram.user?.username) setUsername(telegram.user.username);
        }
    };
    initAuth();
  }, []);

  useEffect(() => {
      // Scroll to top when dossier step changes
      if (step === 'DOSSIER') {
          dossierContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [dossierStep, step]);

  const handleError = (field: string, msg: string) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
    setIsShake(true);
    telegram.haptic('error');
    setTimeout(() => setIsShake(false), 500);
  };

  const updateDossier = (field: keyof UserDossier, value: string) => {
      setDossier(prev => ({ ...prev, [field]: value }));
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^a-zA-Z0-9_@]/g, '');
      setUsername(val);
      if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
  };

  const handleAuthSubmit = () => {
    setErrors({});
    const cleanUsername = username.trim().replace('@', '');
    const cleanPassword = password.trim();
    let hasError = false;

    // Username Validation
    if (!cleanUsername) { 
        handleError('username', 'Введите Username'); 
        hasError = true; 
    } else if (cleanUsername.length < 3) {
        handleError('username', 'Минимум 3 символа');
        hasError = true;
    }

    // Password Validation
    if (!cleanPassword) { 
        handleError('password', 'Введите пароль'); 
        hasError = true; 
    } else if (cleanPassword.length < 4) { 
        handleError('password', 'Пароль слишком короткий (мин. 4)'); 
        hasError = true; 
    }

    if (hasError) return;

    // Admin Bypass
    if (cleanUsername === 'admin' && cleanPassword === '55555sa5') {
        telegram.haptic('success');
        onLogin({
            role: 'ADMIN',
            name: 'Commander',
            telegramUsername: 'admin',
            isRegistration: false,
            avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=1F2128&color=fff',
            armorStyle: 'Golden God' 
        });
        return;
    }

    if (isRegisterMode) {
        const userExists = existingUsers.some(u => u.telegramUsername?.toLowerCase() === cleanUsername.toLowerCase());
        if (userExists) { handleError('username', 'Пользователь уже существует'); return; }
        
        telegram.haptic('light');
        setStep('IDENTITY');
    } else {
        const user = existingUsers.find(u => u.telegramUsername?.toLowerCase() === cleanUsername.toLowerCase());
        if (!user) { handleError('username', 'Пользователь не найден'); return; }
        if (user.password && user.password !== cleanPassword) { handleError('password', 'Неверный пароль'); return; }

        telegram.haptic('success');
        onLogin({ ...user, isRegistration: false });
    }
  };

  const handleIdentitySubmit = () => {
    if (!realName.trim()) { handleError('name', 'Введите имя'); return; }
    if (!selectedImage) { handleError('photo', 'Загрузите фото'); return; }
    
    setStep('DOSSIER'); // Move to Questionaire instead of scanning
    setDossierStep(0);
    telegram.haptic('success');
  };

  const handleDossierNext = () => {
      // Validation for Step 0 (Bio)
      if (dossierStep === 0) {
          if (!dossier.height) { handleError('height', 'Укажите рост'); return; }
          if (!dossier.weight) { handleError('weight', 'Укажите вес'); return; }
          if (!dossier.birthDate) { handleError('birthDate', 'Укажите дату рождения'); return; }
          if (!dossier.location) { handleError('location', 'Укажите город'); return; }
          setDossierStep(1);
          telegram.haptic('selection');
      }
      // Validation for Step 1 (Background & Goals)
      else if (dossierStep === 1) {
          if (!dossier.workExperience) { handleError('workExperience', 'Заполните опыт'); return; }
          if (!dossier.incomeGoal) { handleError('incomeGoal', 'Укажите цель'); return; }
          
          setDossierStep(2);
          telegram.haptic('selection');
      }
      // Validation for Step 2 (Motivation - Final)
      else {
          if (!dossier.courseGoals) { handleError('courseGoals', 'Заполните поле'); return; }
          if (!dossier.motivation) { handleError('motivation', 'Заполните поле'); return; }

          setStep('SCANNING');
          setLoadingText('АНАЛИЗ ДОСЬЕ И БИОМЕТРИИ...');
          setTimeout(() => {
              telegram.haptic('medium');
              handleFinalize();
          }, 2000);
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { handleError('photo', 'Макс. размер 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => { 
          setSelectedImage(reader.result as string); 
          setErrors(prev => ({...prev, photo: ''}));
          telegram.haptic('selection');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = async () => {
    setStep('FINALIZING');
    const loadingMessages = ['СБОРКА ЭКИПИРОВКИ...', 'ГЕНЕРАЦИЯ АВАТАРА...', 'ЗАПИСЬ В РЕЕСТР...'];
    let msgIdx = 0;
    const interval = setInterval(() => {
        setLoadingText(loadingMessages[msgIdx % loadingMessages.length]);
        msgIdx++;
    }, 1500);

    try {
        const base64Data = selectedImage!.split(',')[1];
        const avatarUrl = await generateSpartanAvatar(base64Data, 1, defaultArmorStyle);
        clearInterval(interval);
        telegram.haptic('success');
        
        const cleanUsername = username.trim().replace('@', '');
        const inviteLink = `https://t.me/SalesProBot?start=ref_${cleanUsername}`;
        const tgId = telegram.user?.id.toString();

        const newUser: any = { 
            role: 'STUDENT', 
            name: realName, 
            telegramUsername: cleanUsername,
            telegramId: tgId, 
            password: password.trim() || 'tg_auth',
            originalPhoto: base64Data, 
            avatarUrl, 
            armorStyle: defaultArmorStyle,
            inviteLink: inviteLink,
            dossier: dossier,
            isRegistration: true
        };

        await Backend.saveUser(newUser);
        onLogin(newUser);

    } catch (e) { 
        clearInterval(interval);
        handleError('global', 'Ошибка сети. Попробуйте еще раз.'); 
        setStep('IDENTITY'); // Go back to start if failed
    }
  };

  const renderChecking = () => (
      <div className="flex flex-col items-center justify-center animate-pulse py-20">
           <div className="w-16 h-16 border-4 border-[#6C5DD3] border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="text-[#6C5DD3] font-black text-xs uppercase tracking-[0.2em]">{loadingText || 'ПОИСК ПРОФИЛЯ...'}</p>
      </div>
  );

  const renderAuthForm = () => (
    <div className={`w-full max-w-sm mx-auto animate-fade-in ${isShake ? 'animate-shake' : ''}`}>
       <div className="mb-10 text-center">
           <div className="w-16 h-16 bg-[#6C5DD3]/10 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto text-[#6C5DD3] border border-[#6C5DD3]/20 shadow-lg">
               🛡️
           </div>
           <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">ДОСТУП</h2>
           <p className="text-slate-500 dark:text-white/50 text-sm font-medium">Для доступа к полному функционалу и сохранению прогресса войдите в систему.</p>
       </div>

       <div className="bg-white dark:bg-[#1F2128] p-1.5 rounded-2xl flex relative mb-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm">
          <div 
             className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#6C5DD3] rounded-xl shadow-lg transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isRegisterMode ? 'left-[calc(50%+3px)]' : 'left-1.5'}`}
          ></div>
          <button 
             onClick={() => { setIsRegisterMode(false); setErrors({}); }} 
             className={`flex-1 py-3 text-xs font-black uppercase tracking-widest relative z-10 transition-colors ${!isRegisterMode ? 'text-white' : 'text-slate-400'}`}
          >
             Вход
          </button>
          <button 
             onClick={() => { setIsRegisterMode(true); setErrors({}); }} 
             className={`flex-1 py-3 text-xs font-black uppercase tracking-widest relative z-10 transition-colors ${isRegisterMode ? 'text-white' : 'text-slate-400'}`}
          >
             Регистрация
          </button>
       </div>

       <div className="space-y-5">
           <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase ml-3">Telegram Username</label>
               <div className={`flex items-center bg-white dark:bg-[#1F2128] border ${errors.username ? 'border-red-500' : 'border-slate-200 dark:border-white/5 focus-within:border-[#6C5DD3]'} rounded-2xl px-4 transition-colors`}>
                   <span className="text-slate-500">@</span>
                   <input 
                     value={username} 
                     onChange={handleUsernameChange}
                     className="w-full bg-transparent py-4 pl-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 dark:placeholder:text-white/20"
                     placeholder="username"
                   />
               </div>
           </div>

           <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase ml-3">Пароль</label>
               <div className={`flex items-center bg-white dark:bg-[#1F2128] border ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-white/5 focus:border-[#6C5DD3]'} rounded-2xl px-4 transition-colors`}>
                   <span className="text-slate-500">🔒</span>
                   <input 
                     type="password"
                     value={password} 
                     onChange={handlePasswordChange}
                     className="w-full bg-transparent py-4 pl-2 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-400 dark:placeholder:text-white/20"
                     placeholder="••••••••"
                   />
               </div>
           </div>
           
           {(errors.username || errors.password) && (
               <p className="text-red-500 text-xs font-bold text-center animate-fade-in">{errors.username || errors.password}</p>
           )}

           <Button 
                onClick={handleAuthSubmit} 
                fullWidth 
                className="!mt-8 !py-4 !rounded-2xl !bg-slate-900 !text-white dark:!bg-white dark:!text-black hover:!bg-slate-800 dark:hover:!bg-slate-200"
           >
              {isRegisterMode ? 'ДАЛЕЕ' : 'ВОЙТИ'}
           </Button>
       </div>
    </div>
  );

  const renderIdentity = () => (
      <div className={`w-full max-w-sm mx-auto animate-slide-in ${isShake ? 'animate-shake' : ''}`}>
           <div className="mb-8 text-center">
              <div className="w-12 h-12 bg-[#6C5DD3]/10 text-[#6C5DD3] rounded-full flex items-center justify-center text-2xl mx-auto mb-3 border border-[#6C5DD3]/20">
                 🪪
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">ЛИЧНОЕ ДЕЛО</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                 Этап 1: Идентификация
              </p>
          </div>

          <div className="space-y-6">
              <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-3">ФИО / Позывной</label>
                  <input 
                    value={realName} 
                    onChange={e => setRealName(e.target.value)} 
                    className={`w-full bg-white dark:bg-[#1F2128] border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-2xl py-4 px-5 text-slate-900 dark:text-white font-bold outline-none transition-colors`}
                    placeholder="Имя Фамилия"
                  />
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-3">Фото профиля (Для Аватара)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`
                        w-full h-40 rounded-3xl bg-white dark:bg-[#1F2128] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden
                        ${errors.photo ? 'border-red-500' : 'border-slate-200 dark:border-white/10 hover:border-[#6C5DD3] hover:bg-[#6C5DD3]/5'}
                    `}
                  >
                      {selectedImage ? (
                          <img src={selectedImage} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      ) : (
                          <>
                              <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-[#6C5DD3]">📸</div>
                              <span className="text-xs font-bold text-slate-500 uppercase">Загрузить фото</span>
                          </>
                      )}
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>
              </div>
          </div>
          
          <div className="flex gap-3 mt-10">
              {(!telegram.isAvailable || !telegram.user) && (
                  <button onClick={() => setStep('AUTH_FORM')} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-[#1F2128] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5">
                      ←
                  </button>
              )}
              <Button onClick={handleIdentitySubmit} fullWidth className="!rounded-2xl !bg-slate-900 !text-white dark:!bg-white dark:!text-black">
                  ДАЛЕЕ
              </Button>
          </div>
      </div>
  );

  const renderDossier = () => (
      <div className={`w-full max-w-sm mx-auto animate-slide-in flex flex-col h-[70vh] ${isShake ? 'animate-shake' : ''}`}>
           <div className="flex-shrink-0 mb-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                  {[0, 1, 2].map(i => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= dossierStep ? 'w-8 bg-[#6C5DD3]' : 'w-4 bg-slate-200 dark:bg-white/10'}`}></div>
                  ))}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase">
                  {dossierStep === 0 ? 'Физические данные' : dossierStep === 1 ? 'Статус и Опыт' : 'Цели и Мотивация'}
              </h2>
          </div>

          <div ref={dossierContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
              {/* STEP 0: BIOMETRICS & LOCATION */}
              {dossierStep === 0 && (
                  <div className="space-y-4 animate-fade-in">
                       <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                               <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Рост (см)</label>
                               <input 
                                   type="number"
                                   value={dossier.height} onChange={e => updateDossier('height', e.target.value)} 
                                   className={`w-full bg-white dark:bg-[#1F2128] border ${errors.height ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none`}
                                   placeholder="180"
                               />
                           </div>
                           <div className="space-y-1">
                               <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Вес (кг)</label>
                               <input 
                                   type="number"
                                   value={dossier.weight} onChange={e => updateDossier('weight', e.target.value)} 
                                   className={`w-full bg-white dark:bg-[#1F2128] border ${errors.weight ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none`}
                                   placeholder="75"
                               />
                           </div>
                       </div>
                       
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Дата рождения</label>
                           <input 
                               type="date"
                               value={dossier.birthDate} onChange={e => updateDossier('birthDate', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.birthDate ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none`}
                           />
                       </div>

                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Город проживания</label>
                           <input 
                               value={dossier.location} onChange={e => updateDossier('location', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.location ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none`}
                               placeholder="Москва"
                           />
                       </div>
                       
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Условия проживания</label>
                           <select 
                               value={dossier.livingSituation} onChange={e => updateDossier('livingSituation', e.target.value as any)} 
                               className="w-full bg-white dark:bg-[#1F2128] border border-slate-200 dark:border-white/10 focus:border-[#6C5DD3] rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none appearance-none"
                           >
                               <option value="ALONE">Живу один</option>
                               <option value="PARENTS">С родителями</option>
                               <option value="DORM">Общежитие</option>
                               <option value="FAMILY">С семьей/партнером</option>
                           </select>
                       </div>
                  </div>
              )}

              {/* STEP 1: EXPERIENCE & MONEY */}
              {dossierStep === 1 && (
                  <div className="space-y-4 animate-fade-in">
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Опыт работы (кратко)</label>
                           <textarea 
                               value={dossier.workExperience} onChange={e => updateDossier('workExperience', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.workExperience ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none resize-none h-24`}
                               placeholder="Менеджер 2 года..."
                           />
                       </div>

                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Желаемый доход (в месяц)</label>
                           <input 
                               value={dossier.incomeGoal} onChange={e => updateDossier('incomeGoal', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.incomeGoal ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none`}
                               placeholder="100 000 руб."
                           />
                       </div>

                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Ожидания от курса</label>
                           <textarea 
                               value={dossier.courseExpectations} onChange={e => updateDossier('courseExpectations', e.target.value)} 
                               className="w-full bg-white dark:bg-[#1F2128] border border-slate-200 dark:border-white/10 focus:border-[#6C5DD3] rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none resize-none h-24"
                               placeholder="Жесткая дисциплина, практика..."
                           />
                       </div>
                  </div>
              )}

              {/* STEP 2: GOALS & MOTIVATION */}
              {dossierStep === 2 && (
                   <div className="space-y-4 animate-fade-in">
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Что хочешь получить на выходе?</label>
                           <textarea 
                               value={dossier.courseGoals} onChange={e => updateDossier('courseGoals', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.courseGoals ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none resize-none h-24`}
                               placeholder="Навык продаж, уверенность..."
                           />
                       </div>

                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Почему записался на курс?</label>
                           <textarea 
                               value={dossier.motivation} onChange={e => updateDossier('motivation', e.target.value)} 
                               className={`w-full bg-white dark:bg-[#1F2128] border ${errors.motivation ? 'border-red-500' : 'border-slate-200 dark:border-white/10 focus:border-[#6C5DD3]'} rounded-xl py-3 px-4 text-slate-900 dark:text-white font-bold outline-none resize-none h-32`}
                               placeholder="Хочу изменить жизнь..."
                           />
                       </div>
                   </div>
              )}
          </div>

          <div className="flex gap-3 mt-4 flex-shrink-0">
               <button onClick={() => dossierStep > 0 ? setDossierStep(dossierStep - 1) : setStep('IDENTITY')} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-[#1F2128] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5">
                   ←
               </button>
               <Button onClick={handleDossierNext} fullWidth className="!rounded-2xl !bg-slate-900 !text-white dark:!bg-white dark:!text-black">
                   {dossierStep === 2 ? 'ЗАВЕРШИТЬ' : 'ДАЛЕЕ'}
               </Button>
          </div>
      </div>
  );

  const renderScanning = () => (
      <div className="flex flex-col items-center justify-center w-full py-10 animate-fade-in">
           <div className="relative w-48 h-48 mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-[#1F2128]"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-[#6C5DD3] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                
                <div className="absolute inset-2 rounded-full overflow-hidden bg-white dark:bg-black ring-4 ring-slate-100 dark:ring-[#1F2128]">
                     {selectedImage && <img src={selectedImage} className="w-full h-full object-cover opacity-80 dark:opacity-50 grayscale" />}
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#6C5DD3]/50 to-transparent h-[20%] w-full animate-[scan_2s_linear_infinite]"></div>
                     <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 pointer-events-none">
                        {[...Array(36)].map((_, i) => (
                            <div key={i} className="border-[0.5px] border-[#6C5DD3]/20"></div>
                        ))}
                     </div>
                </div>
           </div>
           <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-widest animate-pulse">{loadingText}</h3>
           <style>{`
             @keyframes scan { 0% { top: -20%; } 100% { top: 100%; } }
           `}</style>
      </div>
  );

  const renderFinalizing = () => (
    <div className="flex flex-col items-center justify-center w-full py-20 animate-fade-in">
        <div className="w-24 h-24 mb-8 relative">
             <div className="absolute inset-0 bg-[#6C5DD3] rounded-full blur-[30px] opacity-40 animate-pulse"></div>
             <svg className="animate-spin text-slate-900 dark:text-white w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{loadingText}</h3>
        <p className="text-slate-400 dark:text-white/40 text-xs uppercase tracking-widest">Создание персонажа...</p>
    </div>
  );

  return (
    <div className="w-full h-full min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-4">
         {step === 'CHECKING' && renderChecking()}
         {step === 'AUTH_FORM' && renderAuthForm()}
         {step === 'IDENTITY' && renderIdentity()}
         {step === 'DOSSIER' && renderDossier()}
         {step === 'SCANNING' && renderScanning()}
         {step === 'FINALIZING' && renderFinalizing()}
    </div>
  );
};
