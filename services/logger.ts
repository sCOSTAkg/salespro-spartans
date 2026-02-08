
// Simple Logger Service
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class LoggerService {
  private logs: { level: LogLevel; message: string; timestamp: string; data?: any }[] = [];
  private maxLogs = 100;

  private formatMessage(level: LogLevel, message: string) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  log(level: LogLevel, message: string, data?: any) {
    const logEntry = { level, message, timestamp: new Date().toISOString(), data };
    this.logs.unshift(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Output to console with styling
    const styles = {
      INFO: 'color: #3b82f6; font-weight: bold',
      WARN: 'color: #f59e0b; font-weight: bold',
      ERROR: 'color: #ef4444; font-weight: bold',
      DEBUG: 'color: #9ca3af; font-weight: bold'
    };

    console.log(`%c${level}`, styles[level], message, data || '');
  }

  info(message: string, data?: any) { this.log('INFO', message, data); }
  warn(message: string, data?: any) { this.log('WARN', message, data); }
  error(message: string, data?: any) { this.log('ERROR', message, data); }
  debug(message: string, data?: any) { this.log('DEBUG', message, data); }

  getLogs() {
    return this.logs;
  }

  clear() {
      this.logs = [];
      console.clear();
      console.log('%cSystem Logs Cleared', 'color: #00B050; font-weight: bold; font-size: 12px;');
  }
}

export const Logger = new LoggerService();
