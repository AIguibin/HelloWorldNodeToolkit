import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 清理单元格值
 * 1. 去除前后空格
 * 2. 去除换行符
 * 3. 如果包含对号(√)，则只保留对号
 */
function cleanCellValue(value) {
    if (value === undefined || value === null) return '';

    let cleaned = String(value)
        .trim() // 去除前后空格
        .replace(/[\r\n]+/g, ''); // 替换换行符为空格

    // 如果包含对号，则只保留对号
    if (cleaned.includes('√')) {
        return '√';
    }

    return cleaned;
}

/**
 * 检测角色列的起始位置
 * 通过查找包含"省联社"、"办事处"、"法人行"等关键词的单元格来确定角色列
 */
function detectRoleStartColumn(data) {
    // 检查第二行（机构信息行）
    for (let col = 0; col < data[1].length; col++) {
        const cellValue = cleanCellValue(data[1][col]);

        // 检查是否包含机构关键词
        if (/(省联社|办事处|法人行|分行|支行|分理处)/.test(cellValue)) {
            return col;
        }
    }

    // 如果没有找到机构信息，检查第一行（角色名称行）
    for (let col = 0; col < data[0].length; col++) {
        const cellValue = cleanCellValue(data[0][col]);

        // 检查是否包含角色关键词
        if (/(管理员|复核员|查询员|审批人|经理|主任|行长|客户经理|审查员|调查员|负责人|专员|委员|秘书|成员|组长)/.test(cellValue)) {
            return col;
        }
    }

    // 如果都没有找到，默认从第5列开始（F列，索引5）
    return 5;
}

/**
 * 将Excel数据转换为JSON格式
 */
function excelToJson(data) {
    // 检测角色列的起始位置
    const roleStartCol = detectRoleStartColumn(data);
    console.log(`检测到角色列从索引 ${roleStartCol} 开始 (列 ${String.fromCharCode(65 + roleStartCol)})`);

    // 获取角色信息
    const roles = [];
    for (let col = roleStartCol; col < data[0].length; col++) {
        const roleName = cleanCellValue(data[0][col]);
        const roleOrg = data[1] && data[1][col] ? cleanCellValue(data[1][col]) : '';

        // 跳过空值
        if (!roleName || !roleOrg) continue;

        roles.push({
            roleName: roleName,
            roleOrg: roleOrg,
            colNum: col + 1,  // 转换为1-based索引
            auths: []
        });
    }

    // 处理权限数据（从第2行开始）
    let currentLevel1 = "";
    let currentLevel2 = "";
    let currentLevel3 = "";
    let currentLevel4 = "";

    for (let row = 2; row < data.length; row++) {
        if (!data[row]) continue;

        // 获取各级菜单名称
        const level1 = cleanCellValue(data[row][0]);  // A列 - 一级菜单
        const level2 = cleanCellValue(data[row][1]);  // B列 - 二级菜单
        const level3 = cleanCellValue(data[row][2]);  // C列 - 三级菜单
        const level4 = cleanCellValue(data[row][3]);  // D列 - 四级菜单
        let func = cleanCellValue(data[row][4]);      // E列 - 功能点

        // 如果角色列从E列开始，则E列是角色列，不是功能点
        if (roleStartCol <= 4) {  // E列的索引是4
            func = null;
        }

        // 更新当前层级
        if (level1 !== undefined && level1 !== null && level1 !== '') {
            currentLevel1 = level1;
            currentLevel2 = "";
            currentLevel3 = "";
            currentLevel4 = "";
        }
        if (level2 !== undefined && level2 !== null && level2 !== '') {
            currentLevel2 = level2;
            currentLevel3 = "";
            currentLevel4 = "";
        }
        if (level3 !== undefined && level3 !== null && level3 !== '') {
            currentLevel3 = level3;
            currentLevel4 = "";
        }
        if (level4 !== undefined && level4 !== null && level4 !== '') {
            currentLevel4 = level4;
        }

        // 确定节点名称
        let nodeName = "";
        if (func !== undefined && func !== null && func !== '') {
            nodeName = func;
        } else if (currentLevel4) {
            nodeName = currentLevel4;
        } else if (currentLevel3) {
            nodeName = currentLevel3;
        } else if (currentLevel2) {
            nodeName = currentLevel2;
        } else if (currentLevel1) {
            nodeName = currentLevel1;
        }

        // 为每个角色检查权限
        for (const role of roles) {
            const col = role.colNum - 1;  // 转换为0-based索引
            const cellValue = cleanCellValue(data[row][col]);
            const hasPermission = cellValue === "√";

            // 构建权限树
            const auths = role.auths;

            // 查找或创建一级菜单
            let level1Node = auths.find(item => item.name === currentLevel1);
            if (!level1Node && currentLevel1) {
                level1Node = {name: currentLevel1, has: false, children: [], rowNum: row + 1};
                auths.push(level1Node);
            }

            // 查找或创建二级菜单
            let level2Node = null;
            if (currentLevel2 && level1Node) {
                level2Node = level1Node.children.find(item => item.name === currentLevel2);
                if (!level2Node) {
                    level2Node = {name: currentLevel2, has: false, children: [], rowNum: row + 1};
                    level1Node.children.push(level2Node);
                }
            }

            // 查找或创建三级菜单
            let level3Node = null;
            if (currentLevel3 && level2Node) {
                level3Node = level2Node.children.find(item => item.name === currentLevel3);
                if (!level3Node) {
                    level3Node = {name: currentLevel3, has: false, children: [], rowNum: row + 1};
                    level2Node.children.push(level3Node);
                }
            }

            // 查找或创建四级菜单
            let level4Node = null;
            if (currentLevel4 && level3Node) {
                level4Node = level3Node.children.find(item => item.name === currentLevel4);
                if (!level4Node) {
                    level4Node = {name: currentLevel4, has: false, children: [], rowNum: row + 1};
                    level3Node.children.push(level4Node);
                }
            }

            // 设置权限
            if (func !== undefined && func !== null && func !== '') {
                // 功能点 - 挂在最低级菜单下
                const parentNode = level4Node || level3Node || level2Node || level1Node;
                if (parentNode) {
                    const functionNode = {name: nodeName, has: hasPermission, children: [], rowNum: row + 1};
                    parentNode.children.push(functionNode);
                    // 更新父节点的has属性
                    if (hasPermission) {
                        parentNode.has = true;
                        if (level4Node) level3Node.has = true;
                        if (level3Node) level2Node.has = true;
                        if (level2Node) level1Node.has = true;
                    }
                }
            } else if (currentLevel4 && level3Node) {
                // 四级菜单
                if (hasPermission) {
                    level4Node.has = true;
                    level3Node.has = true;
                    level2Node.has = true;
                    level1Node.has = true;
                }
            } else if (currentLevel3 && level2Node) {
                // 三级菜单
                if (hasPermission) {
                    level3Node.has = true;
                    level2Node.has = true;
                    level1Node.has = true;
                }
            } else if (currentLevel2 && level1Node) {
                // 二级菜单
                if (hasPermission) {
                    level2Node.has = true;
                    level1Node.has = true;
                }
            } else if (currentLevel1) {
                // 一级菜单
                if (hasPermission) {
                    level1Node.has = true;
                }
            }
        }
    }

    return roles;
}

/**
 * 处理所有sheet页
 */
function processAllSheets(filePath) {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error(`错误：文件不存在 - ${filePath}`);
            console.log("请确保Excel文件位于正确的位置");
            console.log("当前工作目录:", process.cwd());

            // 列出当前目录下的文件
            console.log("当前目录下的文件:");
            try {
                const files = fs.readdirSync(__dirname);
                files.forEach(file => {
                    console.log(`  - ${file}`);
                });
            } catch (err) {
                console.error("无法读取当前目录:", err.message);
            }

            return;
        }

        console.log(`正在读取文件: ${filePath}`);

        // 读取Excel文件 - 使用不同的方法
        let workbook;
        try {
            // 方法1: 直接读取文件
            workbook = XLSX.readFile(filePath);
        } catch (error) {
            console.log("直接读取文件失败，尝试使用Buffer方式读取...");

            // 方法2: 使用Buffer读取
            const fileBuffer = fs.readFileSync(filePath);
            workbook = XLSX.read(fileBuffer, {type: 'buffer'});
        }

        const sheetNames = workbook.SheetNames;

        // 创建输出目录
        const outputDir = "data";
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 处理每个sheet页
        for (const sheetName of sheetNames) {
            try {
                console.log(`正在处理工作表: ${sheetName}`);
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const result = excelToJson(data);

                // 生成安全的文件名
                // const safeSheetName = sheetName.replace(/[^\w\s-]/g, '');
                const outputFile = path.join(outputDir, `${sheetName}.json`);

                // 保存为JSON文件
                fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

                console.log(`已保存: ${outputFile}`);
            } catch (e) {
                console.log(`处理工作表 ${sheetName} 时出错: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("处理文件时发生错误:", error.message);
        console.log("请检查文件格式和路径是否正确");
    }
}

// 尝试多种可能的文件路径
const possiblePaths = [
    path.join(__dirname, "doc", "role_menu_permission.xlsx"),
    path.join(__dirname, "role_menu_permission.xlsx"),
    path.join(process.cwd(), "doc", "role_menu_permission.xlsx"),
    path.join(process.cwd(), "role_menu_permission.xlsx")
];

let filePath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        filePath = p;
        console.log(`找到文件: ${p}`);
        break;
    }
}

if (filePath) {
    console.log("尝试访问文件:", filePath);
    processAllSheets(filePath);
    console.log("所有工作表处理完成");
} else {
    console.error("错误：Excel文件不存在");
    console.log("请将 'role_menu_permission.xlsx' 文件放置在以下位置之一:");
    possiblePaths.forEach(p => console.log(`  - ${p}`));
    console.log("或者修改代码中的文件路径变量");

    // 列出当前目录下的文件
    console.log("\n当前目录下的文件:");
    try {
        const files = fs.readdirSync(__dirname);
        files.forEach(file => {
            console.log(`  - ${file}`);
        });
    } catch (err) {
        console.error("无法读取当前目录:", err.message);
    }
}