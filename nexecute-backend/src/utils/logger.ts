import winston from 'winston';

const { combine, timestamp, errors, json, simple, colorize } = winston.format;

// Create logger configuration
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'nexecute-connect-api' },
  transports: [
    // Write to all logs with level `info` and below to `combined.log`
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      handleExceptions: true
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      handleExceptions: true
    })
  ],
  exitOnError: false
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      simple(),
      winston.format.printf(({ level, message, timestamp, stack }) => {
        const ts = new Date(timestamp as string).toLocaleTimeString();
        return `${ts} [${level}]: ${stack || message}`;
      })
    ),
    handleExceptions: true
  }));
}

export { logger };