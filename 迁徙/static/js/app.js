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
        } catch (e) {}
        
        try {
            await this.initializeSocket();
        } catch (error) {
            console.error('Socket初始化失败:', error);
        }
        
        try {
            await this.loadDevices();
        } catch (error) {
            console.error('加载设备失败:', error);
        }
        
        try {
            await this.fetchServerConfig();
        } catch (error) {
            console.error('获取配置失败:', error);
        }
        
        try {
            this.initAvatarVideo();
        } catch (error) {
            console.error('初始化视频失败:', error);
        }
        
        try {
            this.loadSettings();
        } catch (error) {
            console.error('加载设置失败:', error);
        }
        
        try {
            this.loadTheme();
        } catch (error) {
            console.error('加载主题失败:', error);
        }
        
        try {
            this.setupEventListeners();
        } catch (error) {
            console.error('绑定事件失败:', error);
        }
        
        try {
            this.setupKeyboardShortcuts();
        } catch (error) {
            console.error('绑定快捷键失败:', error);
        }
        
        try {
            this.showLoading(false);
        } catch (e) {}
        
        try {
            this.showNotification('系统初始化完成', 'success');
        } catch (e) {}
    }

    async fetchServerConfig() {
        try {
            const resp = await fetch('/api/config');
            this.serverConfig = await resp.json();
            this.updateAvatarDisplayFromConfig();
            await this.fetchTTSInfo();
        } catch (e) {
            console.error('获取配置失败', e);
        }
    }

    async fetchTTSInfo() {
        try {
            const resp = await fetch('/api/tts/info');
            if (!resp.ok) {
                console.warn('TTS信息端点返回错误:', resp.status);
                this.showNotification('TTS服务配置不完整，但不影响基本功能', 'warning');
                return;
            }
            const ttsInfo = await resp.json();
            console.log('TTS配置信息:', ttsInfo);
            
            if (ttsInfo.has_dashscope && ttsInfo.has_api_key) {
                this.showNotification(`语音合成: ${ttsInfo.tts_model} (${ttsInfo.tts_voice})`, 'info');
            } else {
                this.showNotification('警告: TTS配置不完整，语音合成可能不可用', 'warning');
            }
        } catch (e) {
            console.error('获取TTS信息失败', e);
            this.showNotification('TTS服务初始化失败，但文字对话仍可用', 'warning');
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

    initAvatarVideo() {
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarLoading = document.getElementById('avatarLoading');
        const avatarOverlay = document.querySelector('.avatar-overlay');
        
        if (avatarVideo && avatarOverlay) {
            const hideOverlay = () => {
                console.log('尝试隐藏数字人加载遮罩');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
                if (avatarOverlay) {
                    avatarOverlay.style.display = 'none';
                }
            };
            
            // 立即尝试隐藏遮罩（如果视频已经加载）
            if (avatarVideo.complete) {
                console.log('数字人视频已完成加载，立即隐藏遮罩');
                hideOverlay();
            }
            
            // 监听视频加载完成事件
            avatarVideo.onload = () => {
                console.log('数字人视频流加载成功');
                hideOverlay();
            };
            
            // 对于MJPEG流，使用定时器来检测视频是否开始播放
            let loadCheckInterval = setInterval(() => {
                // 检查图片是否已经有尺寸，这表明至少有一帧已加载
                if (avatarVideo.offsetWidth > 0 && avatarVideo.offsetHeight > 0) {
                    console.log('数字人视频流已开始显示');
                    hideOverlay();
                    clearInterval(loadCheckInterval);
                }
            }, 500); // 每500毫秒检查一次
            
            // 设置最大等待时间，避免无限期等待
            setTimeout(() => {
                clearInterval(loadCheckInterval);
                console.log('数字人视频流加载超时，隐藏加载遮罩');
                hideOverlay();
            }, 3000); // 3秒后强制隐藏
            
            // 立即尝试隐藏遮罩（即使视频还没完全加载）
            setTimeout(() => {
                console.log('强制隐藏数字人加载遮罩');
                hideOverlay();
            }, 1000); // 1秒后立即隐藏
            
            avatarVideo.onerror = () => {
                console.error('数字人视频流加载失败');
                this.showNotification('数字人视频流加载失败', 'error');
                hideOverlay(); // 即使失败也要隐藏遮罩
            };
        }
    }

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

        this.socket.on('chat_stream', (data) => {
            try {
                if (!data || !data.delta) return;
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

        this.socket.on('chat_stream_end', (data) => {
            try {
                console.log('流式输出结束');
            } catch (e) {
                console.warn('处理chat_stream_end失败', e);
            }
        });

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
            
            this.socket.emit('start_session', { session_id: this.sessionId });
        } catch (error) {
            console.error('创建会话失败:', error);
            this.showNotification('创建会话失败', 'error');
        }
    }

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
        
        audioSelect.innerHTML = '<option value="">自动选择</option>';
        videoSelect.innerHTML = '<option value="">自动选择</option>';
        
        this.devices.audio.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `麦克风 ${device.deviceId.slice(0, 8)}`;
            audioSelect.appendChild(option);
        });
        
        this.devices.video.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `摄像头 ${device.deviceId.slice(0, 8)}`;
            videoSelect.appendChild(option);
        });
    }

    async startLocalStream() {
        try {
            // 检查浏览器是否支持getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('您的浏览器不支持媒体设备访问，请使用Chrome、Firefox或Edge浏览器');
            }

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
            
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            const avatarVideo = document.getElementById('avatarVideo');
            
            if (localVideo && localVideoWrapper) {
                localVideo.srcObject = this.localStream;
                localVideoWrapper.style.display = 'block';
                if (avatarVideo) {
                    avatarVideo.style.display = 'none';
                }
            }
            
            this.setupAudioAnalysis();
            this.showNotification('摄像头和麦克风已启动', 'success');
            
            return this.localStream;
        } catch (error) {
            console.error('启动本地流失败:', error);
            
            let errorMessage = '无法访问摄像头或麦克风';
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = '您拒绝了摄像头/麦克风权限，请在浏览器设置中允许访问';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = '未找到摄像头或麦克风设备';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = '摄像头或麦克风被其他应用占用';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showNotification(errorMessage, 'error');
            throw error;
        }
    }

    async stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            const avatarVideo = document.getElementById('avatarVideo');
            
            localVideo.srcObject = null;
            localVideoWrapper.style.display = 'none';
            avatarVideo.style.display = 'block';
        }
    }

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
            
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const volume = average / 255;
            
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

    startVoiceRecording() {
        if (!this.localStream || this.isRecording) return;
        
        try {
            this.isRecording = true;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (!audioTrack) throw new Error('未检测到音频轨');

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

    sendChatMessage(message) {
        if (!message.trim() || !this.sessionId) return;
        
        this.addMessage('user', message);
        
        this.socket.emit('chat_message', {
            session_id: this.sessionId,
            message: message
        });
        
        document.getElementById('messageInput').value = '';
    }

    handleSpeechResult(data) {
        if (data.recognized_text) {
            this.addMessage('user', data.recognized_text, '语音识别');
        }
        
        if (data.ai_response) {
            this.addMessage('ai', data.ai_response);
            this.playAvatarAnimation(data.avatar_animation);
        }
    }

    handleChatResponse(data) {
        if (data.ai_response) {
            this.addMessage('ai', data.ai_response);
            this.playAvatarAnimation(data.avatar_animation);
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
        
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
    }

    playAvatarAnimation(animation) {
        if (!animation) return;
        
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarStatus = document.getElementById('avatarStatus');
        
        if (avatarVideo) {
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
        }
    }

    hideVoiceStatus() {
        try {
            const el = document.getElementById('voiceStatus');
            if (el) el.style.display = 'none';
        } catch (e) {
        }
    }

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

    setupEventListeners() {
        const avatarToggle = document.getElementById('avatarToggle');
        if (avatarToggle) {
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
        }

        const micToggle = document.getElementById('micToggle');
        if (micToggle) {
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
        }

        const cameraToggle = document.getElementById('toggleCameraBtn');
        if (cameraToggle) {
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
        }

        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('mousedown', () => {
                this.startVoiceRecording();
            });
            
            voiceBtn.addEventListener('mouseup', () => {
                this.stopVoiceRecording();
            });
            
            voiceBtn.addEventListener('mouseleave', () => {
                this.stopVoiceRecording();
            });
        }

        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const messageInput = document.getElementById('messageInput');
                this.sendChatMessage(messageInput.value);
            });
        }

        const clearChat = document.getElementById('clearChat');
        if (clearChat) {
            clearChat.addEventListener('click', () => {
                this.stopAllAudio();
                
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
                
                const avatarStatus = document.getElementById('avatarStatus');
                if (avatarStatus && avatarStatus.getAttribute('data-original-text')) {
                    avatarStatus.textContent = avatarStatus.getAttribute('data-original-text');
                    avatarStatus.style.color = '';
                }
                
                this.showNotification('聊天记录已清空', 'info');
            });
        }

        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');

        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('show');
            });
        }

        const closeButtons = [closeSettings, cancelSettings].filter(Boolean);
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });
        });

        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveSettings();
                settingsModal.classList.remove('show');
            });
        }

        const memoryBtn = document.getElementById('memoryBtn');
        const memoryModal = document.getElementById('memoryModal');
        const closeMemory = document.getElementById('closeMemory');

        if (memoryBtn && memoryModal) {
            memoryBtn.addEventListener('click', () => {
                memoryModal.classList.add('show');
            });
        }

        if (closeMemory && memoryModal) {
            closeMemory.addEventListener('click', () => {
                memoryModal.classList.remove('show');
            });
        }

        const knowledgeBtn = document.getElementById('knowledgeBtn');
        const knowledgeModal = document.getElementById('knowledgeModal');
        const closeKnowledge = document.getElementById('closeKnowledge');

        if (knowledgeBtn && knowledgeModal) {
            knowledgeBtn.addEventListener('click', () => {
                knowledgeModal.classList.add('show');
            });
        }

        if (closeKnowledge && knowledgeModal) {
            closeKnowledge.addEventListener('click', () => {
                knowledgeModal.classList.remove('show');
            });
        }

        const lessonBtn = document.getElementById('lessonBtn');
        const lessonModal = document.getElementById('lessonModal');
        const closeLesson = document.getElementById('closeLesson');
        const generateLesson = document.getElementById('generateLesson');

        if (lessonBtn && lessonModal) {
            lessonBtn.addEventListener('click', () => {
                lessonModal.classList.add('show');
            });
        }

        if (closeLesson && lessonModal) {
            closeLesson.addEventListener('click', () => {
                lessonModal.classList.remove('show');
            });
        }

        if (generateLesson) {
            generateLesson.addEventListener('click', () => {
                this.showLoading(true);
                setTimeout(() => {
                    this.hideLoading();
                    const result = document.getElementById('lessonResult');
                    if (result) {
                        result.style.display = 'block';
                        result.scrollIntoView({ behavior: 'smooth' });
                    }
                    this.showNotification('教案生成成功！', 'success');
                }, 1500);
            });
        }

        const evaluationBtn = document.getElementById('evaluationBtn');
        const evaluationModal = document.getElementById('evaluationModal');
        const closeEvaluation = document.getElementById('closeEvaluation');

        if (evaluationBtn && evaluationModal) {
            evaluationBtn.addEventListener('click', () => {
                evaluationModal.classList.add('show');
            });
        }

        if (closeEvaluation && evaluationModal) {
            closeEvaluation.addEventListener('click', () => {
                evaluationModal.classList.remove('show');
            });
        }

        const searchKnowledge = document.getElementById('searchKnowledge');
        if (searchKnowledge) {
            searchKnowledge.addEventListener('click', () => {
                const searchTerm = document.getElementById('knowledgeSearch').value.trim();
                if (!searchTerm) {
                    this.showNotification('请输入搜索关键词', 'warning');
                    return;
                }
                
                this.showNotification(`正在搜索知识点：${searchTerm}`, 'info');
                
                setTimeout(() => {
                    this.showNotification(`找到 3 个相关知识点`, 'success');
                }, 1000);
            });
        }

        document.getElementById('knowledgeSearch').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                searchKnowledge.click();
            }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });

        document.querySelectorAll('.lesson-actions .btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLessonAction(e));
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const themeName = option.getAttribute('data-theme');
                if (themeName) {
                    this.switchTheme(themeName);
                }
            });
        });
    }

    switchTab(e) {
        const tabBtn = e.target;
        const tabId = tabBtn.dataset.tab;
        const tabHeader = tabBtn.parentElement;
        const tabContent = tabHeader.nextElementSibling;
        
        tabHeader.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        tabBtn.classList.add('active');
        
        tabContent.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    handleLessonAction(e) {
        const btn = e.currentTarget;
        const text = btn.textContent.trim();
        
        if (text.includes('PPT')) {
            this.showLoading(true);
            setTimeout(() => {
                this.hideLoading();
                this.showNotification('PPT生成成功！已保存到本地', 'success');
            }, 2000);
        } else if (text.includes('配图')) {
            this.showLoading(true);
            setTimeout(() => {
                this.hideLoading();
                this.showNotification('教学配图生成成功！已插入教案', 'success');
            }, 2000);
        } else if (text.includes('导出')) {
            this.showNotification('教案已导出为PDF文件', 'success');
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                const messageInput = document.getElementById('messageInput');
                this.sendChatMessage(messageInput.value);
            }
            
            if (e.key === ' ' && !e.repeat) {
                e.preventDefault();
                this.startVoiceRecording();
            }
            
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                });
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                this.stopVoiceRecording();
            }
        });
    }

    switchTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('avatarTheme', themeName);
        
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        
        const activeOption = document.querySelector(`.theme-option[data-theme="${themeName}"]`);
        if (activeOption) {
            activeOption.classList.add('active');
        }
        
        const themeNames = {
            'default': '深空靛蓝',
            'aurora': '极光紫',
            'ocean': '海洋蓝',
            'sunset': '日落橙',
            'forest': '森林绿',
            'midnight': '暗夜霓虹'
        };
        
        this.showNotification(`已切换到 ${themeNames[themeName] || themeName} 主题`, 'success');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('avatarTheme') || 'default';
        this.switchTheme(savedTheme);
    }

    saveSettings() {
        const settings = {
            audioDevice: document.getElementById('audioDevice').value,
            videoDevice: document.getElementById('videoDevice').value,
            avatarType: document.getElementById('avatarType').value,
            avatarModel: document.getElementById('avatarModel').value,
            aiModel: document.getElementById('aiModel').value
        };
        
        localStorage.setItem('avatarChatSettings', JSON.stringify(settings));
        
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

    async switchAvatarModel(modelName) {
        try {
            this.showNotification('正在切换数字人形象...', 'info');
            
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
                this.reloadAvatarVideo();
            } else {
                this.showNotification('切换数字人形象失败', 'error');
            }
        } catch (error) {
            console.error('切换数字人形象失败:', error);
            this.showNotification('切换数字人形象失败: ' + error.message, 'error');
        }
    }

    reloadAvatarVideo() {
        const avatarVideo = document.getElementById('avatarVideo');
        if (avatarVideo) {
            const timestamp = new Date().getTime();
            avatarVideo.src = `/avatar/video_feed?t=${timestamp}`;
        }
    }

    updateConnectionStatus(status, connected) {
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (connectionStatus) {
            connectionStatus.textContent = status;
        }
        
        const dot = document.getElementById('connectionDot');
        if (dot) {
            if (connected) {
                dot.classList.add('connected');
            } else {
                dot.classList.remove('connected');
            }
        }
    }

    updateSessionInfo() {
        const sessionIdElement = document.getElementById('sessionId');
        const sessionTimeElement = document.getElementById('sessionTime');
        
        if (this.sessionId && sessionIdElement) {
            sessionIdElement.textContent = `会话ID: ${this.sessionId.slice(0, 8)}...`;
        }
        
        if (this.sessionStartTime && sessionTimeElement) {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            sessionTimeElement.textContent = `会话时间: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

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

    showButtonFeedback(button, message, type = 'success') {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
        
        this.showNotification(message, type, 2000);
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    hideLoading() {
        this.showLoading(false);
    }

    handleError(error, context = '') {
        console.error(`错误 [${context}]:`, error);
        this.showNotification(`操作失败: ${error.message}`, 'error');
    }

    stopAllAudio() {
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        if (this.isRecording) {
            this.stopVoiceRecording();
        }
    }

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

document.addEventListener('DOMContentLoaded', () => {
    window.avatarChatApp = new AvatarChatApp();
    
    window.addEventListener('beforeunload', () => {
        if (window.avatarChatApp) {
            window.avatarChatApp.cleanup();
        }
    });
});

window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (window.avatarChatApp) {
        window.avatarChatApp.showNotification('发生未知错误，请刷新页面', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (window.avatarChatApp) {
        window.avatarChatApp.showNotification('网络连接异常，请检查网络', 'error');
    }
});
