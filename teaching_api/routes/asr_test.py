"""
ASR语音识别测试端点
"""
import io
import numpy as np
from fastapi import APIRouter, UploadFile, File
from loguru import logger

router = APIRouter()


@router.post("/asr/test")
async def test_asr(file: UploadFile = File(...)):
    """上传音频文件测试ASR识别"""
    try:
        content = await file.read()
        # 尝试用wav读取
        try:
            import soundfile as sf
            audio, sr = sf.read(io.BytesIO(content))
            audio = audio.astype(np.float32)
            if sr != 16000:
                logger.warning(f"音频采样率 {sr} 不是16000, 将跳过ASR测试")
                return {"success": True, "message": f"音频已接收({sr}Hz, {len(audio)}帧), 但需要16kHz", "frames": len(audio), "sample_rate": sr}
        except:
            # 尝试作为原始PCM读取
            audio = np.frombuffer(content, dtype=np.int16).astype(np.float32) / 32767
            sr = 16000
        
        # 调用SenseVoice进行ASR
        from funasr import AutoModel
        model = AutoModel(model="iic/SenseVoiceSmall", disable_update=True)
        
        res = model.generate(input=audio, batch_size_s=10)
        text = res[0].get('text', '') if res else ''
        
        # 清理特殊标记
        import re
        clean_text = re.sub(r"<\|.*?\|>", "", text)
        
        return {
            "success": True,
            "recognized_text": clean_text,
            "raw_text": text,
            "audio_frames": len(audio),
            "sample_rate": sr,
            "duration_seconds": round(len(audio) / sr, 2)
        }
    except Exception as e:
        logger.error(f"ASR测试失败: {e}")
        return {"success": False, "error": str(e)}


@router.get("/asr/status")
async def asr_status():
    """检查ASR模型是否加载成功"""
    try:
        from funasr import AutoModel
        model = AutoModel(model="iic/SenseVoiceSmall", disable_update=True)
        # 用一小段静音测试
        test_audio = np.zeros(16000, dtype=np.float32)
        res = model.generate(input=test_audio, batch_size_s=10)
        return {
            "success": True,
            "model_loaded": True,
            "test_result": res[0].get('text', '') if res else 'empty'
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
