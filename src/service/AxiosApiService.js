import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import logger from '../common/utils/logger.js';

const streamPipeline = promisify(require('stream').pipeline);

class AxiosApiService {
    constructor(baseURL) {
        this.client = axios.create({
            baseURL: baseURL,
            timeout: 600000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.token = null;

        // 请求拦截器
        this.client.interceptors.request.use(
            config => {
                logger.debug(`Making ${config.method?.toUpperCase()} request to ${config.url}`);

                // 添加token到请求头
                if (this.token) {
                    config.headers['token'] = this.token;
                }

                return config;
            },
            error => {
                logger.error('Request error:', error);
                return Promise.reject(error);
            }
        );

        // 响应拦截器
        this.client.interceptors.response.use(
            response => {
                logger.debug(`Received response from ${response.config.url}: ${response.status}`);
                return response;
            },
            error => {
                logger.error('Response error:', error.message);
                return Promise.reject(error);
            }
        );
    }

    // 设置token
    setToken(token) {
        this.token = token;
    }

    // 通用请求方法
    async request(config) {
        try {
            const response = await this.client.request(config);
            logger.info(`接口请求返回值：${JSON.stringify(response.data)}`)
            logger.info(`================接口请求结束=============`)
            return response.data;
        } catch (error) {
            logger.error(`API request failed: ${error.message}`);
            throw error;
        }
    }

    // GET请求
    async get(url, params = {}) {
        logger.info(`================接口请求开始=============`)
        logger.info(`请求的URL：${url}`)
        logger.info(`请求体：${JSON.stringify(params)}`)
        return this.request({
            method: 'GET',
            url,
            params
        });
    }

    // POST请求
    async post(url, data = {}, config = {}) {
        logger.info(`================接口请求开始=============`)
        logger.info(`请求的URL：${url}`)
        logger.info(`请求头：${JSON.stringify(config)}`)
        logger.info(`请求体：${JSON.stringify(data)}`)
        return this.request({
            method: 'POST',
            url,
            data,
            ...config
        });
    }

    // 上传文件
    async uploadFile(url, filePath, formData = {}) {
        logger.info(`================上传文件开始=============`)
        logger.info(`请求的URL：${url}`)
        logger.info(`文件的path：${filePath}`)
        logger.info(`请求体：${JSON.stringify(formData)}`)
        try {
            const form = new FormData();

            // 添加文件
            form.append('file', fs.createReadStream(filePath));

            // 添加其他表单数据
            Object.keys(formData).forEach(key => {
                form.append(key, formData[key]);
            });

            const response = await this.client.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    'token': this.token
                }
            });
            logger.info(`上传成功返回值：${JSON.stringify(response.data)}`)
            logger.info(`================上传文件请求结束=============`)
            return response.data;
        } catch (error) {
            logger.error(`File upload failed: ${error.message}`);
            throw error;
        }
    }

    // 下载文件
    async downloadFile(url, filePath, params = {}) {
        logger.info(`================下载文件开始=============`)
        logger.info(`请求的URL：${url}`)
        logger.info(`保存路径：${filePath}`)
        logger.info(`请求参数：${JSON.stringify(params)}`)

        try {
            const response = await this.client.get(url, {
                params,
                responseType: 'stream',
                headers: {
                    'token': this.token
                }
            });

            // 创建写入流
            const writer = createWriteStream(filePath);

            // 管道传输数据
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    logger.info(`文件下载完成：${filePath}`)
                    logger.info(`================下载文件结束=============`)
                    resolve({
                        success: true,
                        filePath: filePath,
                        size: fs.statSync(filePath).size
                    });
                });

                writer.on('error', reject);
                response.data.on('error', reject);
            });
        } catch (error) {
            logger.error(`File download failed: ${error.message}`);
            throw error;
        }
    }

    // 下载文件并返回Buffer（适用于小文件）
    async downloadBuffer(url, params = {}) {
        logger.info(`================下载文件到Buffer开始=============`)
        logger.info(`请求的URL：${url}`)
        logger.info(`请求参数：${JSON.stringify(params)}`)

        try {
            const response = await this.client.get(url, {
                params,
                responseType: 'arraybuffer',
                headers: {
                    'token': this.token
                }
            });

            logger.info(`文件下载完成，大小：${response.data.byteLength} bytes`)
            logger.info(`================下载文件到Buffer结束=============`)

            return {
                success: true,
                data: response.data,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length']
            };
        } catch (error) {
            logger.error(`Buffer download failed: ${error.message}`);
            throw error;
        }
    }
}

export default AxiosApiService;