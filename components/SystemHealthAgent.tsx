
import React, { useEffect, useState, useRef } from 'react';
import { Logger } from '../services/logger';
import { Storage } from '../services/storage';
import { SystemAgentConfig, AppConfig, UserProgress, Module, AgentDecision, AppNotification } from '../types';
import { telegram } from '../services/telegramService';
import { consultSystemAgent } from '../services/geminiService';
import { Backend } from '../services/backendService';

interface SystemHealthAgentProps {
    config: SystemAgentConfig;
    user: UserProgress;
    appConfig: AppConfig;
    modules: Module[];
    onUpdateConfig: (cfg: AppConfig) => void;
    onUpdateModules: (mods: Module[]) => void;
    onSendNotification: (n: AppNotification) => void;
}

type AgentStatus = 'SLEEPING' | 'ANALYZING' | 'EXECUTING' | 'COOLDOWN';

export const SystemHealthAgent: React.FC<SystemHealthAgentProps> = ({ 
    config, user, appConfig, modules, onUpdateConfig, onUpdateModules, onSendNotification 
}) => {
    const [status, setStatus] = useState<AgentStatus>('SLEEPING');
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [agentMessage, setAgentMessage] = useState<string>('');
    const [isVisible, setIsVisible] = useState(false);
    
    // Prevent double execution in React StrictMode
    const processingRef = useRef(false);

    useEffect(() => {
        if (!config.enabled) return;

        // Auto-Start Analysis loop
        const intervalId = setInterval(() => {
            if (status === 'SLEEPING' && config.autonomyLevel !== 'PASSIVE') {
                performAnalysis();
            }
        }, config.monitoringInterval || 30000);

        return () => clearInterval(intervalId);
    }, [config, status]);

    const performAnalysis = async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        
        setStatus('ANALYZING');
        setAgentMessage('Сканирование систем...');
        
        // Only show UI if set to High sensitivity or if we find something interesting
        if (config.sensitivity === 'HIGH') setIsVisible(true);

        try {
            const logs = Logger.getLogs();
            
            // --- THE BRAIN ---
            const decision: AgentDecision = await consultSystemAgent(logs, appConfig, user, modules);
            
            if (decision.action !== 'NO_ACTION') {
                setStatus('EXECUTING');
                setAgentMessage(decision.reason);
                setIsVisible(true); // Always show when doing something
                
                await executeDecision(decision);
                
                // Keep UI visible for a moment
                setTimeout(() => {
                    setIsVisible(false);
                    setStatus('COOLDOWN');
                    processingRef.current = false;
                    // Reset to Sleeping after cooldown
                    setTimeout(() => setStatus('SLEEPING'), 10000);
                }, 4000);
            } else {
                // Nothing to do
                if (config.sensitivity === 'HIGH') {
                    setAgentMessage('Системы стабильны.');
                    setTimeout(() => setIsVisible(false), 2000);
                }
                setStatus('SLEEPING');
                processingRef.current = false;
            }

        } catch (e) {
            console.error('Agent Failure', e);
            setStatus('SLEEPING');
            processingRef.current = false;
        }
    };

    const executeDecision = async (decision: AgentDecision) => {
        telegram.haptic('medium');
        setLastAction(decision.action);

        switch (decision.action) {
            case 'REWRITE_LESSON':
                // Payload: { moduleId, lessonId, newDescription, newContent }
                const { moduleId, lessonId, newDescription, newContent } = decision.payload;
                if (moduleId && lessonId && newContent) {
                    const updatedModules = modules.map(m => {
                        if (m.id === moduleId) {
                            return {
                                ...m,
                                lessons: m.lessons.map(l => l.id === lessonId ? { ...l, description: newDescription, content: newContent } : l)
                            };
                        }
                        return m;
                    });
                    onUpdateModules(updatedModules);
                    Logger.info(`Agent rewrote lesson ${lessonId}`);
                }
                break;

            case 'OPTIMIZE_CONFIG':
                // Payload: Partial<AppConfig>
                onUpdateConfig({ ...appConfig, ...decision.payload });
                Logger.info('Agent optimized config');
                break;

            case 'SEND_NOTIFICATION':
                // Payload: AppNotification
                onSendNotification({
                    ...decision.payload,
                    id: Date.now().toString(),
                    date: new Date().toISOString()
                });
                break;

            case 'CLEAR_LOGS':
                // Internal logic not exposed via props easily, but we can simulate
                console.clear(); // Visual clear
                Logger.info('Agent cleared logs');
                break;
                
            default:
                Logger.warn('Unknown agent action', decision.action);
        }
    };

    if (!config.enabled && !isVisible) return null;

    return (
        <div className={`fixed bottom-24 right-4 z-[150] transition-all duration-500 ease-out transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}>
            <div className="bg-[#14161B]/95 backdrop-blur-xl border border-[#6C5DD3]/40 p-4 rounded-2xl shadow-[0_0_30px_rgba(108,93,211,0.2)] flex items-center gap-4 max-w-[300px] relative overflow-hidden">
                
                {/* Scanning Light Effect */}
                {status === 'ANALYZING' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#6C5DD3] to-transparent animate-[shimmer_2s_infinite]"></div>}

                {/* Agent Avatar */}
                <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                    <div className={`absolute inset-0 rounded-full opacity-30 animate-ping ${status === 'SLEEPING' ? 'bg-green-500' : status === 'EXECUTING' ? 'bg-[#D4AF37]' : 'bg-[#6C5DD3]'}`}></div>
                    <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg font-black shadow-inner transition-colors ${
                        status === 'SLEEPING' ? 'border-green-500 text-green-500 bg-green-500/10' :
                        status === 'EXECUTING' ? 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10' :
                        'border-[#6C5DD3] text-[#6C5DD3] bg-[#6C5DD3]/10'
                    }`}>
                        {status === 'EXECUTING' ? '⚙️' : 'AI'}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className={`text-[10px] font-black uppercase tracking-widest ${
                            status === 'SLEEPING' ? 'text-green-500' :
                            status === 'EXECUTING' ? 'text-[#D4AF37]' :
                            'text-[#6C5DD3]'
                        }`}>
                            {status === 'SLEEPING' ? 'SYSTEM CORE' : status === 'EXECUTING' ? 'OPTIMIZING' : 'ANALYZING'}
                        </h4>
                        <span className="text-[8px] text-white/30 font-mono">{new Date().toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})}</span>
                    </div>
                    <p className="text-white/90 text-xs font-bold leading-tight truncate animate-pulse">
                        {agentMessage || 'Ожидание...'}
                    </p>
                    {lastAction && status === 'COOLDOWN' && (
                        <p className="text-[9px] text-white/50 mt-1 uppercase">Исправлено: {lastAction}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
