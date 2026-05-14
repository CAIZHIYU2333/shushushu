"""
数据存储服务 - JSON文件存储
"""
import os
import json
from typing import List, Dict, Optional
from teaching_api.config import DATA_DIR

class DataService:
    @staticmethod
    def _read_json(filepath: str) -> dict:
        """读取JSON文件"""
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    @staticmethod
    def _write_json(filepath: str, data: dict):
        """写入JSON文件"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def _read_txt(filepath: str) -> str:
        """读取TXT文件"""
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        return ""
    
    @staticmethod
    def _write_txt(filepath: str, content: str):
        """写入TXT文件"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    # 学生数据
    @staticmethod
    def get_students() -> List[Dict]:
        filepath = os.path.join(DATA_DIR, "students.json")
        data = DataService._read_json(filepath)
        return data.get("students", [])
    
    @staticmethod
    def save_students(students: List[Dict]):
        filepath = os.path.join(DATA_DIR, "students.json")
        DataService._write_json(filepath, {"students": students})
    
    # 记忆系统 - 人格设定
    @staticmethod
    def get_personality(student_id: str) -> str:
        filepath = os.path.join(DATA_DIR, "memory", student_id, "personality.txt")
        return DataService._read_txt(filepath)
    
    @staticmethod
    def save_personality(student_id: str, content: str):
        filepath = os.path.join(DATA_DIR, "memory", student_id, "personality.txt")
        DataService._write_txt(filepath, content)
    
    # 记忆系统 - 长期记忆
    @staticmethod
    def get_long_term_memory(student_id: str) -> str:
        filepath = os.path.join(DATA_DIR, "memory", student_id, "long_term_memory.txt")
        return DataService._read_txt(filepath)
    
    @staticmethod
    def save_long_term_memory(student_id: str, content: str):
        filepath = os.path.join(DATA_DIR, "memory", student_id, "long_term_memory.txt")
        DataService._write_txt(filepath, content)
    
    # 记忆系统 - 短期记忆
    @staticmethod
    def get_short_term_memory(student_id: str) -> str:
        filepath = os.path.join(DATA_DIR, "memory", student_id, "short_term_memory.txt")
        return DataService._read_txt(filepath)
    
    @staticmethod
    def save_short_term_memory(student_id: str, content: str):
        filepath = os.path.join(DATA_DIR, "memory", student_id, "short_term_memory.txt")
        DataService._write_txt(filepath, content)
    
    # 获取完整记忆文件夹内容
    @staticmethod
    def get_all_memory_files(student_id: str) -> Dict[str, str]:
        base_dir = os.path.join(DATA_DIR, "memory", student_id)
        files = {}
        if os.path.exists(base_dir):
            for filename in os.listdir(base_dir):
                if filename.endswith('.txt'):
                    filepath = os.path.join(base_dir, filename)
                    files[filename] = DataService._read_txt(filepath)
        return files
    
    # 教案数据
    @staticmethod
    def get_lessons() -> List[Dict]:
        filepath = os.path.join(DATA_DIR, "lessons.json")
        data = DataService._read_json(filepath)
        return data.get("lessons", [])
    
    @staticmethod
    def save_lessons(lessons: List[Dict]):
        filepath = os.path.join(DATA_DIR, "lessons.json")
        DataService._write_json(filepath, {"lessons": lessons})
    
    # 教案提纲缓存（独立文件存储，每份教案一个JSON文件）
    @staticmethod
    def save_lesson_outline(lesson_id: str, data: Dict):
        filepath = os.path.join(DATA_DIR, "lessons", f"{lesson_id}.json")
        DataService._write_json(filepath, data)

    @staticmethod
    def get_lesson_outline(lesson_id: str) -> Optional[Dict]:
        filepath = os.path.join(DATA_DIR, "lessons", f"{lesson_id}.json")
        if not os.path.exists(filepath):
            return None
        return DataService._read_json(filepath)

    # 知识图谱数据
    @staticmethod
    def get_knowledge_graphs() -> Dict:
        filepath = os.path.join(DATA_DIR, "knowledge_graphs.json")
        return DataService._read_json(filepath)
    
    @staticmethod
    def save_knowledge_graphs(data: Dict):
        filepath = os.path.join(DATA_DIR, "knowledge_graphs.json")
        DataService._write_json(filepath, data)
