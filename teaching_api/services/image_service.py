"""
图像生成服务 - 阿里通义万相
"""
import os
import dashscope
from http import HTTPStatus
from dashscope import ImageSynthesis
from teaching_api.config import DASHSCOPE_API_KEY

class ImageService:
    @staticmethod
    async def generate_image(prompt: str, size: str = "1024*1024") -> dict:
        """
        调用通义万相生成图像
        """
        try:
            response = ImageSynthesis.call(
                api_key=DASHSCOPE_API_KEY,
                model=ImageSynthesis.Models.wanx-v1,
                prompt=prompt,
                n=1,
                size=size
            )
            
            if response.status_code == HTTPStatus.OK:
                images = []
                for result in response.output.results:
                    images.append(result.url)
                
                return {
                    "success": True,
                    "images": images,
                    "request_id": response.request_id
                }
            else:
                return {
                    "success": False,
                    "error": f"图像生成失败: {response.code} - {response.message}",
                    "request_id": response.request_id
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def generate_images_batch(prompts: list, size: str = "1024*1024") -> dict:
        """
        批量并发生成图像
        """
        import asyncio
        
        tasks = [ImageService.generate_image(prompt, size) for prompt in prompts]
        results = await asyncio.gather(*tasks)
        
        success_count = sum(1 for r in results if r.get("success"))
        
        return {
            "success": success_count == len(results),
            "total": len(results),
            "success_count": success_count,
            "images": [r.get("images", [None])[0] if r.get("success") else None for r in results],
            "errors": [r.get("error") for r in results if not r.get("success")]
        }
