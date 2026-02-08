
import { AppConfig, UserProgress, Module, Lesson, Material, Stream, CalendarEvent, ArenaScenario, AppNotification } from '../types';
import { Logger } from './logger';
import { Storage } from './storage';

// Hardcoded fallbacks to ensure connection works immediately for everyone
const DEFAULT_PAT = 'YOUR_AIRTABLE_PAT_TOKEN0b87eebde957a290bc640488df0027e9a3edba4de0fb1ac6';
const DEFAULT_BASE_ID = 'appYOUR_BASE_ID_HERE';

// Helper types matching your Airtable table names
type TableName = 'Users' | 'Modules' | 'Lessons' | 'Materials' | 'Streams' | 'Events' | 'Scenarios' | 'Notifications' | 'Config' | 'Notebook' | 'Habits' | 'Goals';

class AirtableService {
    
    private getConfig() {
        const appConfig = Storage.get<AppConfig>('appConfig', {} as any);
        const integ = appConfig?.integrations;
        
        // Use local storage config if available, otherwise fall back to hardcoded constants
        const pat = integ?.airtablePat || DEFAULT_PAT;
        const baseId = integ?.airtableBaseId || DEFAULT_BASE_ID;
        const tableName = integ?.airtableTableName || 'Users';

        return {
            pat,
            baseId,
            tables: {
                Users: tableName,
                Modules: 'Modules',
                Lessons: 'Lessons',
                Materials: 'Materials',
                Streams: 'Streams',
                Events: 'Events',
                Scenarios: 'Scenarios',
                Notifications: 'Notifications',
                Config: 'Config',
                Notebook: 'Notebook',
                Habits: 'Habits',
                Goals: 'Goals'
            }
        };
    }

    private getHeaders(pat: string) {
        return {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
        };
    }

    // --- GENERIC FETCH ---

    async fetchTable<T>(tableName: TableName, mapper: (record: any) => T): Promise<T[]> {
        const { pat, baseId, tables } = this.getConfig();
        const actualTableName = tables[tableName];

        if (!pat || !baseId) return [];

        // Pagination loop to fetch all records
        let allRecords: any[] = [];
        let offset = '';
        
        try {
            do {
                const url = `https://api.airtable.com/v0/${baseId}/${actualTableName}${offset ? `?offset=${offset}` : ''}`;
                const response = await fetch(url, { headers: this.getHeaders(pat) });
                if (!response.ok) {
                    if (response.status === 404) Logger.warn(`Airtable: Table '${actualTableName}' not found.`);
                    return [];
                }
                const data = await response.json();
                if (data.records) allRecords = [...allRecords, ...data.records];
                offset = data.offset;
            } while (offset);

            return allRecords.map((r: any) => {
                try {
                    return mapper(r);
                } catch (e) {
                    console.error(`Error mapping record from ${tableName}`, r, e);
                    return null;
                }
            }).filter((i: any) => i !== null) as T[];
        } catch (error) {
            Logger.error(`Airtable: Error fetching ${tableName}`, error);
            return [];
        }
    }

    // --- GENERIC UPSERT ---

    async upsertRecord(tableName: TableName, searchField: string, searchValue: string, fields: any) {
        const { pat, baseId, tables } = this.getConfig();
        if (!pat || !baseId) return;

        const actualTableName = tables[tableName];
        
        try {
            const safeValue = String(searchValue).replace(/'/g, "\\'");
            const filter = encodeURIComponent(`{${searchField}} = '${safeValue}'`);
            const findUrl = `https://api.airtable.com/v0/${baseId}/${actualTableName}?filterByFormula=${filter}`;
            
            const findRes = await fetch(findUrl, { headers: this.getHeaders(pat) });
            const findData = await findRes.json();
            const existingRecord = findData.records?.[0];

            const url = `https://api.airtable.com/v0/${baseId}/${actualTableName}${existingRecord ? `/${existingRecord.id}` : ''}`;
            const method = existingRecord ? 'PATCH' : 'POST';

            await fetch(url, {
                method,
                headers: this.getHeaders(pat),
                body: JSON.stringify({ fields: { ...fields, [searchField]: searchValue }, typecast: true })
            });
            
            return existingRecord ? existingRecord.id : null;

        } catch (error) {
            Logger.error(`Airtable: Error saving to ${tableName}`, error);
            return null;
        }
    }

    // --- USER SYNC ---

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
            const url = `https://api.airtable.com/v0/${baseId}/${tables.Users}?filterByFormula=${filter}`;
            
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
                const createRes = await fetch(`https://api.airtable.com/v0/${baseId}/${tables.Users}`, {
                    method: 'POST',
                    headers: this.getHeaders(pat),
                    body: JSON.stringify({ fields: payloadFields, typecast: true })
                });
                const createData = await createRes.json();
                userRecordId = createData.id;
                finalUser = { ...localUser, lastSyncTimestamp: currentTimestamp, airtableRecordId: userRecordId };
            } else {
                const remoteUser = this.mapRecordToUser(remoteRecord);
                const localTime = localUser.lastSyncTimestamp || 0;
                const remoteTime = remoteUser.lastSyncTimestamp || 0;

                if (localTime > remoteTime + 2000) {
                    await fetch(`https://api.airtable.com/v0/${baseId}/${tables.Users}/${remoteRecord.id}`, {
                        method: 'PATCH',
                        headers: this.getHeaders(pat),
                        body: JSON.stringify({ fields: payloadFields, typecast: true })
                    });
                    finalUser = { ...localUser, lastSyncTimestamp: currentTimestamp, airtableRecordId: remoteRecord.id };
                } else if (remoteTime > localTime) {
                    Logger.info('Airtable: Pulled newer user data from cloud');
                    return remoteUser;
                } else {
                    finalUser = { ...localUser, airtableRecordId: remoteRecord.id };
                }
            }

            if (userRecordId) {
                this.syncUserDetails(finalUser, userRecordId);
            }

            return finalUser;

        } catch (error) {
            Logger.warn('Airtable User Sync Failed', error);
            return localUser;
        }
    }

    private async syncUserDetails(user: UserProgress, userRecordId: string) {
        if (user.notebook && user.notebook.length > 0) {
            user.notebook.forEach(note => {
                this.upsertRecord('Notebook', 'id', note.id, {
                    "Text": note.text,
                    "Type": note.type,
                    "Date": note.date,
                    "User": [userRecordId]
                });
            });
        }
        if (user.habits && user.habits.length > 0) {
            user.habits.forEach(habit => {
                this.upsertRecord('Habits', 'id', habit.id, {
                    "Title": habit.title,
                    "Streak": habit.streak,
                    "User": [userRecordId]
                });
            });
        }
        if (user.goals && user.goals.length > 0) {
            user.goals.forEach(goal => {
                this.upsertRecord('Goals', 'id', goal.id, {
                    "Title": goal.title,
                    "Progress": `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`,
                    "IsCompleted": goal.isCompleted,
                    "User": [userRecordId]
                });
            });
        }
    }

    // --- CONTENT FETCHING ---

    // 1. Fetch Lessons (Raw)
    private async getLessons(): Promise<any[]> {
        return this.fetchTable('Lessons', (r) => {
            const f = r.fields;
            return {
                id: f.id || r.id,
                title: f.title,
                description: f.description,
                content: f.content || '',
                xpReward: f.xpReward || 50,
                homeworkType: f.homeworkType || 'TEXT',
                homeworkTask: f.homeworkTask || '',
                aiGradingInstruction: f.aiGradingInstruction || '',
                videoUrl: f.videoUrl,
                moduleLink: f.Module // Array of Module Record IDs
            };
        });
    }

    // 2. Fetch Modules and join with Lessons
    async getModulesWithLessons(): Promise<Module[]> {
        const [modulesRaw, lessonsRaw] = await Promise.all([
            this.fetchTable('Modules', (r) => {
                const f = r.fields;
                return {
                    id: f.id || r.id,
                    recordId: r.id,
                    title: f.title,
                    description: f.description,
                    category: f.category,
                    minLevel: f.minLevel || 1,
                    imageUrl: f.imageUrl,
                    videoUrl: f.videoUrl,
                    lessons: [] // Placeholder
                };
            }),
            this.getLessons()
        ]);

        // Join
        return modulesRaw.map(mod => {
            const modLessons = lessonsRaw.filter((l: any) => 
                l.moduleLink && l.moduleLink.includes(mod.recordId)
            );
            
            // Clean up internal field moduleLink
            const cleanLessons = modLessons.map(({ moduleLink, ...rest }: any) => rest as Lesson);
            
            return { ...mod, lessons: cleanLessons };
        });
    }

    // --- OTHER TABLES ---

    async getMaterials() { return this.fetchTable('Materials', (r) => {
        const f = r.fields;
        return {
            id: f.id || r.id,
            title: f.title,
            description: f.description,
            type: f.type,
            url: f.url
        } as Material;
    });}

    async getStreams() { return this.fetchTable('Streams', (r) => {
        const f = r.fields;
        return {
            id: f.id || r.id,
            title: f.title,
            date: f.date,
            status: f.status,
            youtubeUrl: f.youtubeUrl
        } as Stream;
    });}

    async getEvents() { return this.fetchTable('Events', (r) => {
        const f = r.fields;
        return {
            id: f.id || r.id,
            title: f.title,
            description: f.description,
            date: f.date,
            type: f.type,
            durationMinutes: f.durationMinutes
        } as CalendarEvent;
    });}

    async getScenarios() { return this.fetchTable('Scenarios', (r) => {
        const f = r.fields;
        return {
            id: f.id || r.id,
            title: f.title,
            difficulty: f.difficulty,
            clientRole: f.clientRole,
            objective: f.objective,
            initialMessage: f.initialMessage
        } as ArenaScenario;
    });}

    async getNotifications() { return this.fetchTable('Notifications', (r) => {
        const f = r.fields;
        return {
            id: f.id || r.id,
            title: f.title,
            message: f.message,
            type: f.type,
            date: f.date,
            targetRole: f.targetRole
        } as AppNotification;
    });}

    // --- SAVERS (For Admin Dashboard) ---
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
    async getAllUsers() { return this.fetchTable('Users', (r) => this.mapRecordToUser(r)); }
    async getConfigRecord() { return this.fetchTable('Config', r => ({ key: r.fields.key, value: r.fields.value })).then(r => r.find(x => x.key === 'appConfig') ? JSON.parse(r.find(x => x.key === 'appConfig')!.value) : null); }
    async saveConfig(config: AppConfig) { await this.upsertRecord('Config', 'key', 'appConfig', { value: JSON.stringify(config) }); }
}

export const airtable = new AirtableService();
