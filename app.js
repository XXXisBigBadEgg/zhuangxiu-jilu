/* ============ 装修记录 · 交互逻辑（数据存于 localStorage） ============ */
(function () {
  'use strict';

  var STORAGE_KEY = 'zhuangxiu-records-v1';

  /* 记录方向（左页面的选项）—— icon 为矢量图标键 */
  var CATEGORIES = [
    { id: 'design',     name: '设计',     icon: 'design' },
    { id: 'masonry',    name: '瓦工',     icon: 'masonry' },
    { id: 'carpentry',  name: '木工',     icon: 'carpentry' },
    { id: 'painting',   name: '油工',     icon: 'painting' },
    { id: 'install',    name: '安装',     icon: 'install' },
    { id: 'wholehouse', name: '全屋定制', icon: 'wholehouse' },
    { id: 'appliance',  name: '电器',     icon: 'appliance' },
    { id: 'furniture',  name: '家具',     icon: 'furniture' },
    { id: 'misc',       name: '零散花销', icon: 'misc' },
    { id: 'bill',       name: '账单',     icon: 'bill' }
  ];
  /* 记账类目 = 除 设计/账单 外的 8 个方向（设计不再记账，其余方向改为工作台但历史账目仍在账单展示） */
  var RECORD_CATS = CATEGORIES.filter(function (c) { return c.id !== 'bill' && c.id !== 'design'; });

  /* ---------- 矢量图标库（统一描边风格，随容器 currentColor） ---------- */
  function svgI(path) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
           'stroke-linecap="round" stroke-linejoin="round" width="24" height="24" aria-hidden="true">' +
           path + '</svg>';
  }
  var ICONS = {
    design:     svgI('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
    masonry:    svgI('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v6M15 15v6"/>'),
    carpentry:  svgI('<path d="M14 3 21 10 18 13 11 6Z"/><path d="M12 7 4 15"/>'),
    painting:   svgI('<rect x="8" y="4" width="10" height="5" rx="1.5"/><path d="M10 9v7"/><path d="M7 16h6"/>'),
    install:    svgI('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    wholehouse: svgI('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18"/><path d="M8 12h2M14 12h2"/>'),
    appliance:  svgI('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
    furniture:  svgI('<rect x="5" y="9" width="14" height="7" rx="1.5"/><path d="M5 16v3M19 16v3"/><path d="M4 9V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1"/><path d="M2 11a2 2 0 0 1 4 0v3H2Z"/><path d="M18 11a2 2 0 0 1 4 0v3h-4Z"/>'),
    misc:       svgI('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    bill:       svgI('<path d="M4 21h18"/><path d="M7 21V11M13 21V6M19 21v-8"/>'),
    pencil:     svgI('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
    trash:      svgI('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>'),
    x:          svgI('<path d="M18 6 6 18M6 6l12 12"/>'),
    image:      svgI('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    lightbulb:  svgI('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/>'),
    link:       svgI('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>')
  };
  window.RENO_ICONS = ICONS;

  var state = { current: 'bill', editingId: null, editingCat: null };

  /* 数据：data[分类id] = [{ id, date, name, amount, note, createdAt }] */
  var data = load();

  function $(sel) { return document.querySelector(sel); }
  function catOf(id) { return CATEGORIES.find(function (c) { return c.id === id; }); }

  /* ---------- 本地存储 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object') return d;
      }
    } catch (e) { /* 损坏数据时忽略，重新开始 */ }
    return {};
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* 隐私模式下可能失败 */ }
  }

  /* 类目类型：账单 = 记账中心 / 设计 = 图纸+灵感墙 / 其他 = 工作台 */
  function catType(cid) {
    if (cid === 'bill') return 'bill';
    if (cid === 'design') return 'design';
    return 'work';
  }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function grandTotal() {
    return allRecords().reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
  }

  /* ---------- 工作台存储（流程树，sub 递归嵌套） ---------- */
  var WF_KEY = 'zhuangxiu-workflow-v1';
  var wf = loadWorkflow();
  function loadWorkflow() {
    try {
      var d = JSON.parse(localStorage.getItem(WF_KEY));
      if (d && typeof d === 'object') return d;
    } catch (e) {}
    return {};
  }
  function saveWorkflow() {
    try { localStorage.setItem(WF_KEY, JSON.stringify(wf)); } catch (e) { toast('存储失败'); }
  }
  function countWork(list) {
    var done = 0, total = 0;
    (list || []).forEach(function (it) {
      total += 1;
      if (it.done) done += 1;
      var s = countWork(it.sub);
      done += s.done; total += s.total;
    });
    return { done: done, total: total };
  }
  function findWorkNode(list, id) {
    var found = null;
    (list || []).some(function (it) {
      if (it.id === id) { found = it; return true; }
      if (it.sub && it.sub.length) {
        var f = findWorkNode(it.sub, id);
        if (f) { found = f; return true; }
      }
      return false;
    });
    return found;
  }
  function removeWorkNode(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        /* 删除本流程，但其下一级衔接流程顶替它的位置，继续保留 */
        var kids = list[i].sub || [];
        var args = [i, 1].concat(kids);
        list.splice.apply(list, args);
        return true;
      }
      if (list[i].sub && removeWorkNode(list[i].sub, id)) return true;
    }
    return false;
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function catTotal(cid) {
    return (data[cid] || []).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
  }
  function allRecords() {
    var arr = [];
    RECORD_CATS.forEach(function (c) {
      (data[c.id] || []).forEach(function (r) {
        arr.push(Object.assign({}, r, { category: c.id }));
      });
    });
    return arr.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
  function sortRecords(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  /* ---------- 侧边栏 ---------- */
  function openSidebar()  { document.body.classList.add('sidebar-open'); }
  function closeSidebar() { document.body.classList.remove('sidebar-open'); }

  function renderNav() {
    $('#nav').innerHTML = CATEGORIES.map(function (c) {
      /* 工作台类目显示流程进度；设计/账单不再显示金额 */
      var total = '';
      if (catType(c.id) === 'work') {
        var s = countWork(wf[c.id] || []);
        if (s.total) total = '<span class="nav-total">' + s.done + '/' + s.total + '</span>';
      }
      return '<button class="nav-item' + (state.current === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' +
               '<span class="nav-ic">' + ICONS[c.id] + '</span>' +
               '<span class="nav-name">' + c.name + '</span>' + total +
             '</button>';
    }).join('');
  }

  /* ---------- 主界面渲染 ---------- */
  function render() {
    var cat = catOf(state.current);
    $('#catIcon').innerHTML = ICONS[cat.id] || '';
    $('#catName').textContent = cat.name;

    var type = catType(state.current);
    var content;
    if (type === 'bill') {
      $('#topbarTotal').style.display = '';
      $('#topbarTotal').textContent = fmt(grandTotal());
      content = billView();
    } else if (type === 'design') {
      $('#topbarTotal').style.display = 'none';
      content = window.RenoDesign ? window.RenoDesign.render() : '';
    } else {
      var s = countWork(wf[state.current] || []);
      $('#topbarTotal').style.display = '';
      $('#topbarTotal').textContent = s.total ? s.done + '/' + s.total : '';
      content = workView(state.current);
    }

    $('#content').innerHTML = content;
    if (type === 'design' && window.RenoDesign) window.RenoDesign.renderTabs();
    else $('#topTabs').innerHTML = '';
    bindContentEvents(state.current);
    renderNav();
  }

  /* 记账表单（账单页专用，含分类下拉） */
  function recordFormHTML(editing) {
    return (
      '<form id="recordForm" class="form' + (editing ? ' open' : '') + '" autocomplete="off">' +
        '<h3>' + (editing ? '编辑记录' : '添加记录') + '</h3>' +
        '<div class="form-row">' +
          '<div class="field"><label>日期</label><input type="date" id="fDate" required></div>' +
          '<div class="field"><label>分类</label><select id="fCat">' +
            RECORD_CATS.map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field"><label>项目名称</label><input type="text" id="fName" placeholder="如：瓷砖采购" required></div>' +
          '<div class="field"><label>金额（元）</label><input type="number" id="fAmount" placeholder="0.00" min="0" step="0.01" required></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field"><label>备注</label><input type="text" id="fNote" placeholder="选填"></div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="submit" class="btn btn-primary">' + (editing ? '保存修改' : '添加') + '</button>' +
          '<button type="button" class="btn" id="fCancel">' + (editing ? '取消编辑' : '收起') + '</button>' +
        '</div>' +
      '</form>'
    );
  }

  /* ================= 工作台：记录小的工作流程，可打勾划掉、衔接下一步 ================= */
  function workView(cid) {
    var cat = catOf(cid);
    var list = wf[cid] || [];
    var s = countWork(list);
    var items = list.length
      ? list.map(function (it) { return workItemHTML(it, cid); }).join('')
      : '<div class="empty">还没有工作流程<br>点「＋ 添加流程」开始记录吧</div>';
    return (
      '<div class="rec-hero">' +
        '<span class="rec-hero-ic">' + ICONS[cat.id] + '</span>' +
        '<div class="rec-hero-t">' +
          '<div class="rec-hero-name">' + cat.name + '</div>' +
          '<div class="rec-hero-sub">' + (list.length ? '已完成 ' + s.done + ' / ' + s.total + ' 个流程' : '记录一个小的工作流程') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="wf-add">' +
        '<button id="wfAdd" class="btn btn-primary btn-block">＋ 添加流程</button>' +
        '<div class="wf-addbox hidden" id="wfAddBox">' +
          '<input id="wfInput" class="wf-input" placeholder="填写工作流程，如：拆旧墙" maxlength="50" spellcheck="false">' +
          '<button class="btn btn-sm btn-primary" data-add-ok>添加</button>' +
          '<button class="btn btn-sm" data-add-cancel>取消</button>' +
        '</div>' +
      '</div>' +
      '<div class="wf-list">' + items + '</div>'
    );
  }
  function workItemHTML(it, cid) {
    var sub = (it.sub || []).length
      ? '<div class="wf-sub">' + it.sub.map(function (s) { return workItemHTML(s, cid); }).join('') + '</div>'
      : '';
    return '<div class="wf-item" data-id="' + it.id + '">' +
      '<div class="wf-row' + (it.done ? ' done' : '') + '">' +
        '<button class="wf-check' + (it.done ? ' checked' : '') + '" data-wf="check" title="标记完成">' + (it.done ? '✓' : '') + '</button>' +
        '<span class="wf-text">' + esc(it.text) + '</span>' +
        '<span class="wf-tools">' +
          '<button class="btn btn-sm wf-link" data-wf="link" title="添加衔接流程">＋ 衔接</button>' +
          '<button class="icon-btn danger" data-wf="del" title="删除">' + ICONS.trash + '</button>' +
        '</span>' +
      '</div>' +
      '<div class="wf-inline hidden" data-inline="' + it.id + '">' +
        '<input class="wf-input" data-inline-input maxlength="50" placeholder="填写衔接的下一步…" spellcheck="false">' +
        '<button class="btn btn-sm btn-primary" data-inline-ok>添加</button>' +
        '<button class="btn btn-sm" data-inline-cancel>取消</button>' +
      '</div>' +
      sub +
    '</div>';
  }
  function bindWorkEvents(cid) {
    var addBtn = $('#wfAdd');
    var addBox = $('#wfAddBox');
    var input = $('#wfInput');
    var closeBox = function () { if (addBox) addBox.classList.add('hidden'); };
    var openBox = function () {
      if (!addBox) return;
      addBox.classList.remove('hidden');
      if (input) input.focus();
    };
    var doAdd = function () {
      var text = input.value.trim();
      if (!text) { toast('先填写流程内容'); return; }
      if (!Array.isArray(wf[cid])) wf[cid] = [];
      wf[cid].push({ id: uid(), text: text.slice(0, 50), done: false, sub: [] });
      closeBox();
      saveWorkflow(); render();
    };
    if (addBtn) addBtn.addEventListener('click', openBox);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); });
    if (addBox) {
      var ok = addBox.querySelector('[data-add-ok]');
      var cancel = addBox.querySelector('[data-add-cancel]');
      if (ok) ok.addEventListener('click', doAdd);
      if (cancel) cancel.addEventListener('click', closeBox);
    }

    /* 每个流程项自己的按钮（勾选/衔接/删除）。子流程在父级内部，点击会冒泡到父级监听器，
       必须确认按钮只属于本级，否则勾选/删除/衔接会连带影响父流程。 */
    document.querySelectorAll('.wf-item').forEach(function (item) {
      var node = findWorkNode(wf[cid], item.dataset.id);
      if (!node) return;
      item.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-wf]');
        if (!btn) return;
        if (btn.closest('.wf-item') !== item) return;   /* 冒泡自子流程的按钮，忽略 */
        if (btn.dataset.wf === 'check') {
          node.done = !node.done;
          saveWorkflow(); render();
        } else if (btn.dataset.wf === 'del') {
          if (!confirm('删除这个流程吗？它下面的衔接流程会保留并顶上来。')) return;
          removeWorkNode(wf[cid], item.dataset.id);
          saveWorkflow(); render();
        } else if (btn.dataset.wf === 'link') {
          var wrap = item.querySelector('.wf-inline');
          if (wrap) wrap.classList.toggle('hidden');
        }
      });
    });

    document.querySelectorAll('[data-inline]').forEach(function (wrap) {
      var pid = wrap.closest('.wf-item').dataset.id;
      var ok = wrap.querySelector('[data-inline-ok]');
      var cancel = wrap.querySelector('[data-inline-cancel]');
      var inp = wrap.querySelector('[data-inline-input]');
      var doAddSub = function () {
        var text = inp.value.trim();
        if (!text) { toast('先填写流程内容'); return; }
        var parent = findWorkNode(wf[cid], pid);
        if (!parent) return;
        if (!Array.isArray(parent.sub)) parent.sub = [];
        parent.sub.push({ id: uid(), text: text.slice(0, 50), done: false, sub: [] });
        saveWorkflow(); render();
      };
      ok.addEventListener('click', doAddSub);
      cancel.addEventListener('click', function () { wrap.classList.add('hidden'); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAddSub(); });
    });
  }

  function recordItem(r, iconKey) {
    return (
      '<div class="record card" data-id="' + r.id + '">' +
        (iconKey ? '<span class="rec-ic">' + ICONS[iconKey] + '</span>' : '') +
        '<div class="record-info">' +
          '<div class="record-top">' +
            '<span class="record-name">' + esc(r.name) + '</span>' +
            '<span class="record-date">' + esc(r.date) + '</span>' +
          '</div>' +
          (r.note ? '<div class="record-note">' + esc(r.note) + '</div>' : '') +
        '</div>' +
        '<div class="record-right">' +
          '<div class="record-amount">' + fmt(r.amount) + '</div>' +
          '<div class="record-actions">' +
            '<button class="icon-btn" data-act="edit" title="编辑">' + ICONS.pencil + '</button>' +
            '<button class="icon-btn danger" data-act="del" title="删除">' + ICONS.trash + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function billView() {
    var groups = RECORD_CATS.map(function (c) {
      return { cid: c.id, list: (data[c.id] || []).slice().sort(sortRecords) };
    });
    var all = allRecords();
    var grand = grandTotal();
    var rows = groups.filter(function (g) { return catTotal(g.cid) > 0; })
      .sort(function (a, b) { return catTotal(b.cid) - catTotal(a.cid); });
    var max = rows.length ? catTotal(rows[0].cid) : 0;
    var editing = state.editingId !== null;
    var withRec = groups.filter(function (g) { return g.list.length > 0; });

    return (
      '<div class="rec-hero">' +
        '<span class="rec-hero-ic">' + ICONS.bill + '</span>' +
        '<div class="rec-hero-t">' +
          '<div class="rec-hero-name">账单</div>' +
          '<div class="rec-hero-sub">' + (all.length ? '总支出 ' + fmt(grand) + ' · ' + all.length + ' 条记录' : '记账中心 · 开始记录装修的每一步吧') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bill-summary">' +
        '<div class="bill-hero card">' +
          '<div class="bill-hero-label">总支出</div>' +
          '<div class="bill-hero-value">' + fmt(grand) + '</div>' +
          '<div class="bill-hero-sub">共 ' + all.length + ' 条记录</div>' +
        '</div>' +
        '<div class="bill-hero accent">' +
          '<div class="bill-hero-label">最高支出分类</div>' +
          '<div class="bill-hero-value small">' + (rows.length ? ICONS[rows[0].cid] + ' ' + catOf(rows[0].cid).name : '暂无') + '</div>' +
          '<div class="bill-hero-sub">' + (rows.length ? fmt(catTotal(rows[0].cid)) : '—') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="add-card card">' +
        '<button class="btn btn-primary btn-block' + (editing ? ' hidden' : '') + '" id="addToggle">＋ 记账</button>' +
        recordFormHTML(editing) +
      '</div>' +
      '<div class="section-title">分类占比</div>' +
      (rows.length
        ? rows.map(function (r) {
            var c = catOf(r.cid);
            var w = max ? Math.max(2, catTotal(r.cid) / max * 100) : 0;
            return '<div class="bill-row card">' +
                     '<span class="bill-ic">' + ICONS[c.id] + '</span>' +
                     '<div class="bill-mid">' +
                       '<div class="bill-name">' + c.name + ' <span class="bill-count">' + r.list.length + ' 条</span></div>' +
                       '<div class="bar"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
                     '</div>' +
                     '<span class="bill-total">' + fmt(catTotal(r.cid)) + '</span>' +
                   '</div>';
          }).join('')
        : '<div class="empty">还没有任何记录<br>点击"＋ 记账"添加第一笔吧</div>') +
      (withRec.length
        ? '<div class="section-title" style="margin-top:20px">记录明细</div>' +
          withRec.map(function (g) {
            var c = catOf(g.cid);
            return '<div class="bill-group">' +
                     '<div class="bill-group-head">' +
                       '<span class="bill-group-ic">' + ICONS[c.id] + '</span>' +
                       '<span class="bill-group-name">' + c.name + '</span>' +
                       '<span class="bill-group-total">' + fmt(catTotal(g.cid)) + '</span>' +
                     '</div>' +
                     g.list.map(function (r) { return recordItem(r); }).join('') +
                   '</div>';
          }).join('')
        : '')
    );
  }

  /* ---------- 事件绑定 ---------- */
  function bindContentEvents(cid) {
    if (catType(cid) === 'design' && window.RenoDesign) { window.RenoDesign.bind(); return; }
    if (catType(cid) === 'bill') { bindBillEvents(); return; }
    bindWorkEvents(cid);
  }

  function bindBillEvents() {
    var toggle = $('#addToggle');
    var form = $('#recordForm');
    var cancel = $('#fCancel');

    if (toggle) toggle.addEventListener('click', function () {
      form.classList.add('open');
      clearForm();
      setTimeout(function () { form.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    });

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      onSubmitBill();
    });

    if (cancel) cancel.addEventListener('click', function () {
      state.editingId = null; state.editingCat = null;
      render();
    });

    document.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('.record').dataset.id;
        if (btn.dataset.act === 'edit') startEdit(id);
        else delRecord(id);
      });
    });
  }

  function clearForm() {
    $('#fDate').value = todayStr();
    $('#fCat').value = RECORD_CATS[0].id;
    $('#fName').value = '';
    $('#fAmount').value = '';
    $('#fNote').value = '';
  }

  function startEdit(id) {
    var rec = null, catId = null;
    RECORD_CATS.forEach(function (c) {
      if (rec) return;
      var r = (data[c.id] || []).find(function (x) { return x.id === id; });
      if (r) { rec = r; catId = c.id; }
    });
    if (!rec) return;
    state.editingId = id; state.editingCat = catId;
    render();
    $('#fDate').value = rec.date;
    $('#fCat').value = catId;
    $('#fName').value = rec.name;
    $('#fAmount').value = rec.amount;
    $('#fNote').value = rec.note || '';
    $('#fName').focus();
    var f = $('#recordForm');
    if (f) setTimeout(function () { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }

  function onSubmitBill() {
    var date = $('#fDate').value;
    var catId = $('#fCat').value;
    var name = $('#fName').value.trim();
    var amount = parseFloat($('#fAmount').value);
    var note = $('#fNote').value.trim();

    if (!date || !name || isNaN(amount)) { toast('请填写完整的项目信息'); return; }

    if (state.editingId) {
      /* 编辑：找到记录原属分类；若改了分类则搬移到新分类 */
      var rec = null, oldCat = null;
      RECORD_CATS.forEach(function (c) {
        if (rec) return;
        var r = (data[c.id] || []).find(function (x) { return x.id === state.editingId; });
        if (r) { rec = r; oldCat = c.id; }
      });
      if (rec) {
        rec.date = date; rec.name = name; rec.amount = amount; rec.note = note;
        if (oldCat !== catId) {
          data[oldCat] = (data[oldCat] || []).filter(function (x) { return x.id !== rec.id; });
          if (!Array.isArray(data[catId])) data[catId] = [];
          data[catId].push(rec);
        }
      }
      state.editingId = null; state.editingCat = null;
      toast('修改成功 ✓');
    } else {
      if (!Array.isArray(data[catId])) data[catId] = [];
      data[catId].push({
        id: uid(), date: date, name: name, amount: amount, note: note, createdAt: Date.now()
      });
      toast('添加成功 ✓');
    }
    save();
    render();
  }

  function delRecord(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    RECORD_CATS.forEach(function (c) {
      data[c.id] = (data[c.id] || []).filter(function (x) { return x.id !== id; });
    });
    save();
    render();
    toast('已删除');
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- 全局事件 ---------- */
  $('#menuBtn').addEventListener('click', openSidebar);
  $('#backdrop').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSidebar(); });

  $('#nav').addEventListener('click', function (e) {
    var item = e.target.closest('.nav-item');
    if (!item) return;
    state.current = item.dataset.cat;   // 跳转到该方向的主界面
    state.editingId = null;
    state.editingCat = null;
    closeSidebar();                     // 主界面占整个界面 100%
    render();
  });

  /* ---------- 暴露给设计板块（design.js）共用 ---------- */
  window.RenoApp = {
    refresh: render,
    toast: toast,
    esc: esc,
    fmt: fmt
  };

  /* ---------- 启动 ---------- */
  render();
})();
