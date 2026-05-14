"""
提示词模板 - 各种LLM调用的提示词
"""

# 学生画像生成提示词
STUDENT_PROFILE_PROMPT = """你是一个专业的教育分析师。请根据学生的学习数据，生成详细的学习画像。

## 学生数据
{memory_context}

## 对话历史
{conversation_history}

## 输出要求
请输出JSON格式：
{{
  "learning_style": "学习风格（视觉型/听觉型/动觉型）",
  "strengths": ["优势知识点列表"],
  "weaknesses": ["薄弱知识点列表"],
  "suggestions": ["学习建议列表"],
  "confidence_score": 0.75,
  "personality_traits": ["性格特点列表"],
  "learning_habits": ["学习习惯列表"]
}}

注意：
1. 只输出JSON，不要其他内容
2. 分析要具体、有针对性
3. 建议要可操作"""

# 知识图谱生成提示词
KNOWLEDGE_GRAPH_PROMPT = """你是一个知识图谱专家。请分析学科主题，提取知识点及其关系。

## 学科主题
学科：{subject}
主题：{topic}

## 输出要求
请输出JSON格式：
{{
  "nodes": [
    {{"id": "node1", "name": "知识点名称", "difficulty": "easy/medium/hard", "status": "mastered/learning/unlearned"}}
  ],
  "edges": [
    {{"source": "node1", "target": "node2", "relation": "prerequisite/related/application"}}
  ]
}}

注意：
1. 包含8-12个核心知识点
2. 明确标注前置知识和关联知识
3. 难度分为easy/medium/hard三级
4. 只输出JSON，不要其他内容"""

# 教案生成提示词
LESSON_OUTLINE_PROMPT = """你是一个经验丰富的教研专家。请根据教学要求，生成详细的结构化教案提纲，内容要足够充实以支持生成约20页PPT。

## 教学要求
- 教学目标：{objective}
- 学生水平：{level}
- 课时长度：{duration}
- 学科主题：{subject} - {topic}

## 输出要求
请输出以下JSON格式，每个section的content要非常详细(200-400字/每小节)：

{{
  "title": "教案标题（精炼准确）",
  "sections": [
    {{
      "name": "环节名称",
      "duration": 时长(分钟),
      "content": "详细教学内容，按知识点分点展开，每个知识点2-3句话展开说明，总字数200-400字。\\n- 知识点1: 详细解释\\n- 知识点2: 详细解释\\n- 知识点3: 详细解释\\n用\\n换行分隔不同要点",
      "sub_points": ["子要点1（会独立成一页PPT）", "子要点2", "子要点3", "子要点4", "子要点5"],
      "needs_image": true,
      "image_prompt": "配图描述(用英文写，100-200词): 必须是Educational illustration风格的教学插图，清晰简洁、色彩柔和、适合课堂演示。要紧密贴合当前章节的具体教学内容，包含关键概念的可视化呈现。例: 'A clean educational diagram showing the self-attention mechanism in Transformer architecture. Left side shows three arrows labeled Q(Query), K(Key), V(Value) emerging from input embeddings. Center shows the scaled dot-product calculation formula softmax(QK^T/√dk)V. Right side shows attention weight heatmap with colored grid cells. Use soft blue and orange color scheme. White background, textbook illustration style.'"
    }}
  ]
}}

注意：
1. 至少输出6-8个sections，每个section包含4-6个sub_points
2. 每个section的content必须非常详细，至少200字，包含具体知识点和案例
3. sub_points是PPT每页的标题，必须是完整的句子
4. 总时长需等于{duration}，各section时长分配合理
5. needs_image为true的section需给出详细英文配图描述
6. 只输出JSON，不要其他内容，不要markdown代码块"""

# 学习评价生成提示词
EVALUATION_PROMPT = """你是一个教育评估专家。请根据学生的学习表现和对话历史，生成详细的评价报告。

## 学生信息
- 姓名：{student_name}
- 最近对话轮次：{conversation_count}

## 输出要求
请输出JSON格式：
{{
  "class_performance": {{
    "score": 92,
    "comment": "评价说明"
  }},
  "knowledge_mastery": {{
    "score": 85,
    "details": {{
      "知识点1": 95,
      "知识点2": 75
    }}
  }},
  "progress": {{
    "score_change": "+15",
    "comment": "进步说明"
  }},
  "suggestions": ["建议1", "建议2", "建议3"]
}}

注意：
1. 评分要客观、有依据
2. 建议要具体、可操作
3. 只输出JSON，不要其他内容"""

# 图像生成提示词模板
IMAGE_PROMPT_TEMPLATES = {
    "math": "Educational illustration for math topic: {topic}, clean style, colorful, suitable for middle school students",
    "physics": "Educational illustration for physics topic: {topic}, scientific diagram style, clear and informative",
    "chemistry": "Educational illustration for chemistry topic: {topic}, molecular structure or experiment scene, colorful",
    "programming": "Educational illustration for programming topic: {topic}, code visualization or flowchart, modern style"
}
