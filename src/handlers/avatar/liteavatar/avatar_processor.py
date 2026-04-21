
from fractions import Fraction
from queue import Queue
import sys
from threading import Thread
import threading
import time
from typing import List

import av
import cv2
from loguru import logger
import numpy as np
from handlers.avatar.liteavatar.algo.audio2signal_speed_limiter import Audio2SignalSpeedLimiter
from handlers.avatar.liteavatar.algo.base_algo_adapter import BaseAlgoAdapter
from handlers.avatar.liteavatar.media.speech_audio_aligner import SpeechAudioAligner
from handlers.avatar.liteavatar.media.speech_audio_processor import SpeechAudioProcessor
from handlers.avatar.liteavatar.avatar_output_handler import AvatarOutputHandler
from handlers.avatar.liteavatar.media.video_audio_aligner import VideoAudioAligner
from handlers.avatar.liteavatar.model.algo_model import (
    AvatarInitOption, AudioResult, AudioSlice, AvatarStatus, MouthResult, SignalResult, VideoResult)
from handlers.avatar.liteavatar.model.audio_input import SpeechAudio
from src.engine_utils.interval_counter import IntervalCounter


class AvatarProcessor:
    def __init__(self,
                 algo_adapter: BaseAlgoAdapter,
                 init_option: AvatarInitOption):
        
        ## TODO remove debugger logger
        logger.remove()
        logger.add(sys.stdout, level='INFO')

        logger.info("init avatar processor {}", init_option)
        self._output_handlers: List[AvatarOutputHandler] = []
        self._algo_adapter = algo_adapter
        self._init_option = init_option
        self._audio_slice_queue: Queue = None
        self._signal_queue: Queue = None
        self._mouth_img_queue: Queue = None
        self._speech_audio_processor: SpeechAudioProcessor = None

        # running context
        self._session_running = False
        self._audio2signal_thread: Thread = None
        self._signal2img_thread: Thread = None
        self._mouth2full_thread: Thread = None
        self._global_frame_count = 0
        self._current_audio_pts = 0     # in ms
        self._current_video_pts = 0
        self._last_speech_ended = True
        self._current_speech_id = ""
        self._session_start_time = 0
        self._callback_avatar_status: AvatarStatus = None

        # other helpers
        self._audio2signal_speed_limiter = None
        self._video_audio_aligner = None
        self._speech_audio_aligner = None

        # statistic counter
        self._audio2signal_counter = IntervalCounter("generate signal")
        self._callback_counter = IntervalCounter("avatar callback")

        # for debug
        self._debug_mode = init_option.debug

        self._init_algo()

    def start(self):
        start_time = time.time()
        logger.info(f'[TIMING] Avatar Processor start()开始 (session_start_time={start_time})')
        self._session_running = True
        self._callback_start()
        self._reset_processor_status()
        reset_time = time.time()
        logger.info(f'[TIMING] Avatar Processor _reset_processor_status()耗时: {(reset_time - start_time)*1000:.2f}ms')
        
        self._start_threads()
        threads_start_time = time.time()
        logger.info(f'[TIMING] Avatar Processor _start_threads()耗时: {(threads_start_time - reset_time)*1000:.2f}ms')
        
        self._session_start_time = time.time()
        self._audio2signal_counter = IntervalCounter("generate signal")
        self._callback_counter = IntervalCounter("avatar callback")
        logger.info(f'[TIMING] Avatar Processor start()总耗时: {(time.time() - start_time)*1000:.2f}ms')

    def stop(self):
        logger.info("stop avatar processor, totol session time {:.3f}",
                    time.time() - self._session_start_time)
        self._session_running = False
        self._callback_stop()
        if self._signal2img_thread is not None:
            self._signal2img_thread.join()
        if self._audio2signal_thread is not None:
            self._audio2signal_thread.join()
        if self._mouth2full_thread is not None:
            self._mouth2full_thread.join()
        logger.info("avatar processor stopped")

    def add_audio(self, speech_audio: SpeechAudio):
        audio_slices = self._speech_audio_processor.get_speech_audio_slice(speech_audio)
        for audio_slice in audio_slices:
            self._audio_slice_queue.put(audio_slice)

    def clear_output_handlers(self):
        self._output_handlers.clear()

    def register_output_handler(self,
                                avatar_output_handler: AvatarOutputHandler):
        self._output_handlers.append(avatar_output_handler)

    def interrupt(self):
        """
        clear input audio
        """
        if self._audio_slice_queue is not None:
            self._audio_slice_queue.queue.clear()

    def _audio2signal_loop(self):
        """
        generate signal for signal2img
        """
        audio2signal_start = time.time()
        logger.info(f'[TIMING] audio2signal loop线程启动 (time={audio2signal_start})')
        speech_id = ""
        audio_slice = None
        self._audio2signal_speed_limiter.start()
        target_round_time = 0.9
        first_audio_processed = False
        while self._session_running:
            loop_start = time.time()
            try:
                audio_slice: AudioSlice = self._audio_slice_queue.get(timeout=0.1)
                target_round_time = audio_slice.get_audio_duration() - 0.1
            except Exception:
                continue

            speech_id = audio_slice.speech_id
            if speech_id != self._current_speech_id:
                self._last_speech_ended = False
                self._current_speech_id = speech_id
            if audio_slice.end_of_speech:
                self._last_speech_ended = True

            if not first_audio_processed:
                first_audio_time = time.time()
                cumulative_delay = (first_audio_time - self._timing_base_time) * 1000 if hasattr(self, '_timing_base_time') else 0
                logger.info(f'[TIMING] audio2signal首次收到音频 (speech_id={speech_id}, audio_duration={audio_slice.get_audio_duration():.3f}s, 累计延迟: {cumulative_delay:.2f}ms)')
                first_audio_processed = True
                self._first_audio2signal_time = first_audio_time

            logger.info("audio2signal input audio durtaion {}", audio_slice.get_audio_duration())
            audio2signal_call_start = time.time()
            signal_vals = self._algo_adapter.audio2signal(audio_slice)
            audio2signal_call_time = (time.time() - audio2signal_call_start) * 1000
            
            if hasattr(self, '_first_audio2signal_time') and not hasattr(self, '_first_audio2signal_delay_logged'):
                first_audio2signal_delay = (time.time() - self._first_audio2signal_time) * 1000
                cumulative_delay = (time.time() - self._timing_base_time) * 1000 if hasattr(self, '_timing_base_time') else 0
                logger.info(f'[TIMING] audio2signal首次处理完成耗时: {first_audio2signal_delay:.2f}ms (audio2signal调用耗时: {audio2signal_call_time:.2f}ms, 累计延迟: {cumulative_delay:.2f}ms)')
                self._first_audio2signal_delay_logged = True
            avatar_status = AvatarStatus.SPEAKING

            self._speech_audio_aligner.add_audio(audio_slice.play_audio_data, speech_id)

            # remove front padding audio and relative frames
            front_padding_duration = audio_slice.front_padding_duration
            target_round_time = audio_slice.get_audio_duration() - front_padding_duration - 0.1
            padding_frame_count = int(front_padding_duration * self._init_option.video_frame_rate)
            signal_vals = signal_vals[padding_frame_count:]
            padding_audio_count = int(front_padding_duration) * self._init_option.audio_sample_rate * 2
            audio_slice.play_audio_data = audio_slice.play_audio_data[padding_audio_count:]

            # audio_slice.play_audio_data = self._video_audio_aligner.get_speech_level_algined_audio(
            #     audio_slice.play_audio_data, audio_slice.play_audio_sample_rate, len(signal_vals),
            #     audio_slice.speech_id, audio_slice.end_of_speech)

            for i, signal in enumerate(signal_vals):
                frame_end_of_speech = audio_slice.end_of_speech and i == len(signal_vals) - 1
                audio_slice = self._speech_audio_aligner.get_speech_level_algined_audio(end_of_speech=frame_end_of_speech)
                middle_result = SignalResult(
                    speech_id=speech_id,
                    end_of_speech=frame_end_of_speech,
                    middle_data=signal,
                    frame_id=i,
                    global_frame_id=self._global_frame_count,
                    avatar_status=avatar_status,
                    audio_slice=audio_slice,
                )
                self._audio2signal_counter.add()
                self._signal_queue.put_nowait(middle_result)
            cost = time.time() - loop_start
            sleep_time = target_round_time - cost
            if sleep_time > 0:
                time.sleep(sleep_time)
        logger.info("audio2signal loop stopped")

    def _signal2img_loop(self):
        """
        generate image and do callbacks
        """
        signal2img_start = time.time()
        logger.info(f'[TIMING] signal2img loop线程启动 (time={signal2img_start})')
        start_time = -1
        timestamp = 0
        
        # delay start to ensure no extra audio and video generated
        delay_start = time.time()
        logger.info(f'[TIMING] signal2img loop开始0.5秒延迟 (这是固定延迟，每次会话都有)')
        time.sleep(0.5)
        delay_end = time.time()
        logger.info(f'[TIMING] signal2img loop延迟结束，实际延迟: {(delay_end - delay_start)*1000:.2f}ms')
        
        while self._session_running:
            if self._signal_queue.empty():
                # generate idle
                signal_val = self._algo_adapter.get_idle_signal(1)[0]
                avatar_status = AvatarStatus.LISTENING if self._last_speech_ended else AvatarStatus.SPEAKING
                signal = SignalResult(
                    speech_id=self._current_speech_id,
                    end_of_speech=False,
                    middle_data=signal_val,
                    frame_id=0,
                    avatar_status=avatar_status,
                    audio_slice=self._get_idle_audio_slice(1)
                )
            else:
                signal: SignalResult = self._signal_queue.get_nowait()

            out_image, bg_frame_id = self._algo_adapter.signal2img(signal.middle_data, signal.avatar_status)
            # create mouth result
            mouth_result = MouthResult(
                speech_id=signal.speech_id,
                mouth_image=out_image,
                bg_frame_id=bg_frame_id,
                end_of_speech=signal.end_of_speech,
                avatar_status=signal.avatar_status,
                audio_slice=signal.audio_slice,
                global_frame_id=self._global_frame_count
            )
            
            self._global_frame_count += 1

            self._mouth_img_queue.put(mouth_result)
            self._callback_counter.add_property("signal2img")

            if start_time == -1:
                start_time = time.time()
                timestamp = 0
            else:
                timestamp += 1 / self._init_option.video_frame_rate
                wait = start_time + timestamp - time.time()
                if wait > 0:
                    time.sleep(wait)

        logger.info("signal2img loop ended")

    def _mouth2full_loop(self):
        mouth2full_start = time.time()
        logger.info(f'[TIMING] mouth2full loop线程启动 (time={mouth2full_start})')
        first_video_generated = False
        while self._session_running:
            try:
                mouth_reusult: MouthResult = self._mouth_img_queue.get(timeout=0.1)
            except Exception:
                continue
            
            if not first_video_generated:
                first_video_time = time.time()
                cumulative_delay = (first_video_time - self._timing_base_time) * 1000 if hasattr(self, '_timing_base_time') else 0
                logger.info(f'[TIMING] mouth2full首次收到mouth_result (global_frame_id={mouth_reusult.global_frame_id}, 累计延迟: {cumulative_delay:.2f}ms)')
                first_video_generated = True
                self._first_video_generation_start = first_video_time
            
            image = mouth_reusult.mouth_image
            bg_frame_id = mouth_reusult.bg_frame_id
            mouth2full_start_time = time.time()
            full_img = self._algo_adapter.mouth2full(image, bg_frame_id)
            mouth2full_time = (time.time() - mouth2full_start_time) * 1000
            
            if mouth_reusult.audio_slice is not None:
                # create audio result
                audio_data = mouth_reusult.audio_slice.play_audio_data
                audio_frame = av.AudioFrame.from_ndarray(
                    np.frombuffer(audio_data, dtype=np.int16).reshape(1, -1),
                    format="s16",
                    layout="mono"
                )
                audio_time_base = Fraction(1, self._init_option.audio_sample_rate)
                audio_frame.time_base = audio_time_base
                audio_frame.pts = self._current_audio_pts
                audio_frame.sample_rate = mouth_reusult.audio_slice.play_audio_sample_rate
                self._current_audio_pts += len(audio_data) // 2

                audio_result = AudioResult(
                    audio_frame=audio_frame,
                    speech_id=mouth_reusult.audio_slice.speech_id
                )
                self._callback_audio(audio_result)
                logger.debug("create audio with duration {:.3f}s, status: {}",
                             mouth_reusult.audio_slice.get_audio_duration(), mouth_reusult.avatar_status)
            # create video result
            if self._debug_mode:
                full_img = cv2.putText(
                    full_img, f"{mouth_reusult.avatar_status} {mouth_reusult.global_frame_id}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            full_img = cv2.flip(full_img, 1)
            video_frame = av.VideoFrame.from_ndarray(full_img, format="bgr24")
            video_frame.time_base = Fraction(1, self._init_option.video_frame_rate)
            video_frame.pts = self._current_video_pts
            self._current_video_pts += 1

            image_result = VideoResult(
                video_frame=video_frame,
                speech_id=mouth_reusult.speech_id,
                avatar_status=mouth_reusult.avatar_status,
                end_of_speech=mouth_reusult.end_of_speech,
                bg_frame_id=bg_frame_id
            )

            if hasattr(self, '_first_video_generation_start') and not hasattr(self, '_first_video_generation_delay_logged'):
                first_video_delay = (time.time() - self._first_video_generation_start) * 1000
                cumulative_delay = (time.time() - self._timing_base_time) * 1000 if hasattr(self, '_timing_base_time') else 0
                logger.info(f'[TIMING] mouth2full首次视频生成完成，总耗时: {first_video_delay:.2f}ms (mouth2full调用耗时: {mouth2full_time:.2f}ms, 累计延迟: {cumulative_delay:.2f}ms, global_frame_id={mouth_reusult.global_frame_id})')
                self._first_video_generation_delay_logged = True

            self._callback_image(image_result)
            
            if self._callback_avatar_status != image_result.avatar_status and self._callback_avatar_status is not None:
                self._callback_avatar_status_changed(mouth_reusult.speech_id, image_result.avatar_status)
            self._callback_avatar_status = image_result.avatar_status
            
        logger.info("combine img loop ended")

    def _reset_processor_status(self):
        self._audio_slice_queue = Queue()
        self._signal_queue = Queue()
        self._mouth_img_queue = Queue()
        algo_config = self._algo_adapter.get_algo_config()
        self._speech_audio_processor = SpeechAudioProcessor(
            self._init_option.audio_sample_rate,
            algo_config.input_audio_sample_rate,
            algo_config.input_audio_slice_duration,
            enable_fast_mode=self._init_option.enable_fast_mode
        )
        self._audio2signal_speed_limiter = Audio2SignalSpeedLimiter(self._init_option.video_frame_rate)
        self._video_audio_aligner = VideoAudioAligner(self._init_option.video_frame_rate)
        self._speech_audio_aligner = SpeechAudioAligner(self._init_option.video_frame_rate, self._init_option.audio_sample_rate)

    def _init_algo(self):
        init_algo_start = time.time()
        logger.info(f'[TIMING] Avatar Processor _init_algo()开始 (time={init_algo_start})')
        self._algo_adapter.init(self._init_option)
        init_algo_time = (time.time() - init_algo_start) * 1000
        logger.info(f'[TIMING] Avatar Processor _init_algo()完成，耗时: {init_algo_time:.2f}ms')

    def _start_threads(self):
        self._audio2signal_thread = threading.Thread(target=self._audio2signal_loop)
        self._audio2signal_thread.start()
        self._signal2img_thread = threading.Thread(target=self._signal2img_loop)
        self._signal2img_thread.start()
        self._mouth2full_thread = threading.Thread(target=self._mouth2full_loop)
        self._mouth2full_thread.start()

    def _callback_image(self, image_result: VideoResult):
        self._callback_counter.add_property("image_callback")
        if self._session_running:
            for output_handler in self._output_handlers:
                output_handler.on_video(image_result)

    def _callback_audio(self, audio_result: AudioResult):
        audio_frame = audio_result.audio_frame
        self._callback_counter.add_property("audio_callback", audio_frame.samples / audio_frame.sample_rate)
        if self._session_running:
            for output_handler in self._output_handlers:
                output_handler.on_audio(audio_result)

    def _callback_start(self):
        for output_handler in self._output_handlers:
            output_handler.on_start(self._init_option)

    def _callback_stop(self):
        for output_handler in self._output_handlers:
            output_handler.on_stop()

    def _callback_avatar_status_changed(self, speech_id, avatar_status: AvatarStatus):
        for output_handler in self._output_handlers:
            output_handler.on_avatar_status_change(speech_id, avatar_status)
            
    def _get_idle_audio_slice(self, idle_frame_count):
        speech_id = "" if self._last_speech_ended else self._current_speech_id
        # generate silence audio
        frame_rate = self._init_option.video_frame_rate
        play_audio_sample_rate = self._init_option.audio_sample_rate
        idle_duration_seconds = idle_frame_count / frame_rate
        idle_data_length = int(2 * idle_duration_seconds * play_audio_sample_rate)
        idle_audio_data = bytes(idle_data_length)
        idle_audio_slice = AudioSlice(
            speech_id=speech_id,
            play_audio_data=idle_audio_data,
            play_audio_sample_rate=play_audio_sample_rate,
            algo_audio_data=None,
            algo_audio_sample_rate=0,
            end_of_speech=False
        )
        return idle_audio_slice
