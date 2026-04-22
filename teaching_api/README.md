# AI数字人教学助手 - 后端API服务

## 项目结构

```
teaching_api/
├── app.py              # FastAPI主应用
├── config.py           # 配置文件
├── requirements.txt    # 依赖包
├── routes/            # API路由
│   ├── students.py    # 学生管理
│   ├── memory.py      # 记忆系统
│   ├── knowledge.py   # 知识图谱
│   ├── lesson.py      # 教案生成
│   └── evaluation.py  # 学习评价
├── services/          # 业务逻辑
│   ├── llm_service.py     # LLM调用服务
│   ├── image_service.py   # 图像生成服务
│   └── data_service.py    # 数据存储服务
├── models/            # 数据模型
│   └── schemas.py     # Pydantic模型
└── utils/             # 工具函数
    └── prompts.py     # 提示词模板
```

## 使用的阿里模型

| 功能 | 模型 | 说明 |
|------|------|------|
| 文本生成 | qwen-max | 通义千问-Max，用于生成画像、教案、评价等 |
| 图像生成 | wanx-v1 | 通义万相，用于生成教案插图 |

## API接口

### 1. 学生管理 `/api/students`
- `GET /` - 获取学生列表
- `POST /` - 添加学生
- `GET /{student_id}` - 获取学生详情
- `PUT /{student_id}` - 更新学生信息
- `DELETE /{student_id}` - 删除学生

### 2. 记忆系统 `/api/memory`
- `GET /{student_id}` - 获取学生记忆
- `POST /{student_id}/profile` - 生成学习画像（调用LLM）

### 3. 知识图谱 `/api/knowledge`
- `GET /subjects` - 获取学科列表
- `POST /generate` - AI生成知识图谱（调用LLM提取关系）

### 4. 教案生成 `/api/lesson`
- `POST /generate` - 生成教案（两阶段：提纲+并发插图）
- `GET /{lesson_id}` - 获取教案

### 5. 学习评价 `/api/evaluation`
- `POST /generate` - 生成评价报告（调用LLM）

## 启动服务

```bash
# 安装依赖
pip install -r requirements.txt

# 设置API密钥
export DASHSCOPE_API_KEY="your-api-key"

# 启动服务
python -m teaching_api.app
```

服务将在 `http://localhost:8283` 运行

## 教案生成流程

1. **第一阶段**：调用qwen-max生成教案提纲
   - 输入：教学目标、学生水平、课时长度
   - 输出：结构化的教案提纲（JSON格式）

2. **第二阶段**：并发调用wanx-v1生成插图
   - 输入：提纲中的每个知识点描述
   - 输出：对应的教学插图URL

## 知识图谱生成流程

1. 调用qwen-max提取知识点关系
2. 返回JSON格式的节点和边
3. 前端使用D3.js或Echarts渲染
