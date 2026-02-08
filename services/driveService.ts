
import { Logger } from './logger';
import { CalendarEvent, EventType } from '../types';

class DriveService {
  async syncFolder(folderId: string, currentModules: any[]): Promise<{ modules: any[], events: CalendarEvent[] }> {
    Logger.info(`Starting Full Drive Sync for Folder: ${folderId}`);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedModules = currentModules.map((mod, index) => {
        const moduleNum = index + 1;
        return {
          ...mod,
          videoUrl: `https://www.googleapis.com/drive/v3/files/MOCK_VIDEO_ID_${moduleNum}?alt=media`,
          pdfUrl: `https://www.googleapis.com/drive/v3/files/MOCK_PDF_ID_${moduleNum}?alt=media`
        };
      });

      // Simulating fetching a calendar.json file from Drive
      const syncedEvents: CalendarEvent[] = [
        {
          id: 'sync-e1',
          title: 'Стратегическая сессия (Sync)',
          description: 'Обновленное расписание из Штаба.',
          date: new Date(Date.now() + 86400000).toISOString(),
          type: EventType.WEBINAR,
          durationMinutes: 60
        },
        {
          id: 'sync-e2',
          title: 'Дедлайн аттестации',
          description: 'Проверка боевой готовности.',
          date: new Date(Date.now() + 259200000).toISOString(),
          type: EventType.HOMEWORK,
          durationMinutes: 0
        }
      ];

      Logger.info('Drive Sync Successful (Modules & Events)');
      return { modules: updatedModules, events: syncedEvents };
    } catch (error) {
      Logger.error('Drive Sync Failed', error);
      throw error;
    }
  }
}

export const DriveSync = new DriveService();
