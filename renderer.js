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
    } catch (error) {
        terminal.writeln(`\x1b[31m❌ 执行脚本时发生错误: ${error.message}\x1b[0m`);
    }
}

async function stopScript() {
    try {
        const result = await window.electronAPI.stopScript();
        if (result.success) {
            terminal.writeln('\x1b[33m⏹️  脚本已停止\x1b[0m');
        } else {
            terminal.writeln(`\x1b[31m❌ 停止脚本失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('停止脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 停止脚本失败: ${error.message}\x1b[0m`);
    }
}

async function deleteScript(name) {
    try {
        const result = await window.electronAPI.deleteScript(name);
        if (result.success) {
            terminal.writeln(`\x1b[32m✅ 脚本 "${name}" 删除成功\x1b[0m`);
            
            // 重新加载脚本列表
            await loadScripts();
            
            // 如果删除的是当前脚本，清空编辑器
            if (currentScript && currentScript.name === name) {
                currentScript = null;
                editor.setValue('// 选择一个脚本开始编辑\n// 或点击"新建脚本"按钮创建新脚本');
                monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
                updateEditorTabs();
            }
        } else {
            terminal.writeln(`\x1b[31m❌ 删除脚本失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('删除脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 删除脚本失败: ${error.message}\x1b[0m`);
    }
}

async function createNewScript() {
    const scriptName = document.getElementById('scriptName').value.trim();
    const scriptType = document.getElementById('scriptType').value;
    const template = document.getElementById('template').value;
    
    if (!scriptName) {
        alert('请输入脚本名称');
        return;
    }
    
    // 检查脚本名称是否包含扩展名
    if (!scriptName.includes('.')) {
        scriptName += `.${scriptType}`;
    }
    
    // 获取模板内容
    let templateContent = '';
    if (template !== 'empty') {
        const templateElement = document.getElementById(`template-${template}`);
        if (templateElement) {
            templateContent = templateElement.textContent;
        }
    }
    
    try {
        const result = await window.electronAPI.saveScript({
            name: scriptName,
            content: templateContent
        });
        
        if (result.success) {
            terminal.writeln(`\x1b[32m✅ 脚本 "${scriptName}" 创建成功\x1b[0m`);
            
            // 重新加载脚本列表
            await loadScripts();
            
            // 选择新创建的脚本
            const newScript = scripts.find(script => script.name === scriptName);
            if (newScript) {
                selectScript(newScript);
            }
            
            // 关闭模态框
            hideNewScriptModal();
        } else {
            terminal.writeln(`\x1b[31m❌ 创建脚本失败: ${result.error}\x1b[0m`);
        }
    } catch (error) {
        console.error('创建脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 创建脚本失败: ${error.message}\x1b[0m`);
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

async function openScriptsFolder() {
    try {
        const folderPath = await window.electronAPI.selectFolder();
        if (folderPath) {
            terminal.writeln(`\x1b[32m📁 已打开文件夹: ${folderPath}\x1b[0m`);
        }
    } catch (error) {
        console.error('打开文件夹失败:', error);
        terminal.writeln(`\x1b[31m❌ 打开文件夹失败: ${error.message}\x1b[0m`);
    }
}

async function loadTerminalInfo() {
    try {
        const info = await window.electronAPI.getTerminalInfo();
        const terminalInfo = document.getElementById('terminalInfo');
        terminalInfo.innerHTML = `
            <div class="info-item">平台: <span class="info-value">${info.platform}</span></div>
            <div class="info-item">当前目录: <span class="info-value">${info.cwd}</span></div>
            <div class="info-item">主目录: <span class="info-value">${info.homeDir}</span></div>
            <div class="info-item">临时目录: <span class="info-value">${info.tempDir}</span></div>
        `;
    } catch (error) {
        console.error('加载终端信息失败:', error);
    }
}

function setupEventListeners() {
    // 刷新脚本按钮
    document.getElementById('refreshScripts').addEventListener('click', loadScripts);
    
    // 新建脚本按钮
    document.getElementById('newScript').addEventListener('click', showNewScriptModal);
    
    // 打开脚本文件夹按钮
    document.getElementById('openScriptsFolder').addEventListener('click', openScriptsFolder);
    
    // 保存脚本按钮
    document.getElementById('saveScript').addEventListener('click', saveCurrentScript);
    
    // 运行脚本按钮
    document.getElementById('runScript').addEventListener('click', () => {
        if (currentScript) {
            runScript(currentScript);
        } else {
            alert('请先选择一个脚本');
        }
    });
    
    // 停止脚本按钮
    document.getElementById('stopScript').addEventListener('click', stopScript);
    
    // 清空终端按钮
    document.getElementById('clearTerminal').addEventListener('click', () => {
        terminal.clear();
    });
    
    // 复制输出按钮
    document.getElementById('copyOutput').addEventListener('click', async () => {
        // 这里简化处理，实际项目中可能需要更复杂的逻辑来获取终端内容
        terminal.selectAll();
        terminal.copy();
        terminal.write('\x1b[32m📋 输出已复制到剪贴板\x1b[0m\r\n');
    });
    
    // 新建脚本模态框按钮
    document.getElementById('createScript').addEventListener('click', createNewScript);
    document.getElementById('cancelNewScript').addEventListener('click', hideNewScriptModal);
    
    // 关闭模态框
    document.querySelector('.close-modal').addEventListener('click', hideNewScriptModal);
    
    // 点击模态框外部关闭
    document.getElementById('newScriptModal').addEventListener('click', (e) => {
        if (e.target.id === 'newScriptModal') {
            hideNewScriptModal();
        }
    });
    
    // 快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl+S 保存脚本
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentScript();
        }
        
        // Ctrl+R 运行脚本
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            if (currentScript) {
                runScript(currentScript);
            }
        }
    });
}

function updateScriptInList(script) {
    const index = scripts.findIndex(s => s.name === script.name);
    if (index !== -1) {
        scripts[index] = script;
    }
}