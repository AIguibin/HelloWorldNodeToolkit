import { encryptPassword } from '../common/helper/crypto.js';
import axiosApiService from '../service/AxiosApiService.js';
import logger from '../common/helper/logger.js';

class FindTokenService {
    constructor(apiBaseUrl) {
        this.axiosApiService = new axiosApiService(apiBaseUrl);
    }

    // 获取token
    async FindToken(user) {
        try {
            // 第一步：获取authCode
            const authCodeResult = await this.axiosApiService.post('/passwdCheck', {
                username: user.id,
                password: encryptPassword(user.pwd || '1')
            });

            const authCode = authCodeResult.authCode;
            if (!authCode) {
                throw new Error('Failed to get authCode from passwdCheck');
            }

            // 第二步：使用authCode获取token
            const tokenResult = await this.axiosApiService.post('/createTokenByVerificationCode', {
                username: user.id,
                password: user.pwd,
                authCode,
                verificationType: "04",
                clntendId: "10002",
                dingVerificationCode: "6666"
            });

            return tokenResult.access_token || "";
        } catch (error) {
            logger.error(`Failed to fetch token: ${error.message}`);
            return "";
        }
    }

    // 验证token
    async validateToken(user) {
        try {
            const result = await this.axiosApiService.post('/tansun-tcp-app-pc/tansun-tcp-system-boot/getSession', {}, {
                headers: {
                    'token': user.token || 'undefined'
                }
            });

            return result.status === 200;
        } catch (error) {
            logger.error(`Failed to validate token: ${error.message}`);
            return false;
        }
    }
}

export default FindTokenService;