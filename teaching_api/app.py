"""
AI数字人教学助手 - FastAPI后端服务
整合阿里百炼大模型API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from teaching_api.routes import students, memory, knowledge, lesson, evaluation

app = FastAPI(
    title="AI Teaching Assistant API",
    description="AI数字人教学助手后端API服务",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(students.router, prefix="/api/students", tags=["学生管理"])
app.include_router(memory.router, prefix="/api/memory", tags=["记忆系统"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["知识图谱"])
app.include_router(lesson.router, prefix="/api/lesson", tags=["教案生成"])
app.include_router(evaluation.router, prefix="/api/evaluation", tags=["学习评价"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Teaching API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8283)
