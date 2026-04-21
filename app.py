import argparse
import os
import sys
import subprocess
import webbrowser
import threading
import time
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.absolute()

# 在导入其他模块之前，检查是否需要切换到项目 Python
# 这必须在导入 gradio 相关模块之前完成
if __name__ == "__main__":
    project_python = project_root / ".glut" / "python.exe"
    
    # 禁用 conda 自动激活，避免 conda 相关错误
    os.environ["CONDA_AUTO_ACTIVATE_BASE"] = "false"
    
    if project_python.exists() and sys.executable != str(project_python):
        # 检测是否是从命令行运行的
        is_double_click = False
        if sys.platform == "win32":
            try:
                is_double_click = not sys.stdin.isatty() or not hasattr(sys.stdin, 'fileno')
            except:
                is_double_click = True
        
        if is_double_click:
            # 双击运行，启动一个新的命令行窗口
            try:
                # 设置环境变量，禁用 conda 自动激活
                env = os.environ.copy()
                env["CONDA_AUTO_ACTIVATE_BASE"] = "false"
                env["CONDA_SHLVL"] = "0"
                
                subprocess.Popen(
                    [str(project_python), str(project_root / "app.py")] + sys.argv[1:],
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    cwd=str(project_root),
                    env=env
                )
                sys.exit(0)
            except Exception as e:
                print(f"启动新窗口失败: {e}")
                print("尝试直接运行...")
                input("按 Enter 键继续...")
                # 设置环境变量
                os.environ["CONDA_AUTO_ACTIVATE_BASE"] = "false"
                os.environ["CONDA_SHLVL"] = "0"
                os.execv(str(project_python), [str(project_python), str(project_root / "app.py")] + sys.argv[1:])
        else:
            # 在命令行中运行，使用项目 Python 重新执行
            # 设置环境变量
            os.environ["CONDA_AUTO_ACTIVATE_BASE"] = "false"
            os.environ["CONDA_SHLVL"] = "0"
            os.execv(str(project_python), [str(project_python), str(project_root / "app.py")] + sys.argv[1:])

sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))

# 设置项目特定的环境变量
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_HOME"] = str(project_root / "models")
os.environ["TORCH_HOME"] = str(project_root / "models")
os.environ["MODELSCOPE_CACHE"] = str(project_root)

from src.service.service_utils.service_config_loader import load_configs
from src.service.service_utils.ssl_helpers import create_ssl_context
from src.chat_engine.chat_engine import ChatEngine
from src.chat_engine.data_models.chat_engine_config_data import ChatEngineConfigModel
from src.service.service_data_models.service_config_data import ServiceConfigData
from src.service.service_data_models.logger_config_data import LoggerConfigData
from loguru import logger
import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json


# 创建一个简单的上下文管理器，用于模拟 Gradio UI
class DummyGradioUI:
    """用于在没有 Gradio UI 时提供上下文管理器支持"""
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


class LiteAvatarApp:
    def __init__(self):
        self.chat_engine = ChatEngine()
        self.app = FastAPI(title="OpenAvatarChat LiteAvatar Service")
        self.service_config = None
        self.engine_config = None

    def load_config(self, config_path: str = "config/glut2.yaml", host: str = None, port: int = None, env: str = "default"):
        """加载配置文件"""
        # 创建模拟的args对象，用于配置加载
        class Args:
            def __init__(self, config, env="default", host=None, port=None):
                self.config = config
                self.env = env
                self.host = host
                self.port = port
        
        self.args = Args(config=config_path, env=env, host=host, port=port)
        
        try:
            logger_config, service_config, engine_config = load_configs(self.args)
            self.service_config = service_config
            self.engine_config = engine_config
            
            # 如果命令行参数指定了 host 或 port，覆盖配置文件的设置
            if host:
                self.service_config.host = host
            if port:
                self.service_config.port = port
            
            # 设置日志级别
            logger.remove()
            logger.add(sys.stdout, level=logger_config.log_level)
            
            return True
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def initialize_engine(self):
        """初始化聊天引擎"""
        try:
            # 检查数字人资源文件（复用旧代码的逻辑）
            self._check_avatar_resources()
            
            # 创建一个假的 Gradio UI 对象，用于满足 setup_rtc_ui 的上下文管理器需求
            dummy_ui = DummyGradioUI()
            self.chat_engine.initialize(self.engine_config, app=self.app, ui=dummy_ui, parent_block=dummy_ui)
            logger.info("Chat engine initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize chat engine: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def _check_avatar_resources(self):
        """检查数字人资源文件是否存在（复用旧代码的逻辑）"""
        try:
            # 从配置中获取 avatar_name
            handler_configs = self.engine_config.handler_configs or {}
            liteavatar_config = handler_configs.get('LiteAvatar', {})
            avatar_name = liteavatar_config.get('avatar_name', '20250408/sample_data')
            
            # 确保 avatar_name 是字符串类型
            if not isinstance(avatar_name, str):
                avatar_name = str(avatar_name)
            avatar_name = avatar_name.strip().strip('"').strip("'")
            
            # 构建资源路径
            resource_dir = project_root / 'resource' / 'avatar' / 'liteavatar'
            avatar_dir = resource_dir / avatar_name
            avatar_zip = resource_dir / f"{avatar_name}.zip"
            
            # 创建资源目录
            resource_dir.mkdir(parents=True, exist_ok=True)
            
            # 检查资源是否存在
            if avatar_dir.exists():
                logger.info(f"数字人资源目录已存在: {avatar_dir}")
                return True
            
            if avatar_zip.exists():
                logger.info(f"数字人资源压缩包已存在: {avatar_zip}")
                # 尝试解压
                import zipfile
                try:
                    with zipfile.ZipFile(avatar_zip, 'r') as zip_ref:
                        zip_ref.extractall(resource_dir)
                    logger.info(f"数字人资源解压完成: {avatar_dir}")
                    return True
                except Exception as e:
                    logger.warning(f"数字人资源解压失败: {e}")
                    return False
            
            logger.warning(f"数字人资源文件不存在: {avatar_dir}，将尝试使用默认配置")
            return False
        except Exception as e:
            logger.warning(f"检查数字人资源文件时出错: {e}")
            return False

    def setup_routes(self):
        """设置FastAPI路由"""
        # 使用项目主层级的前端目录
        frontend_path = project_root / "web"
        dist_path = frontend_path / "dist"
        
        # 检查新的原生HTML/CSS/JS文件
        new_index_path = frontend_path / "index.html"
        new_videochat_path = frontend_path / "videochat.html"
        new_console_path = frontend_path / "console.html"
        
        if new_index_path.exists() and new_videochat_path.exists() and new_console_path.exists():
            logger.info("=" * 60)
            logger.info("✅ 使用新的原生HTML/CSS/JS前端（非Vue版本）")
            logger.info(f"前端路径: {frontend_path}")
            logger.info("=" * 60)
            # 使用 html=True 允许直接访问 index.html
            self.app.mount("/ui", StaticFiles(directory=str(frontend_path), html=True), name="static")
            # 根路径重定向到前端
            @self.app.get("/")
            async def root():
                return RedirectResponse(url="/ui/videochat.html")
            
            # /ui/videochat 直接重定向到 videochat.html（避免通过路由系统）
            @self.app.get("/ui/videochat")
            async def videochat_redirect():
                return RedirectResponse(url="/ui/videochat.html")
        # 回退到dist目录（Vue构建版本）
        elif dist_path.exists():
            logger.warning("=" * 60)
            logger.warning("⚠️  警告：使用旧的Vue构建版本！")
            logger.warning("新的原生HTML/CSS/JS文件未找到，回退到dist目录")
            logger.warning(f"dist路径: {dist_path}")
            logger.warning("=" * 60)
            self.app.mount("/ui", StaticFiles(directory=str(dist_path), html=True), name="static")
            @self.app.get("/")
            async def root():
                return RedirectResponse(url="/ui/")
        else:
            logger.error("=" * 60)
            logger.error("❌ 错误：前端文件未找到！")
            logger.error(f"检查路径: {frontend_path}")
            logger.error(f"检查路径: {dist_path}")
            logger.error("=" * 60)
            @self.app.get("/")
            async def root():
                return {"message": "Frontend not found. Please ensure frontend files exist."}

        @self.app.get("/health")
        async def health_check():
            return {"status": "healthy", "service": "liteavatar"}
        
        @self.app.get("/api/info")
        async def api_info():
            return {
                "message": "OpenAvatarChat LiteAvatar Service is running",
                "frontend_url": "/ui/index.html"
            }
        
        # 添加控制台API路由
        self._setup_console_routes()
    
    def _get_permissions_data_path(self):
        """获取权限数据文件路径"""
        data_dir = project_root / "web" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "permissions_data.json"
    
    def _get_avatars_data_path(self):
        """获取数字人数据文件路径"""
        data_dir = project_root / "web" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir / "avatars_data.json"
    
    def _load_avatars_data(self):
        """从JSON文件加载数字人数据"""
        data_path = self._get_avatars_data_path()
        if data_path.exists():
            try:
                with open(data_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"加载数字人数据失败: {e}")
                return {"avatars": [], "nextId": 10000}
        else:
            default_data = {"avatars": [], "nextId": 10000}
            self._save_avatars_data(default_data)
            return default_data
    
    def _save_avatars_data(self, data: Dict[str, Any]):
        """保存数字人数据到JSON文件"""
        data_path = self._get_avatars_data_path()
        try:
            with open(data_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存数字人数据失败: {e}")
            raise
    
    def _update_glut2_config(self, system_prompt: str):
        """更新glut2.yaml的system_prompt配置（第66行）"""
        try:
            glut2_path = project_root / "config" / "glut2.yaml"
            if not glut2_path.exists():
                logger.error(f"glut2.yaml文件不存在: {glut2_path}")
                return False
            
            # 读取文件内容
            with open(glut2_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # 查找system_prompt行（第66行，索引65）
            found = False
            for i in range(len(lines)):
                # 查找包含system_prompt的行
                if 'system_prompt:' in lines[i]:
                    # 找到system_prompt行，替换整行
                    # 保持原有的缩进
                    indent = len(lines[i]) - len(lines[i].lstrip())
                    # 替换整行，保持YAML格式
                    lines[i] = ' ' * indent + f'system_prompt: {system_prompt}\n'
                    found = True
                    logger.info(f"✅ 在第{i+1}行找到system_prompt并替换")
                    break
            
            if not found:
                logger.error("无法找到system_prompt行")
                return False
            
            # 写回文件
            with open(glut2_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            
            logger.info(f"✅ 已更新glut2.yaml的system_prompt配置")
            return True
        except Exception as e:
            logger.error(f"更新glut2.yaml失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def _load_permissions_data(self):
        """从JSON文件加载权限数据"""
        data_path = self._get_permissions_data_path()
        if data_path.exists():
            try:
                with open(data_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"加载权限数据失败: {e}")
                return {"users": [], "roles": []}
        else:
            # 如果文件不存在，创建默认数据
            default_data = {
                "users": [
                    {
                        "id": "1",
                        "username": "admin",
                        "email": "admin@maritime-law.com",
                        "role": "admin",
                        "permissions": ["read", "write", "delete", "manage_users", "admin"],
                        "createdAt": datetime.now().isoformat(),
                    },
                    {
                        "id": "2",
                        "username": "lawyer01",
                        "email": "lawyer01@maritime-law.com",
                        "role": "lawyer",
                        "permissions": ["read", "write"],
                        "createdAt": datetime.now().isoformat(),
                    },
                    {
                        "id": "3",
                        "username": "researcher01",
                        "email": "researcher01@maritime-law.com",
                        "role": "researcher",
                        "permissions": ["read"],
                        "createdAt": datetime.now().isoformat(),
                    }
                ],
                "roles": [
                    {
                        "id": "1",
                        "name": "admin",
                        "description": "系统管理员，拥有所有权限",
                        "permissions": ["read", "write", "delete", "manage_users", "admin"],
                        "createdAt": datetime.now().isoformat(),
                    },
                    {
                        "id": "2",
                        "name": "lawyer",
                        "description": "律师角色，可以读取和写入数据",
                        "permissions": ["read", "write"],
                        "createdAt": datetime.now().isoformat(),
                    },
                    {
                        "id": "3",
                        "name": "researcher",
                        "description": "研究员角色，只能读取数据",
                        "permissions": ["read"],
                        "createdAt": datetime.now().isoformat(),
                    }
                ]
            }
            self._save_permissions_data(default_data)
            return default_data
    
    def _save_permissions_data(self, data: Dict[str, Any]):
        """保存权限数据到JSON文件"""
        data_path = self._get_permissions_data_path()
        try:
            with open(data_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存权限数据失败: {e}")
            raise
    
    def _setup_console_routes(self):
        """设置控制台管理API路由"""
        
        # ==================== 权限管理接口 ====================
        
        @self.app.get("/api/admin/permissions/users")
        async def get_users():
            """获取用户列表"""
            try:
                data = self._load_permissions_data()
                return JSONResponse({
                    "success": True,
                    "data": data.get("users", [])
                })
            except Exception as e:
                logger.error(f"获取用户列表失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.post("/api/admin/permissions/users")
        async def create_user(user: Dict[str, Any] = Body(...)):
            """创建用户"""
            try:
                data = self._load_permissions_data()
                users = data.get("users", [])
                
                # 生成新ID
                max_id = max([int(u.get("id", "0")) for u in users], default=0)
                new_id = str(max_id + 1)
                
                new_user = {
                    "id": new_id,
                    "username": user.get("username", ""),
                    "email": user.get("email", ""),
                    "role": user.get("role", ""),
                    "permissions": user.get("permissions", []),
                    "createdAt": datetime.now().isoformat(),
                }
                
                users.append(new_user)
                data["users"] = users
                self._save_permissions_data(data)
                
                return JSONResponse({
                    "success": True,
                    "data": new_user
                })
            except Exception as e:
                logger.error(f"创建用户失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.put("/api/admin/permissions/users/{user_id}")
        async def update_user(user_id: str, user: Dict[str, Any] = Body(...)):
            """更新用户"""
            try:
                data = self._load_permissions_data()
                users = data.get("users", [])
                
                user_index = next((i for i, u in enumerate(users) if u.get("id") == user_id), None)
                if user_index is None:
                    return JSONResponse({
                        "success": False,
                        "error": "用户不存在"
                    }, status_code=404)
                
                updated_user = {
                    **users[user_index],
                    **user,
                    "id": user_id,
                    "updatedAt": datetime.now().isoformat(),
                }
                users[user_index] = updated_user
                data["users"] = users
                self._save_permissions_data(data)
                
                return JSONResponse({
                    "success": True,
                    "data": updated_user
                })
            except Exception as e:
                logger.error(f"更新用户失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.delete("/api/admin/permissions/users/{user_id}")
        async def delete_user(user_id: str):
            """删除用户"""
            try:
                data = self._load_permissions_data()
                users = data.get("users", [])
                
                users = [u for u in users if u.get("id") != user_id]
                data["users"] = users
                self._save_permissions_data(data)
                
                return JSONResponse({"success": True})
            except Exception as e:
                logger.error(f"删除用户失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.get("/api/admin/permissions/roles")
        async def get_roles():
            """获取角色列表"""
            try:
                data = self._load_permissions_data()
                return JSONResponse({
                    "success": True,
                    "data": data.get("roles", [])
                })
            except Exception as e:
                logger.error(f"获取角色列表失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.post("/api/admin/permissions/roles")
        async def create_role(role: Dict[str, Any] = Body(...)):
            """创建角色"""
            try:
                data = self._load_permissions_data()
                roles = data.get("roles", [])
                
                # 生成新ID
                max_id = max([int(r.get("id", "0")) for r in roles], default=0)
                new_id = str(max_id + 1)
                
                new_role = {
                    "id": new_id,
                    "name": role.get("name", ""),
                    "description": role.get("description", ""),
                    "permissions": role.get("permissions", []),
                    "createdAt": datetime.now().isoformat(),
                }
                
                roles.append(new_role)
                data["roles"] = roles
                self._save_permissions_data(data)
                
                return JSONResponse({
                    "success": True,
                    "data": new_role
                })
            except Exception as e:
                logger.error(f"创建角色失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.put("/api/admin/permissions/roles/{role_id}")
        async def update_role(role_id: str, role: Dict[str, Any] = Body(...)):
            """更新角色"""
            try:
                data = self._load_permissions_data()
                roles = data.get("roles", [])
                
                role_index = next((i for i, r in enumerate(roles) if r.get("id") == role_id), None)
                if role_index is None:
                    return JSONResponse({
                        "success": False,
                        "error": "角色不存在"
                    }, status_code=404)
                
                updated_role = {
                    **roles[role_index],
                    **role,
                    "id": role_id,
                    "updatedAt": datetime.now().isoformat(),
                }
                roles[role_index] = updated_role
                data["roles"] = roles
                self._save_permissions_data(data)
                
                return JSONResponse({
                    "success": True,
                    "data": updated_role
                })
            except Exception as e:
                logger.error(f"更新角色失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.delete("/api/admin/permissions/roles/{role_id}")
        async def delete_role(role_id: str):
            """删除角色"""
            try:
                data = self._load_permissions_data()
                roles = data.get("roles", [])
                
                roles = [r for r in roles if r.get("id") != role_id]
                data["roles"] = roles
                self._save_permissions_data(data)
                
                return JSONResponse({"success": True})
            except Exception as e:
                logger.error(f"删除角色失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        # ==================== 数字人管理接口 ====================
        
        @self.app.get("/api/admin/avatars")
        async def get_avatars():
            """获取数字人列表"""
            try:
                data = self._load_avatars_data()
                avatars = data.get("avatars", [])
                
                # 如果列表为空，从glut2.yaml读取当前配置并创建默认数字人
                if len(avatars) == 0:
                    try:
                        # 读取glut2.yaml获取当前配置
                        glut2_path = project_root / "config" / "glut2.yaml"
                        if glut2_path.exists():
                            with open(glut2_path, 'r', encoding='utf-8') as f:
                                glut2_content = f.read()
                            
                            # 提取system_prompt和avatar_name
                            system_prompt = ""
                            avatar_name = ""
                            lines = glut2_content.split('\n')
                            for i, line in enumerate(lines):
                                if 'system_prompt:' in line:
                                    # 提取system_prompt的值
                                    parts = line.split('system_prompt:', 1)
                                    if len(parts) > 1:
                                        system_prompt = parts[1].strip()
                                if 'avatar_name:' in line:
                                    # 提取avatar_name的值
                                    parts = line.split('avatar_name:', 1)
                                    if len(parts) > 1:
                                        avatar_name = parts[1].strip().strip('"').strip("'")
                            
                            # 创建默认数字人
                            default_avatar = {
                                "id": "10000",
                                "name": "默认数字人",
                                "avatar_name": avatar_name or "20250408/sample_data",
                                "avatar_type": "LiteAvatar",
                                "preview": "系统默认数字人配置",
                                "config": system_prompt or "",
                                "createdAt": datetime.now().isoformat(),
                            }
                            avatars.append(default_avatar)
                            data["avatars"] = avatars
                            data["nextId"] = 10001
                            self._save_avatars_data(data)
                    except Exception as e:
                        logger.warning(f"读取glut2.yaml配置失败: {e}")
                
                return JSONResponse({
                    "success": True,
                    "data": avatars
                })
            except Exception as e:
                logger.error(f"获取数字人列表失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.get("/api/admin/avatars/available")
        async def get_available_avatars():
            """获取可用的数字人包列表（从文件夹扫描）"""
            try:
                resource_dir = project_root / 'resource' / 'avatar' / 'liteavatar'
                available_avatars = []
                found_paths = set()  # 用于去重
                
                # 首先从glut2.yaml读取当前配置的avatar_name
                current_avatar_name = None
                try:
                    glut2_path = project_root / "config" / "glut2.yaml"
                    if glut2_path.exists():
                        with open(glut2_path, 'r', encoding='utf-8') as f:
                            glut2_content = f.read()
                        for line in glut2_content.split('\n'):
                            if 'avatar_name:' in line:
                                parts = line.split('avatar_name:', 1)
                                if len(parts) > 1:
                                    current_avatar_name = parts[1].strip().strip('"').strip("'")
                                    break
                except Exception as e:
                    logger.warning(f"读取glut2.yaml中的avatar_name失败: {e}")
                
                if resource_dir.exists():
                    # 扫描所有子目录
                    for item in resource_dir.iterdir():
                        if item.is_dir():
                            # 检查是否是有效的数字人目录（包含必要文件）
                            model_files = ['net.pth', 'net_encode.pt', 'net_decode.pt', 'bg_video.mp4']
                            ref_frames_dir = item / 'ref_frames'
                            has_model_files = any((item / f).exists() for f in model_files)
                            has_ref_frames = ref_frames_dir.exists() and ref_frames_dir.is_dir()
                            
                            # 排除明显不是模型的目录
                            excluded_names = ['preload', '._____temp']
                            if item.name not in excluded_names and (has_model_files or has_ref_frames):
                                # 构建相对路径（相对于liteavatar目录）
                                relative_path = item.name
                                found_paths.add(relative_path)
                                available_avatars.append({
                                    "name": item.name,
                                    "path": relative_path,
                                    "full_path": str(item)
                                })
                    
                    # 处理包含斜杠的路径（如 "20250408/sample_data"）
                    # 递归扫描子目录
                    for item in resource_dir.iterdir():
                        if item.is_dir() and '/' not in item.name:
                            # 检查子目录
                            for sub_item in item.iterdir():
                                if sub_item.is_dir():
                                    model_files = ['net.pth', 'net_encode.pt', 'net_decode.pt', 'bg_video.mp4']
                                    ref_frames_dir = sub_item / 'ref_frames'
                                    has_model_files = any((sub_item / f).exists() for f in model_files)
                                    has_ref_frames = ref_frames_dir.exists() and ref_frames_dir.is_dir()
                                    
                                    if has_model_files or has_ref_frames:
                                        # 构建相对路径（如 "20250408/sample_data"）
                                        relative_path = f"{item.name}/{sub_item.name}"
                                        if relative_path not in found_paths:
                                            found_paths.add(relative_path)
                                            available_avatars.append({
                                                "name": relative_path,
                                                "path": relative_path,
                                                "full_path": str(sub_item)
                                            })
                
                # 如果当前配置的avatar_name不在列表中，也要添加进去
                if current_avatar_name and current_avatar_name not in found_paths:
                    # 检查路径是否存在
                    avatar_path = None
                    if '/' in current_avatar_name:
                        # 处理带斜杠的路径
                        parts = current_avatar_name.split('/')
                        if len(parts) == 2:
                            check_path = resource_dir / parts[0] / parts[1]
                            if check_path.exists():
                                avatar_path = check_path
                    else:
                        check_path = resource_dir / current_avatar_name
                        if check_path.exists():
                            avatar_path = check_path
                    
                    available_avatars.append({
                        "name": current_avatar_name,
                        "path": current_avatar_name,
                        "full_path": str(avatar_path) if avatar_path else ""
                    })
                    found_paths.add(current_avatar_name)
                
                # 按名称排序
                available_avatars.sort(key=lambda x: x['name'])
                
                return JSONResponse({
                    "success": True,
                    "data": available_avatars
                })
            except Exception as e:
                logger.error(f"获取可用数字人列表失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.post("/api/admin/avatars")
        async def create_avatar(avatar: Dict[str, Any] = Body(...)):
            """创建数字人"""
            try:
                data = self._load_avatars_data()
                avatars = data.get("avatars", [])
                next_id = data.get("nextId", 10000)
                
                new_avatar = {
                    "id": str(next_id),
                    "name": avatar.get("name", ""),
                    "avatar_name": avatar.get("avatar_name", ""),
                    "avatar_type": avatar.get("avatar_type", "LiteAvatar"),
                    "preview": avatar.get("preview", ""),
                    "config": avatar.get("config", ""),
                    "createdAt": datetime.now().isoformat(),
                }
                
                avatars.append(new_avatar)
                data["avatars"] = avatars
                data["nextId"] = next_id + 1
                self._save_avatars_data(data)
                
                return JSONResponse({
                    "success": True,
                    "data": new_avatar
                })
            except Exception as e:
                logger.error(f"创建数字人失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.put("/api/admin/avatars/{avatar_id}")
        async def update_avatar(avatar_id: str, avatar: Dict[str, Any] = Body(...)):
            """更新数字人配置"""
            try:
                data = self._load_avatars_data()
                avatars = data.get("avatars", [])
                
                avatar_index = next((i for i, a in enumerate(avatars) if str(a.get("id")) == str(avatar_id)), None)
                if avatar_index is None:
                    return JSONResponse({
                        "success": False,
                        "error": "数字人不存在"
                    }, status_code=404)
                
                updated_avatar = {
                    **avatars[avatar_index],
                    "name": avatar.get("name", avatars[avatar_index].get("name", "")),
                    "avatar_name": avatar.get("avatar_name", avatars[avatar_index].get("avatar_name", "")),
                    "avatar_type": avatar.get("avatar_type", avatars[avatar_index].get("avatar_type", "LiteAvatar")),
                    "preview": avatar.get("preview", avatars[avatar_index].get("preview", "")),
                    "config": avatar.get("config", avatars[avatar_index].get("config", "")),
                    "id": str(avatar_id),
                    "updatedAt": datetime.now().isoformat(),
                }
                avatars[avatar_index] = updated_avatar
                data["avatars"] = avatars
                self._save_avatars_data(data)
                
                # 如果更新了config，同步更新glut2.yaml
                if avatar.get("config"):
                    self._update_glut2_config(avatar.get("config"))
                
                return JSONResponse({
                    "success": True,
                    "data": updated_avatar
                })
            except Exception as e:
                logger.error(f"更新数字人失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.delete("/api/admin/avatars/{avatar_id}")
        async def delete_avatar(avatar_id: str):
            """删除数字人"""
            try:
                data = self._load_avatars_data()
                avatars = data.get("avatars", [])
                
                avatars = [a for a in avatars if str(a.get("id")) != str(avatar_id)]
                data["avatars"] = avatars
                self._save_avatars_data(data)
                
                return JSONResponse({"success": True})
            except Exception as e:
                logger.error(f"删除数字人失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        @self.app.post("/api/admin/avatars/{avatar_id}/apply")
        async def apply_avatar_config(avatar_id: str):
            """应用数字人配置（更新glut2.yaml并重启服务）"""
            try:
                data = self._load_avatars_data()
                avatars = data.get("avatars", [])
                
                avatar = next((a for a in avatars if str(a.get("id")) == str(avatar_id)), None)
                if not avatar:
                    return JSONResponse({
                        "success": False,
                        "error": "数字人不存在"
                    }, status_code=404)
                
                config = avatar.get("config", "")
                if config:
                    self._update_glut2_config(config)
                    return JSONResponse({
                        "success": True,
                        "message": "配置已更新，请重启服务"
                    })
                else:
                    return JSONResponse({
                        "success": False,
                        "error": "数字人配置为空"
                    })
            except Exception as e:
                logger.error(f"应用数字人配置失败: {e}")
                return JSONResponse({
                    "success": False,
                    "error": str(e)
                }, status_code=500)
        
        # ==================== 知识库管理接口 ====================
        
        # 简单的内存存储（实际应该使用数据库）
        knowledge_topics_store = []
        
        @self.app.get("/api/admin/knowledge/topics")
        async def get_knowledge_topics():
            """获取知识库主题列表"""
            return JSONResponse({"success": True, "data": knowledge_topics_store})
        
        @self.app.post("/api/admin/knowledge/topics")
        async def create_knowledge_topic(topic: Dict[str, Any]):
            """创建知识库主题"""
            new_topic = {
                "id": str(len(knowledge_topics_store) + 1),
                "title": topic.get("title", ""),
                "content": topic.get("content", ""),
                "tags": topic.get("tags", []),
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat(),
            }
            knowledge_topics_store.append(new_topic)
            return JSONResponse({"success": True, "data": new_topic})
        
        @self.app.put("/api/admin/knowledge/topics/{topic_id}")
        async def update_knowledge_topic(topic_id: str, topic: Dict[str, Any]):
            """更新知识库主题"""
            for i, t in enumerate(knowledge_topics_store):
                if t["id"] == topic_id:
                    knowledge_topics_store[i] = {
                        **t,
                        **topic,
                        "id": topic_id,
                        "updatedAt": datetime.now().isoformat(),
                    }
                    return JSONResponse({"success": True, "data": knowledge_topics_store[i]})
            return JSONResponse({"success": False, "error": "Topic not found"}, status_code=404)
        
        @self.app.delete("/api/admin/knowledge/topics/{topic_id}")
        async def delete_knowledge_topic(topic_id: str):
            """删除知识库主题"""
            global knowledge_topics_store
            knowledge_topics_store = [t for t in knowledge_topics_store if t["id"] != topic_id]
            return JSONResponse({"success": True})
        
        @self.app.post("/api/admin/knowledge/search")
        async def search_knowledge(query: Dict[str, Any]):
            """搜索知识库"""
            search_query = query.get("query", "").lower()
            results = [
                t for t in knowledge_topics_store
                if search_query in t.get("title", "").lower() or search_query in t.get("content", "").lower()
            ]
            return JSONResponse({"success": True, "data": results})
        
        # ==================== 数据可视化接口 ====================
        
        @self.app.get("/api/admin/analytics/stats")
        async def get_analytics_stats():
            """获取统计数据"""
            return JSONResponse({
                "success": True,
                "data": {
                    "total_sessions": 0,
                    "total_users": 1,
                    "active_users": 0,
                    "avg_session_duration": 0,
                    "date_range": {
                        "start": datetime.now().isoformat(),
                        "end": datetime.now().isoformat(),
                    }
                }
            })
        
        @self.app.get("/api/admin/analytics/sessions")
        async def get_sessions(start_date: Optional[str] = None, end_date: Optional[str] = None):
            """获取会话数据"""
            # TODO: 实现实际的会话数据获取逻辑
            return JSONResponse({
                "success": True,
                "data": []
            })
        
        @self.app.get("/api/admin/analytics/usage")
        async def get_usage(start_date: Optional[str] = None, end_date: Optional[str] = None):
            """获取使用情况"""
            # TODO: 实现实际的使用情况获取逻辑
            return JSONResponse({
                "success": True,
                "data": {}
            })
        
        @self.app.get("/api/admin/analytics/export")
        async def export_data(format: str = "json"):
            """导出数据"""
            # TODO: 实现实际的数据导出逻辑
            return JSONResponse({
                "success": True,
                "data": {
                    "download_url": f"/api/admin/analytics/export?format={format}"
                }
            })
        
        # ==================== 人物模板管理接口 ====================
        
        # 简单的内存存储（实际应该使用数据库）
        templates_store = []
        
        @self.app.get("/api/admin/templates")
        async def get_templates():
            """获取模板列表"""
            return JSONResponse({"success": True, "data": templates_store})
        
        @self.app.post("/api/admin/templates")
        async def create_template(template: Dict[str, Any]):
            """创建模板"""
            new_template = {
                "id": str(len(templates_store) + 1),
                "name": template.get("name", ""),
                "type": template.get("type", "custom"),
                "system_prompt": template.get("system_prompt", ""),
                "config": template.get("config", {}),
                "createdAt": datetime.now().isoformat(),
            }
            templates_store.append(new_template)
            return JSONResponse({"success": True, "data": new_template})
        
        @self.app.put("/api/admin/templates/{template_id}")
        async def update_template(template_id: str, template: Dict[str, Any]):
            """更新模板"""
            for i, t in enumerate(templates_store):
                if t["id"] == template_id:
                    templates_store[i] = {
                        **t,
                        **template,
                        "id": template_id,
                    }
                    return JSONResponse({"success": True, "data": templates_store[i]})
            return JSONResponse({"success": False, "error": "Template not found"}, status_code=404)
        
        @self.app.delete("/api/admin/templates/{template_id}")
        async def delete_template(template_id: str):
            """删除模板"""
            global templates_store
            templates_store = [t for t in templates_store if t["id"] != template_id]
            return JSONResponse({"success": True})
        
        @self.app.post("/api/admin/templates/{template_id}/apply")
        async def apply_template(template_id: str):
            """应用模板"""
            # TODO: 实现实际的模板应用逻辑
            return JSONResponse({
                "success": True,
                "data": {
                    "message": f"Template {template_id} applied successfully"
                }
            })

    def run(self, host: str = None, port: int = None):
        """运行服务"""
        if not host:
            host = self.service_config.host if self.service_config else "127.0.0.1"
        if not port:
            port = self.service_config.port if self.service_config else 8282

        # 设置路由
        self.setup_routes()
        
        # 创建 SSL 上下文（如果需要）
        ssl_context = create_ssl_context(self.args, self.service_config)
        
        # 确定访问协议
        protocol = "https" if ssl_context else "http"
        # 前端页面在 /ui/index.html，根路径会自动重定向
        url = f"{protocol}://{host}:{port}/"
        frontend_url = f"{protocol}://{host}:{port}/ui/index.html"
        
        logger.info(f"Starting LiteAvatar service on {host}:{port}")
        logger.info(f"Frontend will be available at: {frontend_url}")
        
        # 延迟打开浏览器，等待服务启动
        def open_browser():
            time.sleep(3)  # 等待服务完全启动
            try:
                webbrowser.open(url)
                logger.info(f"已自动打开浏览器: {url}")
                logger.info(f"如果页面未正确加载，请访问: {frontend_url}")
            except Exception as e:
                logger.warning(f"无法自动打开浏览器: {e}")
                logger.info(f"请手动访问: {url} 或 {frontend_url}")
        
        # 在后台线程中打开浏览器
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()
        
        # 运行UVICORN服务器
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="info",
            **ssl_context
        )


def main():
    # 确保在项目根目录运行
    os.chdir(project_root)
    
    parser = argparse.ArgumentParser(description="OpenAvatarChat LiteAvatar Service")
    parser.add_argument("--config", type=str, default="config/glut2.yaml",
                        help="Path to config file")
    parser.add_argument("--host", type=str, default=None,
                        help="Host to bind the service to")
    parser.add_argument("--port", type=int, default=None,
                        help="Port to bind the service to")
    
    args = parser.parse_args()
    
    app = LiteAvatarApp()
    
    # 加载配置
    if not app.load_config(args.config, host=args.host, port=args.port):
        logger.error("Failed to load configuration")
        return 1
    
    # 初始化引擎
    if not app.initialize_engine():
        logger.error("Failed to initialize chat engine")
        return 1
    
    # 运行服务
    app.run(args.host, args.port)
    
    return 0


if __name__ == "__main__":
    # 如果代码执行到这里，说明已经使用了正确的 Python 解释器
    # 检测是否是从命令行运行的
    is_double_click = False
    if sys.platform == "win32":
        try:
            is_double_click = not sys.stdin.isatty() or not hasattr(sys.stdin, 'fileno')
        except:
            is_double_click = True
    
    if is_double_click:
        # 双击运行，启动一个新的命令行窗口
        script_path = Path(__file__).absolute()
        try:
            subprocess.Popen(
                [sys.executable, str(script_path)] + sys.argv[1:],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                cwd=str(script_path.parent)
            )
            # 双击运行时，原窗口可以立即退出
            sys.exit(0)
        except Exception as e:
            # 如果启动失败，尝试直接运行
            print(f"启动新窗口失败: {e}")
            print("尝试直接运行...")
            input("按 Enter 键继续...")
            sys.exit(main())
    else:
        # 在命令行中运行，直接执行
        sys.exit(main())