import time
from loguru import logger

from handlers.avatar.liteavatar.liteavatar_worker import LiteAvatarWorker, \
    Tts2FaceConfigModel, Tts2FaceEvent, WorkerStatus


class LiteAvatarWorkerManager:
    
    def __init__(self, concurrent_limit: int, handler_root: str, config: Tts2FaceConfigModel):
        self.cocurrent_limit = concurrent_limit
        self.handler_root = handler_root
        self.config = config
        self.lite_avatar_workers = []
        for _ in range(concurrent_limit):
            self.lite_avatar_workers.append(LiteAvatarWorker(handler_root, config))
            time.sleep(5)
    
    def start_worker(self):
        start_worker_time = time.time()
        logger.info(f'[TIMING] LiteAvatarWorkerManager.start_worker()开始 (time={start_worker_time})')
        for worker in self.lite_avatar_workers:
            if worker.get_status() == WorkerStatus.IDLE:
                worker.recruit()
                event_sent_time = time.time()
                logger.info(f'[TIMING] 发送Tts2FaceEvent.START事件 (time={event_sent_time})')
                worker.event_in_queue.put_nowait(Tts2FaceEvent.START)
                logger.info(f'[TIMING] LiteAvatarWorkerManager.start_worker()完成，耗时: {(time.time() - start_worker_time)*1000:.2f}ms')
                return worker
        logger.warning(f'[TIMING] LiteAvatarWorkerManager.start_worker()未找到可用worker')
        return None
    
    def destroy(self):
        logger.info("destroy LiteAvatarWorkerManager")
        for worker in self.lite_avatar_workers:
            worker.destroy()
