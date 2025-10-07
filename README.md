# aiguibin-toolkit-alpha

一个专业的大型Node.js工具包项目结构。项目具有可维护性、可扩展性和代码复用性。

## 项目目录结构

```
aiguibin-toolkit-alpha/
├── bin/                          # CLI命令入口
│   ├── index.js                  # 主命令注册
│   ├── rule-importer.js          # 规则导入命令
│   ├── db-manager.js             # 数据库管理命令
│   └── http-client.js            # HTTP客户端命令
├── config/                       # 配置文件
│   ├── database.js               # 数据库配置
│   ├── http.js                   # HTTP请求配置
│   ├── logger.js                 # 日志配置
│   └── index.js                  # 配置统一导出
├── src/
│   ├── service/                  # 业务服务层
│   │   ├── RuleImportService.js
│   │   ├── databaseService.js
│   │   ├── httpService.js
│   │   └── concurrentService.js
│   ├── library/                  # 核心库封装
│   │   ├── database/
│   │   │   ├── connectionPool.js
│   │   │   ├── queryBuilder.js
│   │   │   └── transactionManager.js
│   │   ├── http/
│   │   │   ├── httpClient.js
│   │   │   ├── requestBuilder.js
│   │   │   └── responseHandler.js
│   │   └── concurrent/
│   │       ├── threadPool.js
│   │       ├── taskScheduler.js
│   │       └── resourceManager.js
│   └── common/                   # 通用工具
│       ├── utils/
│       │   ├── logger.js
│       │   ├── validator.js
│       │   ├── encryptor.js
│       │   ├── delay.js
│       │   └── fileProcessor.js
│       ├── constants/
│       │   ├── errorCodes.js
│       │   ├── httpCodes.js
│       │   └── databaseConstants.js
│       └── errors/
│           ├── appError.js
│           ├── databaseError.js
│           └── httpError.js
├── logs/                         # 日志目录
│   ├── application/
│   ├── database/
│   └── http/
├── tests/                        # 测试目录
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                         # 文档
│   ├── api/
│   └── examples/
├── package.json
├── README.md
└── .env.example
```

## 核心文件实现

### 1. package.json
```json
{
  "name": "aiguibin-toolkit-alpha",
  "version": "1.0.0",
  "type": "module",
  "description": "A comprehensive toolkit for database operations and HTTP requests",
  "bin": {
    "aiguibin-toolkit": "./bin/index.js"
  },
  "scripts": {
    "start": "node bin/index.js",
    "dev": "node --watch bin/index.js",
    "test": "NODE_OPTIONS=--experimental-vm-modules npx jest",
    "test:coverage": "npm test -- --coverage"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "mysql2": "^3.6.0",
    "axios": "^1.4.0",
    "pino": "^8.14.0",
    "pino-pretty": "^10.0.0",
    "dotenv": "^16.3.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "jest": "^29.6.0",
    "@types/node": "^20.0.0"
  },
  "keywords": [
    "toolkit",
    "database",
    "mysql",
    "http",
    "cli"
  ]
}
```

### 2. bin/index.js (主命令入口)
```javascript
#!/usr/bin/env node

import { Command } from 'commander';
import ruleImporterCommand from './rule-importer.js';
import dbManagerCommand from './db-manager.js';
import httpClientCommand from './http-client.js';

const program = new Command();

program
  .name('aiguibin-toolkit')
  .description('A comprehensive toolkit for database operations and HTTP requests')
  .version('1.0.0');

// 注册子命令
program.addCommand(ruleImporterCommand);
program.addCommand(dbManagerCommand);
program.addCommand(httpClientCommand);

program.parse(process.argv);
```

### 3. bin/rule-importer.js (规则导入命令)
```javascript
import { Command } from 'commander';
import os from 'os';
import path from 'path';
import RuleImportService from '../src/service/RuleImportService.js';
import { logger } from '../src/common/helper/logger.js';

const command = new Command('import-rules');

command
  .description('多线程规则导入工具')
  .option('-p, --path <path>', 'Path to doc/auth directory', 
    path.join(process.cwd(), 'doc', 'auth'))
  .option('-d, --db <db>', 'Database name', 'DEV_ECMS_CREDIT')
  .option('-u, --url <url>', 'API base URL', process.env.API_BASE_URL)
  .option('-t, --delay <delay>', 'Delay between files in milliseconds', '1000')
  .option('-c, --threads <threads>', 'Number of threads to use', 
    Math.min(8, os.cpus().length).toString())
  .option('-f, --folders <folders>', 'Specific folders to process (comma separated)')
  .option('-m, --max-folders <maxFolders>', 'Maximum folders per thread', '10')
  .option('-b, --batch-size <batchSize>', 'Process folders in batches', '0')
  .action(async (options) => {
    try {
      const service = new RuleImportService(options);
      await service.execute();
      logger.info('规则导入完成');
    } catch (error) {
      logger.error(`规则导入失败: ${error.message}`);
      process.exit(1);
    }
  });

export default command;
```

### 4. src/library/database/connectionPool.js
```javascript
import mysql from 'mysql2/promise';
import { getDatabaseConfig } from '../../../config/database.js';
import { logger } from '../../common/helper/logger.js';
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
```

### 5. src/library/database/queryBuilder.js
```javascript
class QueryBuilder {
  constructor() {
    this.query = {
      select: [],
      from: '',
      where: [],
      joins: [],
      orderBy: [],
      groupBy: [],
      limit: null,
      offset: null
    };
    this.params = [];
  }

  select(fields) {
    this.query.select = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  from(table) {
    this.query.from = table;
    return this;
  }

  where(condition, value) {
    if (typeof condition === 'object') {
      Object.entries(condition).forEach(([key, val]) => {
        this.query.where.push(`${key} = ?`);
        this.params.push(val);
      });
    } else {
      this.query.where.push(condition);
      if (value !== undefined) {
        this.params.push(value);
      }
    }
    return this;
  }

  join(table, condition, type = 'INNER') {
    this.query.joins.push({
      table,
      condition,
      type
    });
    return this;
  }

  orderBy(field, direction = 'ASC') {
    this.query.orderBy.push(`${field} ${direction}`);
    return this;
  }

  limit(count) {
    this.query.limit = count;
    return this;
  }

  offset(count) {
    this.query.offset = count;
    return this;
  }

  build() {
    const parts = [];

    // SELECT
    if (this.query.select.length > 0) {
      parts.push(`SELECT ${this.query.select.join(', ')}`);
    } else {
      parts.push('SELECT *');
    }

    // FROM
    parts.push(`FROM ${this.query.from}`);

    // JOINS
    this.query.joins.forEach(join => {
      parts.push(`${join.type} JOIN ${join.table} ON ${join.condition}`);
    });

    // WHERE
    if (this.query.where.length > 0) {
      parts.push(`WHERE ${this.query.where.join(' AND ')}`);
    }

    // ORDER BY
    if (this.query.orderBy.length > 0) {
      parts.push(`ORDER BY ${this.query.orderBy.join(', ')}`);
    }

    // LIMIT
    if (this.query.limit) {
      parts.push(`LIMIT ${this.query.limit}`);
    }

    // OFFSET
    if (this.query.offset) {
      parts.push(`OFFSET ${this.query.offset}`);
    }

    return {
      sql: parts.join(' '),
      params: this.params
    };
  }

  reset() {
    this.query = {
      select: [],
      from: '',
      where: [],
      joins: [],
      orderBy: [],
      groupBy: [],
      limit: null,
      offset: null
    };
    this.params = [];
    return this;
  }
}

export default QueryBuilder;
```

### 6. src/common/utils/logger.js
```javascript
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
```

### 7. config/database.js
```javascript
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
```

### 8. src/common/utils/delay.js
```javascript
/**
 * 延时工具函数
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试的延时
 */
export const delayWithRetry = async (ms, maxRetries = 3, retryCount = 0) => {
  if (retryCount >= maxRetries) {
    throw new Error(`Max retries (${maxRetries}) exceeded`);
  }
  
  await delay(ms);
  return retryCount + 1;
};

/**
 * 指数退避延时
 */
export const exponentialBackoff = async (baseDelay, attempt, maxDelay = 30000) => {
  const delayTime = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 1000; // 添加随机抖动
  await delay(delayTime + jitter);
};

export default delay;
```

## 使用示例

### 数据库操作示例
```javascript
import connectionPoolManager from '../src/library/database/connectionPool.js';
import QueryBuilder from '../src/library/database/queryBuilder.js';

// 构建动态SQL
const query = new QueryBuilder()
  .select(['id', 'name', 'email'])
  .from('users')
  .where({ status: 'active' })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();

// 执行查询
const results = await connectionPoolManager.executeQuery('DEV_ECMS_CREDIT', query.sql, query.params);

// 并发执行多个数据库查询
const concurrentQueries = [
  { dbName: 'DEV_ECMS_CREDIT', sql: 'SELECT COUNT(*) as count FROM users', params: [] },
  { dbName: 'PROD_ECMS_CREDIT', sql: 'SELECT COUNT(*) as count FROM products', params: [] }
];

const results = await connectionPoolManager.executeConcurrentQueries(concurrentQueries);
```
## 特点：

1. **模块化设计** - 每个功能单一职责，易于测试和维护
2. **错误处理** - 统一的错误处理机制
3. **日志系统** - 分级日志，支持不同模块
4. **配置管理** - 统一的配置管理
5. **类型安全** - 使用ES Module，支持类型检查
6. **扩展性** - 易于添加新的命令和功能
7. **并发支持** - 内置并发处理能力