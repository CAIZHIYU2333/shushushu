class MemoryManager {
  constructor() {
    this.currentStudentId = null;
    this.cacheDom();
    this.bindTabs();
  }

  cacheDom() {
    this.studentSelect = document.getElementById('memory-student-select');
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
      });
    });
  }

  async init() {
    await this.loadStudentList();
    await this.loadSystemPrompt();
  }

  async loadStudentList() {
    try {
      const res = await fetch('/api/students/');
      const data = await res.json();
      if (data.success && this.studentSelect) {
        let opts = '<option value="">选择学生...</option>';
        data.data.forEach(s => {
          opts += `<option value="${s.id}">${s.name} (${s.grade} ${s.school || ''})</option>`;
        });
        this.studentSelect.innerHTML = opts;
      }
    } catch (e) {}
  }

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
      editor.value = '无法获取系统提示词';
    }
  }

  async loadStudent() {
    const sid = this.studentSelect ? this.studentSelect.value : '';
    this.currentStudentId = sid || null;

    if (!sid) {
      ['long-term', 'short-term'].forEach(k => {
        if (this.editors[k]) this.editors[k].value = '';
      });
      return;
    }

    if (this.editors['long-term']) this.editors['long-term'].value = '加载中...';
    if (this.editors['short-term']) this.editors['short-term'].value = '加载中...';

    try {
      const res = await fetch('/api/memory/' + sid);
      const data = await res.json();
      if (data.success) {
        if (this.editors['long-term']) {
          this.editors['long-term'].value = data.data.long_term_memory || '';
        }
        if (this.editors['short-term']) {
          this.editors['short-term'].value = data.data.short_term_memory || '';
        }
      } else {
        ['long-term', 'short-term'].forEach(k => {
          if (this.editors[k]) this.editors[k].value = '';
        });
      }
    } catch (e) {
      ['long-term', 'short-term'].forEach(k => {
        if (this.editors[k]) this.editors[k].value = '加载失败，请检查网络';
      });
    }
  }

  async saveMemory(type) {
    if (!this.currentStudentId) {
      alert('请先选择学生');
      return;
    }
    const editor = this.editors[type];
    if (!editor) return;

    try {
      const res = await fetch(`/api/memory/${this.currentStudentId}/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.value }),
      });
      const data = await res.json();
      if (data.success) {
        alert('已保存');
      } else {
        alert('保存失败: ' + (data.error || '未知错误'));
      }
    } catch (e) {
      alert('网络错误: ' + e.message);
    }
  }

  clearMemory(type) {
    if (!confirm('确定清空？')) return;
    const editor = this.editors[type];
    if (editor) editor.value = '';
  }

  async generateProfile() {
    if (!this.currentStudentId) {
      alert('请先选择学生');
      return;
    }
    if (this.profileBtn) {
      this.profileBtn.disabled = true;
      this.profileBtn.textContent = '生成中...';
    }
    try {
      const res = await fetch(`/api/memory/${this.currentStudentId}/generate_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: this.currentStudentId, conversation_history: [] }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const profile = data.data;
        let text = `学习风格: ${profile.learning_style || '未知'}\n`;
        text += `优势: ${(profile.strengths || []).join('、')}\n`;
        text += `薄弱点: ${(profile.weaknesses || []).join('、')}\n`;
        text += `建议: ${(profile.suggestions || []).join('；')}\n`;
        text += `信心分: ${profile.confidence_score || 'N/A'}\n`;
        if (this.editors['long-term']) {
          this.editors['long-term'].value = text + '\n---\n' + (this.editors['long-term'].value || '');
        }
        alert('学习画像已生成并追加到长期记忆');
      } else {
        alert('生成失败: ' + (data.error || '未知错误'));
      }
    } catch (e) {
      alert('网络错误: ' + e.message);
    }
    if (this.profileBtn) {
      this.profileBtn.disabled = false;
      this.profileBtn.textContent = '生成画像';
    }
  }
}

window.MemoryManager = MemoryManager;
