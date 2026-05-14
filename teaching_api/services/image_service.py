"""
图像生成服务 - 阿里百炼 qwen-image-plus（付费版，支持高并发）
"""
import os
import asyncio
import dashscope
from http import HTTPStatus
from dashscope import MultiModalConversation
from teaching_api.config import DASHSCOPE_API_KEY
from loguru import logger


class ImageService:
    """使用 qwen-image-plus 模型，通过 MultiModalConversation API 并发生成教学插图"""

    @staticmethod
    def _generate_sync(prompt: str, size: str = "1328*1328") -> dict:
        try:
            logger.info(f"[IMAGE] 开始生成: {prompt[:80]}...")
            response = MultiModalConversation.call(
                api_key=DASHSCOPE_API_KEY,
                model="qwen-image-plus-2026-01-09",
                messages=[{"role": "user", "content": [{"text": prompt}]}],
                result_format="message",
                stream=False,
                watermark=False,
                prompt_extend=True,
                size=size,
            )
            if response.status_code == HTTPStatus.OK:
                images = []
                for item in response.output.choices[0].message.content:
                    if isinstance(item, dict) and "image" in item:
                        images.append(item["image"])
                logger.info(f"[IMAGE] 生成成功: {len(images)} 张")
                return {"success": True, "images": images, "request_id": response.request_id}
            else:
                logger.error(f"[IMAGE] 生成失败: {response.code} - {response.message}")
                return {"success": False, "error": f"{response.code}: {response.message}"}
        except Exception as e:
            logger.error(f"[IMAGE] 异常: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def generate_image(prompt: str, size: str = "1328*1328") -> dict:
        return await asyncio.to_thread(ImageService._generate_sync, prompt, size)

    @staticmethod
    async def generate_images_batch(prompts: list, size: str = "1328*1328") -> dict:
        tasks = [ImageService.generate_image(p, size) for p in prompts]
        results = await asyncio.gather(*tasks)
        success_count = sum(1 for r in results if r.get("success"))
        logger.info(f"[IMAGE] 批量完成: {success_count}/{len(results)}")
        return {
            "success": success_count == len(results),
            "total": len(results),
            "success_count": success_count,
            "images": [r.get("images", [None])[0] if r.get("success") else None for r in results],
            "errors": [r.get("error") for r in results if not r.get("success")],
        }
