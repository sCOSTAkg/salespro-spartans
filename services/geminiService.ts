import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { AppConfig, UserProgress, Module, AgentDecision } from '../types';

const DEFAULT_SYSTEM_INSTRUCTION = `
Ты — Командир элитного отряда продаж "300 Спартанцев".
Твоя задача: сделать из новобранца (пользователя) настоящую машину продаж.
Твой стиль: Жесткий, но справедливый. Военная риторика.
`;

const handleGeminiError = (error: any): string => {
    console.error('Gemini API Error:', error);
    const errStr = error.toString();
    
    // Check for Rate Limit (429) or Quota Exceeded (429 Resource Exhausted)
    if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota')) {
        return '⚠️ Лимит запросов исчерпан (429). Попробуйте позже или проверьте квоты API.';
    }
    
    if (errStr.includes('400') && errStr.includes('User location is not supported')) {
        return '⚠️ Ваш регион не поддерживается API (400). Используйте VPN (USA/EU) или другой API ключ.';
    }
    
    return 'Ошибка канала связи с ИИ.';
};

// Retry Helper with Exponential Backoff
const retryOperation = async <T>(operation: () => Promise<T>, retries = 2, delay = 2000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        const errStr = error.toString();
        // Retry on 429 (Too Many Requests), 503 (Service Unavailable) or Quota errors
        if (retries > 0 && (errStr.includes('429') || errStr.includes('503') || errStr.includes('quota'))) {
            console.warn(`Gemini API Retry (${retries} left) due to error:`, errStr);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
};

export const createChatSession = (customInstruction?: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: customInstruction || DEFAULT_SYSTEM_INSTRUCTION
    }
  });
};

export const sendMessageToGemini = async (chat: Chat, message: string): Promise<string> => {
  try {
    const result: GenerateContentResponse = await retryOperation(() => chat.sendMessage({ message }));
    return result.text || 'Связь с штабом потеряна.';
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const createArenaSession = (clientRole: string, objective: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `
Ты — клиент в симуляции продаж. 
Твоя роль: ${clientRole}
Цель игрока: ${objective}
Веди себя реалистично, реагируй на аргументы продавца. Будь сложным, но справедливым оппонентом. 
Не выходи из роли клиента до конца симуляции.
`;
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction
    }
  });
};

export const getArenaHint = async (
  clientRole: string, 
  objective: string, 
  lastClientMessage: string, 
  userDraft: string
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Context: Sales Roleplay.
      Client Role: ${clientRole}
      User Goal: ${objective}
      Last Client Message: "${lastClientMessage}"
      User is typing: "${userDraft}"
      
      Task: Act as a sales coach whispering a hint.
      Analyze the user's draft. Is it aggressive? Weak? Good? 
      Provide a VERY SHORT (max 8 words) tactical hint or correction. 
      If it's good, say "Good tactic".
      Lang: Russian.
    `;

    const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
          maxOutputTokens: 30,
          thinkingConfig: { thinkingBudget: 0 } 
      } 
    }));

    return response.text || null;
  } catch (error) {
    const msg = handleGeminiError(error);
    console.warn('Hint suppressed due to error:', msg);
    return null;
  }
};

export const evaluateArenaBattle = async (history: { role: string; text: string }[], objective: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) return 'Ошибка: API Key не найден.';
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
Проанализируй диалог тренировочного боя между продавцом (user) и клиентом (model).
Цель продавца была: ${objective}

Диалог:
${history.map(m => `${m.role === 'user' ? 'Продавец' : 'Клиент'}: ${m.text}`).join('\n')}

Дай оценку действиям продавца в стиле Командира 300 Спартанцев (жестко, лаконично, по делу).
Укажи:
1. Удалось ли достичь цели?
2. 2 сильных тактических приема.
3. 2 критические ошибки или зоны роста.
`;

    const response: GenerateContentResponse = await retryOperation(async () => {
        try {
            return await ai.models.generateContent({
                model: 'gemini-3-pro-preview', 
                contents: prompt
            });
        } catch (e: any) {
            // Fallback inside retry logic if 403/404 occur for Pro model
            if (e.toString().includes('403') || e.toString().includes('404') || e.status === 403) {
                console.warn('Evaluation fallback to Flash');
                return await ai.models.generateContent({
                    model: 'gemini-3-flash-preview', 
                    contents: prompt
                });
            }
            throw e;
        }
    });

    return response.text || 'Командир не смог расшифровать отчет о бое.';
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const checkHomeworkWithAI = async (
    content: string, // Text or Base64
    type: 'TEXT' | 'PHOTO' | 'VIDEO' | 'FILE',
    instruction: string
  ): Promise<{ passed: boolean; feedback: string }> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const parts: any[] = [];
      
      if (type === 'PHOTO' || type === 'VIDEO' || type === 'FILE') {
         const base64Clean = content.includes('base64,') ? content.split('base64,')[1] : content;
         
         let mimeType = 'image/jpeg';
         if (type === 'VIDEO') mimeType = 'video/mp4';
         if (type === 'FILE') mimeType = 'application/pdf';

         parts.push({
            inlineData: {
                data: base64Clean,
                mimeType: mimeType
            }
         });
      }
  
      parts.push({
          text: `
          Ты - Командир "300 Спартанцев". Твоя задача проверить домашнее задание новобранца.
          
          ИНСТРУКЦИЯ ДЛЯ ПРОВЕРКИ (Критерии):
          ${instruction}
          
          ${type === 'TEXT' ? `ОТВЕТ НОВОБРАНЦА: "${content}"` : 'Ответ новобранца находится во вложении (фото/видео/файл).'}
          
          Верни ответ СТРОГО в формате JSON.
          `
      });
  
      const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    passed: { 
                        type: Type.BOOLEAN,
                        description: 'true если задание выполнено по критериям, false если нет' 
                    },
                    feedback: { 
                        type: Type.STRING,
                        description: 'Твой комментарий в стиле спартанского командира. Если не сдал - объясни почему жестко. Если сдал - похвали кратко.' 
                    }
                },
                required: ["passed", "feedback"]
            }
        }
      }));
  
      const resultText = response.text;
      if (!resultText) throw new Error('Empty AI response');
      
      try {
        const parsed = JSON.parse(resultText);
        return {
            passed: !!parsed.passed,
            feedback: parsed.feedback || 'Нет комментария.'
        };
      } catch (jsonError) {
        console.error('JSON Parse Error:', jsonError, resultText);
        return {
            passed: false,
            feedback: 'Ошибка обработки данных от Командира. Попробуйте позже.'
        };
      }
  
    } catch (error) {
      const msg = handleGeminiError(error);
      return {
          passed: true, 
          feedback: `[SYSTEM]: ${msg} (Задание принято условно)`
      };
    }
  };

// --- AUTONOMOUS AGENT CORE ---

export const consultSystemAgent = async (
    logs: any[],
    config: AppConfig,
    userStats: UserProgress,
    modules: Module[]
): Promise<AgentDecision> => {
    try {
        if (!process.env.API_KEY) {
            return { action: 'NO_ACTION', reason: 'No API Key configured', payload: {} };
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Lightweight snapshot of content quality
        const contentSnapshot = modules.map(m => ({
            id: m.id,
            lessonCount: m.lessons.length,
            // Check if descriptions are too short or generic
            lessonsToImprove: m.lessons.filter(l => l.description.length < 30 || l.content.length < 100).map(l => l.id)
        }));

        const prompt = `
        ROLE: You are the Autonomous System Core of "SalesPro: 300 Spartans".
        GOAL: Maintain system health, optimize content, and keep the user engaged. You have FULL ACCESS to modify the app.

        CURRENT STATE:
        - Logs (Errors): ${JSON.stringify(logs.filter(l => l.level === 'ERROR').slice(0, 3))}
        - App Config: Maintenance=${config.features.maintenanceMode}, AutoApprove=${config.features.autoApproveHomework}
        - User: XP=${userStats.xp}, Level=${userStats.level}, Role=${userStats.role}
        - Content Health: ${JSON.stringify(contentSnapshot)}

        AVAILABLE ACTIONS:
        1. REWRITE_LESSON: If a lesson has a short description/content, rewrite it to be epic and educational.
        2. OPTIMIZE_CONFIG: If user level > 5 and 'publicLeaderboard' is false, enable it. If errors > 5, enable maintenanceMode.
        3. SEND_NOTIFICATION: If user hasn't logged in a while (check date manually not possible here, assume active), or just to encourage them.
        4. CLEAR_LOGS: If too many error logs.
        5. NO_ACTION: If everything looks good.

        LOGIC:
        - Priority 1: Fix Errors (Clear logs or Maint mode).
        - Priority 2: Improve Content (If lessonsToImprove has items, pick ONE and rewrite description/content).
        - Priority 3: Engagement (Notification).

        RETURN JSON ONLY matching 'AgentDecision' interface.
        For REWRITE_LESSON, payload must be: { moduleId: string, lessonId: string, newDescription: string, newContent: string (Markdown) }
        For OPTIMIZE_CONFIG, payload: Partial<AppConfig>
        For SEND_NOTIFICATION, payload: AppNotification
        `;

        const response: GenerateContentResponse = await retryOperation(async () => {
            try {
                return await ai.models.generateContent({
                    model: 'gemini-3-pro-preview', 
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json"
                    }
                });
            } catch (e: any) {
                // Fallback for 403 (Permission Denied) or 404
                if (e.toString().includes('403') || e.toString().includes('404') || e.status === 403) {
                    console.warn('System Agent: Falling back to Flash model due to permissions.');
                    return await ai.models.generateContent({
                        model: 'gemini-3-flash-preview', 
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json"
                        }
                    });
                }
                throw e;
            }
        });

        return JSON.parse(response.text || '{ "action": "NO_ACTION", "reason": "AI Failed", "payload": {} }');
    } catch (e: any) {
        // If 429 persists even after retries
        if (e.toString().includes('429') || e.toString().includes('quota')) {
             return { action: 'NO_ACTION', reason: 'AI Quota Exceeded', payload: {} };
        }
        console.error('System Agent Error:', e);
        return { action: 'NO_ACTION', reason: 'Error in agent brain', payload: {} };
    }
};

export const verifyStoryScreenshot = async (base64Image: string): Promise<boolean> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

        const prompt = `
        Look at this screenshot. Does it look like a social media Story (Instagram, Telegram, VK, WhatsApp)?
        And does it contain any mention of "Spartan", "Sales", "Training", "Course" or just look like a repost of app content?
        
        Return JSON: { "isStory": boolean }
        `;

        const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { isStory: { type: Type.BOOLEAN } },
                    required: ["isStory"]
                }
            }
        }));

        const result = JSON.parse(response.text || '{}');
        return !!result.isStory;
    } catch (e) {
        handleGeminiError(e);
        return false; 
    }
};

// --- AVATAR GENERATION LOGIC ---
const ARMOR_DESCRIPTIONS: Record<string, string> = {
    'Classic Bronze': 'Traditional Spartan bronze cuirass with defined muscle sculpting, deep red cape draped over shoulders, leather straps, and Corinthian helmet details on the pauldrons. Battle-worn texture with scratches.',
    'Midnight Stealth': 'Sleek, matte black obsidian tactical armor, dark grey cowl/hood casting shadows over the forehead, faint purple energy accents in armor crevices, lightweight stealth aesthetic.',
    'Golden God': 'Highly polished, ceremonial gold plate armor with intricate divine engravings, radiating a faint warm glow, white and gold silk cape, angelic warrior aesthetic.',
    'Futuristic Chrome': 'High-tech silver chrome plating with segmented plates, neon blue light strips integrated into the chest and shoulders, cybernetic aesthetic, futuristic visor attachment on chest.'
};

const BACKGROUND_DESCRIPTIONS: Record<string, string> = {
    'Ancient Battlefield': 'A dusty, epic battlefield at sunset (golden hour), scattered shields and spears in the background, haze and smoke, dramatic cinematic lighting.',
    'Temple of Olympus': 'Ethereal mountaintop temple, white marble columns in background, bright blue sky with soft clouds, divine bright lighting, bloom effect.',
    'Stormy Peak': 'Dark, moody mountain peak, rain pouring down, lightning striking in the distance, cold blue and grey color palette, dramatic contrast.',
    'Volcanic Gates': 'Underground cavern, flowing lava rivers in background, dark rock, ambient orange and red lighting, embers floating in the air.'
};

export const generateSpartanAvatar = async (
  imageBase64: string, 
  level: number, 
  armorStyle: string = 'Classic Bronze', 
  backgroundStyle: string = 'Ancient Battlefield'
): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const armorPrompt = ARMOR_DESCRIPTIONS[armorStyle] || ARMOR_DESCRIPTIONS['Classic Bronze'];
    const bgPrompt = BACKGROUND_DESCRIPTIONS[backgroundStyle] || BACKGROUND_DESCRIPTIONS['Ancient Battlefield'];

    const armorQuality = level < 3 ? 'Basic Recruit condition' : level < 7 ? 'Battle-Hardened Veteran condition' : 'Legendary Commander condition';
    const auraPrompt = level > 5 ? 'Subtle supernatural power aura surrounding the character.' : 'No supernatural aura.';

    const prompt = `
      Task: Generate a high-fidelity 3D avatar portrait.
      INPUT IMAGE: Use the facial features from the provided image.
      SUBJECT APPEARANCE: ${armorPrompt}, ${armorQuality}, ${auraPrompt}
      ENVIRONMENT: ${bgPrompt}
      STYLE: 8k resolution, Octane Render, Heroic, Cinematic.
    `;

    const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
          imageConfig: { aspectRatio: "1:1" }
      }
    }));

    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
  } catch (error) {
    handleGeminiError(error);
    return null;
  }
};