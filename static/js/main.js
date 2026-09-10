import { API } from './api.js';
import { createWindow, closeWindow, toast, maximizeWindow, restoreWindow, minimizeWindow, snapWindow, rebuildTaskbar, pinApp, unpinApp, isPinned } from './wm.js';
import { openLocalUsers, openFileExplorer, openPowerShell, openCMD } from './apps/lab1.js';
import { openEntraPortal, openSignInLogs } from './apps/lab2.js';
import { openServiceDesk, openKnowledgeBase, openReports } from './apps/lab3.js';
import { openSettings, applySettings } from './apps/settings.js';
import { openCalendar, openStickyNotes, openEpicPen, openNotepadPP, openChrome, openCalculator } from './apps/accessories.js';
import { openWord, openExcel, openPowerPoint } from './apps/office.js';
import { openADUC } from './apps/ad.js';
import { openRoadmap } from './apps/roadmap.js';
import { openChatbot } from './apps/chatbot.js';
import { initContextMenus, initMouseShortcuts, applyDesktopView } from './context-menus.js';

// Apply saved settings on load
applySettings();
applyDesktopView();

// Initialize context menus and mouse shortcuts
initContextMenus();
initMouseShortcuts();

// App registry: id, title, icon, opener, group
const APPS = [
  { id: 'settings', title: 'Settings', icon: '⚙️', opener: openSettings, group: 'System' },
  { id: 'calendar', title: 'Calendar', icon: '📅', opener: openCalendar, group: 'Accessories' },
  { id: 'stickies', title: 'Sticky Notes', icon: '📝', opener: openStickyNotes, group: 'Accessories' },
  { id: 'epicpen', title: 'Epic Pen', icon: '✏️', opener: openEpicPen, group: 'Accessories' },
  { id: 'notepad', title: 'Notepad++', icon: '📃', opener: openNotepadPP, group: 'Accessories' },
  { id: 'chrome', title: 'Lab Browser', icon: '🌐', opener: openChrome, group: 'Accessories' },
  { id: 'calc', title: 'Calculator', icon: '🧮', opener: openCalculator, group: 'Accessories', width: 300, height: 480 },
  { id: 'word', title: 'Microsoft Word', icon: '📄', opener: openWord, group: 'Office' },
  { id: 'excel', title: 'Microsoft Excel', icon: '📊', opener: openExcel, group: 'Office' },
  { id: 'ppt', title: 'PowerPoint', icon: '📽️', opener: openPowerPoint, group: 'Office' },
  { id: 'aduc', title: 'Active Directory', icon: '🏢', opener: openADUC, group: 'Administration' },
  { id: 'roadmap', title: 'Lab Roadmap', icon: '🗺️', opener: openRoadmap, group: 'Help' },
  { id: 'lusrmgr', title: 'Local Users and Groups', icon: '👥', opener: openLocalUsers, group: 'Lab 1' },
  { id: 'explorer', title: 'File Explorer', icon: '📁', opener: openFileExplorer, group: 'Lab 1' },
  { id: 'powershell', title: 'PowerShell', icon: '⚡', opener: openPowerShell, group: 'Lab 1' },
  { id: 'cmd', title: 'Command Prompt', icon: '🖥️', opener: openCMD, group: 'Lab 1' },
  { id: 'entra', title: 'Entra ID Admin Center', icon: '🔐', opener: openEntraPortal, group: 'Lab 2' },
  { id: 'signins', title: 'Sign-in Logs', icon: '📜', opener: openSignInLogs, group: 'Lab 2' },
  { id: 'servicedesk', title: 'Service Desk Console', icon: '🎫', opener: openServiceDesk, group: 'Lab 3' },
  { id: 'kb', title: 'Knowledge Base', icon: '📚', opener: openKnowledgeBase, group: 'Lab 3' },
  { id: 'reports', title: 'Reports Dashboard', icon: '📊', opener: openReports, group: 'Lab 3' },
  { id: 'chatbot', title: 'Lab Assistant', icon: '🤖', opener: openChatbot, group: 'Help', width: 480, height: 600 },
];

function launch(app) {
  // Epic Pen is a direct-action tool — no window, just the floating toolbar
  if (app.id === 'epicpen') { app.opener(null); return; }
  createWindow({ id: app.id, title: app.title, icon: app.icon, content: app.opener, width: app.width, height: app.height });
}

// ---- Clock ----
function tick() {
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const d = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
  const tc = document.getElementById('tray-clock');
  if (tc) tc.innerHTML = `${t}<br>${d}`;
  const lc = document.getElementById('lock-clock');
  if (lc) lc.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ld = document.getElementById('lock-date');
  if (ld) ld.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
setInterval(tick, 1000); tick();

// ---- Login ----
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (window._loginDone) return;  // fallback already handled it
  window._loginDone = true;
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const res = await API.login(u, p);
    enterDesktop(res.user);
  } catch (ex) {
    err.textContent = 'Invalid credentials. Try the accounts shown below.';
    window._loginDone = false;
  }
});

async function enterDesktop(user) {
  try {
    document.getElementById('lockscreen').classList.add('hidden');
    document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('start-user-name').textContent = user.full_name;
    document.getElementById('start-user-avatar').textContent = (user.full_name || 'U')[0];
    document.getElementById('lock-avatar').textContent = (user.full_name || 'U')[0];
    document.getElementById('lock-name').textContent = user.full_name;
    buildDesktopIcons();
    buildStartMenu();
    rebuildTaskbar();
  } catch (e) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:10px;font:13px monospace;z-index:99999';
    d.textContent = 'enterDesktop error: ' + e.message;
    document.body.appendChild(d);
  }
}

function buildDesktopIcons() {
  const c = document.getElementById('desktop-icons');
  c.innerHTML = '';
  const view = JSON.parse(localStorage.getItem('labvm-desktop-view') || '{"size":"medium","showIcons":true,"autoArrange":true,"alignGrid":true}');
  const positions = JSON.parse(localStorage.getItem('labvm-icon-positions') || '{}');
  const gridSize = view.alignGrid !== false ? 10 : 1;
  const iconW = view.size === 'large' ? 104 : view.size === 'small' ? 64 : 84;
  const iconH = view.size === 'large' ? 104 : view.size === 'small' ? 64 : 84;
  const colW = iconW + 4;

  // Single set of drag listeners (avoid stacking listeners on rebuild)
  let dragState = null; // { el, appId, dragStart, elStart, hasMoved }
  // Remove old drag listener if it exists
  if (window._labvmDragMove) document.removeEventListener('mousemove', window._labvmDragMove);
  if (window._labvmDragEnd) document.removeEventListener('mouseup', window._labvmDragEnd);

  window._labvmDragMove = (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.dragStart.x;
    const dy = e.clientY - dragState.dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.hasMoved = true;
    if (!dragState.hasMoved) return;
    const el = dragState.el;
    el.classList.add('dragging');
    let nx = dragState.elStart.x + dx;
    let ny = dragState.elStart.y + dy;
    const maxX = (c.clientWidth || window.innerWidth) - iconW - 4;
    const maxY = (c.clientHeight || window.innerHeight - 48) - iconH - 4;
    nx = Math.max(0, Math.min(nx, maxX));
    ny = Math.max(0, Math.min(ny, maxY));
    if (view.alignGrid !== false) {
      nx = Math.round(nx / gridSize) * gridSize;
      ny = Math.round(ny / gridSize) * gridSize;
    }
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  };
  window._labvmDragEnd = () => {
    if (!dragState) return;
    const el = dragState.el;
    el.classList.remove('dragging');
    if (dragState.hasMoved) {
      positions[dragState.appId] = { x: parseInt(el.style.left), y: parseInt(el.style.top) };
      localStorage.setItem('labvm-icon-positions', JSON.stringify(positions));
    }
    dragState = null;
  };
  document.addEventListener('mousemove', window._labvmDragMove);
  document.addEventListener('mouseup', window._labvmDragEnd);

  APPS.forEach((app, idx) => {
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.dataset.appId = app.id;
    el.innerHTML = `<div class="ic">${app.icon}</div><div class="lbl">${app.title}</div>`;

    // Position: use saved position, or auto-arrange in columns
    let pos = positions[app.id];
    if (!pos || view.autoArrange !== false) {
      // Auto-arrange: column layout, top to bottom
      const containerH = c.clientHeight || (window.innerHeight - 48);
      const iconsPerCol = Math.max(1, Math.floor((containerH - 20) / (iconH + 4)));
      const col = Math.floor(idx / iconsPerCol);
      const row = idx % iconsPerCol;
      pos = { x: 16 + col * colW, y: 16 + row * (iconH + 4) };
    }
    // Snap to grid if enabled
    if (view.alignGrid !== false) {
      pos = { x: Math.round(pos.x / gridSize) * gridSize, y: Math.round(pos.y / gridSize) * gridSize };
    }
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';

    // Click: select
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
    });
    // Double-click: open
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      launch(app);
    });

    // Drag to move: set drag state, single document listener handles the rest
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragState = {
        el,
        appId: app.id,
        dragStart: { x: e.clientX, y: e.clientY },
        elStart: { x: parseInt(el.style.left), y: parseInt(el.style.top) },
        hasMoved: false,
      };
      e.preventDefault();
    });

    // Right-click: Pin/Unpin to taskbar
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showIconContextMenu(e.clientX, e.clientY, app);
    });

    c.appendChild(el);
  });
}

function showIconContextMenu(x, y, app) {
  document.querySelectorAll('.icon-ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'icon-ctx-menu';
  menu.style.cssText = 'position:fixed;background:#fff;border:1px solid #c0c0c0;box-shadow:2px 2px 6px rgba(0,0,0,.18);z-index:100000;min-width:180px;padding:2px;font-size:12px;border-radius:4px';
  const pinned = isPinned(app.id);
  const items = [
    { label: '📂 Open', act: () => launch(app) },
    { sep: true },
    { label: pinned ? '📌 Unpin from taskbar' : '📌 Pin to taskbar', act: () => { pinned ? unpinApp(app.id) : pinApp(app.id); toast(pinned ? 'Unpinned' : 'Pinned to taskbar'); } },
  ];
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
  menu.style.top = y + 'px';
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 4) + 'px';
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 4) + 'px';
}
document.addEventListener('click', () => document.querySelectorAll('.icon-ctx-menu').forEach(m => m.remove()), { capture: true });

function buildStartMenu() {
  const pinned = document.getElementById('start-pinned');
  const all = document.getElementById('start-allapps');
  pinned.innerHTML = ''; all.innerHTML = '';
  APPS.forEach(app => {
    const mk = () => {
      const el = document.createElement('div');
      el.className = 'start-app';
      el.innerHTML = `<div class="ic">${app.icon}</div><div>${app.title}</div>`;
      el.onclick = () => { launch(app); toggleStart(false); };
      // Right-click: Pin/Unpin to taskbar
      el.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showIconContextMenu(e.clientX, e.clientY, app);
      };
      return el;
    };
    pinned.appendChild(mk());
    all.appendChild(mk());
  });
}

// ---- Start menu ----
const startMenu = document.getElementById('start-menu');
document.getElementById('start-btn').onclick = (e) => { e.stopPropagation(); toggleStart(); };
document.addEventListener('click', (e) => { if (!startMenu.contains(e.target) && e.target.id !== 'start-btn') toggleStart(false); });
function toggleStart(show) {
  const open = show === undefined ? startMenu.classList.contains('hidden') : show;
  startMenu.classList.toggle('hidden', !open);
}
document.getElementById('start-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.start-app').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});
document.getElementById('start-power').onclick = async () => {
  await API.logout();
  location.reload();
};
// Settings gear in start menu
document.getElementById('start-user').onclick = () => {
  const app = APPS.find(a => a.id === 'settings');
  if (app) { launch(app); toggleStart(false); }
};

// expose for apps
window.LabVM = { launch, APPS, createWindow, closeWindow, toast, API, enterDesktop, maximizeWindow, restoreWindow, minimizeWindow, snapWindow, buildDesktopIcons, buildStartMenu };

// If the fallback inline script already logged in and showed the desktop, build the icons now
if (!document.getElementById('desktop').classList.contains('hidden')) {
  buildDesktopIcons();
  buildStartMenu();
}
