// Dashboard 模块逻辑
class DashboardModule {
  constructor() {
    this.stats = {
      sessions: 0,
      users: 0,
      avatars: 0,
      templates: 0,
    };
    this.init();
  }

  init() {
    this.loadStats();
    this.bindEvents();
  }

  loadStats() {
    console.log('🔄 开始加载统计数据...');
    
    // 直接使用模拟数据（不依赖API）
    this.loadMockData();
    
    // 确保数据已设置
    this.stats.sessions = this.stats.sessions !== undefined ? this.stats.sessions : 0;
    this.stats.users = this.stats.users !== undefined ? this.stats.users : 1;
    this.stats.avatars = this.stats.avatars !== undefined ? this.stats.avatars : 1;
    this.stats.templates = this.stats.templates !== undefined ? this.stats.templates : 1;

    console.log('📊 最终统计数据:', this.stats);
    console.log('📊 DOM元素检查:', {
      'stat-sessions': document.getElementById('stat-sessions'),
      'stat-users': document.getElementById('stat-users'),
      'stat-avatars': document.getElementById('stat-avatars'),
      'stat-templates': document.getElementById('stat-templates')
    });

    // 立即更新显示（不使用动画，直接设置）
    const sessionsEl = document.getElementById('stat-sessions');
    const usersEl = document.getElementById('stat-users');
    const avatarsEl = document.getElementById('stat-avatars');
    const templatesEl = document.getElementById('stat-templates');
    
    if (sessionsEl) {
      sessionsEl.textContent = this.stats.sessions;
      console.log('✅ 已设置今日会话:', this.stats.sessions);
    } else {
      console.error('❌ 找不到 stat-sessions 元素');
    }
    
    if (usersEl) {
      usersEl.textContent = this.stats.users;
      console.log('✅ 已设置活跃用户:', this.stats.users);
    } else {
      console.error('❌ 找不到 stat-users 元素');
    }
    
    if (avatarsEl) {
      avatarsEl.textContent = this.stats.avatars;
      console.log('✅ 已设置数字人数量:', this.stats.avatars);
    } else {
      console.error('❌ 找不到 stat-avatars 元素');
    }
    
    if (templatesEl) {
      templatesEl.textContent = this.stats.templates;
      console.log('✅ 已设置模板数量:', this.stats.templates);
    } else {
      console.error('❌ 找不到 stat-templates 元素');
    }
    
    // 加载活动数据
    this.loadActivities();
  }

  // 加载模拟数据
  loadMockData() {
    // 从localStorage加载今日会话计数
    const today = new Date().toDateString();
    const sessionKey = `daily_sessions_${today}`;
    let sessionCount = 0;
    
    try {
      sessionCount = parseInt(localStorage.getItem(sessionKey) || '0', 10);
      
      // 如果今天还没有计数，从总的会话计数中获取
      if (sessionCount === 0) {
        const totalSessions = parseInt(localStorage.getItem('total_sessions') || '0', 10);
        sessionCount = totalSessions;
      }
    } catch (e) {
      console.error('读取localStorage失败:', e);
      sessionCount = 0;
    }
    
    // 确保至少显示一些数据
    this.stats.sessions = sessionCount;
    this.stats.users = 1;      // 固定为1
    this.stats.avatars = 1;    // 固定为1
    this.stats.templates = 1;   // 固定为1
    
    console.log('📊 加载统计数据:', this.stats);
    console.log('📊 localStorage中的会话计数:', {
      today: today,
      sessionKey: sessionKey,
      todayCount: localStorage.getItem(sessionKey),
      totalCount: localStorage.getItem('total_sessions')
    });
  }

  // 加载活动数据
  loadActivities() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;

    // 模拟活动数据
    const activities = [
      { icon: '✓', title: '系统启动', time: '刚刚', color: '#52c41a' },
      { icon: '⏰', title: '控制台已就绪', time: '1分钟前', color: '#1890ff' },
      { icon: '👤', title: '新用户注册', time: '5分钟前', color: '#7873f6' },
      { icon: '💬', title: '会话创建', time: '10分钟前', color: '#52c41a' },
      { icon: '📝', title: '模板更新', time: '15分钟前', color: '#faad14' },
      { icon: '📚', title: '知识库同步', time: '20分钟前', color: '#1890ff' },
    ];

    // 清空现有内容
    timeline.innerHTML = '';

    // 添加活动项
    activities.forEach(activity => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-dot" style="background: ${activity.color}20; color: ${activity.color};">
          ${activity.icon}
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      `;
      timeline.appendChild(item);
    });
  }

  updateStatDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      // 添加动画效果
      const currentValue = parseInt(element.textContent) || 0;
      this.animateValue(element, currentValue, value, 500);
    }
  }

  animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current);
    }, 16);
  }

  bindEvents() {
    // 快速操作按钮
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        this.handleAction(action);
      });
    });
  }

  handleAction(action) {
    switch (action) {
      case 'avatars':
        if (window.consoleManager) {
          window.consoleManager.switchModule('avatars');
        } else {
          window.location.href = 'console.html?module=avatars';
        }
        break;
      case 'knowledge':
        if (window.consoleManager) {
          window.consoleManager.switchModule('knowledge');
        } else {
          window.location.href = 'console.html?module=knowledge';
        }
        break;
      case 'templates':
        if (window.consoleManager) {
          window.consoleManager.switchModule('templates');
        } else {
          window.location.href = 'console.html?module=templates';
        }
        break;
      case 'videochat':
        window.location.href = 'videochat.html';
        break;
      default:
        console.log('未知操作:', action);
    }
  }
}

// 将DashboardModule暴露到全局
window.DashboardModule = DashboardModule;

// 初始化Dashboard模块
function initDashboard() {
  // 尝试多种方式查找dashboard元素
  const dashboardElement = document.querySelector('.dashboard') || 
                          document.querySelector('.module-content.dashboard') ||
                          document.querySelector('#content-wrapper .dashboard') ||
                          document.querySelector('[class*="dashboard"]');
  
  console.log('🔍 检查Dashboard初始化:', {
    'dashboard元素存在': !!dashboardElement,
    'dashboardModule已存在': !!window.dashboardModule,
    'DashboardModule类存在': !!window.DashboardModule,
    '找到的元素': dashboardElement ? dashboardElement.className : 'null'
  });
  
  if (dashboardElement && !window.dashboardModule) {
    try {
      window.dashboardModule = new DashboardModule();
      console.log('✅ Dashboard模块已初始化');
      // 确保数据加载
      if (window.dashboardModule.loadStats) {
        window.dashboardModule.loadStats();
      }
    } catch (e) {
      console.error('❌ Dashboard模块初始化失败:', e);
    }
  } else if (dashboardElement && window.dashboardModule) {
    // 如果模块已存在，重新加载数据
    console.log('🔄 Dashboard模块已存在，重新加载数据');
    if (window.dashboardModule.loadStats) {
      window.dashboardModule.loadStats();
    }
  } else if (!dashboardElement) {
    console.warn('⚠️ Dashboard元素未找到，可能HTML还未加载完成');
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  // DOM已经加载完成
  initDashboard();
}

// 也支持延迟初始化（当模块动态加载时）
setTimeout(initDashboard, 300);
setTimeout(initDashboard, 800);
setTimeout(initDashboard, 1500);
