"""
配置文件 - 阿里百炼API密钥和模型配置
"""
import os

# 阿里百炼API配置
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "your-api-key-here")

# 模型配置
LLM_MODEL = "qwen-max"  # 通义千问-Max，用于文本生成
IMAGE_MODEL = "wanx-v1"  # 通义万相，用于图像生成

# 数据存储路径
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
STUDENTS_FILE = os.path.join(DATA_DIR, "students.json")
MEMORY_FILE = os.path.join(DATA_DIR, "memory.json")
LESSONS_FILE = os.path.join(DATA_DIR, "lessons.json")

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)
