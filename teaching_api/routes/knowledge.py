"""
知识图谱API路由
"""
from fastapi import APIRouter
from pydantic import BaseModel
from teaching_api.services.llm_service import LLMService
from teaching_api.services.data_service import DataService

router = APIRouter()

class KnowledgeGenerateRequest(BaseModel):
    subject: str
    topic: str

@router.get("/subjects")
async def get_subjects():
    """获取学科列表"""
    subjects = [
        {"id": "math", "name": "数学", "icon": "📐"},
        {"id": "physics", "name": "物理", "icon": "⚡"},
        {"id": "chemistry", "name": "化学", "icon": "🧪"},
        {"id": "chinese", "name": "语文", "icon": "📖"},
        {"id": "english", "name": "英语", "icon": "🔤"},
        {"id": "programming", "name": "编程", "icon": "💻"}
    ]
    return {"success": True, "data": subjects}

@router.post("/generate")
async def generate_knowledge_graph(req: KnowledgeGenerateRequest):
    """
    调用LLM生成知识图谱
    提取知识点关系，返回JSON供前端渲染
    """
    result = await LLMService.generate_knowledge_graph(req.subject, req.topic)
    
    if result.get("success"):
        # 尝试解析JSON
        import json
        import re
        
        text = result.get("text", "")
        # 提取JSON部分
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                graph_data = json.loads(json_match.group())
                # 保存到文件
                graphs = DataService.get_knowledge_graphs()
                key = f"{req.subject}_{req.topic}"
                graphs[key] = graph_data
                DataService.save_knowledge_graphs(graphs)
                
                return {"success": True, "data": graph_data}
            except json.JSONDecodeError:
                return {"success": False, "error": "JSON解析失败", "raw_text": text}
        
        return {"success": False, "error": "未找到JSON数据", "raw_text": text}
    
    return {"success": False, "error": result.get("error")}

@router.get("/graph/{subject}/{topic}")
async def get_knowledge_graph(subject: str, topic: str):
    """获取已生成的知识图谱"""
    graphs = DataService.get_knowledge_graphs()
    key = f"{subject}_{topic}"
    graph = graphs.get(key)
    
    if graph:
        return {"success": True, "data": graph}
    
    return {"success": False, "error": "知识图谱不存在"}
