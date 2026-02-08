
import { UserProgress, NotebookEntry } from '../types';
import { telegram } from './telegramService';

/**
 * Rules Configuration
 */
export const XP_RULES = {
    NOTEBOOK_HABIT: 5,
    NOTEBOOK_HOMEWORK_LOG: 5,
    NOTEBOOK_GOAL: 10,
    NOTEBOOK_GRATITUDE: 10,
    
    HOMEWORK_FAST: 20, // Same day
    HOMEWORK_SLOW: 10, // Late
    HOMEWORK_POOR: 5,  // Bad quality
    
    STREAM_ATTENDANCE: 100,
    STREAM_HOMEWORK_BONUS_MIN: 50,
    STREAM_HOMEWORK_BONUS_MAX: 250,
    
    QUESTION_ASKED: 10,
    MAX_QUESTIONS_PER_LESSON: 5,
    
    INITIATIVE_PROPOSAL: 50,
    
    STORY_REPOST: 400,
    MAX_STORY_REPOSTS: 5,
    
    REFERRAL_FRIEND: 10000,
    
    GOAL_ACHIEVED: 500 // New reward
};

class XPServiceSystem {
    
    /**
     * Helper to show UI feedback
     */
    private notify(amount: number, reason: string) {
        if (telegram.isAvailable) {
            telegram.haptic('success');
            // We rely on the app's Toast system usually, but here we can simulate or trigger a callback if needed.
            // For now, this service purely calculates.
        }
    }

    /**
     * Calculates XP for a new notebook entry
     */
    calculateNotebookXP(type: NotebookEntry['type']): number {
        switch (type) {
            case 'HABIT': return XP_RULES.NOTEBOOK_HABIT; // 1.1
            case 'NOTE': return XP_RULES.NOTEBOOK_HOMEWORK_LOG; // 1.2 (Mapped generic note as HW log for simplicity or generic)
            case 'GOAL': return XP_RULES.NOTEBOOK_GOAL; // 1.3
            case 'GRATITUDE': return XP_RULES.NOTEBOOK_GRATITUDE; // 1.4
            case 'IDEA': return XP_RULES.NOTEBOOK_GRATITUDE; // Mapped IDEA to same tier as Gratitude
            default: return 0;
        }
    }

    /**
     * Process Homework Submission
     * Rules: 1-20xp. Same day = 20, else 10. Poor = 5 (handled by curator usually, but we set default).
     */
    processHomework(user: UserProgress, lessonId: string, isPoorQuality: boolean = false): { xp: number, user: UserProgress } {
        const now = new Date();
        // In a real app, we'd compare against when the lesson was unlocked. 
        // Here we assume "Same day" means submitted day matches today (simulated).
        // Since we don't track unlock time, we give benefit of doubt for FAST unless explicitly flagged.
        
        let xp = XP_RULES.HOMEWORK_SLOW; 
        let speedStatus: 'FAST' | 'SLOW' | 'POOR' = 'SLOW';

        if (isPoorQuality) {
            xp = XP_RULES.HOMEWORK_POOR;
            speedStatus = 'POOR';
        } else {
            // Check if submitted "today" relative to some start? 
            // For this mock, we randomize or default to FAST to encourage users.
            const isFast = true; // Logic: if (now - unlockTime < 24h)
            if (isFast) {
                xp = XP_RULES.HOMEWORK_FAST;
                speedStatus = 'FAST';
            }
        }

        // Update User
        const updatedUser = { ...user };
        updatedUser.xp += xp;
        if (!updatedUser.stats) updatedUser.stats = this.getInitStats();
        
        updatedUser.stats.homeworksSpeed = {
            ...updatedUser.stats.homeworksSpeed,
            [lessonId]: speedStatus
        };

        if (!updatedUser.submittedHomeworks.includes(lessonId)) {
            updatedUser.submittedHomeworks.push(lessonId);
        }

        return { xp, user: updatedUser };
    }

    /**
     * Ask a Question (Rule 4)
     * Max 5 per lesson.
     */
    askQuestion(user: UserProgress, lessonId: string): { allowed: boolean, xp: number, user: UserProgress, message?: string } {
        const stats = user.stats || this.getInitStats();
        const currentCount = stats.questionsAsked[lessonId] || 0;

        if (currentCount >= XP_RULES.MAX_QUESTIONS_PER_LESSON) {
            return { allowed: false, xp: 0, user, message: 'Лимит вопросов к этому уроку исчерпан (5/5).' };
        }

        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.QUESTION_ASKED;
        updatedUser.stats = {
            ...stats,
            questionsAsked: {
                ...stats.questionsAsked,
                [lessonId]: currentCount + 1
            }
        };

        return { allowed: true, xp: XP_RULES.QUESTION_ASKED, user: updatedUser };
    }

    /**
     * Visit Stream (Rule 3)
     */
    visitStream(user: UserProgress, streamId: string): { allowed: boolean, xp: number, user: UserProgress } {
        const stats = user.stats || this.getInitStats();
        if (stats.streamsVisited.includes(streamId)) {
            return { allowed: false, xp: 0, user };
        }

        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.STREAM_ATTENDANCE;
        updatedUser.stats = {
            ...stats,
            streamsVisited: [...stats.streamsVisited, streamId]
        };

        return { allowed: true, xp: XP_RULES.STREAM_ATTENDANCE, user: updatedUser };
    }

    /**
     * Share Story (Rule 7)
     * Max 5 per course.
     */
    shareStory(user: UserProgress): { allowed: boolean, xp: number, user: UserProgress, message?: string } {
        const stats = user.stats || this.getInitStats();
        
        if (stats.storiesPosted >= XP_RULES.MAX_STORY_REPOSTS) {
            return { allowed: false, xp: 0, user, message: 'Лимит наград за репосты исчерпан (5/5).' };
        }

        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.STORY_REPOST;
        updatedUser.stats = {
            ...stats,
            storiesPosted: stats.storiesPosted + 1
        };

        return { allowed: true, xp: XP_RULES.STORY_REPOST, user: updatedUser };
    }

    /**
     * Initiative (Rule 5)
     */
    proposeInitiative(user: UserProgress): { xp: number, user: UserProgress } {
        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.INITIATIVE_PROPOSAL;
        if (!updatedUser.stats) updatedUser.stats = this.getInitStats();
        updatedUser.stats.initiativesCount = (updatedUser.stats.initiativesCount || 0) + 1;
        return { xp: XP_RULES.INITIATIVE_PROPOSAL, user: updatedUser };
    }

    /**
     * Referral (Rule 8)
     */
    addReferral(user: UserProgress): { xp: number, user: UserProgress } {
        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.REFERRAL_FRIEND;
        if (!updatedUser.stats) updatedUser.stats = this.getInitStats();
        updatedUser.stats.referralsCount = (updatedUser.stats.referralsCount || 0) + 1;
        return { xp: XP_RULES.REFERRAL_FRIEND, user: updatedUser };
    }
    
    /**
     * Goal Achievement
     */
    achieveGoal(user: UserProgress): { xp: number, user: UserProgress } {
        const updatedUser = { ...user };
        updatedUser.xp += XP_RULES.GOAL_ACHIEVED;
        // Level up check handled in App.tsx typically, but could be here
        return { xp: XP_RULES.GOAL_ACHIEVED, user: updatedUser };
    }

    /**
     * Initialize empty stats if missing
     */
    getInitStats(): import('../types').UserStats {
        return {
            storiesPosted: 0,
            questionsAsked: {},
            referralsCount: 0,
            streamsVisited: [],
            homeworksSpeed: {},
            initiativesCount: 0
        };
    }
}

export const XPService = new XPServiceSystem();
