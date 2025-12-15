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
    icon: path.join(__dirname, 'build/icon.png'),
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