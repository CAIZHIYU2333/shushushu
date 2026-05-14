class LessonWizard {
  constructor() {
    this.currentLessonId = null;
    this.currentData = null;
    this.isGenerating = false;
    this.stepElements = {};
    this.cacheDom();
    this.bindButtons();
  }

  cacheDom() {
    this.stepElements = {
      step1: document.getElementById('lesson-step-1'),
      step2: document.getElementById('lesson-step-2'),
      step3: document.getElementById('lesson-step-3'),
      form: document.getElementById('lesson-generate-form'),
      outlineContainer: document.getElementById('lesson-outline-container'),
      resultContainer: document.getElementById('lesson-result-container'),
      progressContainer: document.getElementById('lesson-progress-container'),
      generateBtn: document.getElementById('lesson-generate-btn'),
      confirmBtn: document.getElementById('lesson-confirm-btn'),
    };
  }

  bindButtons() {
    const btn = this.stepElements.generateBtn;
    if (btn) {
      btn.addEventListener('click', () => this._safeGenerate());
    }
  }

  setLoading(loading) {
    this.isGenerating = loading;
    const btn = this.stepElements.generateBtn;
    const confirmBtn = this.stepElements.confirmBtn;
    if (btn) {
      btn.disabled = loading;
      btn.innerHTML = loading
        ? '<span class="spinner"></span> 生成中...'
        : '生成大纲';
      btn.style.opacity = loading ? '0.7' : '1';
      btn.style.cursor = loading ? 'not-allowed' : 'pointer';
    }
    if (confirmBtn) {
      confirmBtn.disabled = loading;
      confirmBtn.innerHTML = loading
        ? '<span class="spinner"></span> 处理中...'
        : '确认并生成完整教案';
      confirmBtn.style.opacity = loading ? '0.7' : '1';
      confirmBtn.style.cursor = loading ? 'not-allowed' : 'pointer';
    }
  }

  _safeGenerate() {
    if (this.isGenerating) return;
    const topic = document.getElementById('lesson-topic').value.trim();
    const objective = document.getElementById('lesson-objective').value.trim();
    if (!topic || !objective) {
      alert('请填写教学主题和教学目标');
      return;
    }
    this.setLoading(true);
    this.generateOutline({
      subject: document.getElementById('lesson-subject').value,
      topic: topic,
      objective: objective,
      level: document.getElementById('lesson-level').value,
      student_level: document.getElementById('lesson-student-level').value,
      duration: parseInt(document.getElementById('lesson-duration').value),
    });
  }

  showStep(step) {
    ['step1', 'step2', 'step3'].forEach(k => {
      const el = this.stepElements[k];
      if (el) el.style.display = (k === step) ? 'block' : 'none';
    });
  }

  showProgress(items) {
    const container = this.stepElements.progressContainer;
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = items.map(item =>
      `<div class="progress-item ${item.done ? 'done' : item.active ? 'active' : ''}">
        <span class="progress-icon">${item.done ? '&#10003;' : item.active ? '&#8987;' : '&#9675;'}</span>
        <span class="progress-text">${item.text}</span>
      </div>`
    ).join('');
  }

  async generateOutline(formData) {
    this.showStep('step2');
    this.showProgress([{ text: '正在生成教案大纲...', active: true, done: false }]);

    try {
      const res = await fetch('/api/lesson/generate_outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!data.success) {
        alert('生成大纲失败: ' + (data.error || '未知错误'));
        this.showStep('step1');
        this.setLoading(false);
        return;
      }

      this.currentLessonId = data.lesson_id;
      this.currentData = data.data;
      this.showProgress([{ text: '教案大纲已生成', active: false, done: true }]);
      this.renderOutline(data.data);
      this.setLoading(false);
    } catch (e) {
      alert('网络错误: ' + e.message);
      this.showStep('step1');
      this.setLoading(false);
    }
  }

  renderOutline(data) {
    const container = this.stepElements.outlineContainer;
    if (!container) return;

    document.getElementById('lesson-outline-title').textContent = data.title || '教案大纲';

    let html = '';
    const sections = data.sections || [];
    sections.forEach((sec, i) => {
      html += `
        <div class="outline-section" data-index="${i}">
          <div class="outline-section-header">
            <span class="outline-section-title">
              <input type="text" class="outline-title-input" value="${this.escapeHtml(sec.title || '')}" data-field="title" data-index="${i}">
            </span>
            <span class="outline-section-duration">
              <input type="number" class="outline-duration-input" value="${sec.duration || 10}" min="1" max="120" data-field="duration" data-index="${i}"> 分钟
            </span>
          </div>
          <div class="outline-section-body">
            <textarea class="outline-content-input" data-field="content" data-index="${i}" rows="4">${this.escapeHtml(sec.content || '')}</textarea>
          </div>
          <div class="outline-section-image">
            <label>
              <input type="checkbox" class="outline-need-image" data-field="need_image" data-index="${i}" ${sec.need_image ? 'checked' : ''}>
              需要配图
            </label>
            <input type="text" class="outline-image-prompt" data-field="image_prompt" data-index="${i}"
              placeholder="描述插图内容（如：展示Transformer Encoder-Decoder架构的示意图）"
              value="${this.escapeHtml(sec.image_prompt || '')}"
              style="display:${sec.need_image ? 'block' : 'none'}">
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('.outline-need-image').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = e.target.dataset.index;
        const promptInput = container.querySelector(`.outline-image-prompt[data-index="${idx}"]`);
        if (promptInput) promptInput.style.display = e.target.checked ? 'block' : 'none';
      });
    });
  }

  collectOutlineData() {
    const sections = [];
    const container = this.stepElements.outlineContainer;
    if (!container) return sections;
    container.querySelectorAll('.outline-section').forEach(el => {
      const idx = el.dataset.index;
      sections.push({
        title: this._val(el, 'title', idx),
        duration: parseInt(this._val(el, 'duration', idx)) || 10,
        content: this._val(el, 'content', idx, true),
        need_image: el.querySelector(`[data-field="need_image"][data-index="${idx}"]`)?.checked || false,
        image_prompt: this._val(el, 'image_prompt', idx),
        image_url: null,
      });
    });
    return sections;
  }

  _val(container, field, index, textarea) {
    const sel = textarea
      ? `textarea[data-field="${field}"][data-index="${index}"]`
      : `[data-field="${field}"][data-index="${index}"]`;
    const el = container.querySelector(sel);
    return el ? el.value : '';
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async confirmAndGenerate() {
    if (this.isGenerating) return;
    const sections = this.collectOutlineData();
    const title = document.getElementById('lesson-outline-title').textContent;
    if (sections.length === 0) { alert('提纲中没有章节'); return; }

    const styleSelect = document.getElementById('lesson-ppt-style');
    const style = styleSelect ? styleSelect.value : 'academic';
    const hasImages = sections.some(s => s.need_image);

    this.setLoading(true);
    this.showStep('step3');
    this.showProgress([
      { text: '教案大纲已确认', active: false, done: true },
      { text: hasImages ? '正在并发生成教学插图...' : '无需生成插图', active: hasImages, done: !hasImages },
      { text: '正在生成 PPT...', active: false, done: false },
    ]);

    try {
      const res = await fetch('/api/lesson/confirm_outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: this.currentLessonId, title: title,
          sections: sections, style: style, generate_images: hasImages,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        alert('生成失败: ' + (data.error || '未知错误'));
        this.showStep('step2');
        this.setLoading(false);
        return;
      }

      this.showProgress([
        { text: '教案大纲已确认', active: false, done: true },
        { text: hasImages ? `已生成 ${sections.filter(s => s.need_image).length} 张插图` : '无需插图', active: false, done: true },
        { text: 'PPT 已生成', active: false, done: true },
      ]);

      this.renderResult(data.data);
      this.setLoading(false);
    } catch (e) {
      alert('生成过程出错: ' + e.message);
      this.showStep('step2');
      this.setLoading(false);
    }
  }

  renderResult(data) {
    const container = this.stepElements.resultContainer;
    if (!container) return;

    const sections = data.sections || [];
    let html = `<h4 style="text-align:center;margin-bottom:16px;">${this.escapeHtml(data.title || '教案')} - 生成完成</h4>`;

    sections.forEach((sec, i) => {
      html += `<div class="result-section">
        <h5>${i + 1}. ${this.escapeHtml(sec.title || '')} (${sec.duration || 0}分钟)</h5>
        <p>${(sec.content || '').replace(/\n/g, '<br>')}</p>
        ${sec.image_url ? `<div class="result-image"><img src="${sec.image_url}" alt="插图" style="max-width:300px;border-radius:8px;"></div>` : ''}
      </div>`;
    });

    html += `
      <div class="result-actions">
        <a class="btn btn-primary" href="/api/lesson/${this.currentLessonId}/ppt" download>下载 PPT</a>
        <button class="btn btn-secondary" onclick="window.lessonWizard.showStep('step2');window.lessonWizard.setLoading(false);">返回修改</button>
        <button class="btn btn-secondary" onclick="window.lessonWizard.resetForm()">新建教案</button>
      </div>`;
    container.innerHTML = html;
  }

  resetForm() {
    this.currentLessonId = null;
    this.currentData = null;
    this.setLoading(false);
    this.showStep('step1');
    if (this.stepElements.form) this.stepElements.form.reset();
  }
}

window.LessonWizard = LessonWizard;
