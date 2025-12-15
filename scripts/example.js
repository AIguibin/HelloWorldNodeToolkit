// Example JavaScript script
console.log('Hello from JavaScript script!');
console.log('Current directory:', process.cwd());
console.log('Date:', new Date().toLocaleString());
console.log('Node.js version:', process.version);
console.log('List of files in current directory:');

const fs = require('fs');
const files = fs.readdirSync('.');
files.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`${file} - ${stats.size} bytes`);
});