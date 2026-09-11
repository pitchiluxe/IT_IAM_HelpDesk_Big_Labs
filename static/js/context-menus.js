// Right-click context menus and mouse shortcuts for the Lab VM desktop
import { toast } from './wm.js';

let contextMenu = null;
let allMenus = []; // track ALL open menu elements (parent + submenus)

export function initContextMenus() {
  // Global: suppress the browser's native context menu everywhere in the app.
  // Only allow it on text inputs/textareas where copy/cut/paste is useful.
  document.addEventListener('contextmenu', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // allow native menu on text fields
    e.preventDefault();
  }, { capture: true });

  // Desktop right-click
  document.getElementById('desktop').addEventListener('contextmenu', e => {
    // If clicking on a desktop icon, let the icon handler work
    if (e.target.closest('.desktop-icon')) return;
    e.preventDefault();
    const viewSettings = JSON.parse(localStorage.getItem('labvm-desktop-view') || '{"size":"medium","showIcons":true,"autoArrange":true,"alignGrid":true}');
    const iconSizes = [
      { label: 'Large icons', value: 'large', icon: '🔲' },
      { label: 'Medium icons', value: 'medium', icon: '🔳' },
      { label: 'Small icons', value: 'small', icon: '▫️' },
    ];
    showMenu(e.clientX, e.clientY, [
      { label: '🔄 Refresh', action: () => { if (window.LabVM) { window.LabVM.buildDesktopIcons?.(); window.LabVM.buildStartMenu?.(); } toast('Desktop refreshed'); } },
      { sep: true },
      { label: '👁️ View ▸', submenu: [
        ...iconSizes.map(s => ({
          label: (viewSettings.size === s.value ? '✓ ' : '   ') + s.label,
          action: () => { viewSettings.size = s.value; saveViewSettings(viewSettings); applyDesktopView(); }
        })),
        { sep: true },
        { label: (viewSettings.showIcons ? '✓ ' : '   ') + 'Show desktop icons', action: () => { viewSettings.showIcons = !viewSettings.showIcons; saveViewSettings(viewSettings); applyDesktopView(); } },
        { label: (viewSettings.autoArrange ? '✓ ' : '   ') + 'Auto arrange icons', action: () => { viewSettings.autoArrange = !viewSettings.autoArrange; saveViewSettings(viewSettings); if (viewSettings.autoArrange) localStorage.removeItem('labvm-icon-positions'); applyDesktopView(); } },
        { label: (viewSettings.alignGrid ? '✓ ' : '   ') + 'Align icons to grid', action: () => { viewSettings.alignGrid = !viewSettings.alignGrid; saveViewSettings(viewSettings); applyDesktopView(); } },
      ]},
      { label: '🔄 Sort by ▸', submenu: [
        { label: 'Name', action: () => sortDesktopIcons('name') },
        { label: 'Group', action: () => sortDesktopIcons('group') },
        { label: 'Date modified', action: () => sortDesktopIcons('date') },
      ]},
      { sep: true },
      { label: '📁 New Folder', action: () => newFolderDesktop() },
      { label: '📝 New Text Document', action: () => newTextDocDesktop() },
      { label: '🗒️ New Sticky Note', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'stickies'); if (app) window.LabVM.launch(app); } },
      { sep: true },
      { label: '📋 Paste', action: () => pasteFromClipboard() },
      { sep: true },
      { label: '🎨 Personalize', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'settings'); if (app) window.LabVM.launch(app); } },
      { label: '🖥️ Display settings', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'settings'); if (app) window.LabVM.launch(app); } },
      { label: '⚙️ Settings', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'settings'); if (app) window.LabVM.launch(app); } },
      { sep: true },
      { label: '📅 Open Calendar', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'calendar'); if (app) window.LabVM.launch(app); } },
      { label: '🧮 Open Calculator', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'calc'); if (app) window.LabVM.launch(app); } },
      { label: '🌐 Open Chrome', action: () => { const app = window.LabVM?.APPS?.find(a => a.id === 'chrome'); if (app) window.LabVM.launch(app); } },
    ]);
  });

  // Desktop icon right-click
  document.getElementById('desktop-icons').addEventListener('contextmenu', e => {
    const icon = e.target.closest('.desktop-icon');
    if (!icon) return;
    e.preventDefault();
    const appId = icon.dataset.appId;
    const app = window.LabVM?.APPS?.find(a => a.id === appId);
    if (!app) return;
    showMenu(e.clientX, e.clientY, [
      { label: '📂 Open', action: () => window.LabVM.launch(app) },
      { label: '📌 Pin to Start', action: () => { toast('Pinned to Start'); window.LabVM.buildStartMenu?.(); } },
      { label: '📌 Pin to Taskbar', action: () => { toast('Pinned to Taskbar'); } },
      { sep: true },
      { label: '✂️ Cut', action: () => { window.LabVM._clipboard = { type: 'icon', app }; toast('Cut'); } },
      { label: '📋 Copy', action: () => { window.LabVM._clipboard = { type: 'icon', app }; toast('Copied'); } },
      { label: '🔗 Create shortcut', action: () => toast('Shortcut created') },
      { sep: true },
      { label: '🗑️ Delete', action: () => { icon.remove(); toast('Icon removed'); } },
      { label: '✏️ Rename', action: () => renameIcon(icon, app) },
      { sep: true },
      { label: 'ℹ️ Properties', action: () => showProperties(app) },
    ]);
  });

  // Text input right-click (copy/cut/paste/select all)
  document.addEventListener('contextmenu', e => {
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      e.preventDefault();
      const hasSelection = el.selectionStart !== el.selectionEnd;
      const canPaste = window.LabVM?._clipboard?.text !== undefined;
      showMenu(e.clientX, e.clientY, [
        { label: '↩️ Undo', action: () => document.execCommand('undo'), disabled: false },
        { sep: true },
        { label: '✂️ Cut', action: () => { window.LabVM._clipboard = { text: el.value.substring(el.selectionStart, el.selectionEnd) }; document.execCommand('cut'); }, disabled: !hasSelection },
        { label: '📋 Copy', action: () => { window.LabVM._clipboard = { text: el.value.substring(el.selectionStart, el.selectionEnd) }; document.execCommand('copy'); }, disabled: !hasSelection },
        { label: '📌 Paste', action: () => { if (window.LabVM._clipboard?.text !== undefined) { const t = window.LabVM._clipboard.text; const s = el.selectionStart; el.value = el.value.slice(0, s) + t + el.value.slice(el.selectionEnd); el.selectionStart = el.selectionEnd = s + t.length; } }, disabled: !canPaste },
        { label: '🗑️ Delete', action: () => { document.execCommand('delete'); }, disabled: !hasSelection },
        { sep: true },
        { label: '☑️ Select All', action: () => { el.select(); } },
      ]);
    }
  });

  // Window titlebar right-click
  document.getElementById('windows-layer').addEventListener('contextmenu', e => {
    const win = e.target.closest('.win');
    if (!win) return;
    // Only trigger on titlebar
    const titlebar = win.querySelector('.win-titlebar');
    if (!titlebar || !titlebar.contains(e.target)) return;
    e.preventDefault();
    const isMax = win.dataset.maximized === 'true';
    showMenu(e.clientX, e.clientY, [
      { label: '↩️ Restore', action: () => window.LabVM.restoreWindow?.(win.id), disabled: !isMax },
      { label: '↔️ Move', action: () => toast('Drag the titlebar to move') },
      { label: '↕️ Size', action: () => toast('Drag any edge to resize') },
      { sep: true },
      { label: '📉 Minimize', action: () => window.LabVM.minimizeWindow?.(win.id) },
      { label: '📈 Maximize', action: () => window.LabVM.maximizeWindow?.(win.id), disabled: isMax },
      { sep: true },
      { label: '❌ Close', action: () => window.LabVM.closeWindow?.(win.id) },
    ]);
  });

  // Close menu on left-click ONLY (not right-click or mousemove)
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // only left click closes
    // Don't close if clicking inside a menu
    if (e.target.closest('.context-menu')) return;
    closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  // Close on contextmenu elsewhere (right-clicking again repositions)
  document.addEventListener('contextmenu', (e) => {
    // If the event already triggered a menu (desktop/icon/window handlers), they call showMenu which calls closeMenu first.
    // This listener is a catch-all that runs after the specific handlers.
    // If no handler called showMenu (e.g. right-click on empty area without handler), close any open menu.
    setTimeout(() => {
      // If no menu was created for this contextmenu event, close existing
      if (contextMenu && !contextMenu.contains(e.target)) {
        // Check if a new menu was opened by a handler — if contextMenu was just created, it's fine
        // This is a safety net
      }
    }, 0);
  }, { capture: true });
}

function showMenu(x, y, items, parent) {
  // If this is a submenu, only remove other submenus, keep the root
  if (parent) {
    document.querySelectorAll('.ctx-submenu').forEach(s => s.remove());
  } else {
    closeMenu();
  }
  const menu = document.createElement('div');
  menu.className = 'context-menu' + (parent ? ' ctx-submenu' : '');
  // Calculate position after adding items so we know the height
  document.body.appendChild(menu);
  items.forEach(item => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'ctx-item' + (item.disabled ? ' ctx-disabled' : '');
      const arrow = item.submenu ? '<span class="ctx-arrow">▸</span>' : '';
      el.innerHTML = `<span class="ctx-label">${item.label}</span>${arrow}`;
      if (item.submenu) {
        el.classList.add('ctx-has-submenu');
        el.onmouseenter = () => {
          const rect = el.getBoundingClientRect();
          showMenu(rect.right - 4, rect.top, item.submenu, el);
        };
      } else if (!item.disabled) {
        el.onclick = (e) => { e.stopPropagation(); closeMenu(); item.action(); };
      }
      menu.appendChild(el);
    }
  });
  // Now position — measure actual height
  const menuH = menu.offsetHeight;
  const menuW = menu.offsetWidth;
  let px = Math.min(x, window.innerWidth - menuW - 4);
  let py = Math.min(y, window.innerHeight - menuH - 4);
  if (py < 0) py = 0;
  if (px < 0) px = 0;
  menu.style.left = px + 'px';
  menu.style.top = py + 'px';
  if (!parent) {
    contextMenu = menu;
    allMenus = [menu];
  } else {
    allMenus.push(menu);
  }
}

function closeMenu() {
  allMenus.forEach(m => m.remove());
  allMenus = [];
  contextMenu = null;
}

function pasteFromClipboard() {
  if (window.LabVM?._clipboard?.type === 'icon' && window.LabVM?._clipboard?.app) {
    window.LabVM.launch(window.LabVM._clipboard.app);
    toast('Pasted');
  } else {
    toast('Nothing to paste');
  }
}

function saveViewSettings(s) { localStorage.setItem('labvm-desktop-view', JSON.stringify(s)); }

export function applyDesktopView() {
  const s = JSON.parse(localStorage.getItem('labvm-desktop-view') || '{"size":"medium","showIcons":true,"autoArrange":true,"alignGrid":true}');
  const container = document.getElementById('desktop-icons');
  if (!container) return;
  container.style.display = s.showIcons === false ? 'none' : '';
  container.className = 'desktop-icons size-' + (s.size || 'medium');
  // Rebuild icons to apply new positions
  if (window.LabVM?.buildDesktopIcons) window.LabVM.buildDesktopIcons();
}

function sortDesktopIcons(by) {
  const container = document.getElementById('desktop-icons');
  if (!container) return;
  const apps = window.LabVM?.APPS || [];
  let sorted;
  if (by === 'name') sorted = [...apps].sort((a,b) => a.title.localeCompare(b.title));
  else if (by === 'group') sorted = [...apps].sort((a,b) => (a.group||'').localeCompare(b.group||''));
  else sorted = apps;
  // Clear saved positions so auto-arrange reflows
  localStorage.removeItem('labvm-icon-positions');
  if (window.LabVM) { window.LabVM.APPS = sorted; window.LabVM.buildDesktopIcons(); }
  toast('Sorted by ' + by);
}

function newFolderDesktop() {
  const name = prompt('Folder name:', 'New Folder');
  if (name) toast(`Created folder: ${name} (Simulation - use File Explorer for actual folders)`);
}

function newTextDocDesktop() {
  const name = prompt('Document name:', 'New Document.txt');
  if (name) {
    const app = window.LabVM?.APPS?.find(a => a.id === 'notepad');
    if (app) window.LabVM.launch(app);
    toast(`Created: ${name}`);
  }
}

function renameIcon(icon, app) {
  const newName = prompt('Rename to:', app.title);
  if (newName) {
    app.title = newName;
    const lbl = icon.querySelector('.lbl');
    if (lbl) lbl.textContent = newName;
    window.LabVM.buildStartMenu?.();
    toast('Renamed');
  }
}

function showProperties(app) {
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.innerHTML = `<div class="modal" style="max-width:400px">
    <div class="modal-head"><span>Properties — ${app.title}</span><button class="btn btn-sm" style="border:none;background:none;font-size:18px">×</button></div>
    <div class="modal-body" style="font-size:13px;line-height:1.8">
      <div><b>Name:</b> ${app.title}</div>
      <div><b>Group:</b> ${app.group || 'System'}</div>
      <div><b>Icon:</b> ${app.icon}</div>
      <div><b>Type:</b> Application</div>
      <div><b>Location:</b> C:\\LabVM\\apps\\${app.id}</div>
      <div><b>Size:</b> ${(Math.floor(Math.random() * 500) + 50)} KB</div>
      <div><b>Created:</b> ${new Date().toLocaleDateString()}</div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary btn-sm">OK</button></div>
  </div>`;
  document.body.appendChild(m);
  m.querySelector('.modal-head button').onclick = () => m.remove();
  m.querySelector('.modal-foot button').onclick = () => m.remove();
  m.onclick = e => { if (e.target === m) m.remove(); };
}

// ===== Mouse shortcuts =====
export function initMouseShortcuts() {
  const wl = document.getElementById('windows-layer');

  // Double-click titlebar to maximize/restore
  wl.addEventListener('dblclick', e => {
    const titlebar = e.target.closest('.win-titlebar');
    if (!titlebar) return;
    const win = titlebar.closest('.window');
    if (!win) return;
    if (window.LabVM?.maximizeWindow) {
      if (win.dataset.maximized === 'true') window.LabVM.restoreWindow(win.id);
      else window.LabVM.maximizeWindow(win.id);
    }
  });

  // Drag window to top edge = maximize, to sides = snap
  let dragSnapCheck = false;
  wl.addEventListener('mousedown', e => {
    const titlebar = e.target.closest('.win-titlebar');
    if (!titlebar) return;
    const win = titlebar.closest('.window');
    if (!win || win.dataset.maximized === 'true') return;
    dragSnapCheck = true;
    const startX = e.clientX, startY = e.clientY;
    const onMove = (ev) => {
      if (!dragSnapCheck) return;
      if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      // Check edges during drag
      if (ev.clientY <= 2 && window.LabVM?.maximizeWindow) {
        window.LabVM.maximizeWindow(win.id);
        dragSnapCheck = false;
      } else if (ev.clientX <= 2 && window.LabVM?.snapWindow) {
        window.LabVM.snapWindow(win.id, 'left');
        dragSnapCheck = false;
      } else if (ev.clientX >= window.innerWidth - 2 && window.LabVM?.snapWindow) {
        window.LabVM.snapWindow(win.id, 'right');
        dragSnapCheck = false;
      }
    };
    const onUp = () => { dragSnapCheck = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Middle-click on taskbar button = close window
  document.getElementById('taskbar-apps').addEventListener('mousedown', e => {
    if (e.button !== 1) return; // middle click
    e.preventDefault();
    const btn = e.target.closest('.taskbar-app');
    if (!btn) return;
    const winId = btn.dataset.winId;
    if (winId && window.LabVM?.closeWindow) {
      window.LabVM.closeWindow(winId);
      toast('Window closed (middle-click)');
    }
  });

  // Middle-click on Chrome tab = close tab (handled in chrome app via delegation)
  // This is a global handler for any .chrome-close elements
  document.addEventListener('mousedown', e => {
    if (e.button !== 1) return;
    const chromeTab = e.target.closest('.chrome-tab');
    if (chromeTab) {
      e.preventDefault();
      const closeBtn = chromeTab.querySelector('.chrome-close');
      if (closeBtn) closeBtn.click();
    }
  });
}
