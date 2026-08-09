/* ============ 设计板块：支出 / 图纸 / 灵感墙 + 全屏标记编辑 ============ */
(function () {
  'use strict';

  var App = window.RenoApp;
  if (!App) return;
  var $ = function (s) { return document.querySelector(s); };
  var esc = App.esc, toast = App.toast;
  var IC = window.RENO_ICONS || {};

  var KEY = 'zhuangxiu-design-v1';
  var COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#111111', '#FFFFFF'];

  /* ---------- 存储（图纸 + 灵感墙） ---------- */
  var data = load();
  if (!Array.isArray(data.wall)) data.wall = [];
  var tab = 'records';   // 设计下的子类目：支出 / 图纸 / 灵感墙

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') {
        /* 旧结构迁移：多面墙 -> 单面墙，取第一个（默认）墙的内容 */
        if (Array.isArray(d.walls) && !d.wall) {
          d.wall = (d.walls[0] && Array.isArray(d.walls[0].items)) ? d.walls[0].items : [];
          delete d.walls;
        }
        return d;
      }
    } catch (e) {}
    return { blueprints: [], wall: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ blueprints: data.blueprints, wall: data.wall })); }
    catch (e) { toast('存储空间不足，图片可能未保存，请删除部分内容'); }
  }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function domain(url) {
    var m = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
    var d = m ? m[1].replace(/^www\./, '') : String(url || '');
    return d.slice(0, 30);
  }

  /* ---------- 图片压缩 ---------- */
  function compress(img, maxDim, q) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var sc = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);   // 透明 PNG 用白底
    ctx.drawImage(img, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', q);
  }

  /* ---------- 子类目切换（位于内容区顶部，居中，切换时布局稳定不位移） ---------- */
  var TABS = [
    { key: 'records',    label: '支出' },
    { key: 'blueprints', label: '图纸' },
    { key: 'wall',       label: '灵感墙' }
  ];

  function tabBarHTML() {
    return '<div class="design-tabs">' + TABS.map(function (t) {
      return '<button class="dtab' + (tab === t.key ? ' active' : '') + '" data-dtab="' + t.key + '">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function renderTabs() {
    /* 顶栏不再放子按钮；保留顶栏总额显示，避免切换时顶栏重排位移 */
    var el = $('#topTabs');
    if (el) el.innerHTML = '';
    var totalEl = $('#topbarTotal');
    if (totalEl) totalEl.style.display = '';
  }

  /* ---------- 渲染分发 ---------- */
  function render() {
    return tabBarHTML() + (tab === 'blueprints' ? blueprintsHTML()
      : tab === 'wall' ? wallHTML()
      : App.recordSectionHTML('design'));
  }

  function bind() {
    document.querySelectorAll('.dtab').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.dataset.dtab; App.refresh(); });
    });
    if (tab === 'blueprints') return bindBlueprints();
    if (tab === 'wall') return bindWall();
    App.bindRecordEvents('design');
  }

  /* ================= 图纸 ================= */
  function blueprintsHTML() {
    var bps = data.blueprints.length
      ? data.blueprints.map(bpItem).join('')
      : '<div class="thumb-empty">还没有图纸，点「上传图纸」添加</div>';
    return '' +
      '<div class="sec-head">' +
        '<span class="sec-title">' + IC.image + ' 施工图纸</span>' +
        '<div class="sec-tools">' +
          '<button id="bpUpload" class="btn btn-sm">＋ 上传图纸</button>' +
          '<input type="file" id="bpFile" accept="image/*" hidden multiple>' +
        '</div>' +
      '</div>' +
      '<div class="thumb-grid bp">' + bps + '</div>';
  }
  function bpItem(bp) {
    return '<div class="tcard bp-card" data-id="' + bp.id + '">' +
      '<div class="tcard-cover"><img src="' + esc(bp.thumb) + '" alt="" loading="lazy"></div>' +
      '<div class="tcard-meta">' +
        '<span class="tcard-name static">' + esc(bp.name || '图纸') + '</span>' +
        '<button class="tcard-del" data-del title="删除">' + IC.x + '</button>' +
      '</div>' +
    '</div>';
  }
  function bindBlueprints() {
    var bpFile = $('#bpFile');
    $('#bpUpload').addEventListener('click', function () { bpFile.click(); });
    bpFile.addEventListener('change', function () {
      handleFiles(bpFile.files, 'blueprint');
      bpFile.value = '';
    });
    document.querySelectorAll('.tcard').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.tcard-del')) { e.stopPropagation(); delItem(card.dataset.id, true); return; }
        openBlueprint(card.dataset.id);
      });
    });
  }

  /* ================= 灵感墙（单面墙，灵感可自定义命名） ================= */
  function wallHTML() {
    var items = data.wall.length
      ? data.wall.map(wallItem).join('')
      : '<div class="thumb-empty">还没有灵感，点「添加灵感」开始吧</div>';
    return '' +
      '<div class="wall-bar">' +
        '<button id="wallAdd" class="btn btn-primary">＋ 添加灵感</button>' +
        '<div class="wall-panel hidden" id="wallPanel">' +
          '<div class="wall-panel-tabs">' +
            '<button class="wptab active" data-src="image">' + IC.image + ' 图片</button>' +
            '<button class="wptab" data-src="link">' + IC.link + ' 链接</button>' +
            '<button class="wptab" data-src="idea">' + IC.lightbulb + ' 点子</button>' +
          '</div>' +
          '<div class="wall-panel-body">' +
            '<div class="wall-src image">' +
              '<label class="btn">' + IC.image + ' 选择图片<input type="file" id="wallFile" accept="image/*" hidden multiple></label>' +
              '<span class="wall-hint">支持多张 · 自动压缩保存</span>' +
            '</div>' +
            '<div class="wall-src link hidden">' +
              '<input id="wallUrl" class="wall-url-input" placeholder="粘贴链接，多余字符自动清理" spellcheck="false">' +
              '<button id="wallAddUrl" class="btn btn-primary btn-sm">添加</button>' +
            '</div>' +
            '<div class="wall-src idea hidden">' +
              '<textarea id="wallIdeaText" class="wall-idea-input" rows="3" maxlength="500" placeholder="写下你的好点子…" spellcheck="false"></textarea>' +
              '<div class="wall-idea-pics">' +
                '<label class="btn">' + IC.image + ' 配图（可选）<input type="file" id="wallIdeaFile" accept="image/*" hidden></label>' +
                '<span id="wallIdeaThumb" class="wall-idea-thumb hidden"><img id="wallIdeaThumbImg" alt=""><button id="wallIdeaRemove" type="button" class="btn btn-sm">移除</button></span>' +
                '<span class="wall-hint">文字必填，配图可留空</span>' +
              '</div>' +
              '<div class="wall-idea-row">' +
                '<button id="wallAddIdea" class="btn btn-primary btn-sm">添加</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="thumb-grid wall">' + items + '</div>';
  }
  function wallItem(it) {
    if (it.type === 'idea') return ideaItem(it);
    var isLink = it.type === 'link';
    var cover = isLink
      ? '<div class="tcard-cover link">' +
          '<span class="cover-name">' + esc(it.name || '未命名') + '</span>' +
          (it.domain ? '<span class="cover-domain">' + esc(it.domain) + '</span>' : '') +
          '<span class="link-badge">' + IC.link + '</span>' +
        '</div>'
      : '<div class="tcard-cover"><img src="' + esc(it.thumb) + '" alt="" loading="lazy"></div>';
    return '<div class="tcard ' + (isLink ? 'link-card' : 'img-card') + '" data-id="' + it.id + '"' +
           (isLink ? ' data-url="' + esc(it.url) + '"' : '') + '>' +
      cover +
      '<div class="tcard-meta">' +
        '<input class="tcard-name" value="' + esc(it.name || '') + '" placeholder="给灵感起个名字" maxlength="20" spellcheck="false">' +
        '<button class="tcard-del" data-del title="删除">' + IC.x + '</button>' +
      '</div>' +
    '</div>';
  }
  function bindWall() {
    var panel = $('#wallPanel');
    $('#wallAdd').addEventListener('click', function () {
      panel.classList.toggle('hidden');
    });
    panel.querySelectorAll('.wptab').forEach(function (b) {
      b.addEventListener('click', function () {
        panel.querySelectorAll('.wptab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var src = b.dataset.src;
        panel.querySelectorAll('.wall-src').forEach(function (x) { x.classList.add('hidden'); });
        panel.querySelector('.wall-src.' + src).classList.remove('hidden');
      });
    });
    var wFile = $('#wallFile');
    wFile.addEventListener('change', function () {
      handleFiles(wFile.files, 'wall');
      wFile.value = '';
    });
    var wUrl = $('#wallUrl');
    var doAddUrl = function () { addByUrl(wUrl.value); };
    $('#wallAddUrl').addEventListener('click', doAddUrl);
    wUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAddUrl(); });

    document.querySelectorAll('.tcard').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.tcard-del')) { e.stopPropagation(); delItem(card.dataset.id, false); return; }
        if (e.target.closest('.idea-tag')) return;   // 点子标签不响应
        if (card.classList.contains('idea-card')) { openIdea(card.dataset.id); return; }
        if (e.target.closest('.tcard-name')) return;   // 交给输入框自己处理
        if (card.classList.contains('link-card')) window.open(card.dataset.url, '_blank', 'noopener');
        else openWallImage(card.dataset.id);
      });
    });
    document.querySelectorAll('.tcard-name').forEach(function (inp) {
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
      inp.addEventListener('change', function () {
        renameItem(inp.closest('.tcard').dataset.id, inp.value);
      });
    });
    initIdeaPanel();
  }
  function renameItem(id, val) {
    var it = data.wall.find(function (x) { return x.id === id; });
    if (!it) return;
    var v = (val || '').trim();
    it.name = v ? v.slice(0, 20) : (it.type === 'link' ? it.domain : '');
    save(); App.refresh();
  }
  function delItem(id, isBp) {
    if (!confirm('确定删除这项内容吗？')) return;
    if (isBp) data.blueprints = data.blueprints.filter(function (b) { return b.id !== id; });
    else data.wall = data.wall.filter(function (it) { return it.id !== id; });
    save(); App.refresh();
  }

  /* ================= 点子：文字 + 可选配图 ================= */
  function ideaItem(it) {
    var hasImg = !!it.thumb;
    return '<div class="tcard idea-card' + (hasImg ? ' has-img' : '') + '" data-id="' + it.id + '">' +
      (hasImg ? '<div class="tcard-cover"><img src="' + esc(it.thumb) + '" alt="" loading="lazy"></div>' : '') +
      '<div class="tcard-idea-text">' + esc(it.text) + '</div>' +
      '<div class="tcard-meta">' +
        '<span class="idea-tag">' + IC.lightbulb + ' 点子</span>' +
        '<button class="tcard-del" data-del title="删除">' + IC.x + '</button>' +
      '</div>' +
    '</div>';
  }

  var ideaDraft = { text: '', thumb: '', full: '' };

  function initIdeaPanel() {
    var ideaText = $('#wallIdeaText');
    var ideaFile = $('#wallIdeaFile');
    var ideaThumb = $('#wallIdeaThumb');
    var ideaThumbImg = $('#wallIdeaThumbImg');
    var ideaRemove = $('#wallIdeaRemove');
    var addIdea = $('#wallAddIdea');
    if (!ideaText || !ideaFile || !addIdea) return;

    ideaFile.addEventListener('change', function () {
      readIdeaImage(ideaFile.files[0]);
      ideaFile.value = '';
    });
    ideaRemove.addEventListener('click', function () {
      ideaDraft.thumb = ideaDraft.full = '';
      ideaThumb.classList.add('hidden');
      ideaThumbImg.removeAttribute('src');
    });
    addIdea.addEventListener('click', function () {
      var text = ideaText.value.trim();
      if (!text) { toast('先写下你的点子'); return; }
      data.wall.push({
        id: uid(), type: 'idea', text: text.slice(0, 500),
        thumb: ideaDraft.thumb, full: ideaDraft.full,
        canBake: true, createdAt: Date.now()
      });
      ideaText.value = '';
      ideaDraft = { text: '', thumb: '', full: '' };
      ideaThumb.classList.add('hidden');
      ideaThumbImg.removeAttribute('src');
      $('#wallPanel').classList.add('hidden');
      save(); App.refresh();
    });
  }

  function readIdeaImage(file) {
    if (!file || !/^image\//.test(file.type || '')) { toast('仅支持图片文件'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        ideaDraft.thumb = compress(img, 320, 0.65);
        ideaDraft.full = compress(img, 1600, 0.78);
        var t = $('#wallIdeaThumb'), ti = $('#wallIdeaThumbImg');
        ti.src = ideaDraft.thumb;
        t.classList.remove('hidden');
      };
      img.onerror = function () { toast('图片读取失败'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- 点子弹层：查看 / 编辑文字与配图 ---------- */
  var ideaModal = null, ideaCurrent = null;

  function buildIdeaModal() {
    if (ideaModal) return;
    ideaModal = document.createElement('div');
    ideaModal.className = 'idea-modal';
    ideaModal.innerHTML =
      '<div class="idea-modal-box">' +
        '<div class="idea-modal-head">' +
          '<span class="idea-modal-title">' + IC.lightbulb + ' 点子</span>' +
          '<button id="ideaClose" class="icon-btn" title="关闭">' + IC.x + '</button>' +
        '</div>' +
        '<div class="idea-modal-body">' +
          '<div id="ideaPic" class="idea-modal-pic hidden">' +
            '<img id="ideaImg" alt="">' +
            '<span class="idea-modal-pic-hint">点击图片放大查看 / 标注</span>' +
          '</div>' +
          '<textarea id="ideaText" class="wall-idea-input" rows="6" maxlength="500" placeholder="写下你的好点子…" spellcheck="false"></textarea>' +
        '</div>' +
        '<div class="idea-modal-actions">' +
          '<label class="btn btn-sm">' + IC.image + ' 配图<input type="file" id="ideaFile" accept="image/*" hidden></label>' +
          '<span class="spacer"></span>' +
          '<button id="ideaDel" class="btn btn-sm danger">删除</button>' +
          '<button id="ideaSave" class="btn btn-sm btn-primary">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ideaModal);

    ideaModal.addEventListener('click', function (e) { if (e.target === ideaModal) closeIdea(); });
    $('#ideaClose').addEventListener('click', closeIdea);
    $('#ideaSave').addEventListener('click', function () {
      if (!ideaCurrent) return;
      var text = $('#ideaText').value.trim();
      if (!text) { toast('点子不能为空'); return; }
      ideaCurrent.text = text.slice(0, 500);
      save(); App.refresh();
      closeIdea();
      toast('已保存 ✓');
    });
    $('#ideaDel').addEventListener('click', function () {
      if (!ideaCurrent) return;
      if (!confirm('删除这条点子吗？')) return;
      data.wall = data.wall.filter(function (x) { return x.id !== ideaCurrent.id; });
      save(); App.refresh();
      closeIdea();
      toast('已删除');
    });
    $('#ideaImg').addEventListener('click', function () {
      if (!ideaCurrent || !ideaCurrent.full) return;
      openViewer({
        src: ideaCurrent.full, title: '点子配图', canBake: true,
        onSave: function (baked) {
          ideaCurrent.full = baked.full; ideaCurrent.thumb = baked.thumb; ideaCurrent.canBake = true;
          save(); $('#ideaImg').src = baked.full;
        }
      });
    });
    $('#ideaFile').addEventListener('change', function () {
      var f = this.files[0];
      if (f && /^image\//.test(f.type || '')) readModalImage(f);
      else if (f) toast('仅支持图片文件');
      this.value = '';
    });
  }
  function readModalImage(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        ideaCurrent.thumb = compress(img, 320, 0.65);
        ideaCurrent.full = compress(img, 1600, 0.78);
        ideaCurrent.canBake = true;
        $('#ideaImg').src = ideaCurrent.full;
        $('#ideaPic').classList.remove('hidden');
        save();
        toast('配图已更新');
      };
      img.onerror = function () { toast('图片读取失败'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
  function openIdea(id) {
    var it = data.wall.find(function (x) { return x.id === id; });
    if (!it) return;
    buildIdeaModal();
    ideaCurrent = it;
    $('#ideaText').value = it.text || '';
    var pic = $('#ideaPic'), img = $('#ideaImg');
    if (it.full) { img.src = it.full; pic.classList.remove('hidden'); }
    else { pic.classList.add('hidden'); img.removeAttribute('src'); }
    ideaModal.classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeIdea() {
    if (!ideaModal) return;
    ideaModal.classList.remove('open');
    ideaCurrent = null;
    document.body.classList.remove('no-scroll');
  }

  /* ---------- 文件上传 ---------- */
  function handleFiles(fileList, target) {
    var files = Array.prototype.slice.call(fileList);
    files.forEach(function (file) {
      if (!file.type || file.type.indexOf('image/') !== 0) { toast('仅支持图片文件'); return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          var full = compress(img, 1600, 0.78);
          var thumb = compress(img, 320, 0.65);
          if (target === 'blueprint') {
            data.blueprints.push({
              id: uid(), name: file.name.replace(/\.[^.]+$/, '') || '图纸',
              thumb: thumb, full: full, createdAt: Date.now()
            });
          } else {
            data.wall.push({
              id: uid(), type: 'image', name: file.name.replace(/\.[^.]+$/, '') || '图片',
              thumb: thumb, full: full, canBake: true, createdAt: Date.now()
            });
          }
          save(); App.refresh();
        };
        img.onerror = function () { toast('图片读取失败'); };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 通过链接添加（自动清理多余字符） ---------- */
  function cleanUrl(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    var m = s.match(/https?:\/\//i);
    if (m) {
      s = s.slice(m.index);                       // 去掉 http 前的多余字符
    } else {
      s = s.replace(/^[^a-zA-Z0-9]+/, '');        // 开头杂符号
      if (!s) return '';
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = 'https://' + s;   // 补全协议
    }
    return s.replace(/[\s。，、；：！？…)\]】」』"'”’>]+$/, '');          // 尾部杂字符
  }

  function addByUrl(raw) {
    var url = cleanUrl(raw);
    if (!url) { toast('请粘贴有效链接'); return; }
    tryImageCors(url, function (err, img) {
      if (!err) {
        data.wall.push({
          id: uid(), type: 'image', name: domain(url),
          thumb: compress(img, 320, 0.65), full: compress(img, 1600, 0.78),
          canBake: true, createdAt: Date.now()
        });
        save(); App.refresh();
      } else {
        tryImagePlain(url, function (err2) {
          if (!err2) {
            data.wall.push({
              id: uid(), type: 'image', name: domain(url),
              thumb: url, full: url, canBake: false, createdAt: Date.now()
            });
            toast('外链图片已添加（标记无法保存回外链）');
          } else {
            data.wall.push({
              id: uid(), type: 'link', name: domain(url), domain: domain(url), url: url,
              createdAt: Date.now()
            });
          }
          save(); App.refresh();
        });
      }
    });
  }

  function tryImageCors(url, cb) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { cb(null, img); };
    img.onerror = function () { cb(true); };
    img.src = url;
  }
  function tryImagePlain(url, cb) {
    var img = new Image();
    img.onload = function () { cb(null, img); };
    img.onerror = function () { cb(true); };
    img.src = url;
  }

  /* ---------- 打开全屏查看器 ---------- */
  function openBlueprint(id) {
    var bp = data.blueprints.find(function (b) { return b.id === id; });
    if (!bp) return;
    openViewer({
      src: bp.full, title: bp.name || '图纸', canBake: true,
      onSave: function (baked) {
        bp.full = baked.full; bp.thumb = baked.thumb;
        save(); App.refresh();
      }
    });
  }
  function openWallImage(id) {
    var it = data.wall.find(function (x) { return x.id === id; });
    if (!it) return;
    openViewer({
      src: it.full, title: it.name || '图片', canBake: it.canBake !== false,
      onSave: function (baked) {
        it.full = baked.full; it.thumb = baked.thumb; it.canBake = true;
        save(); App.refresh();
      }
    });
  }

  /* ================= 全屏查看器（缩放 / 平移 / 标记） ================= */
  var viewer = null;

  function openViewer(opts) {
    var img = $('#vImg');
    img.onload = function () { initViewer(opts); };
    img.onerror = function () { toast('图片加载失败'); };
    img.src = opts.src;
  }
  function initViewer(opts) {
    var img = $('#vImg');
    viewer = {
      w: img.naturalWidth, h: img.naturalHeight,
      s: 1, px: 0, py: 0,
      tool: 'hand', color: COLORS[0], width: 4,
      marks: [], dirty: false,
      canBake: opts.canBake !== false,
      onSave: opts.onSave,
      pointers: {}, mode: null, stroke: null, last: null, moved: false, pinch: null
    };
    var cv = $('#vCanvas');
    cv.width = viewer.w; cv.height = viewer.h;
    $('#vName').textContent = opts.title || '图片';
    $('#viewer').hidden = false;
    document.body.classList.add('no-scroll');
    buildColors();
    highlightTool();
    $('#vHint').textContent = viewer.canBake
      ? '滚轮 / 双指缩放 · 拖动平移 · 手型下单击退出（标记自动保存）'
      : '外链图片 · 仅可查看和缩放，标记无法保存';
    if (!viewer.canBake) toast('外链图片无法保存标记');
    fit();
    renderMarks();
  }
  function closeViewer(saveFlag) {
    if (!viewer) return;
    var canBake = viewer.canBake;
    var onSave = viewer.onSave;
    var wasDirty = viewer.dirty;
    var hadMarks = viewer.marks.length > 0;
    var baked = null;
    if (saveFlag && wasDirty && canBake) {
      try { baked = bake(); } catch (e) { baked = null; }
    }
    viewer = null;
    $('#viewer').hidden = true;
    document.body.classList.remove('no-scroll');
    if (baked) {
      if (onSave) onSave(baked);
      else toast('标记已保存 ✓');
    } else if (wasDirty && hadMarks && canBake) {
      toast('标记保存失败');
    }
    /* 外链图片（canBake=false）的标记无法保存，打开时已提示 */
  }

  /* ---------- 变换 ---------- */
  function applyTransform() {
    if (!viewer) return;
    var box = $('#vBox');
    box.style.left = viewer.px + 'px';
    box.style.top = viewer.py + 'px';
    box.style.width = (viewer.w * viewer.s) + 'px';
    box.style.height = (viewer.h * viewer.s) + 'px';
  }
  function fit() {
    var stage = $('#vStage');
    var pad = 24;
    var sw = stage.clientWidth - pad * 2, sh = stage.clientHeight - pad * 2;
    viewer.s = Math.min(sw / viewer.w, sh / viewer.h, 1);
    viewer.px = (stage.clientWidth - viewer.w * viewer.s) / 2;
    viewer.py = (stage.clientHeight - viewer.h * viewer.s) / 2;
    applyTransform();
  }
  function zoomStep(f) {
    var stage = $('#vStage');
    var r = stage.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }
  function wheelZoom(e) {
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }
  function zoomAt(cx, cy, factor) {
    var stage = $('#vStage');
    var r = stage.getBoundingClientRect();
    var mx = cx - r.left, my = cy - r.top;
    var nx = (mx - viewer.px) / viewer.s, ny = (my - viewer.py) / viewer.s;
    viewer.s = clamp(viewer.s * factor, 0.1, 8);
    viewer.px = mx - nx * viewer.s;
    viewer.py = my - ny * viewer.s;
    applyTransform();
  }

  /* ---------- 标记绘制 ---------- */
  function natFromScreen(pt) {
    var r = $('#vBox').getBoundingClientRect();
    return { x: (pt.x - r.left) / viewer.s, y: (pt.y - r.top) / viewer.s };
  }
  function natPoint(e) { return natFromScreen({ x: e.clientX, y: e.clientY }); }

  function renderMarks() {
    if (!viewer) return;
    var cv = $('#vCanvas'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    viewer.marks.forEach(function (m) { drawMark(ctx, m); });
    ctx.restore();
  }
  function drawMark(ctx, m) {
    ctx.strokeStyle = m.color; ctx.fillStyle = m.color; ctx.lineWidth = m.width;
    if (m.type === 'path') {
      if (m.pts.length < 2) {
        ctx.fillRect(m.pts[0].x - m.width / 2, m.pts[0].y - m.width / 2, m.width, m.width);
        return;
      }
      ctx.beginPath(); ctx.moveTo(m.pts[0].x, m.pts[0].y);
      for (var i = 1; i < m.pts.length; i++) ctx.lineTo(m.pts[i].x, m.pts[i].y);
      ctx.stroke();
    } else if (m.type === 'line' || m.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(m.pts[0].x, m.pts[0].y);
      ctx.lineTo(m.pts[1].x, m.pts[1].y);
      ctx.stroke();
      if (m.type === 'arrow') {
        var a = m.pts[0], b = m.pts[1];
        var ang = Math.atan2(b.y - a.y, b.x - a.x);
        var L = m.width * 4 + 9;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - L * Math.cos(ang - 0.5), b.y - L * Math.sin(ang - 0.5));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - L * Math.cos(ang + 0.5), b.y - L * Math.sin(ang + 0.5));
        ctx.stroke();
      }
    } else if (m.type === 'rect') {
      var p0 = m.pts[0], p1 = m.pts[1];
      ctx.strokeRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
        Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
    } else if (m.type === 'text') {
      ctx.font = '600 ' + m.size + 'px sans-serif';
      ctx.lineWidth = Math.max(3, m.size / 7);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.strokeText(m.text, m.x, m.y);
      ctx.strokeStyle = m.color; ctx.fillStyle = m.color;
      ctx.fillText(m.text, m.x, m.y);
    }
  }
  function startStroke(e) {
    var p = natPoint(e);
    var st = { type: viewer.tool, color: viewer.color, width: viewer.width, pts: [p, p] };
    viewer.stroke = st;
    viewer.marks.push(st);
    renderMarks();
  }
  function eraseAt(p) {
    var R = 20 / viewer.s;
    var before = viewer.marks.length;
    viewer.marks = viewer.marks.filter(function (m) {
      if (m.type === 'text') return Math.hypot(m.x - p.x, m.y - p.y) > R * 2;
      if (!m.pts || !m.pts.length) return true;
      for (var i = 0; i < m.pts.length - 1; i++) {
        if (distToSeg(p, m.pts[i], m.pts[i + 1]) < R) return false;
      }
      return Math.hypot(m.pts[0].x - p.x, m.pts[0].y - p.y) >= R;
    });
    if (viewer.marks.length !== before) viewer.dirty = true;
    renderMarks();
  }
  function distToSeg(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function openTextAt(e) {
    var stage = $('#vStage');
    var r = stage.getBoundingClientRect();
    var input = document.createElement('input');
    input.className = 'vtext-input';
    input.placeholder = '输入文字，回车确定';
    input.style.left = (e.clientX - r.left) + 'px';
    input.style.top = (e.clientY - r.top) + 'px';
    stage.appendChild(input);
    input.focus();
    var used = false;
    var done = function (val) {
      if (used) return;
      used = true;
      input.remove();
      if (val && val.trim()) {
        var p = natFromScreen({ x: e.clientX, y: e.clientY });
        viewer.marks.push({ type: 'text', text: val.trim(), x: p.x, y: p.y,
          color: viewer.color, size: Math.max(16, viewer.width * 10) });
        viewer.dirty = true;
        renderMarks();
      }
    };
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') done(input.value);
      if (ev.key === 'Escape') done('');
    });
    input.addEventListener('blur', function () { done(input.value); });
  }

  /* ---------- 指针交互 ---------- */
  function stageDown(e) {
    if (!viewer) return;
    if (e.target.closest('.vtext-input')) return;   // 不拦截文字输入框
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    var stage = $('#vStage');
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    viewer.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(viewer.pointers).length === 2) { startPinch(); return; }
    viewer.moved = false;
    viewer.last = { x: e.clientX, y: e.clientY };
    var t = viewer.tool;
    if (t === 'hand') viewer.mode = 'pan';
    else if (t === 'text') viewer.mode = 'text';
    else if (t === 'eraser') { viewer.mode = 'erase'; eraseAt(natPoint(e)); }
    else { viewer.mode = 'draw'; startStroke(e); }
  }
  function stageMove(e) {
    if (!viewer) return;
    if (viewer.pointers[e.pointerId]) viewer.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(viewer.pointers).length === 2) { pinchMove(); return; }
    if (!viewer.mode) return;
    var dx = e.clientX - viewer.last.x, dy = e.clientY - viewer.last.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) viewer.moved = true;
    viewer.last = { x: e.clientX, y: e.clientY };
    if (viewer.mode === 'pan') {
      viewer.px += dx; viewer.py += dy;
      applyTransform();
    } else if (viewer.mode === 'draw') {
      var p = natPoint(e);
      if (viewer.stroke.type === 'path') viewer.stroke.pts.push(p);
      else viewer.stroke.pts[1] = p;
      renderMarks();
    } else if (viewer.mode === 'erase') {
      eraseAt(natPoint(e));
    }
  }
  function stageUp(e) {
    if (!viewer) return;
    delete viewer.pointers[e.pointerId];
    var ids = Object.keys(viewer.pointers);
    if (viewer.pinch) {
      viewer.pinch = null;
      if (ids.length === 1) {
        viewer.mode = 'pan';
        viewer.last = viewer.pointers[ids[0]];
        viewer.moved = false;
      } else viewer.mode = null;
      return;
    }
    var t = viewer.tool;
    if (viewer.mode === 'pan') {
      if (t === 'hand' && !viewer.moved) { closeViewer(true); return; }   // 再次点击退出全屏
    } else if (viewer.mode === 'draw') {
      viewer.stroke = null; viewer.dirty = true;
    } else if (viewer.mode === 'erase') {
      viewer.dirty = true;
    } else if (viewer.mode === 'text') {
      if (!viewer.moved) openTextAt(e);
    }
    viewer.mode = null;
  }
  function startPinch() {
    viewer.mode = null;
    if (viewer.stroke) {
      viewer.marks = viewer.marks.filter(function (m) { return m !== viewer.stroke; });
      viewer.stroke = null;
    }
    var ids = Object.keys(viewer.pointers);
    var p1 = viewer.pointers[ids[0]], p2 = viewer.pointers[ids[1]];
    viewer.pinch = {
      d: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      s: viewer.s,
      mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2,
      px: viewer.px, py: viewer.py
    };
  }
  function pinchMove() {
    var ids = Object.keys(viewer.pointers);
    if (ids.length !== 2 || !viewer.pinch) return;
    var p1 = viewer.pointers[ids[0]], p2 = viewer.pointers[ids[1]];
    var d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (!d || !viewer.pinch.d) return;
    var s1 = clamp(viewer.pinch.s * (d / viewer.pinch.d), 0.1, 8);
    var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    var nx = (viewer.pinch.mx - viewer.pinch.px) / viewer.pinch.s;
    var ny = (viewer.pinch.my - viewer.pinch.py) / viewer.pinch.s;
    viewer.s = s1;
    viewer.px = mx - nx * s1;
    viewer.py = my - ny * s1;
    applyTransform();
  }

  /* ---------- 工具栏 ---------- */
  function buildColors() {
    $('#vColors').innerHTML = COLORS.map(function (c) {
      return '<button class="sw' + (c === viewer.color ? ' active' : '') + '" data-color="' + c +
        '" style="background:' + c + '" title="颜色"></button>';
    }).join('');
  }
  function highlightTool() {
    document.querySelectorAll('#vToolbar [data-tool]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === viewer.tool);
    });
  }
  function setTool(t) { if (!viewer) return; viewer.tool = t; viewer.mode = null; highlightTool(); }
  function setColor(c) { if (!viewer) return; viewer.color = c; buildColors(); }
  function setWidth(w) { if (!viewer) return; viewer.width = parseInt(w, 10); }
  function undo() {
    if (!viewer || !viewer.marks.length) return;
    viewer.marks.pop(); viewer.dirty = true; renderMarks();
  }
  function clearMarks() {
    if (!viewer || !viewer.marks.length) return;
    if (!confirm('清空全部标记？')) return;
    viewer.marks = []; viewer.dirty = true; renderMarks();
  }
  function bake() {
    var cv = document.createElement('canvas');
    cv.width = viewer.w; cv.height = viewer.h;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage($('#vImg'), 0, 0, viewer.w, viewer.h);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    viewer.marks.forEach(function (m) { drawMark(ctx, m); });
    ctx.restore();
    var full = cv.toDataURL('image/jpeg', 0.85);
    var tw = Math.min(320, cv.width);
    var th = Math.max(1, Math.round(tw * cv.height / cv.width));
    var tv = document.createElement('canvas');
    tv.width = tw; tv.height = th;
    var tctx = tv.getContext('2d');
    tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, tw, th);
    tctx.drawImage(cv, 0, 0, tw, th);
    return { full: full, thumb: tv.toDataURL('image/jpeg', 0.7) };
  }

  /* ---------- 一次性绑定查看器事件 ---------- */
  function bindViewer() {
    var tb = $('#vToolbar');
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var v = b.dataset.v;
      if (v === 'zoomIn') zoomStep(1.3);
      else if (v === 'zoomOut') zoomStep(1 / 1.3);
      else if (v === 'reset') fit();
      else if (v === 'undo') undo();
      else if (v === 'clear') clearMarks();
      else if (v === 'close') closeViewer(true);
      else if (b.dataset.tool) setTool(b.dataset.tool);
    });
    tb.addEventListener('change', function (e) {
      if (e.target.id === 'vWidth') setWidth(e.target.value);
    });
    $('#vColors').addEventListener('click', function (e) {
      var b = e.target.closest('.sw');
      if (b) setColor(b.dataset.color);
    });
    var stage = $('#vStage');
    stage.addEventListener('pointerdown', stageDown);
    stage.addEventListener('pointermove', stageMove);
    stage.addEventListener('pointerup', stageUp);
    stage.addEventListener('pointercancel', stageUp);
    stage.addEventListener('wheel', wheelZoom, { passive: false });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeViewer(true); });
  }

  /* ---------- 启动 ---------- */
  bindViewer();
  window.RenoDesign = { render: render, bind: bind, renderTabs: renderTabs };
})();
