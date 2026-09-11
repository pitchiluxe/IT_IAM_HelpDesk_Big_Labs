import { toast } from '../wm.js';
import { esc } from './lab1.js';
import { API } from '../api.js';

// ============ Calendar ============
export function openCalendar(body) {
  let curDate = new Date();
  let events = JSON.parse(localStorage.getItem('labvm-calendar') || '{}');

  function saveEvents() { localStorage.setItem('labvm-calendar', JSON.stringify(events)); }
  function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  function render() {
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m+1, 0).getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const today = new Date();
    const todayKey = dateKey(today);

    let cells = '';
    for (let i = 0; i < first; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const evs = events[key] || [];
      const isToday = key === todayKey;
      cells += `<div class="cal-cell ${isToday?'cal-today':''}" data-date="${key}">
        <div class="cal-day">${d}</div>
        ${evs.map(e => `<div class="cal-event" title="${esc(e)}">${esc(e)}</div>`).join('')}
      </div>`;
    }

    body.innerHTML = `
      <div class="app">
        <div class="app-toolbar">
          <button class="btn btn-sm" id="cal-prev">‹</button>
          <h2 style="min-width:200px;text-align:center">${monthNames[m]} ${y}</h2>
          <button class="btn btn-sm" id="cal-next">›</button>
          <button class="btn btn-sm" id="cal-today-btn">Today</button>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="cal-add">+ Add event</button>
        </div>
        <div class="app-body" style="padding:14px">
          <div class="cal-grid">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
            ${cells}
          </div>
          <div id="cal-events-list" style="margin-top:14px"></div>
        </div>
      </div>`;

    body.querySelector('#cal-prev').onclick = () => { curDate = new Date(y, m-1, 1); render(); };
    body.querySelector('#cal-next').onclick = () => { curDate = new Date(y, m+1, 1); render(); };
    body.querySelector('#cal-today-btn').onclick = () => { curDate = new Date(); render(); };
    body.querySelector('#cal-add').onclick = () => addEventModal();
    body.querySelectorAll('.cal-cell[data-date]').forEach(c => c.ondblclick = () => addEventModal(c.dataset.date));

    // events list for this month
    const list = body.querySelector('#cal-events-list');
    let monthEvents = [];
    for (const [k, evs] of Object.entries(events)) {
      if (k.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)) evs.forEach(e => monthEvents.push({ date: k, text: e }));
    }
    monthEvents.sort((a,b) => a.date.localeCompare(b.date));
    list.innerHTML = `<h3 style="font-size:14px;margin-bottom:8px">Events this month (${monthEvents.length})</h3>` +
      (monthEvents.length ? monthEvents.map(e => `<div class="cal-event-row"><span class="cal-event-date">${e.date}</span><span>${esc(e.text)}</span><button class="btn btn-sm btn-danger cal-del" data-date="${e.date}" data-text="${esc(e.text)}">×</button></div>`).join('') : '<div class="muted">No events</div>');
    list.querySelectorAll('.cal-del').forEach(b => b.onclick = () => {
      const d = b.dataset.date, t = b.dataset.text;
      events[d] = events[d].filter(e => e !== t);
      if (events[d].length === 0) delete events[d];
      saveEvents(); render();
    });
  }

  function addEventModal(presetDate) {
    const today = presetDate || dateKey(new Date());
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal"><div class="modal-head"><span>Add Event</span><button class="btn btn-sm" style="border:none;background:none;font-size:18px">×</button></div>
      <div class="modal-body">
        <div class="form-row"><label>Date</label><input class="field" id="ev-date" type="date" value="${today}"></div>
        <div class="form-row"><label>Event</label><input class="field" id="ev-text" placeholder="Event description..."></div>
      </div>
      <div class="modal-foot"><button class="btn btn-sm m-cancel">Cancel</button><button class="btn btn-primary btn-sm m-save">Add</button></div></div>`;
    body.appendChild(m);
    m.querySelector('.modal-head button').onclick = () => m.remove();
    m.querySelector('.m-cancel').onclick = () => m.remove();
    m.querySelector('.m-save').onclick = () => {
      const d = m.querySelector('#ev-date').value, t = m.querySelector('#ev-text').value.trim();
      if (!t) return;
      if (!events[d]) events[d] = [];
      events[d].push(t);
      saveEvents(); m.remove(); render(); toast('Event added');
    };
    m.querySelector('#ev-text').focus();
  }
  render();
}

// ============ Sticky Notes ============
export function openStickyNotes(body) {
  let notes = JSON.parse(localStorage.getItem('labvm-stickies') || '[]');
  const colors = ['#fff9c4','#c8e6c9','#bbdefb','#f8bbd0','#d1c4e9','#ffccbc'];
  function save() { localStorage.setItem('labvm-stickies', JSON.stringify(notes)); }

  function render() {
    body.innerHTML = `<div class="app">
      <div class="app-toolbar"><h2>Sticky Notes</h2><div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="sn-add">+ New note</button></div>
      <div class="app-body" style="padding:14px;display:flex;flex-wrap:wrap;gap:12px;align-content:flex-start">
        ${notes.length ? notes.map((n,i) => `
          <div class="sticky-note" style="background:${n.color||colors[0]}" data-idx="${i}">
            <div class="sticky-toolbar">
              <select class="sticky-color" data-idx="${i}">
                ${colors.map(c => `<option value="${c}" ${n.color===c?'selected':''}>■</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-danger sticky-del" data-idx="${i}">×</button>
            </div>
            <textarea class="sticky-text" data-idx="${i}" placeholder="Type here...">${esc(n.text||'')}</textarea>
          </div>`).join('') : '<div class="empty" style="width:100%">No notes. Click "+ New note" to create one.</div>'}
      </div>
    </div>`;

    body.querySelector('#sn-add').onclick = () => { notes.push({ text: '', color: colors[Math.floor(Math.random()*colors.length)] }); save(); render(); };
    body.querySelectorAll('.sticky-del').forEach(b => b.onclick = () => { notes.splice(parseInt(b.dataset.idx),1); save(); render(); });
    body.querySelectorAll('.sticky-text').forEach(t => {
      t.oninput = () => { notes[parseInt(t.dataset.idx)].text = t.value; save(); };
    });
    body.querySelectorAll('.sticky-color').forEach(s => s.onchange = () => {
      notes[parseInt(s.dataset.idx)].color = s.value; save(); render();
    });
  }
  render();
}

// ============ Epic Pen (screen annotation overlay) ============
export function openEpicPen(body) {
  // Epic Pen is a direct-action tool — no window needed.
  // body is null when called from launch(); ignore it entirely.

  // If already active, don't create a second overlay
  if (document.getElementById('ep-overlay')) return;

  let color = '#e74c3c', size = 4, tool = 'pen', drawing = false;

  // Canvas overlay
  const overlay = document.createElement('canvas');
  overlay.id = 'ep-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:auto;cursor:crosshair';
  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
  document.body.appendChild(overlay);
  const ctx = overlay.getContext('2d');
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  let lastX = null, lastY = null;
  overlay.addEventListener('mousedown', e => {
    if (tool === 'pointer') { return; }
    drawing = true; lastX = e.clientX; lastY = e.clientY;
  });
  overlay.addEventListener('mousemove', e => {
    if (!drawing || !lastX) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.clientX, e.clientY);
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }
    ctx.stroke();
    lastX = e.clientX; lastY = e.clientY;
  });
  const stopDraw = () => { drawing = false; lastX = null; lastY = null; };
  overlay.addEventListener('mouseup', stopDraw);
  overlay.addEventListener('mouseleave', stopDraw);

  // Vertical floating toolbar — draggable, compact
  const toolbar = document.createElement('div');
  toolbar.id = 'ep-toolbar';
  toolbar.style.cssText = 'position:fixed;top:50%;left:16px;transform:translateY(-50%);z-index:99999;background:rgba(30,30,30,.95);border-radius:8px;padding:4px;display:flex;flex-direction:column;align-items:center;gap:3px;box-shadow:0 4px 16px rgba(0,0,0,.4);user-select:none;font-family:sans-serif';
  toolbar.innerHTML = `
    <div style="color:#fff;font-size:9px;font-weight:600;cursor:grab;padding:1px 0 2px;width:100%;text-align:center" id="ep-drag" title="Drag to move">⋮⋮</div>
    <div style="display:flex;flex-direction:column;gap:2px;align-items:center" id="ep-tb-colors">
      ${['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#000000','#ffffff'].map((c,i) =>
        `<div class="ep-tb-color" data-color="${c}" style="width:18px;height:18px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${i===0?'#fff':'#444'}"></div>`).join('')}
    </div>
    <div style="width:70%;height:1px;background:#555;margin:1px 0"></div>
    <input type="range" id="ep-tb-size" min="1" max="20" value="4" style="width:60px;writing-mode:bt-lr;-webkit-appearance:slider-vertical">
    <span id="ep-tb-size-val" style="color:#fff;font-size:9px;text-align:center">4px</span>
    <div style="width:70%;height:1px;background:#555;margin:1px 0"></div>
    <button id="ep-tb-pointer" style="width:32px;height:32px;border-radius:5px;border:none;cursor:pointer;background:#444;color:#fff;font-size:14px" title="Pointer (disable drawing)">🖱️</button>
    <button id="ep-tb-pen" style="width:32px;height:32px;border-radius:5px;border:none;cursor:pointer;background:#0a84ff;color:#fff;font-size:14px" title="Pen">✏️</button>
    <button id="ep-tb-eraser" style="width:32px;height:32px;border-radius:5px;border:none;cursor:pointer;background:#444;color:#fff;font-size:14px" title="Eraser">🧹</button>
    <button id="ep-tb-clear" style="width:32px;height:32px;border-radius:5px;border:none;cursor:pointer;background:#e74c3c;color:#fff;font-size:14px" title="Clear all">🗑️</button>
    <div style="width:70%;height:1px;background:#555;margin:1px 0"></div>
    <button id="ep-tb-exit" style="width:32px;height:32px;border-radius:5px;border:none;cursor:pointer;background:#2ecc71;color:#fff;font-size:14px;font-weight:600" title="Exit annotation">✓</button>
  `;
  document.body.appendChild(toolbar);

  // Drag toolbar by the header
  const dragHandle = toolbar.querySelector('#ep-drag');
  let dragging = false, dragStart = null, tbStart = null;
  dragHandle.addEventListener('mousedown', e => {
    dragging = true;
    const rect = toolbar.getBoundingClientRect();
    toolbar.style.transform = 'none';
    toolbar.style.left = rect.left + 'px';
    toolbar.style.top = rect.top + 'px';
    dragStart = { x: e.clientX, y: e.clientY };
    tbStart = { x: rect.left, y: rect.top };
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let nx = tbStart.x + (e.clientX - dragStart.x);
    let ny = tbStart.y + (e.clientY - dragStart.y);
    const tw = toolbar.offsetWidth, th = toolbar.offsetHeight;
    nx = Math.max(2, Math.min(nx, window.innerWidth - tw - 2));
    ny = Math.max(2, Math.min(ny, window.innerHeight - th - 2));
    toolbar.style.left = nx + 'px';
    toolbar.style.top = ny + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // Tool handlers
  function setTool(t) {
    tool = t;
    const penBtn = toolbar.querySelector('#ep-tb-pen');
    const eraserBtn = toolbar.querySelector('#ep-tb-eraser');
    const pointerBtn = toolbar.querySelector('#ep-tb-pointer');
    penBtn.style.background = t === 'pen' ? '#0a84ff' : '#444';
    eraserBtn.style.background = t === 'eraser' ? '#0a84ff' : '#444';
    pointerBtn.style.background = t === 'pointer' ? '#0a84ff' : '#444';
    // In pointer mode, let clicks pass through the overlay
    overlay.style.pointerEvents = t === 'pointer' ? 'none' : 'auto';
    overlay.style.cursor = t === 'pointer' ? 'default' : (t === 'eraser' ? 'cell' : 'crosshair');
  }
  toolbar.querySelector('#ep-tb-colors').addEventListener('click', e => {
    const el = e.target.closest('.ep-tb-color'); if (!el) return;
    color = el.dataset.color;
    toolbar.querySelectorAll('.ep-tb-color').forEach(c => c.style.border = '2px solid #333');
    el.style.border = '2px solid #fff';
    setTool('pen');
  });
  const sizeInput = toolbar.querySelector('#ep-tb-size');
  sizeInput.oninput = () => { size = parseInt(sizeInput.value); toolbar.querySelector('#ep-tb-size-val').textContent = size + 'px'; };
  toolbar.querySelector('#ep-tb-pointer').onclick = () => setTool('pointer');
  toolbar.querySelector('#ep-tb-pen').onclick = () => setTool('pen');
  toolbar.querySelector('#ep-tb-eraser').onclick = () => setTool('eraser');
  toolbar.querySelector('#ep-tb-clear').onclick = () => {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  };
  toolbar.querySelector('#ep-tb-exit').onclick = () => {
    overlay.remove();
    toolbar.remove();
  };

  // Resize overlay on window resize
  const resizeHandler = () => {
    if (!document.getElementById('ep-overlay')) { window.removeEventListener('resize', resizeHandler); return; }
    const img = ctx.getImageData(0, 0, overlay.width, overlay.height);
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  window.addEventListener('resize', resizeHandler);

  toast('Annotation mode ON - drag the toolbar to move it');
}

// ============ Notepad++ ============
export function openNotepadPP(body) {
  let files = JSON.parse(localStorage.getItem('labvm-notepad') || '[{"name":"untitled.txt","content":""}]');
  let activeTab = 0;
  function save() { localStorage.setItem('labvm-notepad', JSON.stringify(files)); }

  function render() {
    body.innerHTML = `<div class="app">
      <div class="app-toolbar">
        <h2>Notepad++</h2>
        <button class="btn btn-sm" id="np-new">+ New</button>
        <button class="btn btn-sm" id="np-open">Open</button>
        <button class="btn btn-sm btn-primary" id="np-save">Save</button>
        <button class="btn btn-sm" id="np-saveas">Save As</button>
        <div class="spacer"></div>
        <span class="muted" id="np-info">Ln 1, Col 1</span>
      </div>
      <div class="np-tabs" id="np-tabs">
        ${files.map((f,i) => `<div class="np-tab ${i===activeTab?'active':''}" data-idx="${i}">
          <span>${esc(f.name)}</span>
          <button class="np-close" data-idx="${i}">×</button>
        </div>`).join('')}
      </div>
      <div class="app-body" style="flex:1;display:flex;flex-direction:column">
        <textarea class="np-editor" id="np-editor" spellcheck="false" placeholder="Start typing..."></textarea>
      </div>
    </div>`;
    const editor = body.querySelector('#np-editor');
    editor.value = files[activeTab]?.content || '';
    editor.oninput = () => { files[activeTab].content = editor.value; save(); updateInfo(); };
    editor.onkeyup = updateInfo;
    editor.onclick = updateInfo;
    function updateInfo() {
      const val = editor.value.substring(0, editor.selectionStart);
      const lines = val.split('\n');
      body.querySelector('#np-info').textContent = `Ln ${lines.length}, Col ${lines[lines.length-1].length+1}`;
    }
    body.querySelectorAll('.np-tab').forEach(t => t.onclick = (e) => {
      if (e.target.classList.contains('np-close')) return;
      activeTab = parseInt(t.dataset.idx); render();
    });
    body.querySelectorAll('.np-close').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(b.dataset.idx);
      if (files.length === 1) { files = [{ name: 'untitled.txt', content: '' }]; activeTab = 0; }
      else { files.splice(idx, 1); if (activeTab >= idx) activeTab = Math.max(0, activeTab-1); }
      save(); render();
    });
    body.querySelector('#np-new').onclick = () => { files.push({ name: 'untitled.txt', content: '' }); activeTab = files.length-1; save(); render(); };
    body.querySelector('#np-save').onclick = () => { save(); toast('Saved ' + files[activeTab].name); };
    body.querySelector('#np-saveas').onclick = () => {
      const name = prompt('Save as:', files[activeTab].name);
      if (name) { files[activeTab].name = name; save(); render(); toast('Saved as ' + name); }
    };
    body.querySelector('#np-open').onclick = () => {
      const stored = JSON.parse(localStorage.getItem('labvm-notepad-files') || '{}');
      const names = Object.keys(stored);
      if (!names.length) { toast('No saved files found. Use Save As to store files.'); return; }
      const m = document.createElement('div');
      m.className = 'modal-overlay';
      m.innerHTML = `<div class="modal"><div class="modal-head"><span>Open File</span><button class="btn btn-sm" style="border:none;background:none;font-size:18px">×</button></div>
        <div class="modal-body">${names.map(n => `<div class="row-link" style="padding:8px;border-bottom:1px solid #eee;cursor:pointer" data-name="${esc(n)}">${esc(n)}</div>`).join('')}</div></div>`;
      body.appendChild(m);
      m.querySelector('.modal-head button').onclick = () => m.remove();
      m.querySelectorAll('.row-link').forEach(r => r.onclick = () => {
        files.push({ name: r.dataset.name, content: stored[r.dataset.name] });
        activeTab = files.length - 1; save(); m.remove(); render();
      });
    };
    updateInfo();
  }
  render();
}

// ============ Chrome Browser ============
export function openChrome(body) {
  let tabs = [{ id: 1, title: 'New Tab', url: '', history: [], histIdx: -1 }];
  let activeTab = 0;
  let tabCounter = 1;
  const bookmarks = JSON.parse(localStorage.getItem('labvm-bookmarks') || '[]');
  function saveBookmarks() { localStorage.setItem('labvm-bookmarks', JSON.stringify(bookmarks)); }

  function render() {
    const tab = tabs[activeTab];
    body.innerHTML = `<div class="app" style="height:100%">
      <div class="chrome-tabs" id="ch-tabs">
        ${tabs.map((t,i) => `<div class="chrome-tab ${i===activeTab?'active':''}" data-idx="${i}">
          <span>${esc(t.title)}</span><button class="chrome-close" data-idx="${i}">×</button></div>`).join('')}
        <button class="chrome-newtab" id="ch-newtab">+</button>
      </div>
      <div class="chrome-toolbar">
        <button class="btn btn-sm" id="ch-back">←</button>
        <button class="btn btn-sm" id="ch-fwd">→</button>
        <button class="btn btn-sm" id="ch-reload">⟳</button>
        <input class="field" id="ch-url" placeholder="Search or type a URL" value="${esc(tab.url||'')}" style="flex:1">
        <button class="btn btn-sm" id="ch-bookmark">★</button>
        <button class="btn btn-sm" id="ch-home">⌂</button>
      </div>
      <div class="chrome-bookmarks" id="ch-bookmarks">
        ${bookmarks.map((b,i) => `<span class="chrome-bm" data-url="${esc(b.url)}" title="${esc(b.url)}">${esc(b.name)}</span>`).join('')}
      </div>
      <div class="app-body" style="flex:1;position:relative;background:#fff" id="ch-content"></div>
    </div>`;

    const urlInput = body.querySelector('#ch-url');
    const content = body.querySelector('#ch-content');

    async function navigate(url) {
      if (!url) { showNewTabPage(); return; }
      let fullUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.') && !url.includes(' ')) fullUrl = 'https://' + url;
        else fullUrl = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
      tab.url = fullUrl;
      tab.title = fullUrl.replace(/^https?:\/\//, '').split('/')[0];
      tab.history = tab.history.slice(0, tab.histIdx + 1);
      tab.history.push(fullUrl);
      tab.histIdx = tab.history.length - 1;
      urlInput.value = fullUrl;
      // Show loading indicator
      content.innerHTML = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff">
        <div style="font-size:32px;margin-bottom:12px;animation:ch-spin 1s linear infinite">🌐</div>
        <div style="font-size:14px;color:#666">Loading ${esc(tab.title)}…</div>
      </div>
      <style>@keyframes ch-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>`;
      renderTabs();

      // Strategy 1: Try direct iframe (uses the browser's network stack + DNS)
      let iframeLoaded = false;
      const iframe = document.createElement('iframe');
      iframe.src = fullUrl;
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#fff';
      iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
      iframe.onload = () => { iframeLoaded = true; };
      content.innerHTML = '';
      content.appendChild(iframe);

      // After 4 seconds, check if the iframe loaded successfully
      setTimeout(async () => {
        if (iframeLoaded && document.contains(iframe)) {
          // iframe loaded — but check if it's blank (X-Frame-Options blocked)
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc || doc.body?.innerHTML === '' || doc.URL === 'about:blank') {
              // Blank — try server proxy
              await tryProxy(fullUrl, content);
            }
            // else: cross-origin = page loaded fine, leave it
          } catch (e) {
            // Cross-origin = page loaded fine, leave the iframe
          }
        } else if (document.contains(iframe)) {
          // iframe didn't fire onload — try server proxy
          await tryProxy(fullUrl, content);
        }
      }, 4000);
      renderTabs();
    }

    async function tryProxy(fullUrl, content) {
      try {
        const res = await fetch('/api/browse?url=' + encodeURIComponent(fullUrl), { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Server proxy failed');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const iframe2 = document.createElement('iframe');
        iframe2.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#fff';
        iframe2.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
        iframe2.srcdoc = data.html || '';
        content.innerHTML = '';
        content.appendChild(iframe2);
      } catch (e) {
        showFallback(fullUrl, e.message);
      }
    }

    function showFallback(fullUrl, errMsg) {
      content.innerHTML = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5">
        <div style="font-size:48px;margin-bottom:12px">🌐</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:6px">${esc(tab.title)}</div>
        <div style="color:#888;margin-bottom:14px">${esc(fullUrl)}</div>
        <div style="max-width:400px;text-align:center;color:#666;font-size:13px;margin-bottom:14px">${esc(errMsg || 'Could not load this page. The site may be offline or blocking embedded content.')}</div>
        <div style="display:flex;gap:8px">
          <a href="${esc(fullUrl)}" target="_blank" class="btn btn-primary btn-sm">Open in new tab ↗</a>
          <button class="btn btn-sm" id="ch-retry">↻ Retry</button>
        </div>
      </div>`;
      const retry = content.querySelector('#ch-retry');
      if (retry) retry.onclick = () => navigate(fullUrl);
    }

    function showNewTabPage() {
      content.innerHTML = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:60px;background:#fff">
        <div style="font-size:56px;font-weight:700;background:linear-gradient(90deg,#4285f4,#ea4335,#fbbc05,#34a853);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:30px">Lab Browser</div>
        <div style="width:500px;max-width:90%;position:relative">
          <input class="field" id="ch-search" placeholder="Search the web or type a URL" style="width:100%;padding:14px 20px;border-radius:24px;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        </div>
        <div style="margin-top:24px;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:600px">
          ${[
            {name:'Google',url:'google.com',icon:'🔍'},{name:'GitHub',url:'github.com',icon:'🐙'},
            {name:'YouTube',url:'youtube.com',icon:'▶️'},{name:'Wikipedia',url:'wikipedia.org',icon:'📚'},
            {name:'Reddit',url:'reddit.com',icon:'🤖'},{name:'Stack Overflow',url:'stackoverflow.com',icon:'📚'},
            {name:'Microsoft',url:'microsoft.com',icon:'🪟'},{name:'Azure',url:'portal.azure.com',icon:'☁️'},
          ].map(s => `<div class="chrome-shortcut" data-url="${s.url}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:10px;border-radius:8px">
            <div style="font-size:32px">${s.icon}</div><div style="font-size:12px;margin-top:4px">${s.name}</div></div>`).join('')}
        </div>
      </div>`;
      const search = content.querySelector('#ch-search');
      search.focus();
      search.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(search.value); });
      content.querySelectorAll('.chrome-shortcut').forEach(s => s.onclick = () => navigate(s.dataset.url));
    }

    function renderTabs() {
      const tb = body.querySelector('#ch-tabs');
      tb.innerHTML = tabs.map((t,i) => `<div class="chrome-tab ${i===activeTab?'active':''}" data-idx="${i}">
        <span>${esc(t.title)}</span><button class="chrome-close" data-idx="${i}">×</button></div>`).join('') + '<button class="chrome-newtab" id="ch-newtab">+</button>';
      tb.querySelectorAll('.chrome-tab').forEach(t => t.onclick = e => {
        if (e.target.classList.contains('chrome-close')) return;
        activeTab = parseInt(t.dataset.idx); render();
      });
      tb.querySelectorAll('.chrome-close').forEach(b => b.onclick = e => {
        e.stopPropagation();
        const idx = parseInt(b.dataset.idx);
        if (tabs.length === 1) { tabs = [{ id: ++tabCounter, title: 'New Tab', url: '', history: [], histIdx: -1 }]; activeTab = 0; }
        else { tabs.splice(idx, 1); if (activeTab >= idx) activeTab = Math.max(0, activeTab-1); }
        render();
      });
      tb.querySelector('#ch-newtab').onclick = () => { tabs.push({ id: ++tabCounter, title: 'New Tab', url: '', history: [], histIdx: -1 }); activeTab = tabs.length-1; render(); };
    }

    if (!tab.url) showNewTabPage();
    else navigate(tab.url);

    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(urlInput.value); });
    body.querySelector('#ch-back').onclick = () => { if (tab.histIdx > 0) { tab.histIdx--; const u = tab.history[tab.histIdx]; tab.url = u; urlInput.value = u; navigate(u); } };
    body.querySelector('#ch-fwd').onclick = () => { if (tab.histIdx < tab.history.length-1) { tab.histIdx++; const u = tab.history[tab.histIdx]; tab.url = u; urlInput.value = u; navigate(u); } };
    body.querySelector('#ch-reload').onclick = () => { if (tab.url) navigate(tab.url); };
    body.querySelector('#ch-home').onclick = () => { tab.url = ''; tab.title = 'New Tab'; showNewTabPage(); urlInput.value = ''; renderTabs(); };
    body.querySelector('#ch-bookmark').onclick = () => {
      if (!tab.url) return;
      const exists = bookmarks.find(b => b.url === tab.url);
      if (exists) { const idx = bookmarks.indexOf(exists); bookmarks.splice(idx,1); toast('Bookmark removed'); }
      else { bookmarks.push({ name: tab.title, url: tab.url }); toast('Bookmarked'); }
      saveBookmarks(); render();
    };
    body.querySelectorAll('.chrome-bm').forEach(b => b.onclick = () => navigate(b.dataset.url));
  }
  render();
}

// ============ Calculator ============
export function openCalculator(body) {
  let display = '0', prev = null, op = null, waiting = false, scientific = false;

  function update() {
    body.querySelector('#calc-display').textContent = display;
    body.querySelector('#calc-sub').textContent = prev !== null ? `${prev} ${op || ''}` : '';
  }

  function input(d) {
    if (waiting) { display = d; waiting = false; }
    else { display = display === '0' ? d : display + d; }
    update();
  }
  function inputDot() {
    if (waiting) { display = '0.'; waiting = false; }
    else if (!display.includes('.')) display += '.';
    update();
  }
  function clearAll() { display = '0'; prev = null; op = null; waiting = false; update(); }
  function backspace() { display = display.length > 1 ? display.slice(0,-1) : '0'; update(); }
  function negate() { display = String(-parseFloat(display)); update(); }
  function percent() { display = String(parseFloat(display)/100); update(); }

  function setOp(o) {
    if (prev !== null && op && !waiting) calculate();
    prev = parseFloat(display);
    op = o;
    waiting = true;
    update();
  }
  function calculate() {
    if (prev === null || op === null) return;
    const cur = parseFloat(display);
    let r;
    switch(op) {
      case '+': r = prev + cur; break;
      case '-': r = prev - cur; break;
      case '×': r = prev * cur; break;
      case '÷': r = cur === 0 ? 'Error' : prev / cur; break;
      case 'x^y': r = Math.pow(prev, cur); break;
    }
    display = String(r);
    prev = null; op = null; waiting = true;
    update();
  }

  function sciFunc(fn) {
    const v = parseFloat(display);
    let r;
    switch(fn) {
      case 'sin': r = Math.sin(v); break;
      case 'cos': r = Math.cos(v); break;
      case 'tan': r = Math.tan(v); break;
      case 'log': r = Math.log10(v); break;
      case 'ln': r = Math.log(v); break;
      case 'sqrt': r = Math.sqrt(v); break;
      case 'x^2': r = v * v; break;
      case '1/x': r = 1 / v; break;
      case 'pi': r = Math.PI; break;
      case 'e': r = Math.E; break;
      case 'n!': r = factorial(v); break;
    }
    display = String(r); waiting = true; update();
  }
  function factorial(n) { if (n < 0) return 'Error'; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

  function render() {
    body.innerHTML = `<div class="app" style="display:flex;flex-direction:column;padding:8px;height:100%;box-sizing:border-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h2 style="font-size:14px">Calculator</h2>
        <button class="btn btn-sm" id="calc-mode">${scientific ? 'Scientific' : 'Standard'} ▾</button>
      </div>
      <div class="calc-display">
        <div class="calc-sub" id="calc-sub"></div>
        <div class="calc-main" id="calc-display">0</div>
      </div>
      ${scientific ? `
      <div class="calc-sci">
        <button class="calc-btn" data-sci="sin">sin</button>
        <button class="calc-btn" data-sci="cos">cos</button>
        <button class="calc-btn" data-sci="tan">tan</button>
        <button class="calc-btn" data-sci="log">log</button>
        <button class="calc-btn" data-sci="ln">ln</button>
        <button class="calc-btn" data-sci="sqrt">√</button>
        <button class="calc-btn" data-sci="x^2">x²</button>
        <button class="calc-btn" data-sci="1/x">1/x</button>
        <button class="calc-btn" data-sci="x^y">x^y</button>
        <button class="calc-btn" data-sci="pi">π</button>
        <button class="calc-btn" data-sci="e">e</button>
        <button class="calc-btn" data-sci="n!">n!</button>
      </div>` : ''}
      <div class="calc-grid">
        <button class="calc-btn calc-fn" data-act="clear">C</button>
        <button class="calc-btn calc-fn" data-act="negate">±</button>
        <button class="calc-btn calc-fn" data-act="percent">%</button>
        <button class="calc-btn calc-op" data-op="÷">÷</button>
        <button class="calc-btn" data-num="7">7</button>
        <button class="calc-btn" data-num="8">8</button>
        <button class="calc-btn" data-num="9">9</button>
        <button class="calc-btn calc-op" data-op="×">×</button>
        <button class="calc-btn" data-num="4">4</button>
        <button class="calc-btn" data-num="5">5</button>
        <button class="calc-btn" data-num="6">6</button>
        <button class="calc-btn calc-op" data-op="-">-</button>
        <button class="calc-btn" data-num="1">1</button>
        <button class="calc-btn" data-num="2">2</button>
        <button class="calc-btn" data-num="3">3</button>
        <button class="calc-btn calc-op" data-op="+">+</button>
        <button class="calc-btn" data-num="0" style="grid-column:span 2">0</button>
        <button class="calc-btn" data-act="dot">.</button>
        <button class="calc-btn calc-eq" data-act="equals">=</button>
      </div>
    </div>`;

    body.querySelector('#calc-mode').onclick = () => { scientific = !scientific; render(); };
    body.querySelectorAll('[data-num]').forEach(b => b.onclick = () => input(b.dataset.num));
    body.querySelectorAll('[data-op]').forEach(b => b.onclick = () => setOp(b.dataset.op));
    body.querySelectorAll('[data-sci]').forEach(b => b.onclick = () => sciFunc(b.dataset.sci));
    body.querySelector('[data-act="clear"]').onclick = clearAll;
    body.querySelector('[data-act="negate"]').onclick = negate;
    body.querySelector('[data-act="percent"]').onclick = percent;
    body.querySelector('[data-act="dot"]').onclick = inputDot;
    body.querySelector('[data-act="equals"]').onclick = calculate;
    update();
  }

  render();
}
