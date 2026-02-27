import winston from 'winston';

const { combine, timestamp, errors, json, simple, colorize } = winston.format;

// Create logger configuration based on environment
const transports: winston.transport[] = [];

// In production (Vercel), only use console logging since filesystem is read-only
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(
        timestamp(),
        json()
      ),
      handleExceptions: true
    })
  );
} else {
  // In development, use both file and console logging
  transports.push(
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      handleExceptions: true
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      handleExceptions: true
    }),
    new winston.transports.Console({
      format: combine(
        colorize(),
        simple(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const ts = new Date(timestamp as string).toLocaleTimeString();
          return `${ts} [${level}]: ${stack || message}`;
        })
      ),
      handleExceptions: true
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp()
  ),
  defaultMeta: { service: 'nexecute-connect-api' },
  transports,
  exitOnError: false
});

export { logger };