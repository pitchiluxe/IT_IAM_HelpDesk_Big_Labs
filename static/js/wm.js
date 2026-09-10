// Window manager for the Lab VM desktop
let zCounter = 100;
let activeWin = null;
const openWindows = new Map(); // id -> {el, app, taskbarBtn}

// ---- Taskbar pinning ----
function getPinned() { return JSON.parse(localStorage.getItem('labvm-pinned-apps') || '[]'); }
function setPinned(arr) { localStorage.setItem('labvm-pinned-apps', JSON.stringify(arr)); }

export function isPinned(appId) { return getPinned().includes(appId); }

export function pinApp(appId) {
  const pinned = getPinned();
  if (!pinned.includes(appId)) { pinned.push(appId); setPinned(pinned); }
  rebuildTaskbar();
}
export function unpinApp(appId) {
  const pinned = getPinned().filter(id => id !== appId);
  setPinned(pinned);
  rebuildTaskbar();
}

/** Rebuild the taskbar: pinned apps first (always visible), then running apps that aren't pinned. */
export function rebuildTaskbar() {
  const container = document.getElementById('taskbar-apps');
  if (!container) return;
  const pinned = getPinned();
  // Get app metadata from LabVM registry
  const apps = window.LabVM?.APPS || [];
  // Clear and rebuild
  container.innerHTML = '';
  // Pinned apps (always shown)
  for (const appId of pinned) {
    const app = apps.find(a => a.id === appId);
    if (!app) continue;
    const btn = document.createElement('button');
    const isOpen = openWindows.has(appId);
    btn.className = 'taskbar-app' + (isOpen ? ' active' : '') + ' pinned';
    btn.innerHTML = `<span>${app.icon || '?'}</span><span class="taskbar-app-label">${app.title}</span>`;
    btn.title = app.title;
    btn.dataset.appId = appId;
    btn.dataset.pinned = 'true';
    btn.onclick = () => {
      if (isOpen) {
        const w = openWindows.get(appId);
        if (w.el.classList.contains('minimized')) { w.el.classList.remove('minimized'); focusWindow(appId); }
        else if (activeWin === appId) { w.el.classList.add('minimized'); btn.classList.remove('active'); }
        else focusWindow(appId);
      } else {
        window.LabVM.launch(app);
      }
    };
    btn.oncontextmenu = (e) => { e.preventDefault(); showTaskbarContextMenu(e.clientX, e.clientY, appId, true); };
    container.appendChild(btn);
  }
  // Running apps that aren't pinned
  for (const [id, rec] of openWindows) {
    if (pinned.includes(id)) continue; // already shown above
    const btn = document.createElement('button');
    const icon = rec.el.querySelector('.win-ic')?.textContent || '?';
    const title = rec.el.querySelector('.win-title-text')?.textContent || id;
    btn.className = 'taskbar-app active';
    btn.innerHTML = `<span>${icon}</span><span class="taskbar-app-label">${title}</span>`;
    btn.title = title;
    btn.dataset.appId = id;
    btn.onclick = () => {
      if (rec.el.classList.contains('minimized')) { rec.el.classList.remove('minimized'); focusWindow(id); }
      else if (activeWin === id) { rec.el.classList.add('minimized'); btn.classList.remove('active'); }
      else focusWindow(id);
    };
    btn.oncontextmenu = (e) => { e.preventDefault(); showTaskbarContextMenu(e.clientX, e.clientY, id, false); };
    rec.taskbarBtn = btn;
    container.appendChild(btn);
  }
  // Toggle crowded class when too many apps (hides labels like the reference app)
  const totalApps = pinned.length + [...openWindows.keys()].filter(id => !pinned.includes(id)).length;
  container.classList.toggle('crowded', totalApps > 6);
}

function showTaskbarContextMenu(x, y, appId, isPinned) {
  // Remove any existing menu
  document.querySelectorAll('.taskbar-ctx-menu').forEach(m => m.remove());
  const apps = window.LabVM?.APPS || [];
  const app = apps.find(a => a.id === appId);
  const menu = document.createElement('div');
  menu.className = 'taskbar-ctx-menu';
  menu.style.cssText = 'position:fixed;background:#fff;border:1px solid #c0c0c0;box-shadow:2px 2px 6px rgba(0,0,0,.18);z-index:100000;min-width:180px;padding:2px;font-size:12px;border-radius:4px';
  const items = [];
  if (app) {
    items.push({ label: isPinned ? '📌 Unpin from taskbar' : '📌 Pin to taskbar', act: () => { isPinned ? unpinApp(appId) : pinApp(appId); } });
    items.push({ sep: true });
    if (openWindows.has(appId)) {
      items.push({ label: '📋 Restore', act: () => { const w = openWindows.get(appId); if (w.el.classList.contains('minimized')) w.el.classList.remove('minimized'); focusWindow(appId); } });
      items.push({ label: '🗙 Close window', act: () => closeWindow(appId) });
    } else {
      items.push({ label: '📂 Open', act: () => window.LabVM.launch(app) });
    }
  }
  for (const item of items) {
    if (item.sep) { menu.appendChild(document.createElement('hr')); continue; }
    const row = document.createElement('div');
    row.textContent = item.label;
    row.style.cssText = 'padding:6px 16px;cursor:pointer;border-radius:2px;color:#222;white-space:nowrap';
    row.onmouseenter = () => row.style.background = 'var(--accent)';
    row.onmouseleave = () => row.style.background = 'transparent';
    row.onclick = (e) => { e.stopPropagation(); menu.remove(); item.act(); };
    menu.appendChild(row);
  }
  menu.style.left = x + 'px';
  menu.style.top = (y - 40) + 'px';
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 4) + 'px';
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 4) + 'px';
}
document.addEventListener('click', () => document.querySelectorAll('.taskbar-ctx-menu').forEach(m => m.remove()), { capture: true });

export function createWindow({ id, title, icon, width = 820, height = 560, x, y, content }) {
  // focus existing if already open
  if (openWindows.has(id)) {
    const w = openWindows.get(id);
    if (w.el.classList.contains('minimized')) w.el.classList.remove('minimized');
    focusWindow(id);
    return w;
  }

  const layer = document.getElementById('windows-layer');
  const vw = window.innerWidth, vh = window.innerHeight - 48;
  const w = Math.min(width, vw - 20);
  const h = Math.min(height, vh - 20);
  const px = x ?? Math.max(20, (vw - w) / 2 + (openWindows.size * 24) % 120);
  const py = y ?? Math.max(20, (vh - h) / 2 + (openWindows.size * 24) % 100);

  const el = document.createElement('div');
  el.className = 'win';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.left = px + 'px';
  el.style.top = py + 'px';
  el.innerHTML = `
    <div class="win-titlebar">
      <div class="win-title-left"><span class="win-ic">${icon || ''}</span><span class="win-title-text">${title}</span></div>
      <div class="win-controls">
        <button class="win-min" title="Minimize">&#x2014;</button>
        <button class="win-max" title="Maximize">&#x25a2;</button>
        <button class="win-close" title="Close">&#x2715;</button>
      </div>
    </div>
    <div class="win-body"></div>
    <div class="win-resize n"></div><div class="win-resize s"></div>
    <div class="win-resize e"></div><div class="win-resize w"></div>
    <div class="win-resize ne"></div><div class="win-resize nw"></div>
    <div class="win-resize se"></div><div class="win-resize sw"></div>
  `;
  layer.appendChild(el);

  const body = el.querySelector('.win-body');
  if (typeof content === 'function') content(body);
  else if (typeof content === 'string') body.innerHTML = content;

  // taskbar button — managed by rebuildTaskbar()
  const tbBtn = document.createElement('button');
  tbBtn.className = 'taskbar-app active';
  tbBtn.innerHTML = icon || '?';
  tbBtn.title = title;

  const rec = { el, id, taskbarBtn: tbBtn };
  openWindows.set(id, rec);
  rebuildTaskbar();

  // controls
  el.querySelector('.win-close').onclick = () => closeWindow(id);
  el.querySelector('.win-min').onclick = () => { el.classList.add('minimized'); tbBtn.classList.remove('active'); };
  el.querySelector('.win-max').onclick = () => toggleMax(id);
  el.querySelector('.win-titlebar').ondblclick = () => toggleMax(id);
  el.addEventListener('mousedown', () => focusWindow(id));

  // drag
  makeDraggable(el);
  makeResizable(el);

  focusWindow(id);
  return rec;
}

function toggleMax(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  if (rec.el.dataset.maximized === 'true') restoreWindow(id);
  else maximizeWindow(id);
}

export function maximizeWindow(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  rec.el.dataset.maximized = 'true';
  rec.el.dataset.prevW = rec.el.style.width;
  rec.el.dataset.prevH = rec.el.style.height;
  rec.el.dataset.prevX = rec.el.style.left;
  rec.el.dataset.prevY = rec.el.style.top;
  rec.el.classList.add('maximized');
}

export function restoreWindow(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  rec.el.dataset.maximized = 'false';
  rec.el.classList.remove('maximized');
  if (rec.el.dataset.prevW) { rec.el.style.width = rec.el.dataset.prevW; rec.el.style.height = rec.el.dataset.prevH; rec.el.style.left = rec.el.dataset.prevX; rec.el.style.top = rec.el.dataset.prevY; }
}

export function minimizeWindow(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  rec.el.classList.add('minimized');
  rebuildTaskbar();
}

export function snapWindow(id, side) {
  const rec = openWindows.get(id);
  if (!rec) return;
  restoreWindow(id);
  const vw = window.innerWidth, vh = window.innerHeight - 48;
  if (side === 'left') { rec.el.style.left = '0px'; rec.el.style.top = '0px'; rec.el.style.width = (vw/2) + 'px'; rec.el.style.height = vh + 'px'; }
  else if (side === 'right') { rec.el.style.left = (vw/2) + 'px'; rec.el.style.top = '0px'; rec.el.style.width = (vw/2) + 'px'; rec.el.style.height = vh + 'px'; }
}

export function closeWindow(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  rec.el.remove();
  openWindows.delete(id);
  if (activeWin === id) activeWin = null;
  rebuildTaskbar();
}

function focusWindow(id) {
  const rec = openWindows.get(id);
  if (!rec) return;
  rec.el.style.zIndex = ++zCounter;
  document.querySelectorAll('.taskbar-app').forEach(b => b.classList.remove('active'));
  // Find the button for this window in the taskbar
  const btn = document.querySelector(`.taskbar-app[data-app-id="${id}"]`);
  if (btn) btn.classList.add('active');
  // dim non-active titlebars
  document.querySelectorAll('.win').forEach(w => w.querySelector('.win-titlebar').style.background = '#f0f0f0');
  rec.el.querySelector('.win-titlebar').style.background = '#e8e8e8';
  activeWin = id;
}

function makeDraggable(el) {
  const bar = el.querySelector('.win-titlebar');
  let sx, sy, ox, oy, dragging = false;
  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.win-controls')) return;
    if (el.classList.contains('maximized')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ox = parseInt(el.style.left); oy = parseInt(el.style.top);
    bar.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    el.style.left = (ox + e.clientX - sx) + 'px';
    el.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; bar.classList.remove('dragging'); } });
}

function makeResizable(el) {
  const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  dirs.forEach(d => {
    const handle = el.querySelector('.win-resize.' + d);
    handle.addEventListener('mousedown', (e) => {
      if (el.classList.contains('maximized')) return;
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      const ow = el.offsetWidth, oh = el.offsetHeight, ox = parseInt(el.style.left), oy = parseInt(el.style.top);
      const mv = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (d.includes('e')) el.style.width = Math.max(340, ow + dx) + 'px';
        if (d.includes('s')) el.style.height = Math.max(220, oh + dy) + 'px';
        if (d.includes('w')) { const nw = Math.max(340, ow - dx); el.style.width = nw + 'px'; el.style.left = (ox + (ow - nw)) + 'px'; }
        if (d.includes('n')) { const nh = Math.max(220, oh - dy); el.style.height = nh + 'px'; el.style.top = (oy + (oh - nh)) + 'px'; }
      };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  });
}

export function toast(msg, ms = 2500) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('desktop').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
