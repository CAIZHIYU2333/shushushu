# Node.js 清理脚本
# 使用方法：以管理员身份运行PowerShell，然后执行此脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Node.js 清理脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "警告：建议以管理员身份运行此脚本！" -ForegroundColor Yellow
    Write-Host "按任意键继续，或按Ctrl+C取消..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# 1. 尝试卸载Node.js
Write-Host "步骤1: 检查并卸载Node.js..." -ForegroundColor Green
try {
    $nodejs = Get-WmiObject Win32_Product -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Node.js*" }
    if ($nodejs) {
        Write-Host "找到Node.js安装，正在卸载..." -ForegroundColor Yellow
        $nodejs | ForEach-Object {
            $_.Uninstall() | Out-Null
            Write-Host "已卸载: $($_.Name)" -ForegroundColor Green
        }
    } else {
        Write-Host "未找到Node.js安装程序" -ForegroundColor Gray
    }
} catch {
    Write-Host "无法通过WMI卸载，可能需要手动卸载" -ForegroundColor Yellow
}

# 2. 清理常见位置的文件夹
Write-Host "`n步骤2: 清理Node.js相关文件夹..." -ForegroundColor Green
$pathsToClean = @(
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:APPDATA\npm",
    "$env:APPDATA\npm-cache",
    "$env:LOCALAPPDATA\npm-cache",
    "F:\node_modules",
    "F:\npm",
    "F:\.npm",
    "F:\Program Files\nodejs",
    "${env:ProgramFiles(x86)}\nodejs"
)

$cleanedCount = 0
foreach ($path in $pathsToClean) {
    if (Test-Path $path) {
        try {
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-Host "✓ 已删除: $path" -ForegroundColor Green
            $cleanedCount++
        } catch {
            Write-Host "✗ 无法删除: $path (可能正在使用或需要权限)" -ForegroundColor Red
        }
    }
}

Write-Host "`n已清理 $cleanedCount 个文件夹" -ForegroundColor Cyan

# 3. 清理环境变量
Write-Host "`n步骤3: 清理环境变量..." -ForegroundColor Green
try {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    
    $machinePathNew = ($machinePath -split ';' | Where-Object { 
        $_ -and $_ -notmatch 'nodejs' -and $_ -notmatch '\\npm' -and $_ -notmatch 'node_modules'
    }) -join ';'
    
    $userPathNew = ($userPath -split ';' | Where-Object { 
        $_ -and $_ -notmatch 'nodejs' -and $_ -notmatch '\\npm' -and $_ -notmatch 'node_modules'
    }) -join ';'
    
    if ($machinePath -ne $machinePathNew) {
        [Environment]::SetEnvironmentVariable("Path", $machinePathNew, "Machine")
        Write-Host "✓ 已清理系统环境变量" -ForegroundColor Green
    }
    
    if ($userPath -ne $userPathNew) {
        [Environment]::SetEnvironmentVariable("Path", $userPathNew, "User")
        Write-Host "✓ 已清理用户环境变量" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ 清理环境变量失败: $_" -ForegroundColor Red
}

# 4. 查找F盘中的node相关文件
Write-Host "`n步骤4: 搜索F盘中的Node.js相关文件..." -ForegroundColor Green
Write-Host "注意：这可能需要一些时间..." -ForegroundColor Yellow

$fDriveFiles = @()
try {
    # 搜索常见的Node.js文件
    $searchPatterns = @("node.exe", "npm.cmd", "node_modules")
    
    foreach ($pattern in $searchPatterns) {
        Write-Host "搜索: $pattern" -ForegroundColor Gray
        $files = Get-ChildItem -Path "F:\" -Filter $pattern -Recurse -ErrorAction SilentlyContinue -Depth 3 | Select-Object -First 20
        if ($files) {
            $fDriveFiles += $files
            foreach ($file in $files) {
                Write-Host "  找到: $($file.FullName)" -ForegroundColor Yellow
            }
        }
    }
    
    if ($fDriveFiles.Count -eq 0) {
        Write-Host "未在F盘找到明显的Node.js系统文件" -ForegroundColor Gray
        Write-Host "（项目中的node_modules是正常的，不需要删除）" -ForegroundColor Gray
    } else {
        Write-Host "`n找到 $($fDriveFiles.Count) 个相关文件" -ForegroundColor Yellow
        Write-Host "请手动检查这些文件，确认是否需要删除" -ForegroundColor Yellow
    }
} catch {
    Write-Host "搜索F盘时出错: $_" -ForegroundColor Red
}

# 完成
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "清理完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`n下一步操作：" -ForegroundColor Yellow
Write-Host "1. 重启电脑（推荐）或重启命令行窗口" -ForegroundColor White
Write-Host "2. 验证清理：在命令行输入 'node --version'，应该提示找不到命令" -ForegroundColor White
Write-Host "3. 重新安装Node.js到指定文件夹（如 F:\Development\nodejs\）" -ForegroundColor White
Write-Host "`n按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


