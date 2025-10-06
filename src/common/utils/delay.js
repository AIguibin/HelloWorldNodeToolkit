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