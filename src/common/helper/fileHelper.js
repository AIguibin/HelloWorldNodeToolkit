// FileHelper.js
import {readFile, writeFile, appendFile, copyFile, rename, unlink, stat, access, mkdir} from 'fs/promises';
import {createReadStream, readdirSync, statSync, existsSync} from 'fs';
import {resolve, dirname, basename, extname, join} from 'path';
import {fileURLToPath} from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FileHelper {
    constructor(baseDir = process.cwd()) {
        this.baseDir = baseDir;
    }

    /**
     * 解析文件路径
     * @param {string} filePath - 文件路径
     * @returns {string} 绝对路径
     */
    resolvePath(filePath) {
        return resolve(this.baseDir, filePath);
    }

    /**
     * 确保目录存在
     * @param {string} filePath - 文件路径
     */
    async ensureDirExists(filePath) {
        const dir = dirname(filePath);
        try {
            await access(dir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await mkdir(dir, {recursive: true});
            } else {
                throw error;
            }
        }
    }

    /**
     * 确保文件存在
     * @param {string} filePath - 文件路径
     * @param {string} defaultContent - 默认内容
     */
    async ensureFileExists(filePath, defaultContent = '') {
        try {
            await access(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.ensureDirExists(filePath);
                await writeFile(filePath, defaultContent);
            } else {
                throw error;
            }
        }
    }

    /**
     * 读取JSON文件
     * @param {string} filePath - 文件路径
     * @param {Object} defaultValue - 默认值（当文件不存在时返回）
     * @returns {Promise<Object>} JSON对象
     */
    async readJson(filePath, defaultValue = {}) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureFileExists(absolutePath, '{}');
            const data = await readFile(absolutePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error("读取JSON文件失败:", error);
            return defaultValue;
        }
    }

    /**
     * 读取文本文件
     * @param {string} filePath - 文件路径
     * @param {string} defaultValue - 默认值（当文件不存在时返回）
     * @returns {Promise<string>} 文件内容
     */
    async readText(filePath, defaultValue = '') {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureFileExists(absolutePath, defaultValue);
            const data = await readFile(absolutePath, 'utf-8');
            return data;
        } catch (error) {
            console.error("读取文本文件失败:", error);
            return defaultValue;
        }
    }

    /**
     * 逐行读取文件
     * @param {string} filePath - 文件路径
     * @param {string[]} defaultValue - 默认值（当文件不存在时返回）
     * @returns {Promise<string[]>} 行数组
     */
    async readLines(filePath, defaultValue = []) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureFileExists(absolutePath, '');
            const data = await readFile(absolutePath, 'utf-8');
            return data.split('\n').filter(line => line.trim() !== '');
        } catch (error) {
            console.error("逐行读取文件失败:", error);
            return defaultValue;
        }
    }

    /**
     * 随机获取一行文本
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 包含行数、选中行和行号的对象
     */
    async getRandomLine(filePath) {
        const absolutePath = this.resolvePath(filePath);
        let lineCount = 0;
        let selectedLine = null;
        let selectedLineNum = 0;

        try {
            await this.ensureFileExists(absolutePath, '');

            const fileStream = createReadStream(absolutePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                lineCount++;
                if (Math.random() < (1 / lineCount)) {
                    selectedLine = line;
                    selectedLineNum = lineCount;
                }
            }

            return {
                lineCount,
                selectedLine,
                selectedLineNum
            };
        } catch (error) {
            console.error("随机获取行失败:", error);
            return {lineCount: 0, selectedLine: null, selectedLineNum: 0};
        }
    }

    /**
     * 写入JSON文件
     * @param {string} filePath - 文件路径
     * @param {Object} data - 要写入的数据
     * @param {boolean} overwrite - 是否覆盖（true）或合并（false）
     * @returns {Promise<boolean>} 是否成功
     */
    async writeJson(filePath, data, overwrite = true) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureDirExists(absolutePath);

            if (overwrite) {
                await writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf-8');
            } else {
                try {
                    const existingData = await this.readJson(filePath);
                    const mergedData = {...existingData, ...data};
                    await writeFile(absolutePath, JSON.stringify(mergedData, null, 2), 'utf-8');
                } catch (error) {
                    await writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf-8');
                }
            }
            return true;
        } catch (error) {
            console.error("写入JSON文件失败:", error);
            return false;
        }
    }

    /**
     * 写入文本文件
     * @param {string} filePath - 文件路径
     * @param {string} content - 要写入的内容
     * @param {boolean} overwrite - 是否覆盖（true）或追加（false）
     * @returns {Promise<boolean>} 是否成功
     */
    async writeText(filePath, content, overwrite = true) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureDirExists(absolutePath);

            if (overwrite) {
                await writeFile(absolutePath, content, 'utf-8');
            } else {
                await appendFile(absolutePath, content, 'utf-8');
            }
            return true;
        } catch (error) {
            console.error("写入文本文件失败:", error);
            return false;
        }
    }

    /**
     * 逐行写入文本文件
     * @param {string} filePath - 文件路径
     * @param {string[]} lines - 要写入的行数组
     * @param {boolean} overwrite - 是否覆盖（true）或追加（false）
     * @returns {Promise<boolean>} 是否成功
     */
    async writeLines(filePath, lines, overwrite = true) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureDirExists(absolutePath);

            const content = lines.join('\n');
            if (overwrite) {
                await writeFile(absolutePath, content, 'utf-8');
            } else {
                await appendFile(absolutePath, '\n' + content, 'utf-8');
            }
            return true;
        } catch (error) {
            console.error("逐行写入文件失败:", error);
            return false;
        }
    }

    /**
     * 追加一行文本
     * @param {string} filePath - 文件路径
     * @param {string} line - 要追加的行
     * @returns {Promise<boolean>} 是否成功
     */
    async appendLine(filePath, line) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureDirExists(absolutePath);
            await appendFile(absolutePath, line + '\n', 'utf-8');
            return true;
        } catch (error) {
            console.error("追加行失败:", error);
            return false;
        }
    }

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} 是否存在
     */
    async exists(filePath) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await access(absolutePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 删除文件
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} 是否成功
     */
    async delete(filePath) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await unlink(absolutePath);
            return true;
        } catch (error) {
            console.error("删除文件失败:", error);
            return false;
        }
    }

    /**
     * 获取文件信息
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 文件信息
     */
    async getFileInfo(filePath) {
        try {
            const absolutePath = this.resolvePath(filePath);
            await this.ensureFileExists(absolutePath);
            const stats = await stat(absolutePath);
            return {
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile()
            };
        } catch (error) {
            console.error("获取文件信息失败:", error);
            return null;
        }
    }

    /**
     * 复制文件
     * @param {string} sourcePath - 源文件路径
     * @param {string} targetPath - 目标文件路径
     * @returns {Promise<boolean>} 是否成功
     */
    async copyFile(sourcePath, targetPath) {
        try {
            const sourceAbsolute = this.resolvePath(sourcePath);
            const targetAbsolute = this.resolvePath(targetPath);

            await this.ensureDirExists(targetAbsolute);
            await copyFile(sourceAbsolute, targetAbsolute);
            return true;
        } catch (error) {
            console.error("复制文件失败:", error);
            return false;
        }
    }

    /**
     * 移动文件
     * @param {string} sourcePath - 源文件路径
     * @param {string} targetPath - 目标文件路径
     * @returns {Promise<boolean>} 是否成功
     */
    async moveFile(sourcePath, targetPath) {
        try {
            const sourceAbsolute = this.resolvePath(sourcePath);
            const targetAbsolute = this.resolvePath(targetPath);

            await this.ensureDirExists(targetAbsolute);
            await rename(sourceAbsolute, targetAbsolute);
            return true;
        } catch (error) {
            console.error("移动文件失败:", error);
            return false;
        }
    }

    /**
     * 递归遍历文件夹
     * @param {string} dir - 目录路径
     * @param {Function} callback - 回调函数
     * @param {Array} fileList - 文件列表（内部使用）
     * @returns {Array} 文件路径数组
     */
    walkDir(dir, callback, fileList = []) {
        const absoluteDir = this.resolvePath(dir);
        const files = readdirSync(absoluteDir);

        files.forEach(file => {
            const filePath = join(absoluteDir, file);
            const fileStat = statSync(filePath);

            if (fileStat.isDirectory()) {
                this.walkDir(filePath, callback, fileList);
            } else {
                fileList.push(filePath);
                if (callback) callback(filePath);
            }
        });

        return fileList;
    }

    /**
     * 提取文件路径信息
     * @param {string} filePath - 文件路径
     * @returns {Object} 路径信息对象
     */
    extractPathInfo(filePath) {
        const absolutePath = this.resolvePath(filePath);
        return {
            dirname: dirname(absolutePath),
            basename: basename(absolutePath),
            extname: extname(absolutePath),
            filename: basename(absolutePath, extname(absolutePath)),
            absolutePath
        };
    }

    /**
     * 获取文件夹中的所有子文件夹
     * @param {string} dirPath - 目录路径
     * @returns {Array} 子文件夹名称数组
     */
    getSubDirectories(dirPath) {
        try {
            const absolutePath = this.resolvePath(dirPath);
            return readdirSync(absolutePath).filter(file => {
                return statSync(join(absolutePath, file)).isDirectory();
            });
        } catch (error) {
            console.error(`读取目录 ${dirPath} 失败:`, error);
            return [];
        }
    }

    /**
     * 获取文件夹中的所有文件
     * @param {string} dirPath - 目录路径
     * @returns {Array} 文件名称数组
     */
    getFilesInDirectory(dirPath) {
        try {
            const absolutePath = this.resolvePath(dirPath);
            return readdirSync(absolutePath).filter(file => {
                return statSync(join(absolutePath, file)).isFile();
            });
        } catch (error) {
            console.error(`读取目录 ${dirPath} 中的文件失败:`, error);
            return [];
        }
    }

    /**
     * 检查路径是否存在（同步）
     * @param {string} filePath - 文件路径
     * @returns {boolean} 是否存在
     */
    existsSync(filePath) {
        const absolutePath = this.resolvePath(filePath);
        return existsSync(absolutePath);
    }

    /**
     * 创建目录（递归）
     * @param {string} dirPath - 目录路径
     * @returns {Promise<boolean>} 是否成功
     */
    async createDirectory(dirPath) {
        try {
            const absolutePath = this.resolvePath(dirPath);
            await mkdir(absolutePath, {recursive: true});
            return true;
        } catch (error) {
            console.error("创建目录失败:", error);
            return false;
        }
    }

    /**
     * 读取文件状态（同步）
     * @param {string} filePath - 文件路径
     * @returns {Object|null} 文件状态信息
     */
    getFileStatSync(filePath) {
        try {
            const absolutePath = this.resolvePath(filePath);
            const stats = statSync(absolutePath);
            return {
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile()
            };
        } catch (error) {
            console.error("获取文件状态失败:", error);
            return null;
        }
    }

    /**
     * 文件重命名
     * @param {string} oldPath - 原文件路径
     * @param {string} newPath - 新文件路径
     * @returns {Promise<boolean>} 是否成功
     */
    async renameFile(oldPath, newPath) {
        try {
            const oldAbsolute = this.resolvePath(oldPath);
            const newAbsolute = this.resolvePath(newPath);

            await this.ensureDirExists(newAbsolute);
            await rename(oldAbsolute, newAbsolute);
            return true;
        } catch (error) {
            console.error("重命名文件失败:", error);
            return false;
        }
    }

    /**
     * 批量操作文件
     * @param {string} dirPath - 目录路径
     * @param {Function} operation - 操作函数 (filePath) => Promise<boolean>
     * @returns {Promise<Array>} 操作结果数组
     */
    async batchOperation(dirPath, operation) {
        const files = this.getFilesInDirectory(dirPath);
        const results = [];

        for (const file of files) {
            const filePath = join(dirPath, file);
            try {
                const result = await operation(filePath);
                results.push({filePath, success: true, result});
            } catch (error) {
                results.push({filePath, success: false, error: error.message});
            }
        }

        return results;
    }
}

// 默认导出
export default FileHelper;

