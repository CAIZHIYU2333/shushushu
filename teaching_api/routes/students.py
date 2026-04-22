"""
学生管理API路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from teaching_api.services.data_service import DataService

router = APIRouter()

class StudentCreate(BaseModel):
    name: str
    grade: str
    school: str
    avatar: Optional[str] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    grade: Optional[str] = None
    school: Optional[str] = None
    avatar: Optional[str] = None

@router.get("/")
async def get_students():
    """获取所有学生列表"""
    students = DataService.get_students()
    return {"success": True, "data": students}

@router.post("/")
async def create_student(student: StudentCreate):
    """创建新学生"""
    students = DataService.get_students()
    student_id = f"student_{len(students) + 1}"
    
    new_student = {
        "id": student_id,
        "name": student.name,
        "grade": student.grade,
        "school": student.school,
        "avatar": student.avatar
    }
    
    students.append(new_student)
    DataService.save_students(students)
    
    # 创建记忆文件夹
    DataService.save_personality(student_id, "默认人格设定：活泼鼓励型教师")
    DataService.save_long_term_memory(student_id, "长期记忆：\n")
    DataService.save_short_term_memory(student_id, "短期记忆：\n")
    
    return {"success": True, "data": new_student}

@router.get("/{student_id}")
async def get_student(student_id: str):
    """获取学生详情"""
    students = DataService.get_students()
    student = next((s for s in students if s["id"] == student_id), None)
    
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    return {"success": True, "data": student}

@router.put("/{student_id}")
async def update_student(student_id: str, student: StudentUpdate):
    """更新学生信息"""
    students = DataService.get_students()
    idx = next((i for i, s in enumerate(students) if s["id"] == student_id), None)
    
    if idx is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    update_data = student.dict(exclude_unset=True)
    students[idx].update(update_data)
    DataService.save_students(students)
    
    return {"success": True, "data": students[idx]}

@router.delete("/{student_id}")
async def delete_student(student_id: str):
    """删除学生"""
    students = DataService.get_students()
    students = [s for s in students if s["id"] != student_id]
    DataService.save_students(students)
    
    return {"success": True, "message": "学生已删除"}
