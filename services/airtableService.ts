import { AppConfig, UserProgress, Module, Lesson, Material, Stream, CalendarEvent, ArenaScenario, AppNotification } from '../types';
import { Logger } from './logger';
import { Storage } from './storage';

/**
 * ПРИОРИТЕТ КОНФИГУРАЦИИ:
 * 1. ENV переменные (import.meta.env) - для production
 * 2. Storage config - для legacy админки
 * 3. Пустые значения - fallback
 */

type TableName = 'Users' | 'Modules' | 'Lessons' | 'Materials' | 'Streams' | 'Events' | 'Scenarios' | 'Notifications' | 'Config' | 'Notebook' | 'Habits' | 'Goals';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class AirtableService {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly CACHE_TTL = 30000; // 30 секунд

    private getConfig() {
        // ПРИОРИТЕТ 1: ENV переменные
        const envPat = import.meta.env.VITE_AIRTABLE_PAT;
        const envBaseId = import.meta.env.VITE_AIRTABLE_BASE_ID;

        // ПРИОРИТЕТ 2: Storage (admin panel)
        const appConfig = Storage.get<AppConfig>('appConfig', {} as any);
        const storagePat = appConfig?.integrations?.airtablePat;
        const storageBaseId = appConfig?.integrations?.airtableBaseId;

        const pat = envPat || storagePat || '';
        const baseId = envBaseId || storageBaseId || '';

        const tables = {
            Users: import.meta.env.VITE_AIRTABLE_TABLE_USERS || 'Users',
            Modules: import.meta.env.VITE_AIRTABLE_TABLE_MODULES || 'Modules',
            Lessons: import.meta.env.VITE_AIRTABLE_TABLE_LESSONS || 'Lessons',
            Materials: import.meta.env.VITE_AIRTABLE_TABLE_MATERIALS || 'Materials',
            Streams: import.meta.env.VITE_AIRTABLE_TABLE_STREAMS || 'Streams',
            Events: import.meta.env.VITE_AIRTABLE_TABLE_EVENTS || 'Events',
            Scenarios: import.meta.env.VITE_AIRTABLE_TABLE_SCENARIOS || 'Scenarios',
            Notifications: import.meta.env.VITE_AIRTABLE_TABLE_NOTIFICATIONS || 'Notifications',
            Config: 'Config',
            Notebook: 'Notebook',
            Habits: 'Habits',
            Goals: 'Goals'
        };

        return { pat, baseId, tables };
    }

    private getHeaders(pat: string) {
        return {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
        };
    }

    isConfigured(): boolean {
        const { pat, baseId } = this.getConfig();
        return !!(pat && baseId && pat.length > 10 && baseId.startsWith('app'));
    }

    clearCache() {
        this.cache.clear();
        Logger.info('Airtable cache cleared');
    }

    async fetchTable<T>(tableName: TableName, mapper: (record: any) => T, useCache: boolean = true): Promise<T[]> {
        const cacheKey = `table_${tableName}`;
        
        if (useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
                Logger.debug(`Using cached data for ${tableName}`);
                return cached.data;
            }
        }

        const { pat, baseId, tables } = this.getConfig();
        const actualTableName = tables[tableName];

        if (!pat || !baseId) {
            Logger.warn(`Airtable not configured. Cannot fetch ${tableName}.`);
            return [];
        }

        let allRecords: any[] = [];
        let offset = '';
        
        try {
            do {
                const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(actualTableName)}${offset ? `?offset=${offset}` : ''}`;
                const response = await fetch(url, { headers: this.getHeaders(pat) });
                
                if (!response.ok) {
                    if (response.status === 404) {
                        Logger.warn(`Airtable: Table '${actualTableName}' not found (404).`);
                    } else if (response.status === 401) {
                        Logger.error(`Airtable: Invalid PAT or permissions (401).`);
                    } else {
                        Logger.error(`Airtable: HTTP ${response.status}`);
                    }
                    return [];
                }
                
                const data = await response.json();
                if (data.records) allRecords = [...allRecords, ...data.records];
                offset = data.offset || '';
            } while (offset);

            const mappedData = allRecords.map((r: any) => {
                try {
                    return mapper(r);
                } catch (e) {
                    console.error(`Error mapping record from ${tableName}`, r, e);
                    return null;
                }
            }).filter((i: any) => i !== null) as T[];

            this.cache.set(cacheKey, { data: mappedData, timestamp: Date.now() });
            Logger.info(`Airtable: Loaded ${mappedData.length} records from ${tableName}`);
            return mappedData;

        } catch (error) {
            Logger.error(`Airtable: Network error fetching ${tableName}`, error);
            return [];
        }
    }

    async upsertRecord(tableName: TableName, searchField: string, searchValue: string, fields: any) {
        const { pat, baseId, tables } = this.getConfig();
        if (!pat || !baseId) return;

        const actualTableName = tables[tableName];
        
        try {
            const safeValue = String(searchValue).replace(/'/g, "\\'");
            const filter = encodeURIComponent(`{${searchField}} = '${safeValue}'`);
            const findUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(actualTableName)}?filterByFormula=${filter}`;
            
            const findRes = await fetch(findUrl, { headers: this.getHeaders(pat) });
            const findData = await findRes.json();
            const existingRecord = findData.records?.[0];

            const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(actualTableName)}${existingRecord ? `/${existingRecord.id}` : ''}`;
            const method = existingRecord ? 'PATCH' : 'POST';

            await fetch(url, {
                method,
                headers: this.getHeaders(pat),
                body: JSON.stringify({ fields: { ...fields, [searchField]: searchValue }, typecast: true })
            });
            
            this.cache.delete(`table_${tableName}`);
            return existingRecord ? existingRecord.id : null;

        } catch (error) {
            Logger.error(`Airtable: Error saving to ${tableName}`, error);
            return null;
        }
    }

    private mapRecordToUser(record: any): UserProgress {
        const f = record.fields;
        let additionalData = {};
        try {
            if (f.Data) additionalData = JSON.parse(f.Data);
        } catch (e) { console.error('Error parsing User Data JSON', e); }

        return {
            id: f.TelegramId, 
            airtableRecordId: record.id,
            telegramId: f.TelegramId,
            name: f.Name,
            role: f.Role,
            xp: f.XP || 0,
            level: f.Level || 1,
            lastSyncTimestamp: f.LastSync || 0,
            ...additionalData
        } as UserProgress;
    }

    async syncUser(localUser: UserProgress): Promise<UserProgress> {
        const { pat, baseId, tables } = this.getConfig();
        if (!pat || !baseId) return localUser;

        const tgId = localUser.telegramId || localUser.telegramUsername;
        if (!tgId) return localUser;

        try {
            const safeId = String(tgId).replace(/'/g, "\\'");
            const filter = encodeURIComponent(`{TelegramId} = '${safeId}'`);
            const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tables.Users)}?filterByFormula=${filter}`;
            
            const response = await fetch(url, { headers: this.getHeaders(pat) });
            const data = await response.json();
            const remoteRecord = data.records?.[0];

            const { id, airtableRecordId, name, role, xp, level, telegramId, lastSyncTimestamp, ...rest } = localUser;
            const currentTimestamp = Date.now();
            
            const payloadFields = {
                "TelegramId": String(tgId),
                "Name": name || 'Unknown',
                "Role": role || 'STUDENT',
                "XP": Number(xp) || 0,
                "Level": Number(level) || 1,
                "LastSync": currentTimestamp,
                "Data": JSON.stringify(rest)
            };

            let finalUser = localUser;
            let userRecordId = remoteRecord?.id;

            if (!remoteRecord) {
                const createRes = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tables.Users)}`, {
                    method: 'POST',
                    headers: this.getHeaders(pat),
                    body: JSON.stringify({ fields: payloadFields, typecast: true })
                });
                const createData = await createRes.json();
                userRecordId = createData.id;
                finalUser = { ...localUser, lastSyncTimestamp: currentTimestamp, airtableRecordId: userRecordId };
                Logger.info('Airtable: Created new user');
            } else {
                const remoteUser = this.mapRecordToUser(remoteRecord);
                const localTime = localUser.lastSyncTimestamp || 0;
                const remoteTime = remoteUser.lastSyncTimestamp || 0;

                if (localTime > remoteTime + 2000) {
                    await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tables.Users)}/${remoteRecord.id}`, {
                        method: 'PATCH',
                        headers: this.getHeaders(pat),
                        body: JSON.stringify({ fields: payloadFields, typecast: true })
                    });
                    finalUser = { ...localUser, lastSyncTimestamp: currentTimestamp, airtableRecordId: remoteRecord.id };
                    Logger.info('Airtable: Updated user (local newer)');
                } else if (remoteTime > localTime) {
                    Logger.info('Airtable: Pulled newer user data from cloud');
                    return remoteUser;
                } else {
                    finalUser = { ...localUser, airtableRecordId: remoteRecord.id };
                }
            }

            if (userRecordId) {
                await this.syncUserDetails(finalUser, userRecordId);
            }

            return finalUser;

        } catch (error) {
            Logger.warn('Airtable User Sync Failed', error);
            return localUser;
        }
    }

    private async syncUserDetails(user: UserProgress, userRecordId: string) {
        const promises: Promise<any>[] = [];

        if (user.notebook && user.notebook.length > 0) {
            for (const note of user.notebook) {
                promises.push(
                    this.upsertRecord('Notebook', 'id', note.id, {
                        "Text": note.text,
                        "Type": note.type,
                        "Date": note.date,
                        "User": [userRecordId]
                    })
                );
            }
        }
        if (user.habits && user.habits.length > 0) {
            for (const habit of user.habits) {
                promises.push(
                    this.upsertRecord('Habits', 'id', habit.id, {
                        "Title": habit.title,
                        "Streak": habit.streak,
                        "User": [userRecordId]
                    })
                );
            }
        }
        if (user.goals && user.goals.length > 0) {
            for (const goal of user.goals) {
                promises.push(
                    this.upsertRecord('Goals', 'id', goal.id, {
                        "Title": goal.title,
                        "Progress": `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`,
                        "IsCompleted": goal.isCompleted,
                        "User": [userRecordId]
                    })
                );
            }
        }

        try {
            await Promise.all(promises);
        } catch (error) {
            Logger.warn('Failed to sync some user details', error);
        }
    }

    private async getLessons(): Promise<any[]> {
        return this.fetchTable('Lessons', (r) => {
            const f = r.fields;
            
            const getField = (variants: string[]) => {
                for (const v of variants) {
                    if (f[v] !== undefined) return f[v];
                }
                return null;
            };

            return {
                id: getField(['id', 'ID', 'Id']) || r.id,
                title: getField(['title', 'Title', 'Name']) || 'Untitled Lesson',
                description: getField(['description', 'Description', 'Desc']) || '',
                content: getField(['content', 'Content', 'Body', 'Text']) || '',
                xpReward: getField(['xpReward', 'XP', 'XpReward', 'Reward']) || 50,
                homeworkType: getField(['homeworkType', 'HomeworkType', 'Type']) || 'TEXT',
                homeworkTask: getField(['homeworkTask', 'HomeworkTask', 'Task']) || '',
                aiGradingInstruction: getField(['aiGradingInstruction', 'AIGradingInstruction', 'GradingInstruction']) || '',
                videoUrl: getField(['videoUrl', 'VideoUrl', 'Video', 'VideoURL']),
                moduleLink: getField(['Module', 'module', 'ModuleId', 'ModuleLink'])
            };
        });
    }

    async getModulesWithLessons(): Promise<Module[]> {
        const [modulesRaw, lessonsRaw] = await Promise.all([
            this.fetchTable('Modules', (r) => {
                const f = r.fields;
                
                const getField = (variants: string[]) => {
                    for (const v of variants) {
                        if (f[v] !== undefined) return f[v];
                    }
                    return null;
                };

                return {
                    id: getField(['id', 'ID', 'Id']) || r.id,
                    recordId: r.id,
                    title: getField(['title', 'Title', 'Name']) || 'Untitled Module',
                    description: getField(['description', 'Description', 'Desc']) || '',
                    category: getField(['category', 'Category']) || 'GENERAL',
                    minLevel: getField(['minLevel', 'MinLevel', 'Level']) || 1,
                    imageUrl: getField(['imageUrl', 'ImageUrl', 'Image', 'ImageURL']) || '',
                    videoUrl: getField(['videoUrl', 'VideoUrl', 'Video', 'VideoURL']),
                    lessons: []
                };
            }),
            this.getLessons()
        ]);

        return modulesRaw.map(mod => {
            const modLessons = lessonsRaw.filter((l: any) => 
                l.moduleLink && Array.isArray(l.moduleLink) && l.moduleLink.includes(mod.recordId)
            );
            
            const cleanLessons = modLessons.map(({ moduleLink, ...rest }: any) => rest as Lesson);
            
            return { ...mod, lessons: cleanLessons };
        });
    }

    async getMaterials() { 
        return this.fetchTable('Materials', (r) => {
            const f = r.fields;
            const getField = (variants: string[]) => variants.find(v => f[v] !== undefined) ? f[variants.find(v => f[v] !== undefined)!] : null;
            
            return {
                id: getField(['id', 'ID']) || r.id,
                title: getField(['title', 'Title', 'Name']) || 'Material',
                description: getField(['description', 'Description']) || '',
                type: getField(['type', 'Type']) || 'LINK',
                url: getField(['url', 'URL', 'Link']) || '#'
            } as Material;
        });
    }

    async getStreams() { 
        return this.fetchTable('Streams', (r) => {
            const f = r.fields;
            const getField = (variants: string[]) => variants.find(v => f[v] !== undefined) ? f[variants.find(v => f[v] !== undefined)!] : null;
            
            return {
                id: getField(['id', 'ID']) || r.id,
                title: getField(['title', 'Title', 'Name']) || 'Stream',
                date: getField(['date', 'Date', 'DateTime']) || new Date().toISOString(),
                status: getField(['status', 'Status']) || 'UPCOMING',
                youtubeUrl: getField(['youtubeUrl', 'YoutubeUrl', 'YouTube', 'URL']) || ''
            } as Stream;
        });
    }

    async getEvents() { 
        return this.fetchTable('Events', (r) => {
            const f = r.fields;
            const getField = (variants: string[]) => variants.find(v => f[v] !== undefined) ? f[variants.find(v => f[v] !== undefined)!] : null;
            
            return {
                id: getField(['id', 'ID']) || r.id,
                title: getField(['title', 'Title', 'Name']) || 'Event',
                description: getField(['description', 'Description']) || '',
                date: getField(['date', 'Date', 'DateTime']) || new Date().toISOString(),
                type: getField(['type', 'Type', 'EventType']) || 'OTHER',
                durationMinutes: getField(['durationMinutes', 'Duration']) || 60
            } as CalendarEvent;
        });
    }

    async getScenarios() { 
        return this.fetchTable('Scenarios', (r) => {
            const f = r.fields;
            const getField = (variants: string[]) => variants.find(v => f[v] !== undefined) ? f[variants.find(v => f[v] !== undefined)!] : null;
            
            return {
                id: getField(['id', 'ID']) || r.id,
                title: getField(['title', 'Title']) || 'Scenario',
                difficulty: getField(['difficulty', 'Difficulty']) || 'Easy',
                clientRole: getField(['clientRole', 'ClientRole', 'Role']) || '',
                objective: getField(['objective', 'Objective', 'Goal']) || '',
                initialMessage: getField(['initialMessage', 'InitialMessage', 'Message']) || ''
            } as ArenaScenario;
        });
    }

    async getNotifications() { 
        return this.fetchTable('Notifications', (r) => {
            const f = r.fields;
            const getField = (variants: string[]) => variants.find(v => f[v] !== undefined) ? f[variants.find(v => f[v] !== undefined)!] : null;
            
            return {
                id: getField(['id', 'ID']) || r.id,
                title: getField(['title', 'Title']) || '',
                message: getField(['message', 'Message', 'Text']) || '',
                type: getField(['type', 'Type']) || 'INFO',
                date: getField(['date', 'Date']) || new Date().toISOString(),
                targetRole: getField(['targetRole', 'TargetRole']) || 'ALL'
            } as AppNotification;
        });
    }

    async saveModule(module: Module) {
        await this.upsertRecord('Modules', 'id', module.id, {
            title: module.title,
            description: module.description,
            category: module.category,
            minLevel: module.minLevel,
            imageUrl: module.imageUrl,
            videoUrl: module.videoUrl
        });
    }
    
    async saveMaterial(mat: Material) {
        await this.upsertRecord('Materials', 'id', mat.id, {
            title: mat.title,
            description: mat.description,
            type: mat.type,
            url: mat.url
        });
    }
    
    async saveStream(s: Stream) {
        await this.upsertRecord('Streams', 'id', s.id, {
            title: s.title,
            date: s.date,
            status: s.status,
            youtubeUrl: s.youtubeUrl
        });
    }
    
    async saveEvent(e: CalendarEvent) {
        await this.upsertRecord('Events', 'id', e.id, {
            title: e.title,
            description: e.description,
            date: typeof e.date === 'string' ? e.date : e.date.toISOString(),
            type: e.type,
            durationMinutes: e.durationMinutes
        });
    }
    
    async saveScenario(s: ArenaScenario) {
        await this.upsertRecord('Scenarios', 'id', s.id, {
            title: s.title,
            difficulty: s.difficulty,
            clientRole: s.clientRole,
            objective: s.objective,
            initialMessage: s.initialMessage
        });
    }
    
    async saveNotification(n: AppNotification) {
        await this.upsertRecord('Notifications', 'id', n.id, {
            title: n.title,
            message: n.message,
            type: n.type,
            date: n.date,
            targetRole: n.targetRole
        });
    }
    
    async getAllUsers() { 
        return this.fetchTable('Users', (r) => this.mapRecordToUser(r)); 
    }
    
    async getConfigRecord() {
        const records = await this.fetchTable('Config', r => ({
            key: r.fields.key,
            value: r.fields.value
        }));
        const appConfigEntry = records.find(x => x.key === 'appConfig');
        if (!appConfigEntry) return null;
        try {
            return JSON.parse(appConfigEntry.value);
        } catch (e) {
            Logger.error('Failed to parse appConfig JSON from Airtable', e);
            return null;
        }
    }
    
    async saveConfig(config: AppConfig) { 
        await this.upsertRecord('Config', 'key', 'appConfig', { 
            value: JSON.stringify(config) 
        }); 
    }
}

export const airtable = new AirtableService();
