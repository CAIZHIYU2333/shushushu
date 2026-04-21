// 数据可视化模块逻辑
class AnalyticsModule {
  constructor() {
    this.sessions = [];
    this.init();
  }

  init() {
    this.loadStats();
    this.loadSessions();
    this.bindEvents();
  }

  async loadStats() {
    try {
      const response = await apiService.getAnalyticsStats();
      if (response.success && response.data) {
        const data = response.data;
        this.updateStat('stat-sessions', data.total_sessions || 0);
        this.updateStat('stat-users', data.total_users || 0);
        this.updateStat('stat-active', data.active_users || 0);
        this.updateStat('stat-duration', this.formatDuration(data.avg_session_duration || 0));
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  async loadSessions() {
    const tbody = document.getElementById('sessions-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="loading">加载中...</td></tr>';
    try {
      const response = await apiService.getSessions();
      if (response.success && response.data) {
        this.sessions = Array.isArray(response.data) ? response.data : [];
        this.renderSessions();
      }
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">加载失败</td></tr>';
    }
  }

  renderSessions() {
    const tbody = document.getElementById('sessions-tbody');
    if (!tbody) return;
    tbody.innerHTML = this.sessions.length === 0 ?
      '<tr><td colspan="6" class="loading">暂无数据</td></tr>' :
      this.sessions.map(session => `
        <tr>
          <td>${session.id || '-'}</td>
          <td>${session.user_id || '-'}</td>
          <td>${session.start_time || '-'}</td>
          <td>${session.end_time || '-'}</td>
          <td>${this.formatDuration(session.duration || 0)}</td>
          <td><span class="tag tag-blue">${session.status || 'completed'}</span></td>
        </tr>
      `).join('');
  }

  updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
  }

  formatDuration(seconds) {
    if (!seconds) return '0分钟';
    const mins = Math.floor(seconds / 60);
    return `${mins}分钟`;
  }

  bindEvents() {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
  }

  async exportData() {
    try {
      const response = await apiService.exportData('json');
      if (response.success) {
        alert('导出功能待实现');
      }
    } catch (error) {
      alert('导出失败');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.analytics-management')) {
    window.analyticsModule = new AnalyticsModule();
  }
});

