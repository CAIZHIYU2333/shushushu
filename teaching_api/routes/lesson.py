"""
教案生成API路由 - 两阶段生成
阶段1：调用qwen-max生成提纲
阶段2：并发调用wanx-v1生成插图
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from teaching_api.services.llm_service import LLMService
from teaching_api.services.image_service import ImageService
from teaching_api.services.data_service import DataService

router = APIRouter()

class LessonGenerateRequest(BaseModel):
    objective: str  # 教学目标
    level: str  # 学生水平
    duration: int  # 课时长度（分钟）
    subject: str  # 学科
    topic: str  # 主题
    generate_images: bool = True  # 是否生成插图

@router.post("/generate")
async def generate_lesson(req: LessonGenerateRequest):
    """
    两阶段生成教案：
    1. 生成结构化提纲
    2. 并发生成插图
    """
    # 阶段1：生成提纲
    lesson_params = {
        "objective": req.objective,
        "level": req.level,
        "duration": f"{req.duration}分钟",
        "subject": req.subject,
        "topic": req.topic
    }
    
    outline_result = await LLMService.generate_lesson_outline(lesson_params)
    
    if not outline_result.get("success"):
        return {"success": False, "error": outline_result.get("error")}
    
    # 解析提纲JSON
    import json
    import re
    
    text = outline_result.get("text", "")
    json_match = re.search(r'\{[\s\S]*\}', text)
    
    if not json_match:
        return {"success": False, "error": "未找到JSON数据", "raw_text": text}
    
    try:
        lesson_data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return {"success": False, "error": "JSON解析失败", "raw_text": text}
    
    # 阶段2：并发生成插图
    images = []
    if req.generate_images:
        # 提取需要配图的章节
        image_prompts = [
            section.get("image_prompt") 
            for section in lesson_data.get("sections", [])
            if section.get("needs_image") and section.get("image_prompt")
        ]
        
        if image_prompts:
            image_result = await ImageService.generate_images_batch(image_prompts)
            images = image_result.get("images", [])
            
            # 将图片URL关联到对应章节
            image_idx = 0
            for section in lesson_data.get("sections", []):
                if section.get("needs_image") and image_idx < len(images):
                    section["image_url"] = images[image_idx]
                    image_idx += 1
    
    # 保存教案
    lessons = DataService.get_lessons()
    lesson_id = f"lesson_{len(lessons) + 1}"
    lesson_data["id"] = lesson_id
    lesson_data["params"] = lesson_params
    lessons.append(lesson_data)
    DataService.save_lessons(lessons)
    
    return {
        "success": True,
        "data": lesson_data,
        "lesson_id": lesson_id,
        "images_generated": len(images)
    }

@router.get("/{lesson_id}")
async def get_lesson(lesson_id: str):
    """获取教案"""
    lessons = DataService.get_lessons()
    lesson = next((l for l in lessons if l.get("id") == lesson_id), None)
    
    if lesson:
        return {"success": True, "data": lesson}
    
    return {"success": False, "error": "教案不存在"}

@router.get("/")
async def get_lessons():
    """获取所有教案列表"""
    lessons = DataService.get_lessons()
    return {"success": True, "data": lessons}
