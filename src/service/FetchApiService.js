// fetch-api-service.js
import fs from 'fs';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import logger from '../common/utils/logger.js';

class FetchApiService {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.token = null;
        this.defaultOptions = {
            timeout: 600000,
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    // 添加请求拦截器
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    // 添加响应拦截器
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    // 设置token
    setToken(token) {
        this.token = token;
    }

    // 超时控制
    async timeout(ms, promise) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${ms}ms`));
            }, ms);

            promise.then(
                (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            );
        });
    }

    // 执行请求拦截器
    async executeRequestInterceptors(config) {
        let currentConfig = { ...config };
        for (const interceptor of this.requestInterceptors) {
            currentConfig = await interceptor(currentConfig);
        }
        return currentConfig;
    }

    // 执行响应拦截器
    async executeResponseInterceptors(response) {
        let currentResponse = { ...response };
        for (const interceptor of this.responseInterceptors) {
            currentResponse = await interceptor(currentResponse);
        }
        return currentResponse;
    }

    // 通用请求方法
    async request(url, options = {}) {
        logger.info(`================接口请求开始=============`);
        logger.info(`请求的URL：${this.baseURL}${url}`);
        logger.info(`请求方法：${options.method || 'GET'}`);
        logger.info(`请求头：${JSON.stringify(options.headers || {})}`);

        if (options.body) {
            logger.info(`请求体：${typeof options.body === 'string' ? options.body : JSON.stringify(options.body)}`);
        }

        try {
            // 准备请求配置
            let config = {
                ...this.defaultOptions,
                ...options,
                headers: {
                    ...this.defaultOptions.headers,
                    ...options.headers,
                }
            };

            // 添加token
            if (this.token) {
                config.headers['token'] = this.token;
            }

            // 执行请求拦截器
            config = await this.executeRequestInterceptors(config);

            // 发起请求（带超时控制）
            const response = await this.timeout(
                config.timeout,
                fetch(`${this.baseURL}${url}`, config)
            );

            // 克隆响应以便多次使用
            const responseClone = response.clone();

            // 构建响应对象
            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                config: config,
                url: response.url
            };

            // 检查HTTP状态
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
            }

            // 根据Content-Type处理响应数据
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                responseData.data = await response.json();
            } else {
                responseData.data = await response.text();
            }

            // 执行响应拦截器
            const finalResponse = await this.executeResponseInterceptors(responseData);

            logger.info(`接口请求返回值：${JSON.stringify(finalResponse.data)}`);
            logger.info(`================接口请求结束=============`);

            return finalResponse;

        } catch (error) {
            logger.error(`API request failed: ${error.message}`);
            throw error;
        }
    }

    // GET请求
    async get(url, params = {}, options = {}) {
        // 构建查询字符串
        const queryString = Object.keys(params).length > 0
            ? `?${new URLSearchParams(params).toString()}`
            : '';

        return this.request(`${url}${queryString}`, {
            method: 'GET',
            ...options
        });
    }

    // POST请求
    async post(url, data = {}, options = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        });
    }

    // PUT请求
    async put(url, data = {}, options = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    // DELETE请求
    async delete(url, options = {}) {
        return this.request(url, {
            method: 'DELETE',
            ...options
        });
    }

    // 上传文件
    async uploadFile(url, filePath, formData = {}, options = {}) {
        logger.info(`================上传文件开始=============`);
        logger.info(`请求的URL：${this.baseURL}${url}`);
        logger.info(`文件的path：${filePath}`);
        logger.info(`表单数据：${JSON.stringify(formData)}`);

        try {
            // 创建FormData
            const form = new FormData();

            // 添加文件
            const fileBuffer = fs.readFileSync(filePath);
            const fileBlob = new Blob([fileBuffer]);
            form.append('file', fileBlob, filePath.split('/').pop());

            // 添加其他表单数据
            Object.keys(formData).forEach(key => {
                form.append(key, formData[key]);
            });

            // 准备请求配置
            const config = {
                method: 'POST',
                body: form,
                headers: {
                    'token': this.token,
                    // FormData会自动设置Content-Type和boundary
                },
                ...options
            };

            // 移除默认的Content-Type，让浏览器自动设置
            delete config.headers['Content-Type'];

            const response = await this.request(url, config);
            logger.info(`上传成功返回值：${JSON.stringify(response.data)}`);
            logger.info(`================上传文件请求结束=============`);

            return response;

        } catch (error) {
            logger.error(`File upload failed: ${error.message}`);
            throw error;
        }
    }

    // 下载文件到指定路径
    async downloadFile(url, filePath, params = {}, options = {}) {
        logger.info(`================下载文件开始=============`);
        logger.info(`请求的URL：${this.baseURL}${url}`);
        logger.info(`保存路径：${filePath}`);
        logger.info(`请求参数：${JSON.stringify(params)}`);

        try {
            // 构建查询字符串
            const queryString = Object.keys(params).length > 0
                ? `?${new URLSearchParams(params).toString()}`
                : '';

            const response = await this.request(`${url}${queryString}`, {
                method: 'GET',
                ...options
            });

            if (!response.data || typeof response.data === 'string') {
                throw new Error('Invalid response data for file download');
            }

            // 将ArrayBuffer或Blob转换为Buffer并写入文件
            let buffer;
            if (response.data instanceof ArrayBuffer) {
                buffer = Buffer.from(response.data);
            } else if (response.data instanceof Blob) {
                const arrayBuffer = await response.data.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            } else {
                buffer = response.data;
            }

            fs.writeFileSync(filePath, buffer);

            const stats = fs.statSync(filePath);
            logger.info(`文件下载完成：${filePath}，大小：${stats.size} bytes`);
            logger.info(`================下载文件结束=============`);

            return {
                success: true,
                filePath: filePath,
                size: stats.size,
                contentType: response.headers.get('content-type')
            };

        } catch (error) {
            logger.error(`File download failed: ${error.message}`);
            throw error;
        }
    }

    // 下载文件并返回Buffer
    async downloadBuffer(url, params = {}, options = {}) {
        logger.info(`================下载文件到Buffer开始=============`);
        logger.info(`请求的URL：${this.baseURL}${url}`);
        logger.info(`请求参数：${JSON.stringify(params)}`);

        try {
            // 构建查询字符串
            const queryString = Object.keys(params).length > 0
                ? `?${new URLSearchParams(params).toString()}`
                : '';

            const response = await this.request(`${url}${queryString}`, {
                method: 'GET',
                ...options
            });

            let buffer;
            if (response.data instanceof ArrayBuffer) {
                buffer = Buffer.from(response.data);
            } else if (response.data instanceof Blob) {
                const arrayBuffer = await response.data.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            } else {
                buffer = response.data;
            }

            logger.info(`文件下载完成，大小：${buffer.length} bytes`);
            logger.info(`================下载文件到Buffer结束=============`);

            return {
                success: true,
                data: buffer,
                contentType: response.headers.get('content-type'),
                contentLength: response.headers.get('content-length')
            };

        } catch (error) {
            logger.error(`Buffer download failed: ${error.message}`);
            throw error;
        }
    }

    // 流式下载大文件
    async downloadStream(url, filePath, params = {}, options = {}) {
        logger.info(`================流式下载文件开始=============`);
        logger.info(`请求的URL：${this.baseURL}${url}`);
        logger.info(`保存路径：${filePath}`);
        logger.info(`请求参数：${JSON.stringify(params)}`);

        return new Promise(async (resolve, reject) => {
            try {
                // 构建查询字符串
                const queryString = Object.keys(params).length > 0
                    ? `?${new URLSearchParams(params).toString()}`
                    : '';

                const fullUrl = `${this.baseURL}${url}${queryString}`;

                // 准备请求头
                const headers = {
                    'token': this.token,
                    ...options.headers
                };

                const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: headers,
                    ...options
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const writer = createWriteStream(filePath);
                const reader = response.body.getReader();

                const pump = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            writer.end();
                            const stats = fs.statSync(filePath);
                            logger.info(`流式下载完成：${filePath}，大小：${stats.size} bytes`);
                            logger.info(`================流式下载结束=============`);
                            resolve({
                                success: true,
                                filePath: filePath,
                                size: stats.size,
                                contentType: response.headers.get('content-type')
                            });
                            return;
                        }

                        writer.write(Buffer.from(value));
                        pump();
                    }).catch(reject);
                };

                pump();

            } catch (error) {
                logger.error(`Stream download failed: ${error.message}`);
                reject(error);
            }
        });
    }
}

export default FetchApiService;