// AI虚拟形象聊天系统 - 前端JavaScript
class AvatarChatApp {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.localStream = null;
        this.peerConnection = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.isConnected = false;
        this.sessionStartTime = null;
        this.devices = {
            audio: [],
            video: []
        };
        
        this.init();
    }

    async init() {
        try {
            this.showLoading(true);
            await this.initializeSocket();
            await this.loadDevices();
            await this.fetchServerConfig();
            this.initAvatarVideo();
            this.loadSettings();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.showLoading(false);
            this.showNotification('系统初始化完成', 'success');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('系统初始化失败: ' + error.message, 'error');
            this.showLoading(false);
        }
    }

    // 读取后端配置并展示数字人信息
    async fetchServerConfig() {
        try {
            const resp = await fetch('/api/config');
            this.serverConfig = await resp.json();
            this.updateAvatarDisplayFromConfig();
            
            // 获取TTS信息
            await this.fetchTTSInfo();
        } catch (e) {
            console.error('获取配置失败', e);
        }
    }

    // 获取TTS配置信息
    async fetchTTSInfo() {
        try {
            const resp = await fetch('/api/tts/info');
            const ttsInfo = await resp.json();
            console.log('TTS配置信息:', ttsInfo);
            
            if (ttsInfo.has_dashscope && ttsInfo.has_api_key) {
                this.showNotification(`语音合成: ${ttsInfo.tts_model} (${ttsInfo.tts_voice})`, 'info');
            } else {
                this.showNotification('警告: TTS配置不完整，语音合成可能不可用', 'warning');
            }
        } catch (e) {
            console.error('获取TTS信息失败', e);
        }
    }

    updateAvatarDisplayFromConfig() {
        try {
            if (!this.serverConfig) return;
            
            const avatarConfig = this.serverConfig.default?.chat_engine?.handler_configs?.LiteAvatar;
            if (avatarConfig) {
                const avatarName = avatarConfig.avatar_name || 'LiteAvatar';
                const fps = avatarConfig.fps || 20;
                const useGpu = avatarConfig.use_gpu ? 'GPU加速' : 'CPU模式';
                
                // 更新数字人信息显示
                const avatarNameEl = document.querySelector('.avatar-name');
                const avatarStatusEl = document.getElementById('avatarStatus');
                if (avatarNameEl) avatarNameEl.textContent = avatarName;
                if (avatarStatusEl) {
                    const statusText = `FPS: ${fps} | ${useGpu}`;
                    avatarStatusEl.textContent = statusText;
                    avatarStatusEl.setAttribute('data-original-text', statusText);
                }
            }
        } catch (e) {
            console.error('更新数字人显示失败', e);
        }
    }

    // 初始化数字人视频流
    initAvatarVideo() {
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarLoading = document.getElementById('avatarLoading');
        
        if (avatarVideo) {
            avatarVideo.onload = () => {
                console.log('数字人视频流加载成功');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
            
            avatarVideo.onerror = () => {
                console.error('数字人视频流加载失败');
                this.showNotification('数字人视频流加载失败', 'error');
            };
        }
    }

    // Socket.IO 连接管理
    async initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
            this.updateConnectionStatus('已连接', true);
            this.createSession();
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket连接断开');
            this.updateConnectionStatus('连接断开', false);
            this.isConnected = false;
        });

        this.socket.on('connected', (data) => {
            console.log('服务器确认连接:', data);
        });

        this.socket.on('session_started', (data) => {
            console.log('会话开始:', data);
            this.sessionId = data.session_id;
            this.updateSessionInfo();
            this.showNotification('会话已创建', 'success');
        });

        this.socket.on('speech_result', (data) => {
            console.log('语音识别结果:', data);
            this.handleSpeechResult(data);
        });

        this.socket.on('chat_response', (data) => {
            console.log('AI响应:', data);
            this.handleChatResponse(data);
        });

        // 流式增量
        this.socket.on('chat_stream', (data) => {
            try {
                if (!data || !data.delta) return;
                // 在消息区更新最后一条 AI 消息，或新建一条进行流式呈现
                const chatMessages = document.getElementById('chatMessages');
                let lastAi = Array.from(chatMessages.querySelectorAll('.message.ai')).pop();
                if (!lastAi) {
                    this.addMessage('ai', data.delta);
                } else {
                    const textDiv = lastAi.querySelector('.message-text');
                    textDiv.textContent = (textDiv.textContent || '') + data.delta;
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } catch (e) {
                console.warn('处理chat_stream失败', e);
            }
        });

        // 流式结束标记
        this.socket.on('chat_stream_end', (data) => {
            try {
                console.log('流式输出结束');
                // 可以在这里添加流式结束后的处理逻辑
            } catch (e) {
                console.warn('处理chat_stream_end失败', e);
            }
        });

        // 服务端TTS音频（wav base64）
        this.socket.on('tts_audio', (data) => {
            try {
                if (!data || !data.audio_wav_base64) return;
                const wav = atob(data.audio_wav_base64);
                const bytes = new Uint8Array(wav.length);
                for (let i = 0; i < wav.length; i++) bytes[i] = wav.charCodeAt(i);
                const blob = new Blob([bytes.buffer], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.play().catch(() => {});
            } catch (e) {
                console.warn('播放TTS失败', e);
            }
        });

        this.socket.on('error', (data) => {
            console.error('服务器错误:', data);
            this.showNotification('服务器错误: ' + data.message, 'error');
        });
    }

    // 创建会话
    async createSession() {
        try {
            const response = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            this.sessionId = data.session_id;
            this.updateSessionInfo();
            
            // 通知服务器开始会话
            this.socket.emit('start_session', { session_id: this.sessionId });
        } catch (error) {
            console.error('创建会话失败:', error);
            this.showNotification('创建会话失败', 'error');
        }
    }

    // 设备管理
    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            this.devices.audio = devices.filter(device => device.kind === 'audioinput');
            this.devices.video = devices.filter(device => device.kind === 'videoinput');
            
            this.populateDeviceSelectors();
        } catch (error) {
            console.error('加载设备失败:', error);
            this.showNotification('无法访问设备', 'error');
        }
    }

    populateDeviceSelectors() {
        const audioSelect = document.getElementById('audioDevice');
        const videoSelect = document.getElementById('videoDevice');
        
        // 清空现有选项
        audioSelect.innerHTML = '<option value="">自动选择</option>';
        videoSelect.innerHTML = '<option value="">自动选择</option>';
        
        // 添加音频设备
        this.devices.audio.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `麦克风 ${device.deviceId.slice(0, 8)}`;
            audioSelect.appendChild(option);
        });
        
        // 添加视频设备
        this.devices.video.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `摄像头 ${device.deviceId.slice(0, 8)}`;
            videoSelect.appendChild(option);
        });
    }

    // 媒体流管理
    async startLocalStream() {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 24000,
                    sampleSize: 16,
                    channelCount: 1
                },
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // 显示本地视频
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            const avatarVideo = document.getElementById('avatarVideo');
            
            localVideo.srcObject = this.localStream;
            localVideoWrapper.style.display = 'block';
            avatarVideo.style.display = 'none';
            
            this.setupAudioAnalysis();
            this.showNotification('摄像头和麦克风已启动', 'success');
            
            return this.localStream;
        } catch (error) {
            console.error('启动媒体流失败:', error);
            this.showNotification('无法访问摄像头或麦克风', 'error');
            throw error;
        }
    }

    async stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            
            // 隐藏本地视频，显示数字人
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            const avatarVideo = document.getElementById('avatarVideo');
            
            localVideo.srcObject = null;
            localVideoWrapper.style.display = 'none';
            avatarVideo.style.display = 'block';
        }
    }

    // 音频分析
    setupAudioAnalysis() {
        if (!this.localStream) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.localStream);
        this.analyser = this.audioContext.createAnalyser();
        
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        
        this.startAudioVisualization();
    }

    startAudioVisualization() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const updateVisualization = () => {
            if (!this.analyser) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // 计算音量级别
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const volume = average / 255;
            
            // 更新语音按钮状态
            this.updateVoiceButton(volume);
            
            requestAnimationFrame(updateVisualization);
        };
        
        updateVisualization();
    }

    updateVoiceButton(volume) {
        const voiceBtn = document.getElementById('voiceBtn');
        if (volume > 0.1) {
            voiceBtn.style.transform = `scale(${1 + volume * 0.2})`;
        } else {
            voiceBtn.style.transform = 'scale(1)';
        }
    }

    // 语音录制
    startVoiceRecording() {
        if (!this.localStream || this.isRecording) return;
        
        try {
            this.isRecording = true;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (!audioTrack) throw new Error('未检测到音频轨');

            // 仅使用音频轨，避免浏览器报错（音频容器不接受视频轨）
            const audioStream = new MediaStream([audioTrack]);
            const mimeCandidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg'
            ];
            let chosen = '';
            if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function') {
                chosen = mimeCandidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
            }
            const options = chosen ? { mimeType: chosen } : undefined;
            this.mediaRecorder = new MediaRecorder(audioStream, options);
            
            const audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await this.sendAudioData(audioBlob);
            };
            
            this.mediaRecorder.start();
            
            // 更新UI状态
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            
            this.showVoiceStatus('正在录音...', true);
            
        } catch (error) {
            console.error('开始录音失败:', error);
            this.showNotification('录音失败', 'error');
            this.stopVoiceRecording();
        }
    }

    stopVoiceRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        // 更新UI状态
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        
        this.hideVoiceStatus();
    }

    async sendAudioData(audioBlob) {
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            
            this.socket.emit('audio_data', {
                session_id: this.sessionId,
                audio_data: base64Audio
            });
            
            this.showNotification('音频已发送', 'info');
        } catch (error) {
            console.error('发送音频失败:', error);
            this.showNotification('发送音频失败', 'error');
        }
    }

    // 聊天消息处理
    sendChatMessage(message) {
        if (!message.trim() || !this.sessionId) return;
        
        // 添加用户消息到聊天界面
        this.addMessage('user', message);
        
        // 发送到服务器
        this.socket.emit('chat_message', {
            session_id: this.sessionId,
            message: message
        });
        
        // 清空输入框
        document.getElementById('messageInput').value = '';
    }

    handleSpeechResult(data) {
        if (data.recognized_text) {
            this.addMessage('user', data.recognized_text, '语音识别');
        }
        
        if (data.ai_response) {
            this.addMessage('ai', data.ai_response);
            this.playAvatarAnimation(data.avatar_animation);
            // 不再使用浏览器TTS，等待服务端TTS音频
        }
    }

    handleChatResponse(data) {
        if (data.ai_response) {
            this.addMessage('ai', data.ai_response);
            this.playAvatarAnimation(data.avatar_animation);
            // 不再使用浏览器TTS，等待服务端TTS音频
        }
    }
    

    addMessage(type, content, source = '') {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type} fade-in`;
        
        const time = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${type === 'user' ? 'user' : 'robot'}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${content}</div>
                <div class="message-time">
                    ${time}${source ? ` · ${source}` : ''}
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 移除欢迎消息
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
    }

    // 虚拟形象动画
    playAvatarAnimation(animation) {
        if (!animation) return;
        
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarStatus = document.getElementById('avatarStatus');
        
        if (avatarVideo) {
            // 添加说话动画效果
            avatarVideo.style.filter = 'brightness(1.1) contrast(1.1)';
            avatarVideo.style.transform = 'scale(1.02)';
            
            setTimeout(() => {
                avatarVideo.style.filter = '';
                avatarVideo.style.transform = '';
            }, 1000);
        }
        
        if (avatarStatus) {
            avatarStatus.textContent = '正在说话...';
            avatarStatus.style.color = '#10b981';
            
            setTimeout(() => {
                avatarStatus.textContent = avatarStatus.getAttribute('data-original-text') || '准备就绪';
                avatarStatus.style.color = '';
            }, 2000);
        }
        
        console.log('播放虚拟形象动画:', animation);
    }

    // 录音状态展示
    showVoiceStatus(text) {
        try {
            let el = document.getElementById('voiceStatus');
            if (!el) {
                el = document.createElement('div');
                el.id = 'voiceStatus';
                el.style.position = 'fixed';
                el.style.right = '16px';
                el.style.bottom = '80px';
                el.style.zIndex = '9999';
                el.style.background = 'rgba(0,0,0,0.7)';
                el.style.color = '#fff';
                el.style.padding = '8px 12px';
                el.style.borderRadius = '8px';
                el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
                document.body.appendChild(el);
            }
            el.textContent = text || '正在录音...';
            el.style.display = 'block';
        } catch (e) {
            // 忽略展示失败
        }
    }

    hideVoiceStatus() {
        try {
            const el = document.getElementById('voiceStatus');
            if (el) el.style.display = 'none';
        } catch (e) {
            // 忽略隐藏失败
        }
    }

    // 浏览器端TTS朗读
    speak(text) {
        try {
            if (!window.speechSynthesis) return;
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            utter.rate = 1.0;
            utter.pitch = 1.0;
            const voices = window.speechSynthesis.getVoices() || [];
            const zhVoice = voices.find(v => /zh|Chinese|中文/i.test(v.lang || v.name || ''));
            if (zhVoice) utter.voice = zhVoice;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            console.warn('TTS失败', e);
        }
    }

    // 事件监听器设置
    setupEventListeners() {
        // 开始对话按钮
        const avatarToggle = document.getElementById('avatarToggle');
        avatarToggle.addEventListener('click', async () => {
            try {
                if (!this.localStream) {
                    this.showButtonFeedback(avatarToggle, '正在启动摄像头和麦克风...', 'info');
                    await this.startLocalStream();
                    avatarToggle.innerHTML = '<i class="fas fa-pause"></i><span>停止对话</span>';
                    avatarToggle.classList.add('active');
                    this.showButtonFeedback(avatarToggle, '对话已开始，可以开始语音或文字交流', 'success');
                } else {
                    this.showButtonFeedback(avatarToggle, '正在停止对话...', 'info');
                    await this.stopLocalStream();
                    avatarToggle.innerHTML = '<i class="fas fa-play"></i><span>开始对话</span>';
                    avatarToggle.classList.remove('active');
                    this.showButtonFeedback(avatarToggle, '对话已停止', 'success');
                }
            } catch (error) {
                console.error('切换对话状态失败:', error);
                this.showButtonFeedback(avatarToggle, '启动失败: ' + error.message, 'error');
            }
        });

        // 麦克风控制
        const micToggle = document.getElementById('micToggle');
        micToggle.addEventListener('click', () => {
            if (this.localStream) {
                const audioTrack = this.localStream.getAudioTracks()[0];
                audioTrack.enabled = !audioTrack.enabled;
                micToggle.classList.toggle('inactive');
                micToggle.classList.toggle('active');
                
                const status = audioTrack.enabled ? '已开启' : '已关闭';
                this.showButtonFeedback(micToggle, `麦克风${status}`, 'success');
            } else {
                this.showButtonFeedback(micToggle, '请先开始对话', 'warning');
            }
        });

        // 摄像头控制
        const cameraToggle = document.getElementById('cameraToggle');
        cameraToggle.addEventListener('click', () => {
            if (this.localStream) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                videoTrack.enabled = !videoTrack.enabled;
                cameraToggle.classList.toggle('inactive');
                cameraToggle.classList.toggle('active');
                
                const status = videoTrack.enabled ? '已开启' : '已关闭';
                this.showButtonFeedback(cameraToggle, `摄像头${status}`, 'success');
            } else {
                this.showButtonFeedback(cameraToggle, '请先开始对话', 'warning');
            }
        });

        // 语音按钮
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.addEventListener('mousedown', () => {
            this.startVoiceRecording();
        });
        
        voiceBtn.addEventListener('mouseup', () => {
            this.stopVoiceRecording();
        });
        
        voiceBtn.addEventListener('mouseleave', () => {
            this.stopVoiceRecording();
        });

        // 发送按钮
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.addEventListener('click', () => {
            const messageInput = document.getElementById('messageInput');
            this.sendChatMessage(messageInput.value);
        });

            // 清空聊天
    const clearChat = document.getElementById('clearChat');
    clearChat.addEventListener('click', () => {
        // 停止所有正在播放的音频
        this.stopAllAudio();
        
        // 清空聊天记录
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="welcome-content">
                    <h4>欢迎使用AI数字人助手</h4>
                    <p>我是您的智能助手，可以回答各种问题、提供帮助和建议。</p>
                    <p>点击"开始对话"按钮，让我们开始交流吧！</p>
                </div>
            </div>
        `;
        
        // 重置数字人状态
        const avatarStatus = document.getElementById('avatarStatus');
        if (avatarStatus && avatarStatus.getAttribute('data-original-text')) {
            avatarStatus.textContent = avatarStatus.getAttribute('data-original-text');
            avatarStatus.style.color = '';
        }
        
        this.showNotification('聊天记录已清空', 'info');
    });

        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');

        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('show');
        });

        [closeSettings, cancelSettings].forEach(btn => {
            btn.addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });
        });

        saveSettings.addEventListener('click', () => {
            this.saveSettings();
            settingsModal.classList.remove('show');
        });

        // 帮助按钮
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeHelp = document.getElementById('closeHelp');

        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('show');
        });

        closeHelp.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });

        // 模态框背景点击关闭
        [settingsModal, helpModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    // 键盘快捷键
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl + Enter 发送消息
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                const messageInput = document.getElementById('messageInput');
                this.sendChatMessage(messageInput.value);
            }
            
            // Space 按住说话
            if (e.key === ' ' && !e.repeat) {
                e.preventDefault();
                this.startVoiceRecording();
            }
            
            // Esc 关闭模态框
            if (e.key === 'Escape') {
                document.getElementById('settingsModal').classList.remove('show');
                document.getElementById('helpModal').classList.remove('show');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                this.stopVoiceRecording();
            }
        });
    }

    // 设置管理
    saveSettings() {
        const settings = {
            audioDevice: document.getElementById('audioDevice').value,
            videoDevice: document.getElementById('videoDevice').value,
            avatarType: document.getElementById('avatarType').value,
            avatarModel: document.getElementById('avatarModel').value,
            aiModel: document.getElementById('aiModel').value
        };
        
        localStorage.setItem('avatarChatSettings', JSON.stringify(settings));
        
        // 如果改变了数字人形象，需要重新加载
        if (settings.avatarModel !== this.currentAvatarModel) {
            this.currentAvatarModel = settings.avatarModel;
            this.switchAvatarModel(settings.avatarModel);
        }
        
        this.showNotification('设置已保存', 'success');
    }

    loadSettings() {
        const saved = localStorage.getItem('avatarChatSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            document.getElementById('audioDevice').value = settings.audioDevice || '';
            document.getElementById('videoDevice').value = settings.videoDevice || '';
            document.getElementById('avatarType').value = settings.avatarType || 'liteavatar';
            document.getElementById('avatarModel').value = settings.avatarModel || '20250408/sample_data';
            document.getElementById('aiModel').value = settings.aiModel || 'bailian';
            
            this.currentAvatarModel = settings.avatarModel || '20250408/sample_data';
        }
    }

    // 切换数字人形象
    async switchAvatarModel(modelName) {
        try {
            this.showNotification('正在切换数字人形象...', 'info');
            
            // 发送切换请求到后端
            const response = await fetch('/api/avatar/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_name: modelName
                })
            });
            
            if (response.ok) {
                this.showNotification(`数字人形象已切换为: ${modelName}`, 'success');
                // 重新加载数字人视频流
                this.reloadAvatarVideo();
            } else {
                this.showNotification('切换数字人形象失败', 'error');
            }
        } catch (error) {
            console.error('切换数字人形象失败:', error);
            this.showNotification('切换数字人形象失败: ' + error.message, 'error');
        }
    }

    // 重新加载数字人视频
    reloadAvatarVideo() {
        const avatarVideo = document.getElementById('avatarVideo');
        if (avatarVideo) {
            // 添加时间戳避免缓存
            const timestamp = new Date().getTime();
            avatarVideo.src = `/avatar/video_feed?t=${timestamp}`;
        }
    }

    // UI 更新函数
    updateConnectionStatus(status, connected) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionInfo = document.getElementById('connectionInfo');
        
        connectionStatus.innerHTML = `
            <i class="fas fa-circle ${connected ? 'connected' : ''}"></i>
            <span>${status}</span>
        `;
        
        connectionInfo.textContent = `连接状态: ${status}`;
    }

    updateSessionInfo() {
        const sessionIdElement = document.getElementById('sessionId');
        const sessionTimeElement = document.getElementById('sessionTime');
        
        if (this.sessionId) {
            sessionIdElement.textContent = `会话ID: ${this.sessionId.slice(0, 8)}...`;
        }
        
        if (this.sessionStartTime) {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            sessionTimeElement.textContent = `会话时间: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // 通知系统
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
        }, duration - 500);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }

    // 按钮点击反馈
    showButtonFeedback(button, message, type = 'success') {
        // 添加点击动画
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
        
        // 显示反馈消息
        this.showNotification(message, type, 2000);
    }

    // 加载状态管理
    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // 错误处理
    handleError(error, context = '') {
        console.error(`错误 [${context}]:`, error);
        this.showNotification(`操作失败: ${error.message}`, 'error');
    }

    // 停止所有音频播放
    stopAllAudio() {
        // 停止所有HTML5音频元素
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // 停止语音合成
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        // 停止录音
        if (this.isRecording) {
            this.stopVoiceRecording();
        }
    }

    // 清理资源
    cleanup() {
        this.stopAllAudio();
        this.stopLocalStream();
        if (this.socket) {
            this.socket.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.avatarChatApp = new AvatarChatApp();
    
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        if (window.avatarChatApp) {
            window.avatarChatApp.cleanup();
        }
    });
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (window.avatarChatApp) {
        window.avatarChatApp.showNotification('发生未知错误，请刷新页面', 'error');
    }
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (window.avatarChatApp) {
        window.avatarChatApp.showNotification('网络连接异常，请检查网络', 'error');
    }
});
        
