export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel;
  private static readonly LEVEL_ORDER: LogLevel[] = [
    LogLevel.DEBUG,
    LogLevel.INFO,
    LogLevel.WARN,
    LogLevel.ERROR,
  ];

  constructor(minLevel: LogLevel = LogLevel.DEBUG) {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVEL_ORDER.indexOf(level) >= Logger.LEVEL_ORDER.indexOf(this.minLevel);
  }

  private emit(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    if (entry.level === LogLevel.ERROR) {
      console.error(output);
    } else if (entry.level === LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private log(level: LogLevel, service: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
    };
    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }
    this.emit(entry);
  }

  debug(service: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, service, message, data);
  }

  info(service: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, service, message, data);
  }

  warn(service: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, service, message, data);
  }

  error(service: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, service, message, data);
  }

  forService(serviceName: string): ServiceLogger {
    return new ServiceLogger(this, serviceName);
  }
}

class ServiceLogger {
  constructor(private logger: Logger, private serviceName: string) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(this.serviceName, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(this.serviceName, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(this.serviceName, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(this.serviceName, message, data);
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) ?? LogLevel.DEBUG
);
