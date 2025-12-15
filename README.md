# aiguibin-script-runner

一个使用Electron开发的跨平台脚本运行器应用。这个应用将允许您管理和执行各种脚本（.sh、.js、.py等）。

## 项目结构

```
aiguibin-script-runner/
├── package.json
├── main.js
├── preload.js
├── renderer.js
├── index.html
├── styles.css
├── scripts/
│   ├── example.sh
│   ├── example.js
│   └── example.py
└── README.md
```

## 1. package.json

```json
{
  "name": "aiguibin-script-runner",
  "version": "1.0.0",
  "description": "跨平台脚本运行器",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "nodemon --exec electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac",
    "dist:linux": "electron-builder --linux"
  },
  "keywords": ["electron", "script", "runner", "bash", "python", "node"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "electron": "^25.0.0",
    "electron-builder": "^24.0.0",
    "nodemon": "^3.0.0"
  },
  "dependencies": {
    "chokidar": "^3.5.0",
    "fs-extra": "^11.0.0",
    "tree-kill": "^1.2.2",
    "xterm": "^5.2.0",
    "xterm-addon-fit": "^0.7.0",
    "xterm-addon-web-links": "^0.8.0"
  },
  "build": {
    "appId": "com.yourcompany.scriptrunner",
    "productName": "Script Runner",
    "directories": {
      "output": "dist"
    },
    "files": [
      "**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/*.map"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "icon": "build/icon.png"
    }
  }
}
```

## 2. main.js (主进程)

```javascript
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { spawn, exec } = require('child_process');
const os = require('os');

let mainWindow;
let scriptProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'default',
    backgroundColor: '#1e1e1e'
  });

  mainWindow.loadFile('index.html');

  // 打开开发者工具（开发时使用）
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建应用菜单
  createApplicationMenu();
}

function createApplicationMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开脚本文件夹',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('open-scripts-folder');
          }
        },
        {
          label: '新建脚本',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-script');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '切换开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '查看文档',
          click: async () => {
            await shell.openExternal('https://github.com/aiguibin/aiguibin-script-runner');
          }
        },
        {
          label: '报告问题',
          click: async () => {
            await shell.openExternal('https://github.com/aiguibin/aiguibin-script-runner/issues');
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于 AIguibin Script Runner',
              message: 'Script Runner v1.0.0',
              detail: '一个跨平台的脚本运行器\n支持.sh、.js、.py等脚本文件\n作者: AIguibin',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理函数
ipcMain.handle('get-scripts', async () => {
  const scriptsDir = path.join(app.getPath('documents'), 'ScriptRunner', 'scripts');
  await fsExtra.ensureDir(scriptsDir);
  
  try {
    const files = await fs.promises.readdir(scriptsDir);
    const scripts = [];
    
    for (const file of files) {
      const filePath = path.join(scriptsDir, file);
      const stat = await fs.promises.stat(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (['.sh', '.js', '.py', '.bat', '.ps1', '.rb', '.php'].includes(ext)) {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          scripts.push({
            name: file,
            path: filePath,
            content: content,
            type: ext.substring(1),
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    }
    
    return scripts;
  } catch (error) {
    console.error('读取脚本文件失败:', error);
    return [];
  }
});

ipcMain.handle('save-script', async (event, { name, content }) => {
  const scriptsDir = path.join(app.getPath('documents'), 'ScriptRunner', 'scripts');
  await fsExtra.ensureDir(scriptsDir);
  
  const filePath = path.join(scriptsDir, name);
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('保存脚本失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-script', async (event, name) => {
  const scriptsDir = path.join(app.getPath('documents'), 'ScriptRunner', 'scripts');
  const filePath = path.join(scriptsDir, name);
  
  try {
    await fs.promises.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('删除脚本失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('run-script', async (event, scriptInfo) => {
  return new Promise((resolve, reject) => {
    const { path: scriptPath, type, args = [] } = scriptInfo;
    
    // 根据脚本类型确定解释器
    let command;
    let shell;
    
    switch (type.toLowerCase()) {
      case 'sh':
        if (process.platform === 'win32') {
          // Windows 上使用 Git Bash
          const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
          command = gitBashPath;
          shell = false;
          args.unshift(scriptPath);
        } else {
          // Linux/Mac 使用系统bash
          command = '/bin/bash';
          shell = true;
          args.unshift(scriptPath);
        }
        break;
        
      case 'js':
        command = process.execPath; // Node.js
        shell = false;
        args.unshift(scriptPath);
        break;
        
      case 'py':
        command = 'python';
        shell = false;
        args.unshift(scriptPath);
        break;
        
      case 'bat':
        command = scriptPath;
        shell = true;
        break;
        
      case 'ps1':
        command = 'powershell';
        shell = false;
        args.unshift('-ExecutionPolicy', 'Bypass', '-File', scriptPath);
        break;
        
      default:
        command = scriptPath;
        shell = true;
    }
    
    // 终止之前的进程
    if (scriptProcess) {
      try {
        scriptProcess.kill();
      } catch (error) {
        console.error('终止进程失败:', error);
      }
    }
    
    // 设置环境变量
    const env = { ...process.env };
    
    // 执行脚本
    scriptProcess = spawn(command, args, {
      shell: shell,
      env: env,
      cwd: path.dirname(scriptPath)
    });
    
    // 收集输出
    let output = '';
    let errorOutput = '';
    
    scriptProcess.stdout.on('data', (data) => {
      output += data.toString();
      mainWindow.webContents.send('script-output', data.toString());
    });
    
    scriptProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      mainWindow.webContents.send('script-output', data.toString());
    });
    
    scriptProcess.on('close', (code) => {
      const result = {
        exitCode: code,
        output: output,
        errorOutput: errorOutput,
        success: code === 0
      };
      scriptProcess = null;
      resolve(result);
    });
    
    scriptProcess.on('error', (error) => {
      scriptProcess = null;
      reject(error);
    });
  });
});

ipcMain.handle('stop-script', async () => {
  if (scriptProcess) {
    try {
      scriptProcess.kill();
      scriptProcess = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: true };
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-terminal-info', () => {
  return {
    platform: process.platform,
    cwd: process.cwd(),
    homeDir: os.homedir(),
    tempDir: os.tmpdir()
  };
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
```

## 3. preload.js (预加载脚本)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 脚本管理
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  saveScript: (scriptData) => ipcRenderer.invoke('save-script', scriptData),
  deleteScript: (name) => ipcRenderer.invoke('delete-script', name),
  
  // 脚本执行
  runScript: (scriptInfo) => ipcRenderer.invoke('run-script', scriptInfo),
  stopScript: () => ipcRenderer.invoke('stop-script'),
  
  // 文件操作
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 系统信息
  getTerminalInfo: () => ipcRenderer.invoke('get-terminal-info'),
  
  // 事件监听
  onScriptOutput: (callback) => {
    ipcRenderer.on('script-output', (event, data) => callback(data));
  },
  
  onOpenScriptsFolder: (callback) => {
    ipcRenderer.on('open-scripts-folder', () => callback());
  },
  
  onNewScript: (callback) => {
    ipcRenderer.on('new-script', () => callback());
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
```

## 4. index.html (主界面)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIguibin Script Runner</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="node_modules/xterm/css/xterm.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <!-- 侧边栏 -->
        <div class="sidebar">
            <div class="sidebar-header">
                <h2><i class="fas fa-code"></i> 脚本列表</h2>
                <button id="refreshScripts" class="btn-icon" title="刷新">
                    <i class="fas fa-sync-alt"></i>
                </button>
                <button id="newScript" class="btn-icon" title="新建脚本">
                    <i class="fas fa-plus"></i>
                </button>
                <button id="openScriptsFolder" class="btn-icon" title="打开脚本文件夹">
                    <i class="fas fa-folder-open"></i>
                </button>
            </div>
            
            <div class="script-list" id="scriptList">
                <!-- 脚本列表将通过JS动态生成 -->
            </div>
            
            <div class="sidebar-footer">
                <div class="terminal-info">
                    <h3><i class="fas fa-terminal"></i> 终端信息</h3>
                    <div id="terminalInfo">
                        <!-- 终端信息将通过JS动态生成 -->
                    </div>
                </div>
            </div>
        </div>

        <!-- 主内容区 -->
        <div class="main-content">
            <!-- 编辑器区域 -->
            <div class="editor-container">
                <div class="editor-header">
                    <div class="editor-tabs" id="editorTabs">
                        <!-- 标签页将通过JS动态生成 -->
                    </div>
                    <div class="editor-actions">
                        <button id="saveScript" class="btn btn-primary">
                            <i class="fas fa-save"></i> 保存
                        </button>
                        <button id="runScript" class="btn btn-success">
                            <i class="fas fa-play"></i> 运行
                        </button>
                        <button id="stopScript" class="btn btn-danger">
                            <i class="fas fa-stop"></i> 停止
                        </button>
                        <div class="script-args">
                            <input type="text" id="scriptArgs" placeholder="参数 (空格分隔)">
                        </div>
                    </div>
                </div>
                
                <div class="editor-wrapper">
                    <div id="editor" class="code-editor"></div>
                </div>
            </div>

            <!-- 终端输出区域 -->
            <div class="terminal-container">
                <div class="terminal-header">
                    <h3><i class="fas fa-terminal"></i> 输出</h3>
                    <div class="terminal-actions">
                        <button id="clearTerminal" class="btn btn-secondary btn-small">
                            <i class="fas fa-trash"></i> 清空
                        </button>
                        <button id="copyOutput" class="btn btn-secondary btn-small">
                            <i class="fas fa-copy"></i> 复制
                        </button>
                    </div>
                </div>
                <div id="terminal" class="terminal-output"></div>
            </div>
        </div>
    </div>

    <!-- 新建脚本模态框 -->
    <div id="newScriptModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>新建脚本</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="scriptName">脚本名称:</label>
                    <input type="text" id="scriptName" placeholder="例如: my_script.sh">
                </div>
                <div class="form-group">
                    <label for="scriptType">脚本类型:</label>
                    <select id="scriptType">
                        <option value="sh">Bash Shell (.sh)</option>
                        <option value="js">JavaScript (.js)</option>
                        <option value="py">Python (.py)</option>
                        <option value="bat">Batch (.bat)</option>
                        <option value="ps1">PowerShell (.ps1)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="template">选择模板:</label>
                    <select id="template">
                        <option value="empty">空白脚本</option>
                        <option value="todo_finder">TODO查找器</option>
                        <option value="file_backup">文件备份</option>
                        <option value="system_info">系统信息</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelNewScript" class="btn btn-secondary">取消</button>
                <button id="createScript" class="btn btn-primary">创建</button>
            </div>
        </div>
    </div>

    <!-- 脚本模板 -->
    <script type="text/template" id="template-todo_finder">
#!/bin/bash

# TODO查找脚本
# 用法: ./todo_finder.sh [目录] [输出文件]

SEARCH_DIR="${1:-.}"
OUTPUT_FILE="${2:-todo_report.log}"
KEYWORD="TODO"

echo "🔍 开始搜索\${KEYWORD}..."
echo "📁 搜索目录: \${SEARCH_DIR}"
echo "🔑 关键词: \${KEYWORD}"

# 排除的目录
EXCLUDE_DIRS="node_modules dist build .git"

echo "# \${KEYWORD}报告" > "\${OUTPUT_FILE}"
echo "# 生成时间: \$(date)" >> "\${OUTPUT_FILE}"
echo "========================================" >> "\${OUTPUT_FILE}"

find "\${SEARCH_DIR}" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" \) \
    ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.git/*" \
    -exec grep -l "\${KEYWORD}" {} \; | while read -r file; do
    echo "📝 \${file}:" >> "\${OUTPUT_FILE}"
    grep -n "\${KEYWORD}" "\${file}" | sed 's/^/  /' >> "\${OUTPUT_FILE}"
    echo "" >> "\${OUTPUT_FILE}"
done

echo "✅ 完成! 结果保存在: \${OUTPUT_FILE}"
    </script>

    <script type="text/template" id="template-file_backup">
#!/bin/bash

# 文件备份脚本
# 用法: ./backup.sh [源目录] [目标目录]

SOURCE="${1:-./}"
TARGET="${2:-./backup}"
BACKUP_NAME="backup_\$(date +%Y%m%d_%H%M%S).tar.gz"

echo "📂 开始备份..."
echo "📁 源目录: \${SOURCE}"
echo "💾 目标目录: \${TARGET}"

# 创建目标目录
mkdir -p "\${TARGET}"

# 创建备份
tar -czf "\${TARGET}/\${BACKUP_NAME}" -C "\${SOURCE}" .

if [ \$? -eq 0 ]; then
    echo "✅ 备份成功!"
    echo "📦 备份文件: \${TARGET}/\${BACKUP_NAME}"
    echo "📊 文件大小: \$(du -h "\${TARGET}/\${BACKUP_NAME}" | cut -f1)"
else
    echo "❌ 备份失败!"
    exit 1
fi
    </script>

    <script type="text/template" id="template-system_info">
#!/bin/bash

# 系统信息脚本

echo "🖥️  系统信息报告"
echo "========================"
echo ""
echo "📅 日期时间: \$(date)"
echo ""
echo "💻 主机信息:"
echo "  主机名: \$(hostname)"
echo "  操作系统: \$(uname -s) \$(uname -r)"
echo ""
echo "📊 内存使用:"
free -h | sed 's/^/  /'
echo ""
echo "💾 磁盘使用:"
df -h / | sed 's/^/  /'
echo ""
echo "🔥 CPU信息:"
echo "  核心数: \$(nproc)"
echo "  负载: \$(uptime | awk -F'load average:' '{print \$2}')"
echo ""
echo "🌐 网络信息:"
echo "  IP地址: \$(hostname -I | awk '{print \$1}')"
echo ""
echo "========================"
echo "✅ 报告生成完成"
    </script>

    <script src="node_modules/monaco-editor/min/vs/loader.js"></script>
    <script src="node_modules/xterm/lib/xterm.js"></script>
    <script src="node_modules/xterm-addon-fit/lib/xterm-addon-fit.js"></script>
    <script src="node_modules/xterm-addon-web-links/lib/xterm-addon-web-links.js"></script>
    <script src="renderer.js"></script>
</body>
</html>
```

## 5. styles.css (样式文件)

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #1e1e1e;
    color: #d4d4d4;
    height: 100vh;
    overflow: hidden;
}

.container {
    display: flex;
    height: 100vh;
}

/* 侧边栏样式 */
.sidebar {
    width: 280px;
    background: #252526;
    border-right: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.sidebar-header {
    padding: 15px;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.sidebar-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: #cccccc;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-icon {
    background: transparent;
    border: 1px solid #3e3e42;
    color: #cccccc;
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.btn-icon:hover {
    background: #2a2d2e;
    border-color: #007acc;
}

.script-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

.script-item {
    padding: 10px;
    margin-bottom: 5px;
    background: #2d2d30;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s;
    border: 1px solid transparent;
}

.script-item:hover {
    background: #3e3e42;
    border-color: #007acc;
}

.script-item.active {
    background: #094771;
    border-color: #007acc;
}

.script-icon {
    font-size: 14px;
    margin-right: 10px;
    width: 20px;
    text-align: center;
}

.script-name {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.script-actions {
    display: flex;
    gap: 5px;
    opacity: 0;
    transition: opacity 0.2s;
}

.script-item:hover .script-actions {
    opacity: 1;
}

.script-actions button {
    background: transparent;
    border: none;
    color: #cccccc;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
}

.script-actions button:hover {
    background: #3e3e42;
    color: #fff;
}

.sidebar-footer {
    padding: 15px;
    border-top: 1px solid #3e3e42;
}

.terminal-info h3 {
    font-size: 14px;
    margin-bottom: 10px;
    color: #cccccc;
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-item {
    font-size: 12px;
    margin-bottom: 5px;
    color: #888;
}

.info-value {
    color: #4ec9b0;
}

/* 主内容区样式 */
.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid #3e3e42;
}

.editor-header {
    background: #2d2d30;
    padding: 10px 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #3e3e42;
}

.editor-tabs {
    display: flex;
    gap: 2px;
}

.tab {
    padding: 8px 15px;
    background: #2d2d30;
    color: #cccccc;
    border: 1px solid transparent;
    border-bottom: none;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 4px 4px 0 0;
}

.tab:hover {
    background: #3e3e42;
}

.tab.active {
    background: #1e1e1e;
    border-color: #3e3e42;
    color: #fff;
}

.tab-close {
    margin-left: 5px;
    opacity: 0.6;
}

.tab-close:hover {
    opacity: 1;
}

.editor-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.script-args {
    position: relative;
}

.script-args input {
    padding: 8px 12px;
    background: #3e3e42;
    border: 1px solid #007acc;
    border-radius: 4px;
    color: #fff;
    width: 200px;
    font-size: 13px;
}

.script-args input:focus {
    outline: none;
    border-color: #0e639c;
}

.editor-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.code-editor {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
}

/* 终端输出区域 */
.terminal-container {
    height: 300px;
    display: flex;
    flex-direction: column;
    background: #0c0c0c;
}

.terminal-header {
    padding: 10px 15px;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.terminal-header h3 {
    font-size: 14px;
    color: #cccccc;
    display: flex;
    align-items: center;
    gap: 8px;
}

.terminal-actions {
    display: flex;
    gap: 8px;
}

.terminal-output {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
}

/* 按钮样式 */
.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}

.btn:hover {
    transform: translateY(-1px);
}

.btn:active {
    transform: translateY(0);
}

.btn-primary {
    background: #007acc;
    color: white;
}

.btn-primary:hover {
    background: #0e639c;
}

.btn-success {
    background: #388a34;
    color: white;
}

.btn-success:hover {
    background: #2d7a29;
}

.btn-danger {
    background: #f14c4c;
    color: white;
}

.btn-danger:hover {
    background: #c42d2d;
}

.btn-secondary {
    background: #3e3e42;
    color: #cccccc;
}

.btn-secondary:hover {
    background: #4f4f52;
}

.btn-small {
    padding: 6px 12px;
    font-size: 12px;
}

/* 模态框样式 */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: #252526;
    border-radius: 8px;
    width: 500px;
    max-width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid #3e3e42;
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-header h3 {
    color: #cccccc;
    font-size: 18px;
}

.close-modal {
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.close-modal:hover {
    background: #3e3e42;
}

.modal-body {
    padding: 20px;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    color: #cccccc;
    font-size: 14px;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 10px;
    background: #3e3e42;
    border: 1px solid #007acc;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: #0e639c;
}

.modal-footer {
    padding: 20px;
    border-top: 1px solid #3e3e42;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* 滚动条样式 */
::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

::-webkit-scrollbar-track {
    background: #2d2d30;
}

::-webkit-scrollbar-thumb {
    background: #3e3e42;
    border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
    background: #4f4f52;
}

/* 响应式设计 */
@media (max-width: 1024px) {
    .sidebar {
        width: 240px;
    }
    
    .script-args input {
        width: 150px;
    }
}

@media (max-width: 768px) {
    .container {
        flex-direction: column;
    }
    
    .sidebar {
        width: 100%;
        height: 200px;
        border-right: none;
        border-bottom: 1px solid #3e3e42;
    }
    
    .main-content {
        flex: 1;
    }
    
    .editor-actions {
        flex-wrap: wrap;
        gap: 5px;
    }
    
    .script-args input {
        width: 120px;
    }
}

/* 代码编辑器主题 */
.monaco-editor {
    --vscode-editor-background: #1e1e1e;
    --vscode-editor-foreground: #d4d4d4;
    --vscode-editorLineNumber-foreground: #858585;
}
```

## 6. renderer.js (渲染进程逻辑)

```javascript
// 初始化Monaco Editor
require.config({ paths: { vs: 'node_modules/monaco-editor/min/vs' } });

let editor = null;
let terminal = null;
let currentScript = null;
let scripts = [];

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    await initializeMonaco();
    await initializeTerminal();
    await loadScripts();
    setupEventListeners();
    loadTerminalInfo();
    
    // 监听主进程事件
    window.electronAPI.onScriptOutput((data) => {
        terminal.write(data);
    });
    
    window.electronAPI.onOpenScriptsFolder(() => {
        openScriptsFolder();
    });
    
    window.electronAPI.onNewScript(() => {
        showNewScriptModal();
    });
});

async function initializeMonaco() {
    return new Promise((resolve) => {
        require(['vs/editor/editor.main'], () => {
            editor = monaco.editor.create(document.getElementById('editor'), {
                value: '// 选择一个脚本开始编辑\n// 或点击"新建脚本"按钮创建新脚本',
                language: 'plaintext',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
                wordWrap: 'on',
                wrappingIndent: 'indent',
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3
            });
            
            // 监听编辑器内容变化
            editor.onDidChangeModelContent(() => {
                if (currentScript) {
                    currentScript.content = editor.getValue();
                    updateScriptInList(currentScript);
                }
            });
            
            resolve();
        });
    });
}

async function initializeTerminal() {
    const { Terminal } = require('xterm');
    const { FitAddon } = require('xterm-addon-fit');
    const { WebLinksAddon } = require('xterm-addon-web-links');
    
    terminal = new Terminal({
        theme: {
            background: '#0c0c0c',
            foreground: '#f0f0f0',
            cursor: '#a8a8a8',
            black: '#0c0c0c',
            red: '#e74856',
            green: '#16c60c',
            yellow: '#f9f1a5',
            blue: '#3b78ff',
            magenta: '#b4009e',
            cyan: '#61d6d6',
            white: '#cccccc'
        },
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        allowTransparency: true,
        convertEol: true
    });
    
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(document.getElementById('terminal'));
    
    // 调整终端大小
    setTimeout(() => fitAddon.fit(), 100);
    window.addEventListener('resize', () => fitAddon.fit());
    
    terminal.writeln('\x1b[32m✓ AIguibin Script Runner 终端已就绪\x1b[0m');
    terminal.writeln('> 选择一个脚本并点击"运行"按钮开始');
}

async function loadScripts() {
    try {
        scripts = await window.electronAPI.getScripts();
        renderScriptList();
        
        if (scripts.length > 0) {
            selectScript(scripts[0]);
        } else {
            editor.setValue('// 没有找到脚本\n// 点击"新建脚本"按钮创建第一个脚本');
        }
    } catch (error) {
        console.error('加载脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 加载脚本失败: ${error.message}\x1b[0m`);
    }
}

function renderScriptList() {
    const scriptList = document.getElementById('scriptList');
    scriptList.innerHTML = '';
    
    scripts.forEach((script, index) => {
        const scriptItem = document.createElement('div');
        scriptItem.className = `script-item ${currentScript?.name === script.name ? 'active' : ''}`;
        scriptItem.dataset.index = index;
        
        const icon = getScriptIcon(script.type);
        
        scriptItem.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <span class="script-icon">${icon}</span>
                <span class="script-name" title="${script.name}">${script.name}</span>
            </div>
            <div class="script-actions">
                <button class="run-script" title="运行" data-name="${script.name}">
                    <i class="fas fa-play"></i>
                </button>
                <button class="delete-script" title="删除" data-name="${script.name}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        scriptItem.addEventListener('click', (e) => {
            if (!e.target.closest('.script-actions')) {
                selectScript(script);
            }
        });
        
        scriptList.appendChild(scriptItem);
        
        // 添加运行按钮事件
        const runBtn = scriptItem.querySelector('.run-script');
        runBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            runScript(script);
        });
        
        // 添加删除按钮事件
        const deleteBtn = scriptItem.querySelector('.delete-script');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除 "${script.name}" 吗？`)) {
                await deleteScript(script.name);
            }
        });
    });
}

function getScriptIcon(type) {
    const icons = {
        'sh': '🐚',
        'js': '🟨',
        'py': '🐍',
        'bat': '🪟',
        'ps1': '💻',
        'rb': '💎',
        'php': '🐘'
    };
    return icons[type] || '📄';
}

function selectScript(script) {
    currentScript = script;
    
    // 更新编辑器
    editor.setValue(script.content);
    
    // 设置编辑器语言
    const languageMap = {
        'sh': 'shell',
        'js': 'javascript',
        'py': 'python',
        'bat': 'batch',
        'ps1': 'powershell',
        'rb': 'ruby',
        'php': 'php'
    };
    
    monaco.editor.setModelLanguage(editor.getModel(), languageMap[script.type] || 'plaintext');
    
    // 更新标签页
    updateEditorTabs();
    
    // 更新脚本列表高亮
    renderScriptList();
}

function updateEditorTabs() {
    const editorTabs = document.getElementById('editorTabs');
    editorTabs.innerHTML = '';
    
    if (currentScript) {
        const tab = document.createElement('div');
        tab.className = 'tab active';
        tab.innerHTML = `
            ${getScriptIcon(currentScript.type)}
            ${currentScript.name}
            <span class="tab-close">&times;</span>
        `;
        
        editorTabs.appendChild(tab);
    }
}

async function saveCurrentScript() {
    if (!currentScript) {
        alert('请先选择一个脚本');
        return;
    }
    
    try {
        const result = await window.electronAPI.saveScript({
            name: currentScript.name,
            content: editor.getValue()
        });
        
        if (result.success) {
            terminal.writeln(`\x1b[32m✅ 脚本 "${currentScript.name}" 保存成功\x1b[0m`);
            
            // 更新脚本列表
            await loadScripts();
        } else {
            terminal.writeln(`\x1b[31m❌ 保存失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('保存脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 保存失败: ${error.message}\x1b[0m`);
    }
}

async function runScript(script) {
    if (!script) {
        alert('请先选择一个脚本');
        return;
    }
    
    const argsInput = document.getElementById('scriptArgs').value;
    const args = argsInput.split(' ').filter(arg => arg.trim() !== '');
    
    terminal.clear();
    terminal.writeln(`\x1b[33m🚀 正在运行脚本: ${script.name}\x1b[0m`);
    terminal.writeln(`📂 路径: ${script.path}`);
    terminal.writeln(`⚙️  参数: ${args.length > 0 ? args.join(' ') : '无'}`);
    terminal.writeln('─'.repeat(50));
    
    try {
        const result = await window.electronAPI.runScript({
            path: script.path,
            type: script.type,
            args: args
        });
        
        terminal.writeln('\n─'.repeat(50));
        terminal.writeln(`\x1b[${result.success ? '32' : '31'}m${result.success ? '✅' : '❌'} 脚本执行完成 (退出码: ${result.exitCode})\x1b[0m`);
        
        if (!result.success && result.errorOutput) {
            terminal.writeln(`\x1b[31m错误输出:\x1b[0m`);
            terminal.writeln(result.errorOutput);
        }
    } catch (error) {
        console.error('运行脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 运行失败: ${error.message}\x1b[0m`);
    }
}

async function stopScript() {
    try {
        const result = await window.electronAPI.stopScript();
        if (result.success) {
            terminal.writeln('\x1b[33m⏹️  脚本执行已停止\x1b[0m');
        }
    } catch (error) {
        console.error('停止脚本失败:', error);
    }
}

async function deleteScript(name) {
    try {
        const result = await window.electronAPI.deleteScript(name);
        if (result.success) {
            terminal.writeln(`\x1b[32m✅ 脚本 "${name}" 已删除\x1b[0m`);
            
            // 如果删除的是当前脚本，清除编辑器
            if (currentScript && currentScript.name === name) {
                currentScript = null;
                editor.setValue('// 选择一个脚本开始编辑');
                monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
                updateEditorTabs();
            }
            
            // 重新加载脚本列表
            await loadScripts();
        } else {
            terminal.writeln(`\x1b[31m❌ 删除失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('删除脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 删除失败: ${error.message}\x1b[0m`);
    }
}

async function openScriptsFolder() {
    try {
        const scriptsDir = await window.electronAPI.getTerminalInfo();
        // 这里需要根据实际路径调整
        await window.electronAPI.openFolder(scriptsDir.homeDir);
    } catch (error) {
        console.error('打开文件夹失败:', error);
    }
}

function showNewScriptModal() {
    const modal = document.getElementById('newScriptModal');
    modal.classList.add('active');
    
    document.getElementById('scriptName').focus();
}

function hideNewScriptModal() {
    const modal = document.getElementById('newScriptModal');
    modal.classList.remove('active');
    
    document.getElementById('scriptName').value = '';
    document.getElementById('scriptType').value = 'sh';
    document.getElementById('template').value = 'empty';
}

async function createNewScript() {
    const name = document.getElementById('scriptName').value.trim();
    const type = document.getElementById('scriptType').value;
    const template = document.getElementById('template').value;
    
    if (!name) {
        alert('请输入脚本名称');
        return;
    }
    
    // 确保有扩展名
    const fullName = name.includes('.') ? name : `${name}.${type}`;
    
    // 获取模板内容
    let content = '';
    if (template !== 'empty') {
        const templateElement = document.getElementById(`template-${template}`);
        if (templateElement) {
            content = templateElement.textContent;
        }
    }
    
    if (!content) {
        // 基本模板
        switch (type) {
            case 'sh':
                content = '#!/bin/bash\n\n# 这是一个Bash脚本\n# 开始编写您的脚本...\n\necho "Hello, World!"';
                break;
            case 'js':
                content = '// 这是一个JavaScript脚本\n// 开始编写您的脚本...\n\nconsole.log("Hello, World!");';
                break;
            case 'py':
                content = '#!/usr/bin/env python3\n\n# 这是一个Python脚本\n# 开始编写您的脚本...\n\nprint("Hello, World!")';
                break;
            case 'bat':
                content = '@echo off\nrem 这是一个Batch脚本\nrem 开始编写您的脚本...\n\necho Hello, World!';
                break;
            case 'ps1':
                content = '# 这是一个PowerShell脚本\n# 开始编写您的脚本...\n\nWrite-Host "Hello, World!"';
                break;
            default:
                content = `# 这是一个${type}脚本\n# 开始编写您的脚本...`;
        }
    }
    
    try {
        const result = await window.electronAPI.saveScript({
            name: fullName,
            content: content
        });
        
        if (result.success) {
            terminal.writeln(`\x1b[32m✅ 脚本 "${fullName}" 创建成功\x1b[0m`);
            hideNewScriptModal();
            await loadScripts();
            
            // 选择新创建的脚本
            const newScript = scripts.find(s => s.name === fullName);
            if (newScript) {
                selectScript(newScript);
            }
        } else {
            terminal.writeln(`\x1b[31m❌ 创建失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('创建脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 创建失败: ${error.message}\x1b[0m`);
    }
}

function updateScriptInList(script) {
    const index = scripts.findIndex(s => s.name === script.name);
    if (index !== -1) {
        scripts[index] = script;
    }
}

function setupEventListeners() {
    // 按钮事件
    document.getElementById('saveScript').addEventListener('click', saveCurrentScript);
    document.getElementById('runScript').addEventListener('click', () => runScript(currentScript));
    document.getElementById('stopScript').addEventListener('click', stopScript);
    document.getElementById('clearTerminal').addEventListener('click', () => terminal.clear());
    document.getElementById('copyOutput').addEventListener('click', copyTerminalOutput);
    document.getElementById('refreshScripts').addEventListener('click', loadScripts);
    document.getElementById('newScript').addEventListener('click', showNewScriptModal);
    document.getElementById('openScriptsFolder').addEventListener('click', openScriptsFolder);
    
    // 模态框事件
    document.getElementById('createScript').addEventListener('click', createNewScript);
    document.getElementById('cancelNewScript').addEventListener('click', hideNewScriptModal);
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', hideNewScriptModal);
    });
    
    // 点击模态框背景关闭
    document.getElementById('newScriptModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('newScriptModal')) {
            hideNewScriptModal();
        }
    });
    
    // 参数输入框回车运行
    document.getElementById('scriptArgs').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && currentScript) {
            runScript(currentScript);
        }
    });
}

async function loadTerminalInfo() {
    try {
        const info = await window.electronAPI.getTerminalInfo();
        const terminalInfo = document.getElementById('terminalInfo');
        
        terminalInfo.innerHTML = `
            <div class="info-item">平台: <span class="info-value">${info.platform}</span></div>
            <div class="info-item">用户目录: <span class="info-value">${info.homeDir}</span></div>
            <div class="info-item">当前目录: <span class="info-value">${info.cwd}</span></div>
            <div class="info-item">临时目录: <span class="info-value">${info.tempDir}</span></div>
        `;
    } catch (error) {
        console.error('获取终端信息失败:', error);
    }
}

function copyTerminalOutput() {
    const text = terminal.buffer.active.getLine(0)?.translateToString(true) || '';
    navigator.clipboard.writeText(text).then(() => {
        terminal.writeln('\x1b[32m✓ 输出已复制到剪贴板\x1b[0m');
    }).catch(err => {
        terminal.writeln(`\x1b[31m❌ 复制失败: ${err.message}\x1b[0m`);
    });
}

// 导出全局函数供模板使用
window.selectScript = selectScript;
window.runScript = runScript;
window.deleteScript = deleteScript;
```

## 7. 示例脚本文件

在 `scripts/` 目录中创建一些示例脚本：

### example.sh
```bash
#!/bin/bash

echo "🎯 这是一个Bash脚本示例"
echo "当前目录: $(pwd)"
echo "当前用户: $(whoami)"
echo "系统信息: $(uname -a)"
echo ""
echo "📊 当前时间: $(date)"
echo "💾 磁盘使用情况:"
df -h | grep -E "/$|/home$"
echo ""
echo "✅ 脚本执行完成!"
```

### example.js
```javascript
// 这是一个Node.js脚本示例
console.log("🎯 Node.js脚本示例");
console.log("平台:", process.platform);
console.log("Node版本:", process.version);
console.log("当前目录:", process.cwd());

// 显示命令行参数
console.log("\n📝 命令行参数:");
process.argv.forEach((arg, index) => {
    console.log(`  ${index}: ${arg}`);
});

// 简单的计算示例
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(`\n🧮 数字 ${numbers.join('+')} 的总和: ${sum}`);

console.log("\n✅ 脚本执行完成!");
```

### example.py
```python
#!/usr/bin/env python3
# 这是一个Python脚本示例

import sys
import os
import platform
import datetime

print("🎯 Python脚本示例")
print(f"Python版本: {sys.version}")
print(f"平台: {platform.platform()}")
print(f"当前目录: {os.getcwd()}")

print(f"\n📝 命令行参数:")
for i, arg in enumerate(sys.argv):
    print(f"  {i}: {arg}")

print(f"\n📅 当前时间: {datetime.datetime.now()}")

# 列出当前目录的文件
print(f"\n📁 当前目录的文件:")
for file in os.listdir('.'):
    if os.path.isfile(file):
        size = os.path.getsize(file)
        print(f"  {file} ({size} bytes)")

print("\n✅ 脚本执行完成!")
```

## 8. README.md

```markdown
# Script Runner - 跨平台脚本运行器

一个基于Electron开发的跨平台脚本运行器，支持运行.sh、.js、.py等多种脚本文件。

## 功能特性

- 🚀 支持多种脚本语言：Bash、Node.js、Python、Batch、PowerShell等
- 📁 脚本文件管理：创建、编辑、保存、删除脚本
- 🎯 一键运行：点击按钮即可运行选中的脚本
- 🛑 运行控制：支持停止正在运行的脚本
- 📋 参数支持：可以为脚本传递命令行参数
- 💾 终端输出：实时显示脚本执行输出
- 📊 系统信息：显示当前系统环境信息
- 🎨 代码高亮：支持语法高亮的代码编辑器
- 🔄 自动刷新：脚本文件变更自动检测

## 安装和运行

### 开发环境运行

1. 安装依赖：
```bash
npm install
```

2. 启动应用：
```bash
npm start
```

### 构建可执行文件

构建Windows应用：
```bash
npm run dist:win
```

构建macOS应用：
```bash
npm run dist:mac
```

构建Linux应用：
```bash
npm run dist:linux
```

## 使用说明

### 基本操作

1. **新建脚本**：点击侧边栏的"+"按钮，选择脚本类型和模板
2. **编辑脚本**：在编辑器中编写脚本代码
3. **保存脚本**：点击保存按钮或按Ctrl+S保存脚本
4. **运行脚本**：点击运行按钮执行当前脚本
5. **传递参数**：在参数输入框中输入参数（空格分隔）
6. **查看输出**：在终端区域查看脚本执行结果

### 脚本类型支持

| 类型 | 扩展名 | 默认解释器 |
|------|--------|------------|
| Bash Shell | .sh | Git Bash (Windows) / Bash (Linux/Mac) |
| JavaScript | .js | Node.js |
| Python | .py | Python |
| Batch | .bat | cmd.exe (Windows) |
| PowerShell | .ps1 | PowerShell |

## 项目结构

```
aiguibin-script-runner/
├── main.js              # Electron主进程
├── preload.js           # 预加载脚本
├── renderer.js          # 渲染进程逻辑
├── index.html           # 主界面
├── styles.css           # 样式文件
├── package.json         # 项目配置
├── scripts/             # 脚本目录
│   ├── example.sh
│   ├── example.js
│   └── example.py
└── README.md
```

## 技术栈

- **Electron**：跨平台桌面应用框架
- **Monaco Editor**：VS Code的代码编辑器
- **Xterm.js**：终端模拟器
- **Node.js**：后端运行环境

## 自定义配置

### 修改脚本目录

默认脚本目录位于用户的文档文件夹下的 `aiguibin-script-runner/scripts`。您可以在 `main.js` 中修改 `scriptsDir` 路径。

### 添加新的脚本类型

要支持新的脚本类型，需要：

1. 在 `main.js` 的 `run-script` IPC处理器中添加对应的解释器配置
2. 在 `renderer.js` 的 `getScriptIcon` 函数中添加图标
3. 在 `renderer.js` 的 `languageMap` 中添加语法高亮配置

## 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持

如果你在使用中遇到问题，请：

1. 查看 [Issues](https://github.com/aiguibin/aiguibin-script-runner/issues) 页面
2. 创建一个新的 Issue，描述你遇到的问题

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本的脚本编辑和运行功能
- 支持多种脚本语言
- 提供脚本模板
```

## 使用说明

### 安装和运行

1. **安装依赖**：
```bash
npm install
```

2. **启动应用**：
```bash
npm start
```

### 构建可执行文件

构建Windows应用：
```bash
npm run dist:win
```

构建macOS应用：
```bash
npm run dist:mac
```

构建Linux应用：
```bash
npm run dist:linux
```

### 主要功能

1. **脚本管理**：
   - 创建新脚本（支持模板）
   - 编辑现有脚本
   - 保存和删除脚本
   - 按类型分类显示

2. **脚本执行**：
   - 一键运行脚本
   - 支持命令行参数
   - 实时查看输出
   - 可以停止正在运行的脚本

3. **终端功能**：
   - 彩色输出显示
   - 支持复制输出内容
   - 可以清空终端
   - 显示系统信息

4. **代码编辑**：
   - 语法高亮
   - 代码折叠
   - 自动完成
   - 错误检查

### 注意事项

1. **Windows用户**：确保已安装Git Bash（用于运行.sh脚本）
2. **Python脚本**：确保已安装Python并添加到PATH
3. **Node.js脚本**：确保已安装Node.js
4. **权限问题**：某些脚本可能需要管理员权限才能正常运行

这个应用提供了一个完整的开发环境，让您可以轻松管理和运行各种脚本文件。界面美观，功能完善，适合开发人员和系统管理员使用。