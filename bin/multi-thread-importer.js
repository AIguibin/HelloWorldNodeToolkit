#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 检查 Node.js 版本 - ESM 需要更高版本
const semver = require('semver');
if (semver.lt(process.version, '16.0.0')) {
    console.error('错误: ESM模式需要 Node.js 16.0.0 或更高版本');
    console.error(`当前版本: ${process.version}`);
    process.exit(1);
}

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { program } from 'commander';

// 获取当前文件的目录名（ESM替代__dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入其他模块
let logger;
let RuleImporter;

// 加载环境变量
import('dotenv').then(dotenv => {
    dotenv.config();
});

// 工作线程的逻辑
if (!isMainThread) {
    async function workerMain() {
        try {
            // 动态导入所需的模块
            const module = await import('../src/service/RuleImportService.js');
            RuleImporter = module.default;

            const { docAuthPath, dbName, apiBaseUrl, delayMs, folders, threadId, maxFoldersPerThread } = workerData;

            // 如果设置了每个线程最大处理文件夹数，进行截取
            const foldersToProcess = maxFoldersPerThread
                ? folders.slice(0, maxFoldersPerThread)
                : folders;

            // 动态导入logger
            const loggerModule = await import('../src/common/helper/logger.js');
            logger = loggerModule.default;

            logger.info(`线程 ${threadId} 开始处理 ${foldersToProcess.length} 个文件夹: ${foldersToProcess.join(', ')}`);

            const ruleImporter = new RuleImporter({
                docAuthPath,
                dbName,
                apiBaseUrl,
                delayMs: parseInt(delayMs)
            });

            await ruleImporter.process(foldersToProcess);

            parentPort.postMessage({
                success: true,
                threadId,
                message: `线程 ${threadId} 处理完成，处理了 ${foldersToProcess.length} 个文件夹`,
                processedCount: foldersToProcess.length
            });
        } catch (error) {
            // 从 workerData 中单独获取 threadId，确保错误消息中也能显示
            const threadId = workerData?.threadId || 'unknown';
            // 如果logger还没有加载，使用console
            if (logger) {
                logger.error(`线程 ${threadId} 发生错误: ${error.message}`);
            } else {
                console.error(`线程 ${threadId} 发生错误: ${error.message}`);
            }
            parentPort.postMessage({
                success: false,
                threadId,
                error: error.message
            });
        }
    }

    workerMain();
    return;
}

// 主线程逻辑
async function initializeProgram() {
    // 动态导入logger
    const loggerModule = await import('../lib/utils/logger.js');
    logger = loggerModule.default;

    program
        .version('1.0.0')
        .description('多线程规则导入工具')
        .option('-p, --path <path>', 'Path to doc/auth directory', path.join(process.cwd(), 'doc', 'auth'))
        .option('-d, --db <db>', 'Database name', 'DEV_ECMS_CREDIT')
        .option('-u, --url <url>', 'API base URL', process.env.API_BASE_URL)
        .option('-t, --delay <delay>', 'Delay between files in milliseconds', '1000')
        .option('-c, --threads <threads>', 'Number of threads to use', Math.min(8, os.cpus().length).toString())
        .option('-f, --folders <folders>', 'Specific folders to process (comma separated)')
        .option('-m, --max-folders <maxFolders>', 'Maximum folders per thread (avoid memory overload)', '10')
        .option('-b, --batch-size <batchSize>', 'Process folders in batches to control memory usage', '0')
        .parse(process.argv);

    return program.opts();
}

// 分配文件夹到线程的函数（优化版本）
function distributeFolders(allFolders, threadCount, maxFoldersPerThread = 0) {
    // 如果设置了最大文件夹数，先限制总文件夹数
    const totalFolders = maxFoldersPerThread > 0
        ? Math.min(allFolders.length, maxFoldersPerThread * threadCount)
        : allFolders.length;

    const limitedFolders = allFolders.slice(0, totalFolders);

    const distributed = Array.from({ length: threadCount }, () => []);

    // 更均匀的分配算法（轮询分配）
    limitedFolders.forEach((folder, index) => {
        distributed[index % threadCount].push(folder);
    });

    return distributed;
}

// 分批处理函数（处理大量文件夹时使用）
async function processInBatches(allFolders, batchSize, processBatchFn) {
    const batches = [];
    for (let i = 0; i < allFolders.length; i += batchSize) {
        batches.push(allFolders.slice(i, i + batchSize));
    }

    logger.info(`将 ${allFolders.length} 个文件夹分成 ${batches.length} 批处理，每批 ${batchSize} 个`);

    for (let i = 0; i < batches.length; i++) {
        logger.info(`开始处理第 ${i + 1}/${batches.length} 批文件夹`);
        await processBatchFn(batches[i], i);
    }
}

// 处理单个批次的函数
async function processBatch(foldersToProcess, threadCount, maxFoldersPerThread, batchIndex, options) {
    // 分配文件夹到各个线程
    const distributedFolders = distributeFolders(foldersToProcess, threadCount, maxFoldersPerThread);

    const workers = [];
    const results = [];

    // 显示分配情况
    distributedFolders.forEach((folders, index) => {
        if (folders.length > 0) {
            logger.info(`线程 ${index + 1} 分配了 ${folders.length} 个文件夹`);
        }
    });

    // 创建 worker 线程 - 使用当前文件的ESM路径
    const workerPath = new URL(import.meta.url).href;

    for (let i = 0; i < threadCount; i++) {
        if (distributedFolders[i].length === 0) continue;

        const worker = new Worker(workerPath, {
            workerData: {
                docAuthPath: options.path,
                dbName: options.db,
                apiBaseUrl: options.url,
                delayMs: options.delay,
                folders: distributedFolders[i],
                threadId: i + 1 + (batchIndex * threadCount),
                maxFoldersPerThread: maxFoldersPerThread > 0 ? maxFoldersPerThread : null
            }
        });

        workers.push(new Promise((resolve, reject) => {
            worker.on('message', (message) => {
                results.push(message);
                if (message.success) {
                    logger.success(message.message);
                } else {
                    logger.error(`线程 ${message.threadId} 错误: ${message.error}`);
                }
                resolve(message);
            });

            worker.on('error', (error) => {
                logger.error(`线程 ${i + 1} 发生错误: ${error.message}`);
                reject(error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    logger.error(`线程 ${i + 1} 异常退出，退出码: ${code}`);
                }
            });
        }));
    }

    // 等待所有线程完成
    await Promise.all(workers);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const totalProcessed = results.reduce((sum, r) => sum + (r.processedCount || 0), 0);

    logger.success(`批次 ${batchIndex + 1} 处理完成! 成功线程: ${successCount}, 失败线程: ${errorCount}, 处理文件夹: ${totalProcessed}`);
}

async function main() {
    try {
        const options = await initializeProgram();

        // 动态导入fs
        const fs = await import('fs');

        // 获取所有文件夹或指定文件夹
        let foldersToProcess = [];
        if (options.folders) {
            foldersToProcess = options.folders.split(',').map(f => f.trim());
            logger.info(`指定处理 ${foldersToProcess.length} 个文件夹`);
        } else {
            // 自动检测文件夹
            if (fs.existsSync(options.path)) {
                const allFolders = fs.readdirSync(options.path).filter(item => {
                    const itemPath = path.join(options.path, item);
                    return fs.statSync(itemPath).isDirectory();
                });
                foldersToProcess = allFolders;
                logger.info(`检测到 ${foldersToProcess.length} 个文件夹`);
            } else {
                throw new Error(`路径不存在: ${options.path}`);
            }
        }

        if (foldersToProcess.length === 0) {
            logger.warning('没有找到要处理的文件夹');
            return;
        }

        // 限制线程数量，避免资源耗尽
        const maxThreads = 8;
        const threadCount = Math.min(
            parseInt(options.threads),
            foldersToProcess.length,
            maxThreads
        );

        const batchSize = parseInt(options.batchSize);
        const maxFoldersPerThread = parseInt(options.maxFolders);

        logger.info(`启动 ${threadCount} 个线程处理 ${foldersToProcess.length} 个文件夹`);
        if (maxFoldersPerThread > 0) {
            logger.info(`每个线程最多处理 ${maxFoldersPerThread} 个文件夹`);
        }

        // 分批处理逻辑
        if (batchSize > 0) {
            await processInBatches(foldersToProcess, batchSize, async (batchFolders, batchIndex) => {
                await processBatch(batchFolders, threadCount, maxFoldersPerThread, batchIndex, options);
            });
        } else {
            await processBatch(foldersToProcess, threadCount, maxFoldersPerThread, 0, options);
        }

    } catch (error) {
        logger.error(`多线程处理失败: ${error.message}`);
        process.exit(1);
    }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error(`未捕获异常: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`未处理的拒绝: ${promise}, 原因: ${reason}`);
    process.exit(1);
});

if (isMainThread) {
    main();
}