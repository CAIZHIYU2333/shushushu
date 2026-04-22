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
LESSON_OUTLINE_PROMPT = """你是一个经验丰富的教研专家。请根据教学要求，生成结构化的教案提纲。

## 教学要求
- 教学目标：{objective}
- 学生水平：{level}
- 课时长度：{duration}
- 学科主题：{subject} - {topic}

## 输出要求
请输出JSON格式：
{{
  "title": "教案标题",
  "sections": [
    {{
      "name": "环节名称",
      "duration": 5,
      "content": "详细内容",
      "needs_image": true,
      "image_prompt": "如果需要配图，用英文描述配图内容，要具体详细"
    }}
  ]
}}

注意：
1. 包含导入、新知讲解、练习巩固、总结四个环节
2. 明确时间分配，总时长等于课时长度
3. 需要配图的环节要详细描述配图内容
4. 只输出JSON，不要其他内容"""

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
