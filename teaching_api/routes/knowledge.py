"""
知识图谱API路由 - 四入口 + 图谱库
"""
import json
import re
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from teaching_api.services.llm_service import LLMService
from teaching_api.services.data_service import DataService
from loguru import logger

router = APIRouter()


class KnowledgeGenerateRequest(BaseModel):
    subject: str = ""
    topic: str = ""


class ExtractTextRequest(BaseModel):
    content: str
    source: str = "手动输入"


class ConversationSummaryRequest(BaseModel):
    conversation: list = []
    summary: str = ""


class SaveToLibraryRequest(BaseModel):
    data: dict
    name: str = ""
    source: str = ""


@router.get("/subjects")
async def get_subjects():
    subjects = [
        {"id": "math", "name": "数学"},
        {"id": "physics", "name": "物理"},
        {"id": "chemistry", "name": "化学"},
        {"id": "chinese", "name": "语文"},
        {"id": "english", "name": "英语"},
        {"id": "programming", "name": "编程/AI"},
    ]
    return {"success": True, "data": subjects}


@router.post("/summarize-conversation")
async def summarize_conversation(req: ConversationSummaryRequest):
    """从对话记录中提取知识图谱"""
    if req.summary:
        text = req.summary
    elif req.conversation:
        lines = []
        for msg in req.conversation[:30]:
            role = "用户" if msg.get("role") == "user" else "AI教师"
            lines.append(f"{role}: {msg.get('content', '')}")
        text = "\n".join(lines)
    else:
        return {"success": False, "error": "请提供对话内容或总结文本"}

    logger.info(f"对话提取知识图谱: {len(text)} 字符")
    result = await LLMService.generate_knowledge_from_text(text, "课堂对话记录")

    if result.get("success") and result.get("data"):
        graph_data = result["data"]
        DataService.save_knowledge_graphs(graph_data)
        return {"success": True, "data": graph_data}

    return {"success": False, "error": result.get("error", "提取失败"), "raw": result.get("text", "")}


@router.post("/extract-from-text")
async def extract_from_text(req: ExtractTextRequest):
    """从手动输入/粘贴的文本中提取知识图谱"""
    if not req.content.strip():
        return {"success": False, "error": "文本内容为空"}

    logger.info(f"文本提取知识图谱: {len(req.content)} 字符, 来源={req.source}")
    result = await LLMService.generate_knowledge_from_text(req.content, req.source)

    if result.get("success") and result.get("data"):
        graph_data = result["data"]
        DataService.save_knowledge_graphs(graph_data)
        return {"success": True, "data": graph_data}

    return {"success": False, "error": result.get("error", "提取失败"), "raw": result.get("text", "")}


@router.post("/extract-from-file")
async def extract_from_file(file: UploadFile = File(...)):
    """上传txt/md文件，提取知识图谱"""
    if not file.filename.endswith(('.txt', '.md', '.json', '.py', '.java', '.cpp', '.js', '.ts', '.html', '.css')):
        return {"success": False, "error": "仅支持文本类文件(txt/md/json/代码)"}

    content = (await file.read()).decode("utf-8", errors="replace")
    if len(content) < 10:
        return {"success": False, "error": "文件内容太少"}

    logger.info(f"文件提取知识图谱: {file.filename}, {len(content)} 字符")
    result = await LLMService.generate_knowledge_from_text(content, f"上传文件: {file.filename}")

    if result.get("success") and result.get("data"):
        graph_data = result["data"]
        DataService.save_knowledge_graphs(graph_data)
        return {"success": True, "data": graph_data, "filename": file.filename}

    return {"success": False, "error": result.get("error", "提取失败"), "raw": result.get("text", "")}


@router.post("/generate")
async def generate_knowledge_graph(req: KnowledgeGenerateRequest):
    """原有：按学科主题生成知识图谱"""
    logger.info(f"学科主题生成知识图谱: {req.subject}/{req.topic}")
    result = await LLMService.generate_knowledge_graph(req.subject, req.topic)

    if result.get("success"):
        if result.get("data"):
            DataService.save_knowledge_graphs(result["data"])
            return {"success": True, "data": result["data"]}

        text = result.get("text", "")
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                graph_data = json.loads(json_match.group())
                DataService.save_knowledge_graphs(graph_data)
                return {"success": True, "data": graph_data}
            except json.JSONDecodeError:
                return {"success": False, "error": "JSON解析失败", "raw_text": text}
        return {"success": False, "error": "未找到JSON数据", "raw_text": text}

    return {"success": False, "error": result.get("error")}


# ===== 知识图谱库 CRUD =====

@router.post("/library/save")
async def save_to_library(req: SaveToLibraryRequest):
    """保存图谱到图谱库"""
    if not req.data or not req.data.get("nodes"):
        return {"success": False, "error": "图谱数据无效"}
    name = req.name.strip() or req.data.get("center_topic", "未命名图谱")
    gid = DataService.save_knowledge_library_item(req.data, name, req.source)
    return {"success": True, "id": gid, "message": "已保存到知识图谱库"}


@router.get("/library/list")
async def list_library():
    """获取图谱库列表"""
    graphs = DataService.get_knowledge_library()
    items = [{
        "id": g.get("id"),
        "name": g.get("name"),
        "source": g.get("source"),
        "created_at": g.get("created_at"),
        "node_count": g.get("node_count"),
        "edge_count": g.get("edge_count"),
    } for g in graphs]
    return {"success": True, "data": items}


@router.get("/library/{gid}")
async def get_library_item(gid: str):
    """获取图谱库中的指定图谱"""
    graphs = DataService.get_knowledge_library()
    for g in graphs:
        if g.get("id") == gid:
            return {"success": True, "data": g.get("data")}
    return {"success": False, "error": "图谱不存在"}


@router.delete("/library/{gid}")
async def delete_library_item(gid: str):
    """删除图谱库中的图谱"""
    ok = DataService.delete_knowledge_library_item(gid)
    if ok:
        return {"success": True, "message": "已删除"}
    return {"success": False, "error": "图谱不存在"}


@router.get("/graph/{key:path}")
async def get_knowledge_graph(key: str):
    """获取已缓存的知识图谱"""
    graphs = DataService.get_knowledge_graphs()
    graph = graphs.get(key)
    if graph:
        return {"success": True, "data": graph}
    return {"success": False, "error": "知识图谱不存在"}
