import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logFile: string;
  private maxSizeBytes: number;

  constructor(logFile: string = 'confluence-mcp.log', maxSizeMB: number = 3) {
    this.logFile = path.resolve(logFile);
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
  }

  private async checkAndTrimLogFile(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.logFile);
      if (stats.size > this.maxSizeBytes) {
        const content = await fs.promises.readFile(this.logFile, 'utf8');
        const lines = content.split('\n');
        
        // Keep approximately the last 50% of lines to prevent frequent trimming
        const keepLines = Math.floor(lines.length * 0.5);
        const trimmedContent = lines.slice(-keepLines).join('\n');
        
        await fs.promises.writeFile(this.logFile, trimmedContent);
      }
    } catch (error) {
      // If file doesn't exist, that's fine - it will be created on first write
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error checking log file size:', error);
      }
    }
  }

  private async writeLog(entry: string): Promise<void> {
    await this.checkAndTrimLogFile();
    
    try {
      await fs.promises.appendFile(this.logFile, entry + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  async logRequest(method: string, url: string, params?: any, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'REQUEST',
      method: method?.toUpperCase(),
      url,
      params: params || {},
      data: data ? this.sanitizeData(data) : undefined
    };

    await this.writeLog(JSON.stringify(logEntry));
  }

  async logResponse(method: string, url: string, status: number, data?: any, duration?: number): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'RESPONSE',
      method: method?.toUpperCase(),
      url,
      status,
      data: data ? this.sanitizeData(data) : undefined,
      duration: duration ? `${duration}ms` : undefined
    };

    await this.writeLog(JSON.stringify(logEntry));
  }

  async logError(method: string, url: string, error: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'ERROR',
      method: method?.toUpperCase(),
      url,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? this.sanitizeData(error.response.data) : undefined
      }
    };

    await this.writeLog(JSON.stringify(logEntry));
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Create a deep copy and remove sensitive information
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove or mask sensitive fields
    this.removeSensitiveFields(sanitized);
    
    return sanitized;
  }

  private removeSensitiveFields(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;
    
    const sensitiveKeys = ['password', 'token', 'authorization', 'auth', 'key', 'secret'];
    
    for (const key in obj) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key]);
      }
    }
  }
}