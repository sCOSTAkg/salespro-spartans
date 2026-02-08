
import { AIConfig, AIProviderId, ChatMessage } from '../types';
import { Storage } from './storage';
import { sendMessageToGemini as geminiSend, createChatSession as geminiChat, checkHomeworkWithAI as geminiCheck } from './geminiService';

// Helper to interact with OpenAI-compatible APIs (Groq, OpenRouter)
const callOpenAICompatibleAPI = async (
    endpoint: string,
    apiKey: string,
    model: string,
    messages: { role: string, content: string }[],
    temperature: number = 0.7,
    jsonMode: boolean = false
): Promise<string> => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                // OpenRouter specific headers
                ...(endpoint.includes('openrouter') ? {
                    'HTTP-Referer': 'https://salespro-app.com',
                    'X-Title': 'SalesPro 300 Spartans'
                } : {})
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error ${response.status}: ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error) {
        console.error('External AI API Error:', error);
        throw error;
    }
};

class AIServiceRegistry {
    private config: AIConfig;

    constructor() {
        this.config = Storage.get<any>('appConfig', {})?.aiConfig || {
            activeProvider: 'GOOGLE_GEMINI',
            apiKeys: {},
            modelOverrides: {}
        };
    }

    public updateConfig(newConfig: AIConfig) {
        this.config = newConfig;
    }

    public getConfig() {
        return this.config;
    }

    // --- HELPER: CONVERT HISTORY ---
    private formatHistoryForOpenAI(history: ChatMessage[], systemPrompt?: string): { role: string, content: string }[] {
        const messages: { role: string, content: string }[] = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        history.forEach(msg => {
            messages.push({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.text
            });
        });

        return messages;
    }

    // --- UNIFIED API METHODS ---

    public async sendMessage(historyOrSession: any, message: string): Promise<string> {
        const provider = this.config.activeProvider;
        const appConfig = Storage.get<any>('appConfig', {});
        const systemInstruction = appConfig.systemInstruction || "You are a helpful assistant.";

        try {
            switch (provider) {
                case 'GOOGLE_GEMINI':
                    return await geminiSend(historyOrSession, message);
                
                case 'GROQ': {
                    const apiKey = this.config.apiKeys.groq;
                    if (!apiKey) throw new Error("Groq API Key missing");
                    
                    // We need full history here, but 'historyOrSession' coming from ChatAssistant might be the Chat object from Gemini SDK.
                    // This is a limitation of the current architecture. For mixed providers, we need to pass the raw history array.
                    // Assuming for now the caller passes the message text only and we rely on context or simple one-shot if history isn't available properly in this method signature context.
                    // FIX: In ChatAssistant.tsx, we rely on Gemini SDK state. To support stateless APIs like Groq properly, we'd need to refactor ChatAssistant to pass full history array.
                    // FOR DEMO: We will assume 'historyOrSession' is just the Chat object which we can't read easily, OR we reconstruct context if possible. 
                    // However, to make this work without major refactoring of ChatAssistant, let's treat this as a single turn + system prompt if strict history isn't passed.
                    
                    // Ideally, ChatAssistant should pass `history` array to this service.
                    // Let's create a single turn interaction for now or check if historyOrSession has params.
                    
                    const messages = [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: message }
                    ];

                    return await callOpenAICompatibleAPI(
                        'https://api.groq.com/openai/v1/chat/completions',
                        apiKey,
                        this.config.modelOverrides.chat || 'llama3-70b-8192',
                        messages
                    );
                }

                case 'OPENROUTER': {
                    const apiKey = this.config.apiKeys.openrouter;
                    if (!apiKey) throw new Error("OpenRouter API Key missing");

                    const messages = [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: message }
                    ];

                    return await callOpenAICompatibleAPI(
                        'https://openrouter.ai/api/v1/chat/completions',
                        apiKey,
                        this.config.modelOverrides.chat || 'liquid/lfm-40b', // Good default for general tasks
                        messages
                    );
                }
                
                case 'OPENAI_GPT4':
                    // Placeholder
                    return `[GPT-4o Mock]: Connection simulated.`;

                case 'ANTHROPIC_CLAUDE':
                    return `[Claude Mock]: Connection simulated.`;

                default:
                    return "AI Provider not configured.";
            }
        } catch (error: any) {
            console.error(`AI Service Error (${provider}):`, error);
            return `Ошибка связи с нейросетью: ${error.message}`;
        }
    }

    public async checkHomework(content: string, type: any, instruction: string): Promise<{ passed: boolean; feedback: string }> {
        const provider = this.config.activeProvider;

        if (provider === 'GOOGLE_GEMINI') {
            return await geminiCheck(content, type, instruction);
        }

        if (provider === 'GROQ' || provider === 'OPENROUTER') {
             try {
                const apiKey = provider === 'GROQ' ? this.config.apiKeys.groq : this.config.apiKeys.openrouter;
                const endpoint = provider === 'GROQ' 
                    ? 'https://api.groq.com/openai/v1/chat/completions' 
                    : 'https://openrouter.ai/api/v1/chat/completions';
                
                const model = provider === 'GROQ' 
                    ? (this.config.modelOverrides.chat || 'llama3-70b-8192')
                    : (this.config.modelOverrides.chat || 'liquid/lfm-40b');

                if (!apiKey) throw new Error("API Key missing");

                const prompt = `
                Ты - Командир "300 Спартанцев". Проверь задание.
                ИНСТРУКЦИЯ: ${instruction}
                КОНТЕНТ СТУДЕНТА: "${content.substring(0, 2000)}" (truncated if too long)
                
                Верни ТОЛЬКО JSON:
                { "passed": boolean, "feedback": "string" }
                `;

                const result = await callOpenAICompatibleAPI(
                    endpoint,
                    apiKey,
                    model,
                    [{ role: 'user', content: prompt }],
                    0.2,
                    true // JSON mode
                );

                const parsed = JSON.parse(result);
                return {
                    passed: !!parsed.passed,
                    feedback: parsed.feedback || "Проверка завершена."
                };

             } catch (e) {
                 console.error("AI Grading Error", e);
                 return { passed: true, feedback: "Ошибка AI при проверке. Засчитано автоматически." };
             }
        }

        // Simulating other providers
        return {
            passed: true,
            feedback: `[${provider}]: Задание проанализировано (Симуляция). Переключитесь на Gemini/Groq/OpenRouter для реальной проверки.`
        };
    }

    public getActiveProviderName(): string {
        switch (this.config.activeProvider) {
            case 'GOOGLE_GEMINI': return 'Gemini 1.5 Pro (Google)';
            case 'OPENAI_GPT4': return 'GPT-4o (OpenAI)';
            case 'ANTHROPIC_CLAUDE': return 'Claude 3.5 Sonnet';
            case 'LOCAL_LLAMA': return 'Llama 3 (Local)';
            case 'GROQ': return 'Groq (Llama 3 fast)';
            case 'OPENROUTER': return 'OpenRouter (Aggregator)';
            default: return 'Unknown';
        }
    }
}

export const AIService = new AIServiceRegistry();
