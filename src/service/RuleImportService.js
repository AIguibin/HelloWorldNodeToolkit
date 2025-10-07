import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import AxiosApiService from '../service/AxiosApiService.js';
import FindTokenService from '../service/FindTokenService.js';
import connectionPoolManager from '../library/database/connectionPool.js';
import {delayMs} from '../common/helper/delayMs.js';
import {logger} from '../common/helper/logger.js';
import FileHelper from '../common/helper/fileHelper.js';

// ESM 中的 __dirname 等效实现
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RuleImporterService {
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || process.env.API_BASE_URL;
        this.docAuthPath = options.docAuthPath || path.join(process.cwd(), 'doc', 'auth');
        this.dbName = options.dbName || 'DEV_ECMS_CREDIT';
        this.connection = connectionPoolManager;
        this.delayMs = options.delayMs || 1000;

        this.tokenService = new FindTokenService(this.apiBaseUrl);
        this.apiService = new AxiosApiService(this.apiBaseUrl);

        this.fileHelper = null;

        // 用户密码映射配置
        this.userConfig = this.loadUserConfig();

        // 加载workflowNum.json配置
        this.workflowNumConfig = this.loadWorkflowNumConfig();

        // 初始化 fileHelper
        this.setDocAuthPath(this.docAuthPath);
    }

    // 新增：设置动态路径的方法
    setDocAuthPath(docAuthPath) {
        this.docAuthPath = docAuthPath;
        this.fileHelper = new FileHelper(this.docAuthPath);
    }

    // 加载用户配置
    loadUserConfig() {
        try {
            const userConfigPath = path.join(process.cwd(), 'config', 'users.json');
            if (fs.existsSync(userConfigPath)) {
                return JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
            } else {
                logger.warning('users.json configuration file not found');
                return {};
            }
        } catch (error) {
            logger.error(`Error loading users.json: ${error.message}`);
            return {};
        }
    }

    // 获取该机构业务管理员
    getUserId(orgId) {
        try {
            const userId = this.userConfig.userInfo[orgId];
            if (userId) {
                logger.success(`Successfull to get userId ${userId} by orgId ${orgId}`);
                return userId;
            } else {
                throw new Error('Failed to get userId');
            }
        } catch (error) {
            logger.error(`Failed to get userId by orgId ${orgId}`);
            throw new Error(`Failed to get userId : ${error.message}`);
        }
    }

    // 加载workflowNum.json配置
    loadWorkflowNumConfig() {
        try {
            const flowConfigPath = path.join(
                process.cwd(),
                'config',
                'workflowNum.json'
            );
            if (fs.existsSync(flowConfigPath)) {
                return JSON.parse(fs.readFileSync(flowConfigPath, 'utf8'));
            } else {
                logger.warning('workflowNum.json configuration file not found');
                return {file_mappings: {}};
            }
        } catch (error) {
            logger.error(`Error loading workflowNum.json: ${error.message}`);
            return {file_mappings: {}};
        }
    }

    // 获取workflowNum
    getWorkflowNum(filename) {
        try {
            const workflowNum =
                this.workflowNumConfig.file_mappings[filename.split('-')[0]]
                    ?.workflowNum;
            if (workflowNum) {
                return workflowNum;
            } else {
                throw new Error(`${filename} is not a valid workflowNum`);
            }
        } catch (error) {
            logger.error(
                `Error getting workflowNum for filename ${filename}: ${error.message}`
            );
            return '';
        }
    }

    // 查询法人机构业务管理员
    async queryOrgManager() {
        const sql = `
            SELECT inst_cd,
                   usr_numb
            FROM sys_user_org_role_rel
            WHERE rl_ecd = 'RL1074'
              AND del_ind = '0'
              AND stcd = '1'
              AND inst_cd IN (SELECT inst_cd FROM sys_organization WHERE inst_tp = '03' AND del_ind = '0')
            GROUP BY inst_cd;`;

        return await this.connection.executeQuery(this.dbName, sql);
    }

    // 删除未发布成功的授权方案
    async deleteAuthScheme() {
        const sql = `delete
                     from ecms_workflow.auth_scheme
                     WHERE st = '01';`;
        return await this.connection.executeQuery(this.dbName, sql);
    }

    // 把查询的法人机构业务管理员写入users.json
    async writeUsersInfo(arr) {
        let data = {
            userInfo: {},
        };
        arr.forEach((item) => {
            data.userInfo[item.inst_cd] = item.usr_numb;
        });
        this.fileHelper.writeJson('../../config/users.json', data);
    }

    // 登录获取token
    async login(userId) {
        try {
            logger.info(`Logging in with user ID: ${userId}`);

            const token = await this.tokenService.fetchToken({
                id: userId,
                pwd: '1',
            });

            if (token) {
                // 设置token到请求头
                this.apiService.setToken(token);
                logger.success('Login successful, token set');
                return token;
            } else {
                throw new Error('Failed to get token');
            }
        } catch (error) {
            logger.error(`Login failed: ${error.message}`);
            throw error;
        }
    }

    // 获取授权方案编号
    async getAuthSchemeNum() {
        try {
            logger.info(
                'Requesting auth scheme number from /tansun-tcp-workflow/authScheme/initBasInf'
            );
            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authScheme/initBasInf'
            );

            if (response && response.data && response.data.scmNumb) {
                const scmNumb = response.data.scmNumb;
                const ahnInst = response.data.ahnInst;
                logger.success(
                    `Received auth scheme number: ${scmNumb}, institution: ${ahnInst}`
                );
                return {scmNumb, ahnInst};
            } else {
                throw new Error('Invalid response format: missing data.scmNumb');
            }
        } catch (error) {
            logger.error(`Failed to get auth scheme number: ${error.message}`);
            throw error;
        }
    }

    // 保存授权方案
    async saveAuthScheme(authData) {
        try {
            logger.info('Saving auth scheme to /tansun-tcp-workflow/authScheme/save');
            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authScheme/save',
                authData
            );

            if (response && response.status === 200 && response.data) {
                logger.success('Auth scheme saved successfully');
                return response.data;
            } else {
                throw new Error(
                    `Failed to save auth scheme: ${response?.description || 'Unknown error'
                    }`
                );
            }
        } catch (error) {
            logger.error(`Failed to save auth scheme: ${error.message}`);
            throw error;
        }
    }

    // 获取规则ID
    async getRuleId(scmNumb, ahnScnNm) {
        try {
            logger.info(
                'Requesting rule ID from /tansun-tcp-workflow/authSchemeRule/initBaseInfo'
            );
            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authSchemeRule/initBaseInfo',
                {
                    action: 'add',
                    scmNumb,
                    ahnScnNm,
                }
            );

            if (response && response.status === 200 && response.data) {
                logger.success(`Received rule number: ${response.data.ahnRuleNumb}`);
                return response.data;
            } else {
                throw new Error('Invalid response format: missing ahnRuleNumb');
            }
        } catch (error) {
            logger.error(`Failed to get rule ID: ${error.message}`);
            throw error;
        }
    }

    // 解析Excel文件
    async uploadAndParseExcel(
        scmNumb,
        ahnScnNm,
        ahnRuleNumb,
        ahnRuleNm,
        filePath,
        filename
    ) {
        try {
            logger.info(`Parsing Excel file: ${filename}`);

            // 构建表单数据
            const formData = {
                action: 'add',
                scmNumb,
                ahnScnNm,
                ahnRuleNumb,
                ahnRuleNm,
                flNm: filename,
            };

            // 上传文件并解析
            const response = await this.apiService.uploadFile(
                '/tansun-tcp-workflow/authScheme/excelImp',
                filePath,
                formData
            );

            if (response && response.status === 200 && response.data) {
                logger.success(
                    `Excel file uploaded and parsed successfully: ${filename}`
                );
                return response.data;
            } else {
                throw new Error(
                    `Failed to uploadAndParse Excel: ${response?.description || 'Unknown error'
                    }`
                );
            }
        } catch (error) {
            // 删除上传失败授权方案
            this.deleteAuthScheme();

            this.fileHelper.writeText(
                `../../logs/${new Date().toISOString().slice(0, 10)}.error.excelImp.log`,
                `【${new Date().toISOString().slice(0, 19).replace('T', ' ')}】【上传失败的文件：${filePath} 】【失败原因：${error.message}】`,
                false
            );
            logger.error(
                `Failed to uploadAndParse Excel file  ${filePath} -> ${filename}: ${error.message}`
            );
            throw error;
        }
    }

    // 发布授权方案
    async publishAuthScheme(publishData) {
        try {
            logger.info(
                'Publishing auth scheme to /tansun-tcp-workflow/authScheme/rulePlatform/saveDecitionTable'
            );
            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authScheme/rulePlatform/saveDecitionTable',
                publishData
            );

            if (response && response.status === 200) {
                logger.success('Auth scheme published successfully');
                return response;
            } else {
                throw new Error(
                    `Failed to publish auth scheme: ${response?.description || 'Unknown error'
                    }`
                );
            }
        } catch (error) {
            logger.error(`Failed to publish auth scheme: ${error.message}`);
            throw error;
        }
    }

    // 查询流程信息
    async queryWorkflow(workflowNum) {
        try {
            logger.info(
                'Querying workflow information from /tansun-tcp-workflow/authSchemeFlow/workflow'
            );
            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authSchemeFlow/workflow',
                {
                    pageNum: 1,
                    pageSize: 10,
                    modelKey: workflowNum,
                    modelName: '',
                }
            );

            if (
                response &&
                response.status === 200 &&
                response.data &&
                response.data.grid &&
                response.data.grid.list.length > 0
            ) {
                logger.success('Workflow information retrieved successfully');
                // 返回第一个匹配的流程
                return response.data.grid.list[0];
            } else {
                throw new Error('No workflow found or invalid response format');
            }
        } catch (error) {
            logger.error(`Failed to query workflow: ${error.message}`);
            throw error;
        }
    }

    // 绑定流程
    async bindWorkflow(workflowData, scmNumb) {
        try {
            logger.info(
                'Binding workflow to /tansun-tcp-workflow/authSchemeFlow/save'
            );

            // 添加必要的字段
            const bindData = {
                ...workflowData,
                tsRowIndex: 0,
                scmNumb,
            };

            const response = await this.apiService.post(
                '/tansun-tcp-workflow/authSchemeFlow/save',
                bindData
            );

            if (response && response.status === 200) {
                return response;
            } else {
                throw new Error(`Failed to bind workflow: ${response?.description || 'Unknown error'}`);
            }
        } catch (error) {
            logger.error(`Failed to bind workflow: ${error.message}`);
            throw error;
        }
    }

    // 处理单个文件夹
    async processFolder(foldername) {
        try {
            logger.info(`Processing folder: ${foldername}`);

            // 提取前缀用于登录
            const orgId = foldername.split('-')[0];
            // 获取用户编号
            const userId = this.getUserId(orgId);
            // 正式登录
            await this.login(userId);

            // 获取文件夹中的所有文件
            const folderPath = path.join(this.docAuthPath, foldername);
            const files = getFilesInDirectory(folderPath);

            if (files.length === 0) {
                logger.warning(`No files found in folder: ${foldername}`);
                return;
            }

            // 处理每个文件
            for (const filename of files) {
                try {
                    logger.info(`==${foldername}-文件下的${filename}授权文件开始==`);
                    // 1. 获取授权方案编号
                    const {scmNumb, ahnInst} = await this.getAuthSchemeNum();
                    // 2. 保存授权方案
                    const authSchemeData = {
                        scmNumb,
                        ahnInst,
                        ahnScnNm: `${filename.split('-')[0]}-${foldername.split('-')[1]
                        }方案`,
                        ahnAnul: new Date().getFullYear().toString(),
                        ahnEffDay: '2025-01-01',
                        ahnExdy: '2026-12-31',
                        ahnTp:
                        this.workflowNumConfig.file_mappings[filename.split('-')[0]]
                            ?.ahnTp, //方案类型
                        ahnAcrdto: `系统导入${filename.split('-')[0]}-${foldername.split('-')[1]
                        }授权方案V1.0`,
                    };

                    const savedAuthScheme = await this.saveAuthScheme(authSchemeData);
                    // 3. 获取规则ID
                    const ahnRuleObj = await this.getRuleId(
                        scmNumb,
                        authSchemeData.ahnScnNm
                    );
                    ahnRuleObj.ahnRuleNm = `${authSchemeData.ahnScnNm}授权规则`;
                    // 4. 上传Excel文件导入授权规则
                    const filePath = path.join(folderPath, filename);
                    const workflowNum = this.getWorkflowNum(filename);

                    const excelResult = await this.uploadAndParseExcel(
                        scmNumb,
                        authSchemeData.ahnScnNm,
                        ahnRuleObj.ahnRuleNumb,
                        ahnRuleObj.ahnRuleNm,
                        filePath,
                        filename
                    );
                    // 5. 发布授权方案
                    const publishData = {
                        ...savedAuthScheme,
                        ...excelResult,
                        createUserNm: 'SYSTEM',
                        ahnInstNm: `${foldername.split('-')[1]}`,
                        updateUser: userId,
                        updateTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
                        version: 1,
                        delInd: '0',
                        createTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
                        tplTpDesc: '',
                        tenantId: ahnInst,
                        createUser: userId,
                        tsRowIndex: 0,
                    };

                    await this.publishAuthScheme(publishData);

                    // 6. 查询流程信息
                    const workflow = await this.queryWorkflow(workflowNum);

                    // 7. 绑定流程
                    const bindingResult = await this.bindWorkflow(workflow, scmNumb);

                    // 8.如果执行成功，移动成功的文件到另一个文件夹
                    if (bindingResult && bindingResult.status === 200) {
                        logger.success('Workflow bound successfully');
                        logger.success(
                            `机构为：${foldername}的${filename.split('-')[0]
                            }转授权规则完成导入!`
                        );
                        const moveResult = this.fileHelper.moveFile(
                            `../../doc/auth/${foldername}/${filename}`,
                            `../../doc/success/${foldername}/${filename}`
                        );
                        if (moveResult) {
                            logger.success(
                                `文件${foldername}/${filename}转授权规则完成导入，已成功移动!`
                            );
                        } else {
                            logger.error(
                                `文件${foldername}/${filename}转授权规则完成导入，但移动失败!!!`
                            );
                        }
                    } else {
                        this.fileHelper.writeText(`../../logs/${new Date().toISOString().slice(0, 10)}.error.bindWorkflow.log`,
                            `【${new Date().toISOString().slice(0, 19).replace('T', ' ')}】流程绑定失败文件->流程名称：${workflow.modelName || 'Unknown'},
                            流程编号：${workflowNum},授权方案编号：${scmNumb},绑定失败原因：${bindingResult?.description || 'Unknown error'}`, false);
                        logger.error(`Failed to bind workflow: ${bindingResult?.description || 'Unknown error'}`);
                    }

                    // 延时执行下一个文件
                    if (this.delayMs > 0) {
                        logger.info(
                            `Waiting ${this.delayMs}ms before processing next file`
                        );
                        await delayMs(this.delayMs);
                    }
                } catch (error) {
                    logger.error(`Failed to process file ${filename}: ${error.message}`);
                    // 继续处理下一个文件而不是终止整个流程
                    continue;
                }
            }
        } catch (error) {
            logger.error(`Error processing folder ${foldername}: ${error.message}`);
            throw error;
        }
    }

    // 主处理函数
    async process(specificFolders = null) {
        try {
            logger.info('Starting rule importer process');

            const allOrgManager = await this.queryOrgManager();
            await this.writeUsersInfo(allOrgManager);

            // 支持处理指定文件夹或所有文件夹
            let folders;
            if (specificFolders && specificFolders.length > 0) {
                folders = specificFolders;
                logger.info(`Processing specific folders: ${folders.join(', ')}`);
            } else {
                folders = getSubDirectories(this.docAuthPath);
                if (folders.length === 0) {
                    logger.warning(`No folders found in: ${this.docAuthPath}`);
                    return;
                }
            }

            logger.info(`Found ${folders.length} folders to process`);

            // 处理每个文件夹
            for (const foldername of folders) {
                try {
                    // 检查文件夹是否存在
                    const folderPath = path.join(this.docAuthPath, foldername);
                    if (!fs.existsSync(folderPath)) {
                        logger.warning(`Folder not found: ${folderPath}, skipping...`);
                        continue;
                    }

                    await this.processFolder(foldername);

                    // 文件夹之间的延时
                    if (this.delayMs > 0) {
                        logger.info(`Waiting ${this.delayMs}ms before processing next folder`);
                        await delayMs(this.delayMs);
                    }
                } catch (error) {
                    logger.error(`Failed to process folder ${foldername}: ${error.message}`);
                    logger.error(`文件夹名称 ${foldername}: 不符合【机构法人号-机构法人中文名】`);
                    logger.error(`======跳过当前错误文件夹，处理下一个文件夹而不是终止整个流程======`);
                    continue;
                }
            }

            logger.success('Rule importer process completed successfully');
        } catch (error) {
            logger.error(`Rule importer process failed: ${error.message}`);
            throw error;
        }
    }
}

export default RuleImporterService;