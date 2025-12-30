import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: unknown;
  data?: unknown;
}

class Logger {
  // private logDir: string;
  // private debugLogFile: string;
  // private errorLogFile: string;

  constructor() {
    // this.logDir = join(process.cwd(), 'logs');
    // this.debugLogFile = join(this.logDir, 'debug.log');
    // this.errorLogFile = join(this.logDir, 'error.log');
    
    // // Ensure log directory exists
    // if (!existsSync(this.logDir)) {
    //   mkdirSync(this.logDir, { recursive: true });
    // }
  }

  private log(level: LogLevel, message: string, error?: unknown, data?: unknown) {
    // const entry: LogEntry = {
    //   level,
    //   message,
    //   timestamp: new Date().toISOString(),
    //   error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
    //   data
    // };

    // Log to console with appropriate formatting
    // const logMessage = `[${entry.timestamp}] ${level.toUpperCase()}: ${message}`;
    
    // switch (level) {
    //   case 'info':
    //     console.info(logMessage);
    //     break;
    //   case 'warn':
    //     console.warn(logMessage);
    //     break;
    //   case 'error':
    //     console.error(logMessage);
    //     if (error && error instanceof Error && error.stack) {
    //       console.error(error.stack);
    //     }
    //     // Always write errors to file
    //     this.writeToFile(this.errorLogFile, entry);
    //     break;
    //   case 'debug':
    //     // Only show debug in console if explicitly enabled
    //     if (process.env.DEBUG_CONSOLE === 'true') {
    //       console.debug(logMessage);
    //     }
    //     // Always write debug to file
    //     this.writeToFile(this.debugLogFile, entry);
    //     break;
    // }
  }

  private writeToFile(filePath: string, entry: LogEntry) {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      appendFileSync(filePath, logLine);
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }
  }

  info(message: string, error?: unknown, data?: unknown) {
    this.log('info', message, error, data);
  }

  warn(message: string, error?: unknown, data?: unknown) {
    this.log('warn', message, error, data);
  }

  error(message: string, data?: unknown, error?: unknown) {
    this.log('error', message, error, data);
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, undefined, data);
  }

  // Helper method to clear debug logs
  clearDebugLogs() {
    // try {
    //   if (existsSync(this.debugLogFile)) {
    //     writeFileSync(this.debugLogFile, '');
    //   }
    // } catch (error) {
    //   console.error('Failed to clear debug logs:', error);
    // }
  }

  // Helper method to get log file paths
  getLogFilePaths() {
    return {
      // debug: this.debugLogFile,
      // error: this.errorLogFile
    };
  }
}

export const logger = new Logger();
