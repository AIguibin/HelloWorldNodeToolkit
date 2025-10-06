import chalk from 'chalk';

const loggers = {
    info: (message) => {
        console.log(chalk.blue(`[INFO] ${new Date().toISOString()}: ${message}`));
    },

    success: (message) => {
        console.log(chalk.green(`[SUCCESS] ${new Date().toISOString()}: ${message}`));
    },

    warning: (message) => {
        console.log(chalk.yellow(`[WARNING] ${new Date().toISOString()}: ${message}`));
    },

    error: (message) => {
        console.log(chalk.red(`[ERROR] ${new Date().toISOString()}: ${message}`));
    },

    debug: (message) => {
        if (process.env.DEBUG) {
            console.log(chalk.gray(`[DEBUG] ${new Date().toISOString()}: ${message}`));
        }
    }
};

export default loggers;