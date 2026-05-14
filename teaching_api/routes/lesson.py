"""
教案生成API路由 - 三步向导模式
"""
import uuid
import re
import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
from teaching_api.services.llm_service import LLMService
from teaching_api.services.image_service import ImageService
from teaching_api.services.data_service import DataService
from teaching_api.services.ppt_service import generate_ppt_from_lesson
from loguru import logger

router = APIRouter()


class OutlineGenerateRequest(BaseModel):
    objective: str
    subject: str
    topic: str
    level: str
    duration: int
    student_level: str = "中等"
    style: str = "严谨学术"


class ConfirmOutlineRequest(BaseModel):
    lesson_id: str
    title: str
    sections: List[Dict]
    style: str = "academic"
    generate_images: bool = True


# === 静态路由（必须在动态路由 /{lesson_id} 之前） ===

@router.get("/")
async def list_lessons():
    lessons = DataService.get_lessons()
    return {"success": True, "data": lessons}


@router.post("/generate_outline")
async def generate_outline(req: OutlineGenerateRequest):
    lesson_id = f"lesson_{uuid.uuid4().hex[:10]}"
    lesson_params = {
        "objective": req.objective,
        "level": f"{req.level} (学生水平: {req.student_level})",
        "duration": f"{req.duration}分钟",
        "subject": req.subject,
        "topic": req.topic,
    }
    logger.info(f"生成教案提纲: {lesson_id} - {req.subject}/{req.topic}")
    result = await LLMService.generate_lesson_outline(lesson_params)
    if not result.get("success"):
        return {"success": False, "error": result.get("error", "LLM 调用失败")}
    text = result.get("text", "")
    json_match = re.search(r'\{[\s\S]*\}', text)
    if not json_match:
        return {"success": False, "error": "未找到JSON数据", "raw_text": text}
    try:
        lesson_data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return {"success": False, "error": "JSON解析失败", "raw_text": text}
    lesson_data["lesson_id"] = lesson_id
    lesson_data["status"] = "outline"
    lesson_data["style"] = req.style
    lesson_data["params"] = {
        "objective": req.objective, "subject": req.subject,
        "level": req.level, "duration": req.duration,
        "student_level": req.student_level,
    }
    for i, sec in enumerate(lesson_data.get("sections", [])):
        if "name" in sec and "title" not in sec:
            sec["title"] = sec.pop("name")
        sec["id"] = f"sec_{i + 1}"
        if "needs_image" in sec and "need_image" not in sec:
            sec["need_image"] = sec.pop("needs_image")
        if "need_image" not in sec:
            sec["need_image"] = False
        if "image_prompt" not in sec:
            sec["image_prompt"] = None
        if "image_url" not in sec:
            sec["image_url"] = None
        if "sub_points" not in sec or not sec["sub_points"]:
            sec["sub_points"] = [sec.get("title", "本节内容")]
    DataService.save_lesson_outline(lesson_id, lesson_data)
    return {"success": True, "lesson_id": lesson_id, "data": lesson_data}


@router.post("/confirm_outline")
async def confirm_outline(req: ConfirmOutlineRequest):
    lesson_id = req.lesson_id
    lesson_data = {
        "lesson_id": lesson_id, "title": req.title,
        "sections": req.sections, "status": "generating",
        "style": req.style, "params": {},
    }
    DataService.save_lesson_outline(lesson_id, lesson_data)
    if req.generate_images:
        image_prompts = []
        for s in req.sections:
            if s.get("need_image") and s.get("image_prompt"):
                image_prompts.append(s["image_prompt"])
            else:
                image_prompts.append(None)

        valid_prompts = [p for p in image_prompts if p]
        if valid_prompts:
            logger.info(f"开始并发生成 {len(valid_prompts)} 张插图 (qwen-image-plus)")
            tasks = [ImageService.generate_image(p) if p else asyncio.sleep(0) for p in image_prompts]
            results = await asyncio.gather(*tasks)
            for i, result in enumerate(results):
                if isinstance(result, dict) and result.get("success"):
                    imgs = result.get("images", [])
                    if imgs:
                        req.sections[i]["image_url"] = imgs[0]
                    else:
                        logger.warning(f"[IMAGE] section {i} 返回空图片列表")
                else:
                    logger.warning(f"[IMAGE] section {i} 失败: {result}")
    lesson_data["sections"] = req.sections
    ppt_path = generate_ppt_from_lesson(lesson_data)
    lesson_data["ppt_path"] = ppt_path
    lesson_data["status"] = "completed"
    DataService.save_lesson_outline(lesson_id, lesson_data)
    logger.info(f"教案生成完成: {lesson_id}")
    return {"success": True, "lesson_id": lesson_id, "data": lesson_data}


# === 动态路由 /{lesson_id}/... ===

@router.get("/{lesson_id}/ppt")
async def get_lesson_ppt(lesson_id: str):
    lesson_data = DataService.get_lesson_outline(lesson_id)
    if not lesson_data:
        return JSONResponse({"success": False, "error": "教案不存在"}, status_code=404)
    ppt_path = lesson_data.get("ppt_path")
    if not ppt_path:
        return JSONResponse({"success": False, "error": "PPT尚未生成"}, status_code=404)
    import os
    if not os.path.exists(ppt_path):
        return JSONResponse({"success": False, "error": "PPT文件不存在"}, status_code=404)
    return FileResponse(
        path=ppt_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"lesson_{lesson_id}.pptx",
    )


@router.get("/{lesson_id}/status")
async def get_lesson_status(lesson_id: str):
    lesson_data = DataService.get_lesson_outline(lesson_id)
    if not lesson_data:
        return {"success": False, "error": "教案不存在"}
    return {"success": True, "lesson_id": lesson_id, "status": lesson_data.get("status", "unknown")}


@router.get("/{lesson_id}")
async def get_lesson(lesson_id: str):
    lesson_data = DataService.get_lesson_outline(lesson_id)
    if lesson_data:
        return {"success": True, "data": lesson_data}
    lessons = DataService.get_lessons()
    lesson = next((l for l in lessons if l.get("id") == lesson_id), None)
    if lesson:
        return {"success": True, "data": lesson}
    return {"success": False, "error": "教案不存在"}
