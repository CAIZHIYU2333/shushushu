import threading
import time
from typing import Dict
from loguru import logger
import numpy as np

from chat_engine.contexts.handler_context import HandlerContext
from chat_engine.contexts.session_context import SharedStates
from chat_engine.data_models.chat_data_type import ChatDataType
from chat_engine.data_models.runtime_data.data_bundle import DataBundle, DataBundleDefinition
from chat_engine.data_models.chat_data.chat_data_model import ChatData
from chat_engine.common.engine_channel_type import EngineChannelType
from handlers.avatar.liteavatar.liteavatar_worker import LiteAvatarWorker, Tts2FaceEvent


class HandlerTts2FaceContext(HandlerContext):
    def __init__(self,
                 session_id: str,
                 lite_avatar_worker: LiteAvatarWorker,
                 shared_status):
        super().__init__(session_id)
        self.lite_avatar_worker: LiteAvatarWorker = lite_avatar_worker
        self.shared_state: SharedStates = shared_status

        self.output_data_definitions: Dict[ChatDataType, DataBundleDefinition] = {}
        
        self.media_out_thread: threading.Thread = None
        self.event_out_thread: threading.Thread = None

        self.loop_running = True
        self.media_out_thread = threading.Thread(target=self._media_out_loop)
        self.media_out_thread.start()
        self.event_out_thread = threading.Thread(target=self._event_out_loop)
        self.event_out_thread.start()

    def return_data(self, data, chat_data_type: ChatDataType):
        definition = self.output_data_definitions.get(chat_data_type)
        if definition is None:
            return
        data_bundle = DataBundle(definition)
        if chat_data_type.channel_type == EngineChannelType.AUDIO:
            data_bundle.set_main_data(data.squeeze()[np.newaxis, ...])
        elif chat_data_type.channel_type == EngineChannelType.VIDEO:
            data_bundle.set_main_data(data[np.newaxis, ...])
        else:
            return
        chat_data = ChatData(type=chat_data_type, data=data_bundle)
        self.submit_data(chat_data)

    def _media_out_loop(self):
        while self.loop_running:
            no_output = True
            # get audio
            if self.lite_avatar_worker.audio_out_queue.qsize() > 0:
                no_output = False
                try:
                    if not hasattr(self, '_first_audio_logged'):
                        self._first_audio_received_time = time.time()
                        # 获取基准时间（如果存在）
                        base_time = getattr(self.lite_avatar_worker.processor, '_timing_base_time', None)
                        cumulative_delay = (self._first_audio_received_time - base_time) * 1000 if base_time else 0
                        logger.info(f'[TIMING] HandlerTts2FaceContext首次收到音频输出 (session={self.session_id}, 累计延迟: {cumulative_delay:.2f}ms)')
                        self._first_audio_logged = True
                    
                    audio_tensor = self.lite_avatar_worker.audio_out_queue.get_nowait()
                    audio = audio_tensor.numpy()
                    # self.rtc_audio_queue.put_nowait(audio)
                    self.return_data(audio, ChatDataType.AVATAR_AUDIO)
                    
                    if hasattr(self, '_first_audio_received_time') and not hasattr(self, '_first_audio_delay_logged'):
                        first_audio_delay = (time.time() - self._first_audio_received_time) * 1000
                        base_time = getattr(self.lite_avatar_worker.processor, '_timing_base_time', None)
                        cumulative_delay = (time.time() - base_time) * 1000 if base_time else 0
                        logger.info(f'[TIMING] HandlerTts2FaceContext首次音频输出完成，耗时: {first_audio_delay:.2f}ms, 累计延迟: {cumulative_delay:.2f}ms (session={self.session_id})')
                        self._first_audio_delay_logged = True
                    no_output = False
                except Exception:
                    pass
            # get video
            if self.lite_avatar_worker.video_out_queue.qsize() > 0:
                no_output = False
                try:
                    if not hasattr(self, '_first_video_logged'):
                        self._first_video_received_time = time.time()
                        base_time = getattr(self.lite_avatar_worker.processor, '_timing_base_time', None)
                        cumulative_delay = (self._first_video_received_time - base_time) * 1000 if base_time else 0
                        logger.info(f'[TIMING] HandlerTts2FaceContext首次收到视频输出 (session={self.session_id}, 累计延迟: {cumulative_delay:.2f}ms)')
                        self._first_video_logged = True
                    
                    video_tensor = self.lite_avatar_worker.video_out_queue.get_nowait()
                    video = video_tensor.numpy()
                    # self.rtc_video_queue.put_nowait(video)
                    self.return_data(video, ChatDataType.AVATAR_VIDEO)
                    
                    if hasattr(self, '_first_video_received_time') and not hasattr(self, '_first_video_delay_logged'):
                        first_video_delay = (time.time() - self._first_video_received_time) * 1000
                        base_time = getattr(self.lite_avatar_worker.processor, '_timing_base_time', None)
                        cumulative_delay = (time.time() - base_time) * 1000 if base_time else 0
                        logger.info(f'[TIMING] HandlerTts2FaceContext首次视频输出完成，耗时: {first_video_delay:.2f}ms, 累计延迟: {cumulative_delay:.2f}ms (session={self.session_id})')
                        # 输出延迟汇总
                        if base_time:
                            logger.info(f'[TIMING汇总] 从TTS首次音频数据到达 到 数字人首次开口说话 总延迟: {cumulative_delay:.2f}ms (session={self.session_id})')
                        self._first_video_delay_logged = True
                    no_output = False
                except Exception:
                    pass
            if no_output:
                time.sleep(0.05)
                continue
        logger.info("media out loop exit")

    def _event_out_loop(self):
        while self.loop_running:
            try:
                event: Tts2FaceEvent = self.lite_avatar_worker.event_out_queue.get(timeout=0.1)
                logger.info("receive output event: {}", event)
                if event == Tts2FaceEvent.SPEAKING_TO_LISTENING:
                    self.shared_state.enable_vad = True
            except Exception:
                continue
        logger.info("event out loop exit")
    
    def clear(self):
        logger.info("clear tts2face context")
        self.loop_running = False
        self.lite_avatar_worker.event_in_queue.put_nowait(Tts2FaceEvent.STOP)
        self.media_out_thread.join()
        self.event_out_thread.join()
        self.lite_avatar_worker.release()