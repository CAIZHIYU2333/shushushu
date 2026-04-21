// 知识库管理模块逻辑
class KnowledgeModule {
  constructor() {
    this.topics = [];
    this.editingTopic = null;
    this.init();
  }

  init() {
    this.loadTopics();
    this.bindEvents();
  }

  async loadTopics() {
    const tbody = document.getElementById('topics-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="loading">加载中...</td></tr>';
    try {
      const response = await apiService.getKnowledgeTopics();
      if (response.success && response.data) {
        this.topics = Array.isArray(response.data) ? response.data : [];
        this.renderTopics();
      }
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading">加载失败</td></tr>`;
    }
  }

  renderTopics() {
    const tbody = document.getElementById('topics-tbody');
    if (!tbody) return;
    tbody.innerHTML = this.topics.length === 0 ? 
      '<tr><td colspan="5" class="loading">暂无数据</td></tr>' :
      this.topics.map(topic => `
        <tr>
          <td>${topic.id || '-'}</td>
          <td>${topic.name || '-'}</td>
          <td>${topic.description || '-'}</td>
          <td>${topic.file_count || 0}</td>
          <td>
            <button class="btn-link" onclick="window.knowledgeModule.editTopic('${topic.id}')">编辑</button>
            <button class="btn-link danger" onclick="window.knowledgeModule.deleteTopic('${topic.id}')">删除</button>
          </td>
        </tr>
      `).join('');
  }

  bindEvents() {
    const addBtn = document.getElementById('add-topic-btn');
    const modal = document.getElementById('topic-modal');
    const closeBtn = document.getElementById('topic-modal-close');
    const cancelBtn = document.getElementById('topic-modal-cancel');
    const submitBtn = document.getElementById('topic-modal-submit');

    if (addBtn) addBtn.addEventListener('click', () => this.showModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal());
    if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.hideModal(); });
  }

  showModal(topic = null) {
    this.editingTopic = topic;
    const modal = document.getElementById('topic-modal');
    const title = document.getElementById('topic-modal-title');
    if (title) title.textContent = topic ? '编辑主题' : '添加主题';
    const form = document.getElementById('topic-form');
    if (form) {
      form.reset();
      if (topic) {
        document.getElementById('topic-name').value = topic.name || '';
        document.getElementById('topic-description').value = topic.description || '';
      }
    }
    if (modal) modal.classList.add('show');
  }

  hideModal() {
    const modal = document.getElementById('topic-modal');
    if (modal) modal.classList.remove('show');
    this.editingTopic = null;
  }

  async handleSubmit() {
    const name = document.getElementById('topic-name').value;
    const description = document.getElementById('topic-description').value;
    if (!name) { alert('请填写主题名称'); return; }
    try {
      const response = this.editingTopic ? 
        await apiService.updateKnowledgeTopic(this.editingTopic.id, { name, description }) :
        await apiService.createKnowledgeTopic({ name, description });
      if (response.success) {
        alert(this.editingTopic ? '主题更新成功' : '主题创建成功');
        this.hideModal();
        this.loadTopics();
      }
    } catch (error) {
      alert('操作失败');
    }
  }

  editTopic(topicId) {
    const topic = this.topics.find(t => t.id === topicId);
    if (topic) this.showModal(topic);
  }

  async deleteTopic(topicId) {
    if (!confirm('确定要删除这个主题吗？')) return;
    try {
      const response = await apiService.deleteKnowledgeTopic(topicId);
      if (response.success) {
        alert('主题删除成功');
        this.loadTopics();
      }
    } catch (error) {
      alert('删除失败');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.knowledge-management')) {
    window.knowledgeModule = new KnowledgeModule();
  }
});

