// 模板管理模块逻辑
class TemplatesModule {
  constructor() {
    this.templates = [];
    this.editingTemplate = null;
    this.init();
  }

  init() {
    this.loadTemplates();
    this.bindEvents();
  }

  async loadTemplates() {
    const tbody = document.getElementById('templates-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="loading">加载中...</td></tr>';
    try {
      const response = await apiService.getTemplates();
      if (response.success && response.data) {
        this.templates = Array.isArray(response.data) ? response.data : [];
        this.renderTemplates();
      }
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">加载失败</td></tr>';
    }
  }

  renderTemplates() {
    const tbody = document.getElementById('templates-tbody');
    if (!tbody) return;
    tbody.innerHTML = this.templates.length === 0 ?
      '<tr><td colspan="5" class="loading">暂无数据</td></tr>' :
      this.templates.map(template => `
        <tr>
          <td>${template.id || '-'}</td>
          <td>${template.name || '-'}</td>
          <td><span class="tag tag-blue">${template.role_type || '-'}</span></td>
          <td>${template.description || '-'}</td>
          <td>
            <button class="btn-link" onclick="window.templatesModule.applyTemplate('${template.id}')">应用</button>
            <button class="btn-link" onclick="window.templatesModule.editTemplate('${template.id}')">编辑</button>
            <button class="btn-link danger" onclick="window.templatesModule.deleteTemplate('${template.id}')">删除</button>
          </td>
        </tr>
      `).join('');
  }

  bindEvents() {
    const addBtn = document.getElementById('add-template-btn');
    const modal = document.getElementById('template-modal');
    const closeBtn = document.getElementById('template-modal-close');
    const cancelBtn = document.getElementById('template-modal-cancel');
    const submitBtn = document.getElementById('template-modal-submit');

    if (addBtn) addBtn.addEventListener('click', () => this.showModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal());
    if (submitBtn) submitBtn.addEventListener('click', () => this.handleSubmit());
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.hideModal(); });
  }

  showModal(template = null) {
    this.editingTemplate = template;
    const modal = document.getElementById('template-modal');
    const title = document.getElementById('template-modal-title');
    if (title) title.textContent = template ? '编辑模板' : '添加模板';
    const form = document.getElementById('template-form');
    if (form) {
      form.reset();
      if (template) {
        document.getElementById('template-name').value = template.name || '';
        document.getElementById('template-role-type').value = template.role_type || '';
        document.getElementById('template-description').value = template.description || '';
      }
    }
    if (modal) modal.classList.add('show');
  }

  hideModal() {
    const modal = document.getElementById('template-modal');
    if (modal) modal.classList.remove('show');
    this.editingTemplate = null;
  }

  async handleSubmit() {
    const name = document.getElementById('template-name').value;
    const roleType = document.getElementById('template-role-type').value;
    const description = document.getElementById('template-description').value;
    if (!name || !roleType) { alert('请填写必填项'); return; }
    try {
      const response = this.editingTemplate ?
        await apiService.updateTemplate(this.editingTemplate.id, { name, role_type: roleType, description }) :
        await apiService.createTemplate({ name, role_type: roleType, description });
      if (response.success) {
        alert(this.editingTemplate ? '模板更新成功' : '模板创建成功');
        this.hideModal();
        this.loadTemplates();
      }
    } catch (error) {
      alert('操作失败');
    }
  }

  async applyTemplate(templateId) {
    try {
      const response = await apiService.applyTemplate(templateId);
      if (response.success) {
        alert('模板应用成功');
      }
    } catch (error) {
      alert('应用失败');
    }
  }

  editTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (template) this.showModal(template);
  }

  async deleteTemplate(templateId) {
    if (!confirm('确定要删除这个模板吗？')) return;
    try {
      const response = await apiService.deleteTemplate(templateId);
      if (response.success) {
        alert('模板删除成功');
        this.loadTemplates();
      }
    } catch (error) {
      alert('删除失败');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.templates-management')) {
    window.templatesModule = new TemplatesModule();
  }
});

