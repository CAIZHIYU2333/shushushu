// AI数字人教学辅助平台 - 前端逻辑
class TeachingApp {
    constructor() {
        this.isConnected = false;
        this.currentTheme = localStorage.getItem('teaching-theme') || 'dark';
        this.init();
    }

    async init() {
        try {
            this.initLucideIcons();
            this.setupEventListeners();
            this.loadTheme();
            this.showNotification('系统初始化完成', 'success');
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    initLucideIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setupEventListeners() {
        // 返回按钮
        const backBtn = document.getElementById('back-to-videochat');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/ui/videochat.html';
            });
        }

        // 头部按钮
        document.getElementById('memoryBtn')?.addEventListener('click', () => this.openModal('memoryModal'));
        document.getElementById('knowledgeBtn')?.addEventListener('click', () => this.openModal('knowledgeModal'));
        document.getElementById('lessonBtn')?.addEventListener('click', () => this.openModal('lessonModal'));
        document.getElementById('evaluationBtn')?.addEventListener('click', () => this.openModal('evaluationModal'));
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openModal('settingsModal'));

        // 关闭按钮
        document.getElementById('closeMemory')?.addEventListener('click', () => this.closeModal('memoryModal'));
        document.getElementById('closeKnowledge')?.addEventListener('click', () => this.closeModal('knowledgeModal'));
        document.getElementById('closeLesson')?.addEventListener('click', () => this.closeModal('lessonModal'));
        document.getElementById('closeEvaluation')?.addEventListener('click', () => this.closeModal('evaluationModal'));
        document.getElementById('closeSettings')?.addEventListener('click', () => this.closeModal('settingsModal'));

        // 点击弹窗外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // 教案生成按钮
        document.getElementById('generateLesson')?.addEventListener('click', () => this.generateLesson());

        // 知识图谱搜索
        document.getElementById('searchKnowledge')?.addEventListener('click', () => this.searchKnowledge());

        // 设置保存
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettings')?.addEventListener('click', () => this.closeModal('settingsModal'));

        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // 清空对话
        document.getElementById('clearChat')?.addEventListener('click', () => this.clearChat());

        // 发送消息
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 数字人控制
        document.getElementById('avatarToggle')?.addEventListener('click', () => this.toggleAvatar());
        document.getElementById('toggleCameraBtn')?.addEventListener('click', () => this.toggleCamera());
        document.getElementById('micToggle')?.addEventListener('click', () => this.toggleMic());

        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
    }

    // 弹窗管理
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // 标签页切换
    switchTab(tabName) {
        // 更新按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // 更新内容显示
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const targetPane = document.getElementById(`${tabName}-tab`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    // 教案生成（模拟）
    generateLesson() {
        this.showLoading(true);
        
        setTimeout(() => {
            this.showLoading(false);
            const result = document.getElementById('lessonResult');
            if (result) {
                result.style.display = 'block';
                this.showNotification('教案生成成功', 'success');
            }
        }, 1500);
    }

    // 知识图谱搜索（模拟）
    searchKnowledge() {
        const searchInput = document.getElementById('knowledgeSearch');
        if (searchInput && searchInput.value.trim()) {
            this.showNotification(`搜索: ${searchInput.value}`, 'info');
        }
    }

    // 保存设置
    saveSettings() {
        const theme = document.getElementById('theme')?.value;
        if (theme) {
            localStorage.setItem('teaching-theme', theme);
            this.loadTheme();
        }
        this.showNotification('设置已保存', 'success');
        this.closeModal('settingsModal');
    }

    // 加载主题
    loadTheme() {
        const theme = localStorage.getItem('teaching-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeSelect = document.getElementById('theme');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    // 清空对话
    clearChat() {
        const messages = document.getElementById('chatMessages');
        if (messages) {
            messages.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <i data-lucide="message-circle" style="width: 32px; height: 32px;"></i>
                    </div>
                    <div class="welcome-content">
                        <h4>对话已清空</h4>
                        <p>开始新的对话吧！</p>
                    </div>
                </div>
            `;
            this.initLucideIcons();
            this.showNotification('对话已清空', 'info');
        }
    }

    // 发送消息
    sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        this.addMessage('user', message);
        input.value = '';

        // 模拟AI回复
        setTimeout(() => {
            this.addMessage('ai', '这是一个模拟回复。在实际应用中，这里会连接AI模型生成真实回复。');
        }, 1000);
    }

    // 添加消息
    addMessage(type, content) {
        const messages = document.getElementById('chatMessages');
        if (!messages) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        messages.appendChild(messageEl);
        messages.scrollTop = messages.scrollHeight;
    }

    // 数字人控制
    toggleAvatar() {
        const btn = document.getElementById('avatarToggle');
        if (btn) {
            const isPlaying = btn.classList.contains('playing');
            if (isPlaying) {
                btn.classList.remove('playing');
                btn.innerHTML = '<i data-lucide="play" style="width: 18px; height: 18px;"></i><span>开始对话</span>';
                this.showNotification('数字人已暂停', 'info');
            } else {
                btn.classList.add('playing');
                btn.innerHTML = '<i data-lucide="pause" style="width: 18px; height: 18px;"></i><span>暂停对话</span>';
                this.showNotification('数字人已启动', 'success');
            }
            this.initLucideIcons();
        }
    }

    toggleCamera() {
        const wrapper = document.getElementById('localVideoWrapper');
        if (wrapper) {
            const isVisible = wrapper.style.display !== 'none';
            wrapper.style.display = isVisible ? 'none' : 'block';
            this.showNotification(isVisible ? '摄像头已关闭' : '摄像头已开启', 'info');
        }
    }

    toggleMic() {
        const btn = document.getElementById('micToggle');
        if (btn) {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            this.showNotification(isActive ? '麦克风已开启' : '麦克风已关闭', 'info');
        }
    }

    // 加载状态
    showLoading(show) {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
    }

    // 通知系统
    showNotification(message, type = 'info') {
        const container = document.querySelector('.notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
        `;
        notification.style.cssText = `
            padding: 12px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 999px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    .message {
        padding: 12px 16px;
        border-radius: 12px;
        max-width: 80%;
        animation: slideIn 0.3s ease;
    }
    .message-user {
        background: var(--primary);
        color: white;
        margin-left: auto;
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .message-ai {
        background: var(--bg-card);
        color: var(--text-primary);
        margin-right: auto;
        box-shadow: 0 0 0 1px rgba(42, 52, 80, 0.5), 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .message-content {
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 4px;
    }
    .message-time {
        font-size: 11px;
        opacity: 0.7;
        text-align: right;
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.teachingApp = new TeachingApp();
});
