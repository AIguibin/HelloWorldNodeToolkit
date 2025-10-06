import { Command } from 'commander';
import os from 'os';
import path from 'path';
import RuleImportService from '../src/service/ruleImportService.js';
import { logger } from '../src/common/utils/logger.js';

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