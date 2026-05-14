"""
学生管理API路由
"""
import uuid
import json
import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List
from teaching_api.services.data_service import DataService
from loguru import logger

router = APIRouter()


class StudentCreate(BaseModel):
    name: str
    grade: str
    school: str
    avatar: Optional[str] = None
    email: Optional[str] = ""
    phone: Optional[str] = ""
    notes: Optional[str] = ""


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    grade: Optional[str] = None
    school: Optional[str] = None
    avatar: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class BatchImportRequest(BaseModel):
    students: List[dict]


@router.get("/")
async def get_students():
    students = DataService.get_students()
    return {"success": True, "data": students}


@router.post("/")
async def create_student(student: StudentCreate):
    students = DataService.get_students()
    sid = f"stu_{uuid.uuid4().hex[:8]}"
    new_student = {
        "id": sid,
        "name": student.name,
        "grade": student.grade,
        "school": student.school,
        "avatar": student.avatar,
        "email": student.email or "",
        "phone": student.phone or "",
        "notes": student.notes or "",
    }
    students.append(new_student)
    DataService.save_students(students)
    DataService.save_personality(sid, "默认人格：活泼鼓励型教师")
    DataService.save_long_term_memory(sid, f"{student.name}的长期记忆：\n")
    DataService.save_short_term_memory(sid, f"{student.name}的短期记忆：\n")
    return {"success": True, "data": new_student}


@router.get("/{student_id}")
async def get_student(student_id: str):
    students = DataService.get_students()
    student = next((s for s in students if s["id"] == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    return {"success": True, "data": student}


@router.put("/{student_id}")
async def update_student(student_id: str, student: StudentUpdate):
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
    students = DataService.get_students()
    students = [s for s in students if s["id"] != student_id]
    DataService.save_students(students)
    return {"success": True, "message": "学生已删除"}


# ===== 模板下载 =====

@router.get("/template/download")
async def download_template():
    """下载学生导入模板CSV文件"""
    header = "姓名,年级,学校,邮箱,电话,备注"
    example = "张三,大三,大连海事大学,zhangsan@example.com,13800138000,对人工智能有浓厚兴趣"
    example2 = "李四,大二,清华大学,lisi@example.com,13900139000,数学基础扎实"
    csv_content = f"{header}\n{example}\n{example2}\n"
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=student_template.csv"}
    )


# ===== 批量导入 =====

@router.post("/batch-import")
async def batch_import(req: BatchImportRequest):
    """JSON批量导入学生"""
    if not req.students:
        return {"success": False, "error": "学生列表为空"}
    students = DataService.get_students()
    imported = 0
    for s in req.students:
        if not s.get("name"):
            continue
        sid = f"stu_{uuid.uuid4().hex[:8]}"
        new_s = {
            "id": sid,
            "name": s.get("name", ""),
            "grade": s.get("grade", ""),
            "school": s.get("school", ""),
            "avatar": s.get("avatar"),
            "email": s.get("email", ""),
            "phone": s.get("phone", ""),
            "notes": s.get("notes", ""),
        }
        students.append(new_s)
        DataService.save_personality(sid, "默认人格：活泼鼓励型教师")
        DataService.save_long_term_memory(sid, f"{new_s['name']}的长期记忆：\n")
        DataService.save_short_term_memory(sid, f"{new_s['name']}的短期记忆：\n")
        imported += 1
    DataService.save_students(students)
    logger.info(f"批量导入 {imported} 名学生")
    return {"success": True, "imported": imported}


@router.post("/csv-import")
async def csv_import(file: UploadFile = File(...)):
    """上传CSV文件导入学生"""
    if not file.filename.endswith('.csv'):
        return {"success": False, "error": "仅支持CSV文件"}
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    students = DataService.get_students()
    imported = 0
    for row in reader:
        name = row.get("姓名", row.get("name", "")).strip()
        if not name:
            continue
        sid = f"stu_{uuid.uuid4().hex[:8]}"
        new_s = {
            "id": sid,
            "name": name,
            "grade": row.get("年级", row.get("grade", "")).strip(),
            "school": row.get("学校", row.get("school", "")).strip(),
            "avatar": None,
            "email": row.get("邮箱", row.get("email", "")).strip(),
            "phone": row.get("电话", row.get("phone", "")).strip(),
            "notes": row.get("备注", row.get("notes", "")).strip(),
        }
        students.append(new_s)
        DataService.save_personality(sid, "默认人格：活泼鼓励型教师")
        DataService.save_long_term_memory(sid, f"{new_s['name']}的长期记忆：\n")
        DataService.save_short_term_memory(sid, f"{new_s['name']}的短期记忆：\n")
        imported += 1
    DataService.save_students(students)
    logger.info(f"CSV导入 {imported} 名学生")
    return {"success": True, "imported": imported, "filename": file.filename}
