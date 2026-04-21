class AvatarChatApp {
    constructor() {
        this.isRecording = false;
        this.isConnected = true;
        this.cameraEnabled = false;
        this.micEnabled = true;
        this.avatarActive = false;
        
        this.mockResponses = {
            '三角函数': '三角函数是我们最近的重点内容。你之前说正弦定理有点难理解，我们一起来看看：正弦定理的公式是 a/sinA = b/sinB = c/sinC。这个公式告诉我们，三角形的边长和对应角的正弦值成比例。你哪里不太明白？',
            '正弦': '正弦定理的公式是 a/sinA = b/sinB = c/sinC。你之前练习时正确率已经达到85%了，很不错！我们再来巩固一下应用场景。',
            '教案': '好的，我可以帮你生成教案。点击顶部的"教案"按钮，输入教学目标、学生水平和课时长度，我会自动生成结构化的教案，还可以生成配套的PPT和配图哦！',
            '知识图谱': '我们的知识图谱记录了知识点之间的关联关系。比如学正弦定理之前，需要先掌握直角三角形和三角函数定义。点击顶部的"知识图谱"按钮可以看到完整的知识网络！',
            '记忆': '当然记得！你叫蔡同学，初二，上次学三角函数时正确率从80%提升到了95%。你的学习风格是视觉型，喜欢看图解。晚上学习效率比较高。这些我都记着呢！',
            '评价': '你最近的表现很棒！课堂表现92分，知识点掌握85分，较上月提升了15分。三角函数定义掌握得很好（95%），正弦定理还需要加强（75%）。点击顶部的"评价"按钮可以看到详细分析！',
            '你好': '嗨，蔡同学！今天想学点什么？上次我们学的三角函数，你回去复习了吗？有什么不懂的随时问我！',
            '谢谢': '不客气！能帮到你我很开心。记住，学习是一个循序渐进的过程，不要着急，我们一步一步来。有问题随时找我！',
            'default': [
                '蔡同学，你上次问的问题，我记得你当时卡在了第二步。这次我们换个思路看看？',
                '很好！你这个问题问得很棒。我们一起来看看怎么解决。',
                '你之前说看图解更容易懂，我画了个示意图给你。你看，这样理解是不是更清晰？',
                '这个问题你上周问过类似的，当时卡在了第二步，这次试试换个思路？',
                '你这个月进步很大！上次这类题错误率80%，现在只有20%了。继续保持！',
                '别着急，这个知识点确实有点难。我们一步一步来，先理解概念，再做练习。',
                '你之前这个知识点总错，现在正确率已经很高了，可以进阶了！要不要试试综合题？'
            ]
        };
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.updateConnectionStatus(true);
            this.hideLoading();
            this.showNotification('系统初始化完成', 'success');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('系统初始化失败: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    setupEventListeners() {
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') this.sendMessage();
        });
        
        document.getElementById('avatarToggle').addEventListener('click', () => this.toggleAvatar());
        document.getElementById('micToggle').addEventListener('click', () => this.toggleMic());
        document.getElementById('voiceBtn').addEventListener('click', () => this.toggleVoice());
        document.getElementById('voiceInputBtn').addEventListener('mousedown', () => this.startVoiceInput());
        document.getElementById('voiceInputBtn').addEventListener('mouseup', () => this.stopVoiceInput());
        document.getElementById('toggleCameraBtn').addEventListener('click', () => this.toggleCamera());
        document.getElementById('clearChat').addEventListener('click', () => this.clearChat());
        
        document.getElementById('memoryBtn').addEventListener('click', () => this.openModal('memoryModal'));
        document.getElementById('knowledgeBtn').addEventListener('click', () => this.openModal('knowledgeModal'));
        document.getElementById('lessonBtn').addEventListener('click', () => this.openModal('lessonModal'));
        document.getElementById('evaluationBtn').addEventListener('click', () => this.openModal('evaluationModal'));
        document.getElementById('settingsBtn').addEventListener('click', () => this.openModal('settingsModal'));
        
        document.getElementById('closeMemory').addEventListener('click', () => this.closeModal('memoryModal'));
        document.getElementById('closeKnowledge').addEventListener('click', () => this.closeModal('knowledgeModal'));
        document.getElementById('closeLesson').addEventListener('click', () => this.closeModal('lessonModal'));
        document.getElementById('closeEvaluation').addEventListener('click', () => this.closeModal('evaluationModal'));
        document.getElementById('closeSettings').addEventListener('click', () => this.closeModal('settingsModal'));
        document.getElementById('cancelSettings').addEventListener('click', () => this.closeModal('settingsModal'));
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        
        document.getElementById('generateLesson').addEventListener('click', () => this.generateLesson());
        document.getElementById('searchKnowledge').addEventListener('click', () => this.searchKnowledge());
        document.getElementById('knowledgeSearch').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.searchKnowledge();
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('show');
            });
        });
        
        document.querySelectorAll('.lesson-actions .btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLessonAction(e));
        });
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        if (!message) return;
        
        this.addMessage(message, 'user');
        input.value = '';
        
        this.showTypingIndicator();
        
        const delay = 800 + Math.random() * 1500;
        setTimeout(() => {
            this.hideTypingIndicator();
            const response = this.getMockResponse(message);
            this.addMessage(response, 'ai');
        }, delay);
    }

    addMessage(content, type) {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) welcomeMessage.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span>${type === 'user' ? '蔡同学' : '小智老师'}</span>
                <span>${timeStr}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <span>小智老师正在思考</span>
                <span class="typing-indicator">
                    <span></span><span></span><span></span>
                </span>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.remove();
    }

    getMockResponse(userMessage) {
        for (const [keyword, response] of Object.entries(this.mockResponses)) {
            if (keyword === 'default') continue;
            if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
                return response;
            }
        }
        const defaults = this.mockResponses['default'];
        return defaults[Math.floor(Math.random() * defaults.length)];
    }

    toggleAvatar() {
        const btn = document.getElementById('avatarToggle');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        this.avatarActive = !this.avatarActive;
        
        if (this.avatarActive) {
            btn.classList.add('active');
            icon.className = 'fas fa-pause';
            text.textContent = '暂停对话';
            this.showNotification('开始对话，小智老师已就绪！', 'success');
            
            setTimeout(() => {
                this.addMessage('蔡同学你好！我是小智老师，今天想学点什么？上次我们学的三角函数，你还有什么不懂的吗？', 'ai');
            }, 500);
        } else {
            btn.classList.remove('active');
            icon.className = 'fas fa-play';
            text.textContent = '开始对话';
            this.showNotification('对话已暂停', 'info');
        }
    }

    toggleMic() {
        const btn = document.getElementById('micToggle');
        this.micEnabled = !this.micEnabled;
        
        if (this.micEnabled) {
            btn.classList.add('active');
            this.showNotification('麦克风已启用', 'success');
        } else {
            btn.classList.remove('active');
            this.showNotification('麦克风已关闭', 'info');
        }
    }

    toggleVoice() {
        const btn = document.getElementById('voiceBtn');
        
        if (this.isRecording) {
            this.isRecording = false;
            btn.classList.remove('active');
            this.showNotification('语音输入已停止', 'info');
        } else {
            this.isRecording = true;
            btn.classList.add('active');
            this.showNotification('正在录音，请说话...', 'info');
            
            setTimeout(() => {
                if (this.isRecording) {
                    this.isRecording = false;
                    btn.classList.remove('active');
                    document.getElementById('messageInput').value = '老师，正弦定理怎么用？';
                    this.showNotification('语音识别完成', 'success');
                }
            }, 3000);
        }
    }

    startVoiceInput() {
        document.getElementById('voiceInputBtn').style.background = 'var(--gradient-warning)';
        document.getElementById('voiceInputBtn').style.color = 'white';
        this.showNotification('按住说话，松开结束', 'info');
    }

    stopVoiceInput() {
        document.getElementById('voiceInputBtn').style.background = '';
        document.getElementById('voiceInputBtn').style.color = '';
        document.getElementById('messageInput').value = '老师，我不太懂正弦定理的应用';
        this.showNotification('语音识别完成', 'success');
    }

    toggleCamera() {
        const btn = document.getElementById('toggleCameraBtn');
        const wrapper = document.getElementById('localVideoWrapper');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        this.cameraEnabled = !this.cameraEnabled;
        
        if (this.cameraEnabled) {
            wrapper.style.display = 'block';
            icon.className = 'fas fa-video-slash';
            text.textContent = '关闭摄像头';
            this.showNotification('摄像头已开启', 'success');
        } else {
            wrapper.style.display = 'none';
            icon.className = 'fas fa-video';
            text.textContent = '开启摄像头';
            this.showNotification('摄像头已关闭', 'info');
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon"><i class="fas fa-robot"></i></div>
                <div class="welcome-content">
                    <h4>对话已清空</h4>
                    <p>我是你的数字人老师小智，有什么可以帮你的吗？</p>
                </div>
            </div>
        `;
        this.showNotification('对话记录已清空', 'info');
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
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

    generateLesson() {
        this.showLoading();
        
        setTimeout(() => {
            this.hideLoading();
            const result = document.getElementById('lessonResult');
            result.style.display = 'block';
            result.scrollIntoView({ behavior: 'smooth' });
            this.showNotification('教案生成成功！', 'success');
        }, 1500);
    }

    searchKnowledge() {
        const searchTerm = document.getElementById('knowledgeSearch').value.trim();
        if (!searchTerm) {
            this.showNotification('请输入搜索关键词', 'warning');
            return;
        }
        
        this.showNotification(`正在搜索知识点：${searchTerm}`, 'info');
        
        setTimeout(() => {
            this.showNotification(`找到 3 个相关知识点`, 'success');
        }, 1000);
    }

    handleLessonAction(e) {
        const btn = e.currentTarget;
        const text = btn.textContent.trim();
        
        if (text.includes('PPT')) {
            this.showLoading();
            setTimeout(() => {
                this.hideLoading();
                this.showNotification('PPT生成成功！已保存到本地', 'success');
            }, 2000);
        } else if (text.includes('配图')) {
            this.showLoading();
            setTimeout(() => {
                this.hideLoading();
                this.showNotification('教学配图生成成功！已插入教案', 'success');
            }, 2000);
        } else if (text.includes('导出')) {
            this.showNotification('教案已导出为PDF文件', 'success');
        }
    }

    saveSettings() {
        this.closeModal('settingsModal');
        this.showNotification('设置已保存', 'success');
    }

    updateConnectionStatus(connected) {
        const dot = document.getElementById('connectionDot');
        const status = document.getElementById('connectionStatus');
        
        if (connected) {
            dot.classList.add('connected');
            status.textContent = '已连接';
        } else {
            dot.classList.remove('connected');
            status.textContent = '连接中...';
        }
    }

    showNotification(message, type = 'info') {
        const container = document.querySelector('.notification-container');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        container.appendChild(notification);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showLoading() {
        document.querySelector('.loading-overlay').classList.add('show');
    }

    hideLoading() {
        document.querySelector('.loading-overlay').classList.remove('show');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AvatarChatApp();
});
