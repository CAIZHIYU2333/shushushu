"""
学习评价API路由
"""
from fastapi import APIRouter
from pydantic import BaseModel
from teaching_api.services.llm_service import LLMService

router = APIRouter()

class EvaluationGenerateRequest(BaseModel):
    student_id: str
    student_name: str
    conversation_history: list = []

@router.post("/generate")
async def generate_evaluation(req: EvaluationGenerateRequest):
    """
    调用LLM生成学习评价报告
    基于对话历史和学生信息
    """
    result = await LLMService.generate_evaluation(
        student_name=req.student_name,
        conversation_history=req.conversation_history
    )
    
    if result.get("success"):
        return {"success": True, "data": result.get("data"), "raw_text": result.get("text")}
    
    return {"success": False, "error": result.get("error"), "raw_text": result.get("text")}
