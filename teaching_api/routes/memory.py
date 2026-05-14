"""
记忆系统API路由 - 模仿OpenClaw设计
人格设定 + 长期记忆 + 短期记忆（TXT文档）
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from teaching_api.services.data_service import DataService
from teaching_api.services.llm_service import LLMService

router = APIRouter()

class MemoryContent(BaseModel):
    content: str

class MemoryGenerateRequest(BaseModel):
    student_id: str
    conversation_history: list = []

@router.get("/{student_id}")
async def get_memory(student_id: str):
    """获取学生完整记忆（人格+长期+短期）"""
    personality = DataService.get_personality(student_id)
    long_term = DataService.get_long_term_memory(student_id)
    short_term = DataService.get_short_term_memory(student_id)
    
    if not personality and not long_term and not short_term:
        raise HTTPException(status_code=404, detail="记忆不存在，请先创建学生")
    
    return {
        "success": True,
        "data": {
            "student_id": student_id,
            "personality": personality,
            "long_term_memory": long_term,
            "short_term_memory": short_term
        }
    }

@router.get("/{student_id}/files")
async def get_memory_files(student_id: str):
    """获取记忆文件夹所有文件"""
    files = DataService.get_all_memory_files(student_id)
    return {"success": True, "data": files}

@router.put("/{student_id}/personality")
async def update_personality(student_id: str, data: MemoryContent):
    """更新人格设定"""
    DataService.save_personality(student_id, data.content)
    return {"success": True, "message": "人格设定已更新"}

@router.put("/{student_id}/long_term")
async def update_long_term_memory(student_id: str, data: MemoryContent):
    """更新长期记忆"""
    DataService.save_long_term_memory(student_id, data.content)
    return {"success": True, "message": "长期记忆已更新"}

@router.put("/{student_id}/short_term")
async def update_short_term_memory(student_id: str, data: MemoryContent):
    """更新短期记忆"""
    DataService.save_short_term_memory(student_id, data.content)
    return {"success": True, "message": "短期记忆已更新"}

@router.post("/{student_id}/generate_profile")
async def generate_profile(data: MemoryGenerateRequest):
    """
    调用LLM生成学生学习画像
    将人格+长期+短期记忆传给大模型分析
    """
    personality = DataService.get_personality(data.student_id)
    long_term = DataService.get_long_term_memory(data.student_id)
    short_term = DataService.get_short_term_memory(data.student_id)
    
    # 构建完整的记忆上下文
    memory_context = f"""
人格设定：
{personality}

长期记忆：
{long_term}

短期记忆：
{short_term}
"""
    
    result = await LLMService.generate_student_profile(
        memory_context=memory_context,
        conversation_history=data.conversation_history
    )
    
    return {"success": result.get("success"), "data": result.get("data"), "raw_text": result.get("text"), "error": result.get("error")}

# ===== 对话历史（供知识图谱对话总结提取） =====

class ConversationSession(BaseModel):
    id: str = ""
    topic: str = ""
    messages: list = []

@router.get("/conversations/list")
async def get_conversations():
    """获取所有对话历史列表"""
    sessions = DataService.get_conversation_history()
    items = [{"id": s.get("id"), "topic": s.get("topic", "未命名对话"),
              "msg_count": len(s.get("messages", [])),
              "created_at": s.get("created_at", "")} for s in sessions]
    items.reverse()
    return {"success": True, "data": items}

@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    """获取指定对话的完整消息"""
    sessions = DataService.get_conversation_history()
    for s in sessions:
        if s.get("id") == conv_id:
            return {"success": True, "data": s}
    return {"success": False, "error": "对话不存在"}

@router.post("/conversations/save")
async def save_conversation(req: ConversationSession):
    """保存对话历史（前端对话结束后调用）"""
    import uuid, datetime
    sessions = DataService.get_conversation_history()
    if req.id:
        for s in sessions:
            if s.get("id") == req.id:
                s["messages"] = req.messages
                s["topic"] = req.topic or s.get("topic", "未命名对话")
                DataService.save_conversation_history(sessions)
                return {"success": True, "id": req.id}
    cid = req.id or f"conv_{uuid.uuid4().hex[:8]}"
    sessions.append({
        "id": cid, "topic": req.topic or "未命名对话",
        "messages": req.messages,
        "created_at": datetime.datetime.now().isoformat(),
    })
    DataService.save_conversation_history(sessions)
    return {"success": True, "id": cid}
