import { config } from 'dotenv';

config();

const databaseConfigs = {
    DEV_ECMS_CREDIT: {
        host: process.env.DB_HOST_DEV || 'localhost',
        port: parseInt(process.env.DB_PORT_DEV) || 3306,
        user: process.env.DB_USER_DEV || 'root',
        password: process.env.DB_PASSWORD_DEV || '',
        database: process.env.DB_NAME_DEV || 'dev_ecms_credit',
        charset: 'utf8mb4',
        timezone: '+08:00'
    },
    PROD_ECMS_CREDIT: {
        host: process.env.DB_HOST_PROD || 'localhost',
        port: parseInt(process.env.DB_PORT_PROD) || 3306,
        user: process.env.DB_USER_PROD || 'root',
        password: process.env.DB_PASSWORD_PROD || '',
        database: process.env.DB_NAME_PROD || 'prod_ecms_credit',
        charset: 'utf8mb4',
        timezone: '+08:00'
    },
    // 可以添加更多数据库配置
};

export const getDatabaseConfig = (dbName) => {
    const config = databaseConfigs[dbName];
    if (!config) {
        throw new Error(`Database configuration for ${dbName} not found`);
    }
    return config;
};

export const getAvailableDatabases = () => Object.keys(databaseConfigs);

export default databaseConfigs;