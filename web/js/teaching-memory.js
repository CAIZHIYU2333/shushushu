class MemoryManager {
  constructor() {
    this.currentStudentId = null;
    this.cacheDom();
    this.bindTabs();
  }

  cacheDom() {
    this.studentSelect = document.getElementById('memory-student-select');
    this.studentList = document.getElementById('mem-student-list');
    this.editors = {
      personality: document.getElementById('mem-editor-personality'),
      'long-term': document.getElementById('mem-editor-long-term'),
      'short-term': document.getElementById('mem-editor-short-term'),
    };
    this.profileBtn = document.getElementById('memory-profile-btn');
  }

  bindTabs() {
    const modal = document.getElementById('teaching-memory-modal');
    if (!modal) return;
    modal.querySelectorAll('.memory-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.memory-tab');
        const tabName = tabBtn.dataset.tab;
        modal.querySelectorAll('.memory-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.memory-tab-panel').forEach(p => p.classList.remove('active'));
        tabBtn.classList.add('active');
        const panel = document.getElementById('mem-panel-' + tabName);
        if (panel) panel.classList.add('active');
        if (tabName === 'students') this.loadStudentList();
        if (tabName === 'personality') this.loadSystemPrompt();
      });
    });
  }

  async init() {
    await this.loadStudentSelect();
    await this.loadSystemPrompt();
  }

  // ===== 系统提示词 =====

  async loadSystemPrompt() {
    const editor = this.editors.personality;
    if (!editor) return;
    editor.value = '加载中...';
    try {
      const res = await fetch('/api/memory/system-prompt');
      const data = await res.json();
      if (data.success) {
        editor.value = data.data.system_prompt || '(未配置)';
      }
    } catch (e) {
      editor.value = '无法获取教师人格设定';
    }
  }

  // ===== 学生选择器 =====

  async loadStudentSelect() {
    try {
      const res = await fetch('/api/students/');
      const data = await res.json();
      if (data.success && this.studentSelect) {
        let opts = '<option value="">选择学生...</option>';
        data.data.forEach(s => {
          opts += `<option value="${s.id}">${this.esc(s.name)} (${this.esc(s.grade)} ${this.esc(s.school || '')})</option>`;
        });
        this.studentSelect.innerHTML = opts;
      }
    } catch (e) {}
  }

  // ===== 学生库 =====

  async loadStudentList() {
    if (!this.studentList) return;
    this.studentList.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">加载中...</p>';
    try {
      const res = await fetch('/api/students/');
      const data = await res.json();
      if (!data.success || !data.data.length) {
        this.studentList.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无学生，请添加或导入</p>';
        return;
      }
      let html = '';
      data.data.forEach(s => {
        html += `<div class="kg-lib-item">
          <div class="kg-lib-item-info">
            <span class="kg-lib-name">${this.esc(s.name)}</span>
            <span class="kg-lib-meta">${this.esc(s.grade)} | ${this.esc(s.school || '')} | ${this.esc(s.email || '')}${s.notes ? ' | ' + this.esc(s.notes) : ''}</span>
          </div>
          <div class="kg-lib-item-actions">
            <button class="btn btn-primary" style="padding:4px 12px;font-size:12px;" onclick="window.memoryManager.editStudent('${s.id}')">编辑</button>
            <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px;" onclick="window.memoryManager.deleteStudent('${s.id}')">删除</button>
          </div>
        </div>`;
      });
      this.studentList.innerHTML = html;
    } catch (e) {
      this.studentList.innerHTML = '<p style="color:red;text-align:center;padding:20px;">加载失败</p>';
    }
  }

  async addStudent() {
    const name = document.getElementById('mem-s-name').value.trim();
    if (!name) { alert('请填写姓名'); return; }
    const body = {
      name: name,
      grade: document.getElementById('mem-s-grade').value.trim() || '未知',
      school: document.getElementById('mem-s-school').value.trim() || '未知',
      email: document.getElementById('mem-s-email').value.trim(),
      phone: document.getElementById('mem-s-phone').value.trim(),
      notes: document.getElementById('mem-s-notes').value.trim(),
    };
    try {
      const res = await fetch('/api/students/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('mem-student-form').style.display = 'none';
        document.getElementById('mem-s-name').value = '';
        this.loadStudentList();
        this.loadStudentSelect();
        alert('已添加');
      } else {
        alert('添加失败: ' + (data.error || ''));
      }
    } catch (e) { alert('网络错误'); }
  }

  editStudent(sid) {
    const form = document.getElementById('mem-student-form');
    form.style.display = 'block';
    fetch('/api/students/' + sid).then(r => r.json()).then(data => {
      if (!data.success) return;
      const s = data.data;
      document.getElementById('mem-s-name').value = s.name || '';
      document.getElementById('mem-s-grade').value = s.grade || '';
      document.getElementById('mem-s-school').value = s.school || '';
      document.getElementById('mem-s-email').value = s.email || '';
      document.getElementById('mem-s-phone').value = s.phone || '';
      document.getElementById('mem-s-notes').value = s.notes || '';
      document.getElementById('mem-s-name').dataset.editId = sid;
    }).catch(() => {});
  }

  async deleteStudent(sid) {
    if (!confirm('确定删除该学生吗？相关记忆数据将保留在文件中。')) return;
    try {
      await fetch('/api/students/' + sid, { method: 'DELETE' });
      this.loadStudentList();
      this.loadStudentSelect();
    } catch (e) { alert('删除失败'); }
  }

  async importCSV(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/students/csv-import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        alert('成功导入 ' + data.imported + ' 名学生');
        this.loadStudentList();
        this.loadStudentSelect();
      } else {
        alert('导入失败: ' + (data.error || ''));
      }
    } catch (e) { alert('网络错误'); }
  }

  // ===== 记忆加载/保存 =====

  async loadStudent() {
    const sid = this.studentSelect ? this.studentSelect.value : '';
    this.currentStudentId = sid || null;
    if (!sid) {
      ['long-term', 'short-term'].forEach(k => { if (this.editors[k]) this.editors[k].value = ''; });
      return;
    }
    ['long-term', 'short-term'].forEach(k => { if (this.editors[k]) this.editors[k].value = '加载中...'; });
    try {
      const res = await fetch('/api/memory/' + sid);
      const data = await res.json();
      if (data.success) {
        if (this.editors['long-term']) this.editors['long-term'].value = data.data.long_term_memory || '';
        if (this.editors['short-term']) this.editors['short-term'].value = data.data.short_term_memory || '';
      }
    } catch (e) {
      ['long-term', 'short-term'].forEach(k => { if (this.editors[k]) this.editors[k].value = '加载失败'; });
    }
  }

  async saveMemory(type) {
    if (!this.currentStudentId) { alert('请先选择学生'); return; }
    const editor = this.editors[type];
    if (!editor) return;
    try {
      const res = await fetch(`/api/memory/${this.currentStudentId}/${type}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.value }),
      });
      const data = await res.json();
      alert(data.success ? '已保存' : '保存失败: ' + (data.error || ''));
    } catch (e) { alert('网络错误: ' + e.message); }
  }

  clearMemory(type) {
    if (!confirm('确定清空？')) return;
    const editor = this.editors[type];
    if (editor) editor.value = '';
  }

  async generateProfile() {
    if (!this.currentStudentId) { alert('请先选择学生'); return; }
    if (this.profileBtn) { this.profileBtn.disabled = true; this.profileBtn.textContent = '生成中...'; }
    try {
      const res = await fetch(`/api/memory/${this.currentStudentId}/generate_profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: this.currentStudentId, conversation_history: [] }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        let text = '学习风格: ' + (p.learning_style || '未知') + '\n';
        text += '优势: ' + (p.strengths || []).join(', ') + '\n';
        text += '薄弱点: ' + (p.weaknesses || []).join(', ') + '\n';
        text += '建议: ' + (p.suggestions || []).join('; ') + '\n';
        text += '信心分: ' + (p.confidence_score || 'N/A') + '\n';
        if (this.editors['long-term']) {
          this.editors['long-term'].value = text + '\n---\n' + (this.editors['long-term'].value || '');
        }
        alert('学习画像已生成并追加到长期记忆');
      } else {
        alert('生成失败: ' + (data.error || '未知错误'));
      }
    } catch (e) { alert('网络错误: ' + e.message); }
    if (this.profileBtn) { this.profileBtn.disabled = false; this.profileBtn.textContent = '生成画像'; }
  }

  esc(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}

window.MemoryManager = MemoryManager;
