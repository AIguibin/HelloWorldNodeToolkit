// 简化方案：使用textarea替代monaco-editor
let editor = null;
let terminal = null;
let currentScript = null;
let scripts = [];

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    await initializeTerminal();
    initializeSimpleEditor();
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

// 初始化简单的textarea编辑器
function initializeSimpleEditor() {
    const editorContainer = document.getElementById('editor');
    
    // 创建textarea元素
    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.border = 'none';
    textarea.style.background = '#1e1e1e';
    textarea.style.color = '#d4d4d4';
    textarea.style.fontFamily = 'Consolas, "Courier New", monospace';
    textarea.style.fontSize = '14px';
    textarea.style.lineHeight = '1.5';
    textarea.style.padding = '10px';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'auto';
    textarea.value = '// 选择一个脚本开始编辑\n// 或点击"新建脚本"按钮创建新脚本';
    
    // 清空容器并添加textarea
    editorContainer.innerHTML = '';
    editorContainer.appendChild(textarea);
    
    // 保存引用和添加事件监听
    editor = textarea;
    
    textarea.addEventListener('input', () => {
        if (currentScript) {
            currentScript.content = textarea.value;
            updateScriptInList(currentScript);
        }
    });
}

async function initializeTerminal() {
    return new Promise((resolve) => {
        // 调试：检查全局对象
        console.log('=== 终端初始化调试信息 ===');
        console.log('window.Terminal:', typeof window.Terminal);
        console.log('window.FitAddon:', typeof window.FitAddon, window.FitAddon);
        console.log('window.WebLinksAddon:', typeof window.WebLinksAddon, window.WebLinksAddon);
        
        // 尝试从window或global对象获取
        const globalObj = typeof window !== 'undefined' ? window : global;
        
        // 检查Terminal是否已加载
        const checkTerminal = () => {
            return typeof globalObj.Terminal === 'function';
        };
        
        // 等待Terminal加载完成
        const waitForTerminal = () => {
            if (checkTerminal()) {
                initialize();
            } else {
                console.log('等待Terminal对象加载...');
                setTimeout(waitForTerminal, 100);
            }
        };
        
        // 实际初始化函数
        const initialize = () => {
            try {
                const Terminal = globalObj.Terminal;
                
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
                
                // 简化处理：不使用addons，直接实现简单的适配
                terminal.open(document.getElementById('terminal'));
                
                // 简化的适配函数
                const fit = () => {
                    const container = document.getElementById('terminal');
                    if (container && terminal) {
                        terminal.resize(Math.floor(container.clientWidth / 8), Math.floor(container.clientHeight / 20));
                    }
                };
                
                // 初始适配和窗口大小变化监听
                setTimeout(fit, 100);
                window.addEventListener('resize', fit);
                
                terminal.writeln('\x1b[32m✓ AIguibin Script Runner 终端已就绪\x1b[0m');
                terminal.writeln('> 选择一个脚本并点击"运行"按钮开始');
                
                resolve();
            } catch (error) {
                console.error('终端初始化失败:', error);
                resolve(); // 即使失败也继续执行
            }
        };
        
        // 开始初始化流程
        waitForTerminal();
    });
}

async function loadScripts() {
    try {
        terminal.writeln('\x1b[33m🔄 开始加载脚本...\x1b[0m');
        
        // 直接在终端输出调试信息
        terminal.writeln('调用getScripts API...');
        scripts = await window.electronAPI.getScripts();
        
        terminal.writeln(`\x1b[32m✅ 加载脚本完成，数量: ${scripts.length}\x1b[0m`);
        
        // 输出每个脚本的详细信息
        scripts.forEach((script, index) => {
            terminal.writeln(`📄 脚本 ${index + 1}: ${script.name}`);
            terminal.writeln(`   路径: ${script.path}`);
            terminal.writeln(`   类型: ${script.type}`);
            terminal.writeln(`   大小: ${script.size} bytes`);
        });
        
        terminal.writeln('\x1b[33m📋 开始渲染脚本列表...\x1b[0m');
        renderScriptList();
        terminal.writeln('\x1b[32m✅ 脚本列表渲染完成\x1b[0m');
        
        if (scripts.length > 0) {
            terminal.writeln(`\x1b[33m🔍 选择第一个脚本: ${scripts[0].name}\x1b[0m`);
            selectScript(scripts[0]);
        } else {
            terminal.writeln('\x1b[31m❌ 没有找到脚本\x1b[0m');
            editor.setValue('// 没有找到脚本\n// 点击"新建脚本"按钮创建第一个脚本');
        }
    } catch (error) {
        console.error('加载脚本失败:', error);
        terminal.writeln(`\x1b[31m❌ 加载脚本失败: ${error.message}\x1b[0m`);
        // 输出完整的错误堆栈
        terminal.writeln(`   错误详情: ${error.stack}`);
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
    if (editor) {
        editor.value = script.content;
    }
    
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
    terminal.writeln('─ ─ '.repeat(28));

    
    try {
        const result = await window.electronAPI.runScript({
            path: script.path,
            type: script.type,
            args: args
        });
        
        terminal.writeln('─ ─ '.repeat(28));
        terminal.writeln(`\x1b[${result.success ? '32' : '31'}m${result.success ? '✅' : '❌'} 脚本执行完成 (退出码: ${result.exitCode})\x1b[0m`);
    } catch (error) {
        terminal.writeln(`\x1b[31m❌ 执行脚本时发生错误: ${error.message}\x1b[0m`);
    }
}

async function stopScript() {
    try {
        const result = await window.electronAPI.stopScript();
        if (result.success) {
            terminal.writeln('\n');
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
    let scriptName = document.getElementById('scriptName').value.trim();
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