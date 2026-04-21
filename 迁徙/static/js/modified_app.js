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
        this.history = []; // 存储当前会话历史
        
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

    // 初始化WebSocket连接
    async initializeSocket() {
        return new Promise((resolve, reject) => {
            try {
                // 创建WebSocket连接
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('WebSocket连接已建立');
                    this.isConnected = true;
                    this.updateConnectionStatus('已连接');
                    this.createSession();
                    resolve();
                });
                
                this.socket.on('disconnect', () => {
                    console.log('WebSocket连接已断开');
                    this.isConnected = false;
                    this.updateConnectionStatus('已断开');
                });
                
                // 处理连接错误
                this.socket.on('connect_error', (error) => {
                    console.error('WebSocket连接错误:', error);
                    this.showNotification('连接服务器失败', 'error');
                    reject(error);
                });
                
                // 处理会话开始
                this.socket.on('session_started', (data) => {
                    console.log('会话已开始:', data);
                    this.sessionId = data.session_id;
                    document.getElementById('sessionId').textContent = `会话ID: ${this.sessionId.substring(0, 8)}...`;
                    this.showNotification('会话已建立', 'success');
                });
                
                // 处理语音识别结果
                this.socket.on('asr_result', (data) => {
                    console.log('语音识别结果:', data);
                    if (data.session_id === this.sessionId) {
                        // 在聊天框中显示识别结果
                        this.addMessageToChat('user', data.recognized_text, '语音识别');
                    }
                });
                
                // 处理流式聊天响应
                this.socket.on('chat_stream', (data) => {
                    if (data.session_id === this.sessionId) {
                        // 更新AI回复消息（流式）
                        this.updateAIMessageStream(data.content);
                    }
                });
                
                // 处理聊天响应结束
                this.socket.on('chat_stream_end', (data) => {
                    if (data.session_id === this.sessionId) {
                        // 完成AI回复消息
                        this.completeAIMessage(data.final_content);
                    }
                });
                
                // 处理TTS音频
                this.socket.on('tts_audio', (data) => {
                    if (data.session_id === this.sessionId) {
                        // 播放TTS音频
                        this.playTTS(data.audio_wav_base64);
                    }
                });
                
                // 处理完整聊天响应
                this.socket.on('chat_response', (data) => {
                    if (data.session_id === this.sessionId) {
                        if (data.error) {
                            this.showNotification(data.error, 'error');
                            return;
                        }
                        
                        // 播放虚拟形象动画
                        if (data.avatar_animation) {
                            this.playAvatarAnimation(data.avatar_animation);
                        }
                        
                        // 更新聊天历史
                        if (data.chat_history) {
                            this.history = data.chat_history;
                        }
                    }
                });
                
                // 处理语音识别和AI响应结果
                this.socket.on('speech_result', (data) => {
                    if (data.session_id === this.sessionId) {
                        // 显示识别文本
                        this.addMessageToChat('user', data.recognized_text, '语音输入');
                        
                        // 显示AI回复
                        this.addMessageToChat('ai', data.ai_response);
                        
                        // 播放虚拟形象动画
                        if (data.avatar_animation) {
                            this.playAvatarAnimation(data.avatar_animation);
                        }
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
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
            // 监听加载事件
            avatarVideo.onload = () => {
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
            
            // 监听错误事件
            avatarVideo.onerror = () => {
                if (avatarLoading) {
                    avatarLoading.innerHTML = `
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <span>数字人加载失败</span>
                    `;
                }
                this.showNotification('数字人视频流加载失败', 'error');
            };
        }
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
            if (data.session_id) {
                this.sessionId = data.session_id;
                console.log('会话创建成功:', this.sessionId);
                
                // 启动会话
                this.socket.emit('start_session', {
                    session_id: this.sessionId
                });
            }
        } catch (error) {
            console.error('创建会话失败:', error);
            this.showNotification('创建会话失败', 'error');
        }
    }

    // 加载设备列表
    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices.audio = devices.filter(device => device.kind === 'audioinput');
            this.devices.video = devices.filter(device => device.kind === 'videoinput');
            
            this.populateDeviceSelectors();
        } catch (error) {
            console.error('加载设备列表失败:', error);
        }
    }

    // 填充设备选择器
    populateDeviceSelectors() {
        const audioDeviceSelect = document.getElementById('audioDevice');
        const videoDeviceSelect = document.getElementById('videoDevice');
        
        // 清空现有选项
        audioDeviceSelect.innerHTML = '<option value="">自动选择</option>';
        videoDeviceSelect.innerHTML = '<option value="">自动选择</option>';
        
        // 添加音频设备选项
        this.devices.audio.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `麦克风 ${audioDeviceSelect.children.length}`;
            audioDeviceSelect.appendChild(option);
        });
        
        // 添加视频设备选项
        this.devices.video.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `摄像头 ${videoDeviceSelect.children.length}`;
            videoDeviceSelect.appendChild(option);
        });
    }

    // 加载设置
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('avatarChatSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                if (settings.audioDevice) document.getElementById('audioDevice').value = settings.audioDevice;
                if (settings.videoDevice) document.getElementById('videoDevice').value = settings.videoDevice;
                if (settings.avatarType) document.getElementById('avatarType').value = settings.avatarType;
                if (settings.avatarModel) document.getElementById('avatarModel').value = settings.avatarModel;
                if (settings.aiModel) document.getElementById('aiModel').value = settings.aiModel;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 发送按钮
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.addEventListener('click', () => {
            const messageInput = document.getElementById('messageInput');
            this.sendChatMessage(messageInput.value);
            messageInput.value = '';
        });
        
        // 消息输入框
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage(messageInput.value);
                messageInput.value = '';
            }
        });
        
        // 语音按钮
        const voiceBtn = document.getElementById('voiceBtn');
        let voicePressTimer = null;
        
        voiceBtn.addEventListener('mousedown', () => {
            voicePressTimer = setTimeout(() => {
                this.startVoiceRecording();
            }, 300); // 长按300ms开始录音
        });
        
        voiceBtn.addEventListener('mouseup', () => {
            clearTimeout(voicePressTimer);
            this.stopVoiceRecording();
        });
        
        voiceBtn.addEventListener('mouseleave', () => {
            clearTimeout(voicePressTimer);
            this.stopVoiceRecording();
        });
        
        // 清空聊天按钮
        const clearChat = document.getElementById('clearChat');
        clearChat.addEventListener('click', () => {
            this.clearChatHistory();
        });
        
        // 文件上传
        const fileUploadInput = document.getElementById('fileUploadInput');
        if (fileUploadInput) {
            fileUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.uploadFile(file);
                }
            });
        }
        
        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        settingsBtn.addEventListener('click', () => {
            // 加载历史记录列表
            this.loadHistoryList();
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
        
        // 历史记录相关按钮
        const saveHistoryBtn = document.getElementById('saveHistoryBtn');
        if (saveHistoryBtn) {
            saveHistoryBtn.addEventListener('click', () => {
                this.saveChatHistory();
            });
        }
        
        // 标签页切换
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有活动状态
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                
                // 添加当前活动状态
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    // 上传文件
    async uploadFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(`文件上传成功: ${result.filename}`, 'success');
                // 在聊天中显示文件信息
                this.addMessageToChat('system', `已上传文件: ${result.filename}`, '文件上传');
            } else {
                this.showNotification(`文件上传失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            this.showNotification('文件上传失败', 'error');
        }
    }
    
    // 保存聊天历史
    async saveChatHistory() {
        try {
            const response = await fetch('/api/history/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    history: this.history
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(`聊天历史已保存: ${result.filename}`, 'success');
            } else {
                this.showNotification(`保存聊天历史失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('保存聊天历史失败:', error);
            this.showNotification('保存聊天历史失败', 'error');
        }
    }
    
    // 加载历史记录列表
    async loadHistoryList() {
        try {
            const response = await fetch('/api/history/list');
            const result = await response.json();
            
            if (result.history_files) {
                const historyList = document.getElementById('historyList');
                if (historyList) {
                    historyList.innerHTML = '';
                    
                    result.history_files.forEach(file => {
                        const item = document.createElement('div');
                        item.className = 'history-item';
                        item.innerHTML = `
                            <div class="history-item-info">
                                <div class="history-item-name">${file.filename}</div>
                                <div class="history-item-meta">
                                    <span>大小: ${(file.size / 1024).toFixed(1)} KB</span>
                                    <span>时间: ${new Date(file.created_time * 1000).toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="history-item-actions">
                                <button class="btn btn-small btn-secondary" onclick="app.loadHistory('${file.filename}')">
                                    <i class="fas fa-download"></i> 加载
                                </button>
                            </div>
                        `;
                        historyList.appendChild(item);
                    });
                    
                    // 如果没有历史记录，显示空状态
                    if (result.history_files.length === 0) {
                        historyList.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-history"></i>
                                <p>暂无历史记录</p>
                            </div>
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('加载历史记录列表失败:', error);
        }
    }
    
    // 加载历史记录
    async loadHistory(filename) {
        try {
            const response = await fetch(`/api/history/load/${filename}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                // 清空当前聊天
                this.clearChatHistory();
                
                // 加载历史记录
                result.data.history.forEach(item => {
                    this.addMessageToChat(
                        item.type === 'user' ? 'user' : item.type === 'ai' ? 'ai' : 'system',
                        item.message,
                        item.type === 'user' ? '历史消息' : ''
                    );
                });
                
                this.showNotification(`已加载历史记录: ${filename}`, 'success');
                
                // 关闭设置模态框
                document.getElementById('settingsModal').classList.remove('show');
            } else {
                this.showNotification(`加载历史记录失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.showNotification('加载历史记录失败', 'error');
        }
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
        if (settings.avatarModel) {
            this.switchAvatar(settings.avatarModel);
        }
        
        this.showNotification('设置已保存', 'success');
    }
    
    // 切换数字人形象
    async switchAvatar(modelName) {
        try {
            const response = await fetch('/api/avatar/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_name: modelName
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                // 刷新页面以应用更改
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                this.showNotification(`切换失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('切换数字人形象失败:', error);
            this.showNotification('切换数字人形象失败', 'error');
        }
    }

    // 启动本地媒体流
    async startLocalStream() {
        try {
            const audioDevice = document.getElementById('audioDevice').value;
            const videoDevice = document.getElementById('videoDevice').value;
            
            const constraints = {
                audio: audioDevice ? { deviceId: audioDevice } : true,
                video: videoDevice ? { deviceId: videoDevice } : true
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // 显示本地视频
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            const avatarVideo = document.getElementById('avatarVideo');
            
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideoWrapper.style.display = 'block';
                avatarVideo.style.display = 'none';
            }
            
            // 设置音频分析
            this.setupAudioAnalysis();
            
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
                this.isRecording = false;
                this.hideVoiceStatus();
                
                try {
                    // 合并音频数据
                    const audioBlob = new Blob(audioChunks, { type: chosen || 'audio/webm' });
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const base64Audio = this.arrayBufferToBase64(arrayBuffer);
                    
                    // 发送到服务器
                    this.socket.emit('audio_data', {
                        session_id: this.sessionId,
                        audio_data: base64Audio
                    });
                    
                } catch (error) {
                    console.error('处理音频数据失败:', error);
                    this.showNotification('语音识别失败', 'error');
                }
            };
            
            this.mediaRecorder.start();
            this.showVoiceStatus('正在录音...');
            
        } catch (error) {
            console.error('开始录音失败:', error);
            this.isRecording = false;
            this.showNotification('录音启动失败', 'error');
        }
    }

    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }

    // 发送聊天消息
    sendChatMessage(message) {
        if (!message.trim() || !this.sessionId) return;
        
        // 添加用户消息到聊天界面
        this.addMessageToChat('user', message);
        
        // 发送到服务器
        this.socket.emit('chat_message', {
            session_id: this.sessionId,
            message: message.trim()
        });
        
        // 清空输入框
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
        }
    }

    // 添加消息到聊天界面
    addMessageToChat(type, content, source = '') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        
        const time = new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${type === 'user' ? 'user' : type === 'ai' ? 'robot' : 'info-circle'}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(content)}</div>
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
        
        // 更新历史记录
        this.history.push({
            type: type,
            message: content,
            timestamp: Date.now()
        });
    }

    // 更新AI消息流（流式输出）
    updateAIMessageStream(content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 查找最后一个AI消息
        const aiMessages = chatMessages.querySelectorAll('.message-ai');
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        
        if (lastAiMessage) {
            const messageText = lastAiMessage.querySelector('.message-text');
            if (messageText) {
                messageText.innerHTML = this.escapeHtml(content) + '<span class="typing-indicator"></span>';
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    // 完成AI消息
    completeAIMessage(content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 查找最后一个AI消息
        const aiMessages = chatMessages.querySelectorAll('.message-ai');
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        
        if (lastAiMessage) {
            const messageText = lastAiMessage.querySelector('.message-text');
            if (messageText) {
                messageText.innerHTML = this.escapeHtml(content);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        
        // 更新历史记录
        this.history.push({
            type: 'ai',
            message: content,
            timestamp: Date.now()
        });
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

    // 播放TTS音频
    playTTS(base64Audio) {
        try {
            const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
            audio.play();
        } catch (error) {
            console.error('播放TTS音频失败:', error);
        }
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

    // 清空聊天历史
    clearChatHistory() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 保留欢迎消息
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            chatMessages.appendChild(welcomeMessage);
        }
        
        // 清空历史记录
        this.history = [];
        
        // 重置数字人状态
        const avatarStatus = document.getElementById('avatarStatus');
        if (avatarStatus && avatarStatus.getAttribute('data-original-text')) {
            avatarStatus.textContent = avatarStatus.getAttribute('data-original-text');
            avatarStatus.style.color = '';
        }
        
        this.showNotification('聊天记录已清空', 'info');
    }

    // 更新连接状态
    updateConnectionStatus(status) {
        const connectionDot = document.getElementById('connectionDot');
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionInfo = document.getElementById('connectionInfo');
        
        if (connectionDot && connectionStatus && connectionInfo) {
            connectionStatus.textContent = status;
            connectionInfo.textContent = `连接状态: ${status}`;
            
            if (status === '已连接') {
                connectionDot.className = 'status-dot connected';
            } else {
                connectionDot.className = 'status-dot disconnected';
            }
        }
    }

    // 显示加载动画
    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // ArrayBuffer转Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
const app = new AvatarChatApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 应用已经在构造函数中初始化
});