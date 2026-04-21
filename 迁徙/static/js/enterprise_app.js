/**
 * AI虚拟形象聊天系统 - 企业级前端JavaScript
 * 
 * 作者: OpenAvatarChat团队
 * 版本: 1.0.0
 * 描述: 实现完整的数字人聊天系统前端逻辑，包括WebSocket连接、媒体处理、UI交互等
 */

/**
 * AvatarChatApp 类 - 数字人聊天应用主类
 * 
 * 负责管理整个应用的生命周期，包括：
 * - WebSocket连接管理
 * - 媒体设备控制
 * - UI状态更新
 * - 消息处理
 * - 会话管理
 */
class AvatarChatApp {
    /**
     * 构造函数
     * 初始化应用状态和配置
     */
    constructor() {
        // 核心组件引用
        this.socket = null;
        this.localStream = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        
        // 应用状态
        this.sessionId = null;
        this.isConnected = false;
        this.isRecording = false;
        this.sessionStartTime = null;
        this.currentUserRole = 'user';
        
        // 设备信息
        this.devices = {
            audio: [],
            video: []
        };
        
        // 会话历史
        this.history = [];
        
        // 定时器
        this.avatarCheckInterval = null;
        this.typingTimeout = null;
        
        // 初始化应用
        this.init();
    }

    /**
     * 应用初始化
     * 设置事件监听器并启动核心功能
     */
    async init() {
        try {
            console.log('[AvatarChatApp] 开始初始化应用...');
            this.showLoading(true);
            
            // 初始化核心组件
            await this.initializeSocket();
            await this.loadDevices();
            await this.fetchServerConfig();
            this.initAvatarVideo();
            this.loadSettings();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            // 加载历史记录
            await this.loadHistoryList();
            
            // 完成初始化
            this.showLoading(false);
            this.showNotification('系统初始化完成', 'success');
            console.log('[AvatarChatApp] 应用初始化完成');
        } catch (error) {
            console.error('[AvatarChatApp] 初始化失败:', error);
            this.showNotification(`系统初始化失败: ${error.message}`, 'error');
            this.showLoading(false);
        }
    }

    /**
     * WebSocket连接初始化
     * 建立与后端的实时通信连接
     */
    async initializeSocket() {
        return new Promise((resolve, reject) => {
            try {
                // 创建WebSocket连接
                this.socket = io();
                
                // 连接成功事件
                this.socket.on('connect', () => {
                    console.log('[WebSocket] 连接成功');
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    this.createSession();
                    resolve();
                });

                // 连接断开事件
                this.socket.on('disconnect', () => {
                    console.log('[WebSocket] 连接断开');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                });

                // 连接错误事件
                this.socket.on('connect_error', (error) => {
                    console.error('[WebSocket] 连接错误:', error);
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    reject(error);
                });

                // 聊天消息事件
                this.socket.on('chat_message', (data) => {
                    console.log('[WebSocket] 收到聊天消息:', data);
                    this.addMessageToChat('ai', data.content, 'AI助手');
                });

                // 聊天流事件
                this.socket.on('chat_stream', (data) => {
                    this.handleChatStream(data);
                });

                // 聊天流结束事件
                this.socket.on('chat_stream_end', (data) => {
                    this.handleChatStreamEnd(data);
                });

                // TTS完成事件
                this.socket.on('tts_complete', (data) => {
                    console.log('[WebSocket] TTS合成完成:', data);
                });

                // TTS音频事件
                this.socket.on('tts_audio', (data) => {
                    console.log('[WebSocket] 收到TTS音频数据:', data);
                    
                    if (!data || !data.audio_wav_base64) {
                        console.warn('[WebSocket] 接收到无效的TTS音频数据');
                        return;
                    }
                    
                    try {
                        this.playTTS(data.audio_wav_base64, data.format || 'wav');
                    } catch (error) {
                        console.error('[WebSocket] 播放TTS音频失败:', error);
                    }
                });

                // 数字人动画事件
                this.socket.on('avatar_animation', (data) => {
                    console.log('[WebSocket] 收到数字人动画数据:', data);
                    
                    if (!data) {
                        console.warn('[WebSocket] 接收到无效的动画数据');
                        return;
                    }
                    
                    this.handleAvatarAnimation(data);
                    
                    if (data.expression) {
                        this.updateAvatarStatus(data.expression);
                    }
                });

                // 错误事件
                this.socket.on('error', (data) => {
                    console.error('[WebSocket] 服务器错误:', data);
                    this.showNotification(`服务器错误: ${data.message}`, 'error');
                });
            } catch (error) {
                console.error('[WebSocket] 初始化失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 创建会话
     * 与后端建立新的聊天会话
     */
    async createSession() {
        try {
            const response = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    avatar_type: 'liteavatar'
                })
            });

            if (!response.ok) {
                // 如果响应不是200-299，尝试解析错误信息
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // 如果无法解析JSON，使用默认错误信息
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            if (result.success) {
                this.sessionId = result.session_id;
                console.log('[Session] 会话创建成功:', this.sessionId);
            } else {
                throw new Error(result.error || '会话创建失败');
            }
        } catch (error) {
            console.error('[Session] 创建会话失败:', error);
            if (this.showNotification) {
                this.showNotification(`创建会话失败: ${error.message}`, 'error');
            }
        }
    }

    /**
     * 更新连接状态显示
     * @param {boolean} isConnected - 连接状态
     */
    updateConnectionStatus(isConnected = this.isConnected) {
        const connectionDot = document.getElementById('connectionDot');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (isConnected) {
            connectionDot.className = 'status-dot connected';
            connectionStatus.textContent = '已连接';
        } else {
            connectionDot.className = 'status-dot disconnected';
            connectionStatus.textContent = '未连接';
        }
    }

    /**
     * 初始化数字人视频显示
     */
    initAvatarVideo() {
        console.log('[Avatar] 初始化数字人视频显示');
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarLoading = document.getElementById('avatarLoading');
        
        if (avatarVideo) {
            avatarVideo.onload = () => {
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
                console.log('[Avatar] 数字人视频加载完成');
            };
            
            avatarVideo.onerror = () => {
                if (avatarLoading) {
                    avatarLoading.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>数字人加载失败</span>
                    `;
                }
                console.warn('[Avatar] 数字人视频加载失败');
            };
        }
    }

    /**
     * 加载设备列表
     */
    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices.audio = devices.filter(device => device.kind === 'audioinput');
            this.devices.video = devices.filter(device => device.kind === 'videoinput');
            
            console.log('[Devices] 音频设备:', this.devices.audio);
            console.log('[Devices] 视频设备:', this.devices.video);
            
            this.populateDeviceSelectors();
        } catch (error) {
            console.error('[Devices] 加载设备列表失败:', error);
        }
    }

    /**
     * 填充设备选择器
     */
    populateDeviceSelectors() {
        const audioDeviceSelect = document.getElementById('audioDevice');
        const videoDeviceSelect = document.getElementById('videoDevice');
        
        if (audioDeviceSelect) {
            audioDeviceSelect.innerHTML = '<option value="">默认设备</option>';
            this.devices.audio.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `麦克风 ${audioDeviceSelect.options.length}`;
                audioDeviceSelect.appendChild(option);
            });
        }
        
        if (videoDeviceSelect) {
            videoDeviceSelect.innerHTML = '<option value="">默认设备</option>';
            this.devices.video.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `摄像头 ${videoDeviceSelect.options.length}`;
                videoDeviceSelect.appendChild(option);
            });
        }
    }

    /**
     * 获取服务器配置
     */
    async fetchServerConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('响应不是JSON格式');
            }
            
            const config = await response.json();
            console.log('[Config] 服务器配置:', config);
            // 可以在这里处理配置信息
        } catch (error) {
            console.error('[Config] 获取服务器配置失败:', error);
            // 不显示错误通知，因为这是可选的配置获取
        }
    }

    /**
     * 加载用户设置
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('avatarChatSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log('[Settings] 加载用户设置:', settings);
                // 可以在这里应用设置
            }
        } catch (error) {
            console.error('[Settings] 加载用户设置失败:', error);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // DOM内容加载完成后执行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindUIElements();
            });
        } else {
            this.bindUIElements();
        }
        
        // 窗口大小变化事件
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // 页面卸载前事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * 绑定UI元素事件
     */
    bindUIElements() {
        // 按钮事件绑定
        this.bindButtonEvent('avatarToggle', this.toggleAvatar);
        this.bindButtonEvent('micToggle', this.toggleMicrophone);
        this.bindButtonEvent('cameraToggle', this.toggleCamera);
        this.bindButtonEvent('screenShareToggle', this.toggleScreenShare);
        this.bindButtonEvent('sendBtn', this.sendMessage);
        this.bindButtonEvent('voiceBtn', this.handleVoiceButton, true);
        this.bindButtonEvent('clearChat', this.clearChat);
        this.bindButtonEvent('saveHistoryBtn', this.saveHistory);
        this.bindButtonEvent('settingsBtn', this.openSettings);
        this.bindButtonEvent('closeSettings', this.closeSettings);
        this.bindButtonEvent('knowledgeBaseBtn', this.openKnowledgeBase);
        this.bindButtonEvent('permissionsBtn', this.openPermissions);
        this.bindButtonEvent('helpBtn', this.openHelp);
        this.bindButtonEvent('toggleVideoView', this.toggleVideoView);
        this.bindButtonEvent('toggleChatView', this.toggleChatView);
        
        // 表单事件绑定
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // 模态框关闭事件
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    this.closeSettings();
                }
            });
        }
    }

    /**
     * 绑定按钮事件
     * @param {string} buttonId - 按钮ID
     * @param {Function} handler - 事件处理函数
     * @param {boolean} isPressAndHold - 是否为按住操作
     */
    bindButtonEvent(buttonId, handler, isPressAndHold = false) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (isPressAndHold) {
                let pressTimer;
                
                button.addEventListener('mousedown', () => {
                    pressTimer = setTimeout(() => {
                        handler.call(this, true);
                    }, 300);
                });
                
                button.addEventListener('mouseup', () => {
                    clearTimeout(pressTimer);
                    handler.call(this, false);
                });
                
                button.addEventListener('mouseleave', () => {
                    clearTimeout(pressTimer);
                });
            } else {
                button.addEventListener('click', handler.bind(this));
            }
        } else {
            console.warn(`[UI] 未找到按钮元素: ${buttonId}`);
        }
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter 发送消息
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
            
            // ESC 关闭模态框
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        });
    }

    /**
     * 处理窗口大小变化
     */
    handleWindowResize() {
        console.log('[UI] 窗口大小变化');
        // 可以在这里处理响应式布局调整
    }

    /**
     * 清理资源
     */
    cleanup() {
        console.log('[App] 清理应用资源');
        
        // 关闭WebSocket连接
        if (this.socket) {
            this.socket.close();
        }
        
        // 停止媒体流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // 清除定时器
        if (this.avatarCheckInterval) {
            clearInterval(this.avatarCheckInterval);
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }

    /**
     * 切换数字人状态
     */
    toggleAvatar() {
        console.log('[Avatar] 切换数字人状态');
        const avatarToggle = document.getElementById('avatarToggle');
        if (avatarToggle) {
            const isPlaying = avatarToggle.querySelector('i').classList.contains('fa-play');
            if (isPlaying) {
                avatarToggle.innerHTML = '<i class="fas fa-stop"></i><span>停止对话</span>';
                this.startAvatarSession();
            } else {
                avatarToggle.innerHTML = '<i class="fas fa-play"></i><span>开始对话</span>';
                this.stopAvatarSession();
            }
        }
    }

    /**
     * 开始数字人会话
     */
    startAvatarSession() {
        console.log('[Avatar] 开始数字人会话');
        // 这里可以添加开始会话的逻辑
    }

    /**
     * 停止数字人会话
     */
    stopAvatarSession() {
        console.log('[Avatar] 停止数字人会话');
        // 这里可以添加停止会话的逻辑
    }

    /**
     * 切换麦克风状态
     */
    toggleMicrophone() {
        console.log('[Media] 切换麦克风状态');
        const micToggle = document.getElementById('micToggle');
        if (micToggle) {
            micToggle.classList.toggle('active');
            const isActive = micToggle.classList.contains('active');
            micToggle.title = isActive ? '麦克风已启用' : '麦克风已禁用';
            
            // 这里可以添加实际的麦克风控制逻辑
        }
    }

    /**
     * 切换摄像头状态
     */
    toggleCamera() {
        console.log('[Media] 切换摄像头状态');
        const cameraToggle = document.getElementById('cameraToggle');
        if (cameraToggle) {
            cameraToggle.classList.toggle('active');
            const isActive = cameraToggle.classList.contains('active');
            cameraToggle.title = isActive ? '摄像头已启用' : '摄像头已禁用';
            
            // 这里可以添加实际的摄像头控制逻辑
        }
    }

    /**
     * 切换屏幕共享状态
     */
    async toggleScreenShare() {
        console.log('[Media] 切换屏幕共享状态');
        const screenShareToggle = document.getElementById('screenShareToggle');
        if (screenShareToggle) {
            try {
                if (screenShareToggle.classList.contains('active')) {
                    // 停止屏幕共享
                    screenShareToggle.classList.remove('active');
                    screenShareToggle.title = '屏幕共享';
                } else {
                    // 开始屏幕共享
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: true
                    });
                    
                    screenShareToggle.classList.add('active');
                    screenShareToggle.title = '停止屏幕共享';
                    
                    // 处理屏幕共享流
                    stream.getVideoTracks()[0].onended = () => {
                        screenShareToggle.classList.remove('active');
                        screenShareToggle.title = '屏幕共享';
                    };
                }
            } catch (error) {
                console.error('[Media] 屏幕共享失败:', error);
                this.showNotification('屏幕共享失败: ' + error.message, 'error');
            }
        }
    }

    /**
     * 处理语音按钮
     * @param {boolean} isPressed - 是否按下
     */
    handleVoiceButton(isPressed) {
        if (isPressed) {
            console.log('[Voice] 开始语音识别');
            this.startVoiceRecognition();
        } else {
            console.log('[Voice] 停止语音识别');
            this.stopVoiceRecognition();
        }
    }

    /**
     * 开始语音识别
     */
    startVoiceRecognition() {
        // 这里可以添加语音识别逻辑
        console.log('[Voice] 语音识别已启动');
    }

    /**
     * 停止语音识别
     */
    stopVoiceRecognition() {
        // 这里可以添加停止语音识别逻辑
        console.log('[Voice] 语音识别已停止');
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) {
            console.warn('[Chat] 消息为空');
            return;
        }
        
        if (!this.sessionId) {
            console.warn('[Chat] 会话未创建');
            await this.createSession();
        }
        
        try {
            // 添加用户消息到聊天界面
            this.addMessageToChat('user', message, '我');
            
            // 清空输入框
            messageInput.value = '';
            
            // 发送消息到服务器
            this.socket.emit('chat_message', {
                session_id: this.sessionId,
                message: message,
                role: this.currentUserRole
            });
            
            console.log('[Chat] 消息已发送:', message);
        } catch (error) {
            console.error('[Chat] 发送消息失败:', error);
            this.showNotification('发送消息失败: ' + error.message, 'error');
        }
    }

    /**
     * 添加消息到聊天界面
     * @param {string} role - 角色 ('user' 或 'ai')
     * @param {string} content - 消息内容
     * @param {string} displayName - 显示名称
     */
    addMessageToChat(role, content, displayName) {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeMessage = document.querySelector('.welcome-message');
        
        // 隐藏欢迎消息
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // 创建消息元素
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${role}`;
        
        const avatarInitial = displayName.charAt(0);
        
        messageElement.innerHTML = `
            <div class="message-avatar">${avatarInitial}</div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(content)}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 处理聊天流数据
     * @param {Object} data - 流数据
     */
    handleChatStream(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 查找最后一个AI消息
        const aiMessages = chatMessages.querySelectorAll('.message-ai');
        let lastAiMessage = aiMessages[aiMessages.length - 1];
        
        // 如果没有AI消息，创建一个新的
        if (!lastAiMessage) {
            // 隐藏欢迎消息
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.style.display = 'none';
            }
            
            // 创建新的AI消息元素
            lastAiMessage = document.createElement('div');
            lastAiMessage.className = 'message message-ai';
            lastAiMessage.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <div class="message-text"><span class="typing-indicator"></span></div>
                    <div class="message-time">${new Date().toLocaleTimeString()}</div>
                </div>
            `;
            chatMessages.appendChild(lastAiMessage);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // 更新消息内容
        const messageText = lastAiMessage.querySelector('.message-text');
        if (messageText && data.content) {
            // 移除现有的输入指示器并添加新内容
            const typingIndicator = messageText.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            
            // 添加新内容
            messageText.innerHTML += this.escapeHtml(data.content);
            
            // 添加新的输入指示器
            messageText.innerHTML += '<span class="typing-indicator"></span>';
            
            // 滚动到底部
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * 处理聊天流结束
     * @param {Object} data - 结束数据
     */
    handleChatStreamEnd(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 查找最后一个AI消息
        const aiMessages = chatMessages.querySelectorAll('.message-ai');
        const lastAiMessage = aiMessages[aiMessages.length - 1];
        
        if (lastAiMessage) {
            // 移除输入指示器
            const typingIndicator = lastAiMessage.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }
        
        // 这里可以处理流结束后的操作
        console.log('[Chat] 流结束:', data);
    }

    /**
     * 播放TTS音频
     * @param {string} audioBase64 - 音频Base64数据
     * @param {string} format - 音频格式
     */
    playTTS(audioBase64, format = 'wav') {
        try {
            const audio = new Audio(`data:audio/${format};base64,${audioBase64}`);
            audio.play().catch(error => {
                console.error('[TTS] 音频播放失败:', error);
            });
        } catch (error) {
            console.error('[TTS] 播放音频失败:', error);
        }
    }

    /**
     * 处理数字人动画
     * @param {Object} data - 动画数据
     */
    handleAvatarAnimation(data) {
        // 这里可以处理数字人动画逻辑
        console.log('[Avatar] 处理动画数据:', data);
    }

    /**
     * 更新数字人状态
     * @param {string} status - 状态文本
     */
    updateAvatarStatus(status) {
        const avatarStatus = document.getElementById('avatarStatus');
        if (avatarStatus) {
            avatarStatus.textContent = status;
        }
    }

    /**
     * 清空聊天记录
     */
    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeMessage = document.querySelector('.welcome-message');
        
        // 清空聊天消息
        chatMessages.innerHTML = '';
        
        // 显示欢迎消息
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
        
        console.log('[Chat] 聊天记录已清空');
    }

    /**
     * 保存聊天历史
     */
    saveHistory() {
        // 这里可以添加保存历史记录的逻辑
        console.log('[History] 保存聊天历史');
        this.showNotification('聊天历史已保存', 'success');
    }

    /**
     * 加载历史记录列表
     */
    async loadHistoryList() {
        try {
            // 这里可以添加加载历史记录的逻辑
            console.log('[History] 加载历史记录列表');
        } catch (error) {
            console.error('[History] 加载历史记录失败:', error);
        }
    }

    /**
     * 打开设置模态框
     */
    openSettings() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.classList.add('show');
        }
    }

    /**
     * 关闭设置模态框
     */
    closeSettings() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.classList.remove('show');
        }
    }

    /**
     * 打开知识库
     */
    openKnowledgeBase() {
        console.log('[UI] 打开知识库');
        this.showNotification('知识库功能正在开发中', 'info');
    }

    /**
     * 打开权限设置
     */
    openPermissions() {
        console.log('[UI] 打开权限设置');
        this.showNotification('权限管理功能正在开发中', 'info');
    }

    /**
     * 打开帮助文档
     */
    openHelp() {
        console.log('[UI] 打开帮助文档');
        this.showNotification('帮助文档功能正在开发中', 'info');
    }

    /**
     * 切换视频视图
     */
    toggleVideoView() {
        console.log('[UI] 切换视频视图');
        this.showNotification('全屏功能正在开发中', 'info');
    }

    /**
     * 切换聊天视图
     */
    toggleChatView() {
        console.log('[UI] 切换聊天视图');
        this.showNotification('收起聊天功能正在开发中', 'info');
    }

    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.add('show');
            } else {
                loadingOverlay.classList.remove('show');
            }
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 ('success', 'error', 'warning', 'info')
     */
    showNotification(message, type = 'info') {
        const notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            console.warn('[UI] 未找到通知容器');
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${this.escapeHtml(message)}</span>
            <button class="notification-close">&times;</button>
        `;
        
        notificationContainer.appendChild(notification);
        
        // 添加关闭事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 转义HTML字符
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化应用
window.addEventListener('DOMContentLoaded', () => {
    window.avatarChatApp = new AvatarChatApp();
});

// 导出类以供测试使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarChatApp;
}