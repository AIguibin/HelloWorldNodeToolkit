import mysql from 'mysql2/promise';
import { getDatabaseConfig } from '../../../config/database.js';
import { logger } from '../../common/utils/logger.js';
import { DatabaseError } from '../../common/errors/databaseError.js';

class ConnectionPoolManager {
    constructor() {
        this.pools = new Map();
        this.connections = new Map();
    }

    getPool(dbName) {
        if (this.pools.has(dbName)) {
            return this.pools.get(dbName);
        }

        const config = getDatabaseConfig(dbName);
        if (!config) {
            throw new DatabaseError(`Database configuration for ${dbName} not found`, 'CONFIG_NOT_FOUND');
        }

        const pool = mysql.createPool({
            ...config,
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true
        });

        this.pools.set(dbName, pool);
        logger.info(`数据库连接池创建成功: ${dbName}`);

        return pool;
    }

    async executeQuery(dbName, sql, params = []) {
        const pool = this.getPool(dbName);

        try {
            logger.info(`开始执行SQL - 数据库: ${dbName}`);
            logger.debug(`SQL语句: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);

            if (params.length > 0) {
                logger.debug(`参数: ${JSON.stringify(params).substring(0, 200)}`);
            }

            const [rows] = await pool.execute(sql, params);

            logger.info(`SQL执行成功 - 数据库: ${dbName}, 返回记录: ${rows.length} 条`);
            return rows;
        } catch (error) {
            logger.error(`SQL执行失败 - 数据库: ${dbName}, 错误: ${error.message}`);
            logger.error(`失败SQL: ${sql}`);
            throw new DatabaseError(error.message, 'QUERY_EXECUTION_FAILED', { sql, dbName });
        }
    }

    async executeTransaction(dbName, operations) {
        const pool = this.getPool(dbName);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            logger.info(`开始事务 - 数据库: ${dbName}`);

            const results = [];
            for (const operation of operations) {
                const result = await connection.execute(operation.sql, operation.params);
                results.push(result);
            }

            await connection.commit();
            logger.info(`事务提交成功 - 数据库: ${dbName}`);

            return results;
        } catch (error) {
            await connection.rollback();
            logger.error(`事务回滚 - 数据库: ${dbName}, 错误: ${error.message}`);
            throw new DatabaseError(error.message, 'TRANSACTION_FAILED', { dbName });
        } finally {
            connection.release();
        }
    }

    async closeAllPools() {
        for (const [dbName, pool] of this.pools) {
            try {
                await pool.end();
                logger.info(`数据库连接池关闭成功: ${dbName}`);
            } catch (error) {
                logger.error(`关闭数据库连接池失败: ${dbName}, 错误: ${error.message}`);
            }
        }
        this.pools.clear();
    }

    // 支持并发连接多个数据库
    async executeConcurrentQueries(queries) {
        const queryPromises = queries.map(({ dbName, sql, params }) =>
            this.executeQuery(dbName, sql, params)
        );

        return Promise.allSettled(queryPromises);
    }
}

// 单例模式导出
export default new ConnectionPoolManager();