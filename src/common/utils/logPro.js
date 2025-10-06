import pino from 'pino';
import path from 'path';
import fs from 'fs';

const logDir = './logs';

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志级别颜色映射
const levelColors = {
    info: '\x1b[34m',    // 蓝色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m',    // 黄色
    error: '\x1b[31m',   // 红色
    debug: '\x1b[90m',   // 灰色
};

// 自定义格式化函数
const customFormatter = (log) => {
    const timestamp = new Date().toISOString();
    const level = log.level.toUpperCase();
    const message = log.msg;

    // 为success级别特殊处理
    const displayLevel = level === 'INFO' && message.includes('[SUCCESS]') ? 'SUCCESS' : level;

    const color = levelColors[log.level] || '\x1b[0m';
    const reset = '\x1b[0m';

    return `${color}[${displayLevel}] ${timestamp}: ${message}${reset}`;
};

const transport = pino.transport({
    targets: [
        {
            target: 'pino-pretty',
            options: {
                colorize: false, // 禁用默认颜色，使用自定义颜色
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                customPrettifiers: {
                    // 自定义级别显示
                    level: (level) => {
                        const color = levelColors[level] || '\x1b[0m';
                        return `${color}${level.toUpperCase()}\x1b[0m`;
                    }
                },
                messageFormat: (log) => {
                    return customFormatter(log);
                }
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
            },
            // 添加自定义字段支持
            log: (object) => {
                // 支持success级别的特殊处理
                if (object.success) {
                    return { ...object, msg: `[SUCCESS] ${object.msg}` };
                }
                return object;
            }
        },
        serializers: {
            error: pino.stdSerializers.err
        },
        // 自定义级别
        customLevels: {
            success: 35 // 介于info和warn之间
        }
    },
    transport
);

// 扩展logger方法，提供更友好的API
export const extendedLogger = {
    ...logger,
    success: (message) => {
        logger.info(`[SUCCESS] ${message}`);
    }
};

// 专门的数据操作日志
export const dbLogger = extendedLogger.child({ module: 'database' });
export const httpLogger = extendedLogger.child({ module: 'http' });
export const cliLogger = extendedLogger.child({ module: 'cli' });

// 兼容原有chalk logger的API
export const compatLogger = {
    info: (message) => extendedLogger.info(message),
    success: (message) => extendedLogger.success(message),
    warning: (message) => extendedLogger.warn(message),
    error: (message) => extendedLogger.error(message),
    debug: (message) => extendedLogger.debug(message),
};

export default extendedLogger;