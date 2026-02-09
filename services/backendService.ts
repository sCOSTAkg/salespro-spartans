import { airtable } from './airtableService';
import { UserProgress } from '../types';

/**
 * Backend service wrapper for consistent API across components
 * Delegates to airtableService for actual data operations
 */
export const Backend = {
    /**
     * Sync user with backend (creates or updates user record)
     */
    async syncUser(user: UserProgress): Promise<UserProgress> {
        return await airtable.syncUser(user);
    },

    /**
     * Save/update user record
     */
    async saveUser(user: UserProgress): Promise<void> {
        await airtable.syncUser(user);
    },

    /**
     * Fetch all content (modules, materials, etc.)
     */
    async fetchAllContent() {
        try {
            const [modules, materials, streams, events, scenarios] = await Promise.all([
                airtable.fetchModules(),
                airtable.fetchMaterials(),
                airtable.fetchStreams(),
                airtable.fetchEvents(),
                airtable.fetchScenarios()
            ]);
            
            return {
                modules,
                materials,
                streams,
                events,
                scenarios
            };
        } catch (error) {
            console.error('Error fetching content:', error);
            return { 
                modules: [],
                materials: [],
                streams: [],
                events: [],
                scenarios: [],
                error: 'Failed to fetch content' 
            };
        }
    },

    /**
     * Fetch notifications
     */
    async fetchNotifications() {
        return await airtable.fetchNotifications();
    }
};