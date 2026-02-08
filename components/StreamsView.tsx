
import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Stream, UserProgress, SmartNavAction } from '../types';
import { XPService } from '../services/xpService';
import { telegram } from '../services/telegramService';

// Fix for ReactPlayer type issues in TypeScript/Vite
const VideoPlayer = ReactPlayer as unknown as React.ComponentType<any>;

interface StreamsViewProps {
  streams: Stream[];
  onBack: () => void;
  userProgress: UserProgress;
  onUpdateUser: (data: Partial<UserProgress>) => void;
  setNavAction?: (action: SmartNavAction | null) => void;
}

export const StreamsView: React.FC<StreamsViewProps> = ({ streams, userProgress, onUpdateUser, setNavAction }) => {
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');

  const filteredStreams = streams.filter(s => 
      activeTab === 'UPCOMING' ? (s.status === 'UPCOMING' || s.status === 'LIVE') : s.status === 'PAST'
  );

  const activeStream = filteredStreams.find(s => s.status === 'LIVE' || s.status === 'UPCOMING');
  const visited = activeStream ? userProgress.stats?.streamsVisited?.includes(activeStream.id) : false;

  useEffect(() => {
      if (setNavAction) {
          if (activeTab === 'UPCOMING' && activeStream && !visited) {
              setNavAction({
                  label: 'Я В ПУТИ! 📍',
                  onClick: () => handleCheckIn(activeStream.id),
                  variant: 'success',
                  icon: '🚀'
              });
          } else {
              setNavAction(null);
          }
      }
      return () => { if (setNavAction) setNavAction(null); }
  }, [activeTab, activeStream, visited]);

  const handleCheckIn = (streamId: string) => {
      const result = XPService.visitStream(userProgress, streamId);
      if (result.allowed) {
          onUpdateUser(result.user);
          telegram.showAlert(`Вы отметились на эфире! Начислено ${result.xp} XP.`, 'Посещение');
          telegram.haptic('success');
      } else {
          telegram.showAlert('Вы уже отмечались на этом эфире.', 'Инфо');
      }
  };

  return (
    <div className="px-6 pt-10 pb-32 max-w-2xl mx-auto space-y-8 animate-fade-in">
        <div className="flex justify-between items-end">
            <div>
                <span className="text-[#6C5DD3] text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">Direct Broadcasts</span>
                <h1 className="text-4xl font-black text-text-primary tracking-tighter">ПРЯМЫЕ <br/><span className="text-text-secondary opacity-30">ЭФИРЫ</span></h1>
            </div>
            <div className="flex bg-surface border border-border-color p-1 rounded-2xl mb-1 shadow-sm">
                <button 
                    onClick={() => setActiveTab('UPCOMING')}
                    className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'UPCOMING' ? 'bg-[#1F2128] text-white shadow-lg' : 'text-text-secondary'}`}
                >
                    Будущие
                </button>
                <button 
                    onClick={() => setActiveTab('PAST')}
                    className={`px-4 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'PAST' ? 'bg-[#1F2128] text-white shadow-lg' : 'text-text-secondary'}`}
                >
                    Записи
                </button>
            </div>
        </div>

        <div className="space-y-6">
            {filteredStreams.map((stream, i) => {
                const isVisited = userProgress.stats?.streamsVisited?.includes(stream.id);
                
                return (
                <div key={stream.id} className="bg-surface rounded-[2.5rem] overflow-hidden border border-border-color shadow-sm animate-slide-up group" style={{ animationDelay: `${i*0.1}s` }}>
                    <div className="relative aspect-video bg-black overflow-hidden">
                        {stream.youtubeUrl ? (
                            <VideoPlayer 
                                url={stream.youtubeUrl} 
                                width="100%" 
                                height="100%" 
                                light={true}
                                controls
                                playIcon={
                                    <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-3 opacity-30 grayscale group-hover:grayscale-0 transition-all">
                                <span className="text-5xl">📅</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">Анонс скоро</span>
                            </div>
                        )}
                        {stream.status === 'LIVE' && (
                            <div className="absolute top-5 left-5 px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg animate-pulse shadow-lg shadow-red-600/30">
                                LIVE NOW
                            </div>
                        )}
                        
                        {isVisited && (
                             <div className="absolute bottom-4 right-4 bg-green-500/80 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                                 ✓ Посещено
                             </div>
                        )}
                    </div>

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-black text-text-primary leading-tight w-2/3 group-hover:text-[#6C5DD3] transition-colors">{stream.title}</h3>
                            <div className="text-right">
                                <p className="text-[14px] font-black text-text-primary leading-none">{new Date(stream.date).getDate()}</p>
                                <p className="text-[8px] font-bold text-text-secondary uppercase">{new Date(stream.date).toLocaleString('ru-RU', { month: 'short' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-text-secondary text-[10px] font-bold">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {new Date(stream.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <span className="w-1 h-1 bg-border-color rounded-full"></span>
                            <span className="text-[9px] font-black uppercase text-[#6C5DD3] tracking-widest">
                                {stream.status === 'PAST' ? 'RECORDED' : 'UPCOMING'}
                            </span>
                        </div>
                    </div>
                </div>
            )})}

            {filteredStreams.length === 0 && (
                <div className="text-center py-32 opacity-30">
                    <p className="text-text-secondary text-xs font-black uppercase tracking-widest">Трансляций нет</p>
                </div>
            )}
        </div>
    </div>
  );
};
