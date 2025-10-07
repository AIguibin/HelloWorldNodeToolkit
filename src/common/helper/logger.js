import pino from 'pino';
import path from 'path';
import fs from 'fs';

const logDir = './logs';

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const transport = pino.transport({
    targets: [
        {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            },
            level: 'info'
        },
        {
            target: 'pino/file',
            options: {
                destination: path.join(logDir, 'application.log'),
                mkdir: true
            },
            level: 'debug'
        }
    ]
});

export const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            }
        },
        serializers: {
            error: pino.stdSerializers.err
        }
    },
    transport
);

// 专门的数据操作日志
export const dbLogger = logger.child({ module: 'database' });
export const httpLogger = logger.child({ module: 'http' });
export const cliLogger = logger.child({ module: 'cli' });

export default logger;