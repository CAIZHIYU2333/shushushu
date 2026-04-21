# Node.js 清理和重新安装指南

## 问题
安装Node.js时选择了自定义位置，但没有放在单独文件夹，导致文件散落在F盘各处。

## 解决方案

### 方法1：使用Windows卸载程序（推荐）

1. **卸载Node.js**
   - 按 `Win + R`，输入 `appwiz.cpl`，回车
   - 在"程序和功能"中找到"Node.js"
   - 右键点击，选择"卸载"
   - 按照提示完成卸载

2. **手动清理残留文件**
   
   卸载后，需要手动删除以下位置的文件夹（如果存在）：
   
   ```
   F:\node_modules\          # 全局安装的包
   F:\npm\                    # npm缓存（可能）
   F:\.npm\                   # npm配置（可能）
   F:\Program Files\nodejs\   # 如果安装在这里
   F:\Program Files (x86)\nodejs\  # 如果安装在这里
   ```
   
   以及检查这些位置：
   ```
   %AppData%\npm              # C:\Users\你的用户名\AppData\Roaming\npm
   %AppData%\npm-cache        # C:\Users\你的用户名\AppData\Roaming\npm-cache
   %LocalAppData%\npm-cache   # C:\Users\你的用户名\AppData\Local\npm-cache
   ```

3. **清理环境变量**
   - 按 `Win + R`，输入 `sysdm.cpl`，回车
   - 点击"高级"选项卡 → "环境变量"
   - 在"系统变量"的Path中，删除所有包含以下内容的条目：
     - `nodejs`
     - `npm`
     - `node_modules`
   - 点击"确定"保存

4. **清理注册表（可选，谨慎操作）**
   - 按 `Win + R`，输入 `regedit`，回车
   - 搜索以下键并删除（如果存在）：
     ```
     HKEY_LOCAL_MACHINE\SOFTWARE\Node.js
     HKEY_CURRENT_USER\SOFTWARE\Node.js
     ```
   - ⚠️ **注意**：修改注册表有风险，如果不确定，可以跳过这一步

### 方法2：使用清理脚本（快速）

创建一个PowerShell脚本来清理：

```powershell
# 清理Node.js脚本
# 以管理员身份运行PowerShell，然后执行以下命令

# 1. 卸载Node.js（如果已安装）
$nodejs = Get-WmiObject Win32_Product | Where-Object { $_.Name -like "*Node.js*" }
if ($nodejs) {
    $nodejs.Uninstall()
    Write-Host "Node.js已卸载"
}

# 2. 清理常见位置
$paths = @(
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:APPDATA\npm",
    "$env:APPDATA\npm-cache",
    "$env:LOCALAPPDATA\npm-cache",
    "F:\node_modules",
    "F:\npm",
    "F:\.npm"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "已删除: $path"
    }
}

# 3. 清理环境变量中的Node.js路径
$envPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

$envPath = ($envPath -split ';' | Where-Object { $_ -notmatch 'nodejs|npm' }) -join ';'
$userPath = ($userPath -split ';' | Where-Object { $_ -notmatch 'nodejs|npm' }) -join ';'

[Environment]::SetEnvironmentVariable("Path", $envPath, "Machine")
[Environment]::SetEnvironmentVariable("Path", $userPath, "User")

Write-Host "环境变量已清理"
Write-Host "请重启电脑后重新安装Node.js"
```

### 方法3：手动查找和删除（最彻底）

1. **在F盘搜索Node.js相关文件**
   - 打开F盘
   - 在搜索框输入：`node`
   - 查看搜索结果，删除以下类型的文件/文件夹：
     - `node_modules` 文件夹
     - `npm` 相关文件夹
     - `.npm` 隐藏文件夹
     - `node.exe` 文件
     - `npm.cmd` 文件

2. **检查常见安装位置**
   在文件资源管理器中，依次检查这些位置：
   ```
   F:\Program Files\nodejs\
   F:\Program Files (x86)\nodejs\
   F:\nodejs\
   F:\tools\nodejs\
   ```

## 重新安装Node.js（正确方式）

### 1. 创建专用文件夹
在F盘创建一个专门的文件夹，例如：
```
F:\Development\nodejs\
```
或者
```
F:\Tools\nodejs\
```

### 2. 下载并安装
- 访问 https://nodejs.org/
- 下载LTS版本
- **安装时选择自定义安装**
- **安装路径选择**：`F:\Development\nodejs\`（或你创建的文件夹）
- 其他选项保持默认即可

### 3. 验证安装
打开新的命令行窗口，输入：
```bash
node --version
npm --version
where node
where npm
```

`where` 命令会显示Node.js的安装位置，确认它在正确的文件夹中。

## 清理F盘散落文件的快速方法

### 使用Everything搜索（推荐）

1. **下载Everything**
   - 访问：https://www.voidtools.com/
   - 下载并安装Everything（文件搜索工具）

2. **搜索Node.js相关文件**
   - 打开Everything
   - 在F盘搜索：
     ```
     F:\ node.exe
     F:\ npm.cmd
     F:\ node_modules
     ```
   - 查看结果，删除不需要的文件

### 使用Windows搜索

1. 打开F盘
2. 在搜索框输入：`node`
3. 等待搜索完成
4. 按类型分组查看：
   - 删除所有 `node_modules` 文件夹
   - 删除 `node.exe`、`npm.cmd` 等可执行文件
   - 删除 `.npm` 等配置文件夹

## 注意事项

⚠️ **重要提示**：
1. 删除前确认这些文件确实是Node.js安装产生的
2. 如果F盘有你的项目，注意不要删除项目中的 `node_modules` 文件夹
3. 项目中的 `node_modules` 是正常的，只需要删除全局安装产生的

## 验证清理是否完成

清理完成后，检查：
1. 命令行中 `node` 和 `npm` 命令应该找不到
2. F盘搜索 `node` 应该找不到系统级的Node.js文件
3. 环境变量中不应该有Node.js路径

然后就可以重新安装了！

