"""
LLM调用服务 - 阿里百炼qwen-max
"""
import os
import json
import re
from http import HTTPStatus
from dashscope import Generation
from teaching_api.config import DASHSCOPE_API_KEY, LLM_MODEL
from teaching_api.utils.prompts import (
    STUDENT_PROFILE_PROMPT,
    KNOWLEDGE_GRAPH_PROMPT,
    LESSON_OUTLINE_PROMPT,
    EVALUATION_PROMPT
)

class LLMService:
    @staticmethod
    async def generate_text(prompt: str, system_prompt: str = None, stream: bool = False) -> dict:
        """
        调用通义千问生成文本
        """
        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            response = Generation.call(
                api_key=DASHSCOPE_API_KEY,
                model=LLM_MODEL,
                messages=messages,
                result_format='message',
                stream=stream
            )
            
            if response.status_code == HTTPStatus.OK:
                return {
                    "success": True,
                    "text": response.output.choices[0].message.content,
                    "request_id": response.request_id
                }
            else:
                return {
                    "success": False,
                    "error": f"API调用失败: {response.code} - {response.message}",
                    "request_id": response.request_id
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _extract_json(text: str) -> dict:
        """从LLM输出中提取JSON"""
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                return None
        return None
    
    @staticmethod
    async def generate_student_profile(memory_context: str, conversation_history: list = []) -> dict:
        """
        生成学生学习画像
        """
        prompt = STUDENT_PROFILE_PROMPT.format(
            memory_context=memory_context,
            conversation_history=conversation_history
        )
        
        result = await LLMService.generate_text(prompt)
        
        if result.get("success"):
            json_data = LLMService._extract_json(result["text"])
            if json_data:
                result["data"] = json_data
        
        return result
    
    @staticmethod
    async def generate_knowledge_graph(subject: str, topic: str) -> dict:
        """
        生成知识图谱（提取知识点关系）
        """
        prompt = KNOWLEDGE_GRAPH_PROMPT.format(subject=subject, topic=topic)
        
        result = await LLMService.generate_text(prompt)
        
        if result.get("success"):
            json_data = LLMService._extract_json(result["text"])
            if json_data:
                result["data"] = json_data
        
        return result
    
    @staticmethod
    async def generate_lesson_outline(lesson_params: dict) -> dict:
        """
        生成教案提纲（第一阶段）
        """
        prompt = LESSON_OUTLINE_PROMPT.format(**lesson_params)
        
        result = await LLMService.generate_text(prompt)
        
        if result.get("success"):
            json_data = LLMService._extract_json(result["text"])
            if json_data:
                result["data"] = json_data
        
        return result
    
    @staticmethod
    async def generate_evaluation(student_name: str, conversation_history: list) -> dict:
        """
        生成学习评价报告
        """
        prompt = EVALUATION_PROMPT.format(
            student_name=student_name,
            conversation_count=len(conversation_history)
        )
        
        result = await LLMService.generate_text(prompt)
        
        if result.get("success"):
            json_data = LLMService._extract_json(result["text"])
            if json_data:
                result["data"] = json_data
        
        return result
