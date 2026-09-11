import { toast } from '../wm.js';
import { modal, esc } from './lab1.js';
import { API } from '../api.js';
import { generateBatch, generateWallpaper, seedToId, idToSeed, generateThemeBatch, generateTheme, randomSeed } from './wallpaperGenerator.js';

// A backend avatar is only treated as a picture when it is a data URL.
// The seed users store single letters ("A", "H", "J") which must fall back
// to the letter-based avatar derived from the display name.
function isImageAvatar(a) { return !!a && a.startsWith('data:'); }

// Wallpaper presets (CSS gradients)
const WALLPAPERS = [
  { id: 'default', name: 'Windows Bloom', css: 'linear-gradient(135deg,#0d4a8a 0%,#0a84ff 40%,#1a5fb4 70%,#0a2e6e 100%)', thumb: 'linear-gradient(135deg,#0d4a8a,#0a84ff,#1a5fb4,#0a2e6e)' },
  { id: 'dark', name: 'Dark Mode', css: '#1a1a2e', thumb: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg,#2c1810 0%,#8b3a0e 30%,#e67e22 60%,#f39c12 100%)', thumb: 'linear-gradient(135deg,#2c1810,#8b3a0e,#e67e22,#f39c12)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg,#0b3d0b 0%,#1a6b1a 40%,#2ecc71 80%,#a8e6a8 100%)', thumb: 'linear-gradient(135deg,#0b3d0b,#1a6b1a,#2ecc71,#a8e6a8)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg,#001f3f 0%,#0074d9 40%,#39cccc 80%,#7fdbff 100%)', thumb: 'linear-gradient(135deg,#001f3f,#0074d9,#39cccc,#7fdbff)' },
  { id: 'purple', name: 'Aurora', css: 'linear-gradient(135deg,#1a0033 0%,#4a0080 30%,#9b59b6 60%,#e84393 100%)', thumb: 'linear-gradient(135deg,#1a0033,#4a0080,#9b59b6,#e84393)' },
  { id: 'mountain', name: 'Mountain', css: 'linear-gradient(180deg,#2c3e50 0%,#34495e 40%,#7f8c8d 70%,#bdc3c7 100%)', thumb: 'linear-gradient(180deg,#2c3e50,#34495e,#7f8c8d,#bdc3c7)' },
  { id: 'fire', name: 'Ember', css: 'linear-gradient(135deg,#1a0000 0%,#4a0000 30%,#c0392b 60%,#e74c3c 100%)', thumb: 'linear-gradient(135deg,#1a0000,#4a0000,#c0392b,#e74c3c)' },
  { id: 'minimal', name: 'Minimal Gray', css: 'linear-gradient(135deg,#2d2d2d 0%,#3d3d3d 50%,#4d4d4d 100%)', thumb: 'linear-gradient(135deg,#2d2d2d,#3d3d3d,#4d4d4d)' },
];

const LOCKSCREEN_WALLPAPERS = [
  { id: 'lock-default', name: 'Windows Blue', css: 'linear-gradient(135deg,#0a2e6e 0%,#0a84ff 50%,#003a70 100%)', thumb: 'linear-gradient(135deg,#0a2e6e,#0a84ff,#003a70)' },
  { id: 'lock-dark', name: 'Midnight', css: 'linear-gradient(180deg,#0a0a1a 0%,#1a1a3a 50%,#0a0a1a 100%)', thumb: 'linear-gradient(180deg,#0a0a1a,#1a1a3a,#0a0a1a)' },
  { id: 'lock-sunset', name: 'Sunset Lock', css: 'linear-gradient(135deg,#2c1810 0%,#8b3a0e 50%,#e67e22 100%)', thumb: 'linear-gradient(135deg,#2c1810,#8b3a0e,#e67e22)' },
  { id: 'lock-forest', name: 'Forest Lock', css: 'linear-gradient(135deg,#0b3d0b 0%,#1a6b1a 50%,#2ecc71 100%)', thumb: 'linear-gradient(135deg,#0b3d0b,#1a6b1a,#2ecc71)' },
  { id: 'lock-purple', name: 'Aurora Lock', css: 'linear-gradient(135deg,#1a0033 0%,#4a0080 50%,#9b59b6 100%)', thumb: 'linear-gradient(135deg,#1a0033,#4a0080,#9b59b6)' },
];

const ACCENT_COLORS = [
  { name: 'Blue', value: '#0a84ff' },
  { name: 'Purple', value: '#9b59b6' },
  { name: 'Green', value: '#2ecc71' },
  { name: 'Orange', value: '#e67e22' },
  { name: 'Red', value: '#e74c3c' },
  { name: 'Teal', value: '#1abc9c' },
  { name: 'Pink', value: '#e84393' },
  { name: 'Indigo', value: '#5b6dc8' },
];

const THEMES = [
  { id: 'light', name: 'Light', taskbarBg: 'rgba(32,32,32,.78)', winBg: '#f3f3f3', winBorder: '#e5e5e5', text: '#1b1b1b' },
  { id: 'dark', name: 'Dark', taskbarBg: 'rgba(20,20,20,.85)', winBg: '#2b2b2b', winBorder: '#3a3a3a', text: '#e0e0e0' },
];

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('labvm-settings') || '{}'); }
  catch { return {}; }
}

function saveSettings(s) {
  localStorage.setItem('labvm-settings', JSON.stringify(s));
}

export function applySettings() {
  const s = loadSettings();
  const desktop = document.getElementById('desktop');
  const lockscreen = document.getElementById('lockscreen');
  const taskbar = document.getElementById('taskbar');

  // avatar and username
  if (s.avatar) {
    document.querySelectorAll('#lock-avatar, #start-user-avatar').forEach(el => {
      el.style.background = 'url(' + s.avatar + ') center/cover';
      el.textContent = '';
    });
  }
  if (s.userName) {
    document.querySelectorAll('#lock-name, #start-user-name').forEach(el => el.textContent = s.userName);
    if (!s.avatar) document.querySelectorAll('#lock-avatar, #start-user-avatar').forEach(el => el.textContent = (s.userName[0]||'U'));
  }

  // wallpaper — check generated first, then presets
  let wp = WALLPAPERS.find(w => w.id === s.wallpaper);
  if (!wp && s.wallpaper) {
    const info = idToSeed(s.wallpaper);
    if (info) wp = generateWallpaper(info.seed, 'wall');
  }
  if (!wp) wp = WALLPAPERS[0];
  if (desktop) desktop.style.background = wp.css;

  // lockscreen wallpaper — check generated first, then presets
  let lwp = LOCKSCREEN_WALLPAPERS.find(w => w.id === s.lockwallpaper);
  if (!lwp && s.lockwallpaper) {
    const info = idToSeed(s.lockwallpaper);
    if (info) lwp = generateWallpaper(info.seed, 'lock');
  }
  if (!lwp) lwp = LOCKSCREEN_WALLPAPERS[0];
  if (lockscreen) lockscreen.style.background = lwp.css;

  // accent color
  if (s.accent) {
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.style.setProperty('--accent-2', s.accent);
  }

  // theme — check for generated theme first, then presets
  if (s.genTheme) {
    const m = /^gen-theme-([0-9a-z]+)$/.exec(s.genTheme);
    if (m) {
      const gt = generateTheme(parseInt(m[1], 36));
      document.documentElement.style.setProperty('--accent', gt.accent);
      document.documentElement.style.setProperty('--accent-2', gt.accent);
      document.documentElement.style.setProperty('--win-bg', gt.winBg);
      document.documentElement.style.setProperty('--win-border', gt.winBorder);
      document.documentElement.style.setProperty('--text', gt.text);
      if (taskbar) taskbar.style.background = gt.taskbarBg;
    }
  } else {
    const theme = THEMES.find(t => t.id === s.theme) || THEMES[0];
    document.documentElement.style.setProperty('--win-bg', theme.winBg);
    document.documentElement.style.setProperty('--win-border', theme.winBorder);
    document.documentElement.style.setProperty('--text', theme.text);
    if (taskbar) taskbar.style.background = theme.taskbarBg;
  }

  // taskbar position
  if (s.taskbarPos === 'left') {
    taskbar.classList.add('left');
  } else {
    taskbar.classList.remove('left');
  }
}

export function openSettings(body) {
  let s = loadSettings();
  let view = 'personalization';

  body.innerHTML = `
    <div class="app" style="height:100%">
      <div class="portal">
        <div class="portal-nav" style="background:#f0f0f0;color:#333">
          <div class="nav-brand" style="color:#333;border-bottom-color:#ddd">⚙️ Settings</div>
          <div class="nav-item active" data-v="personalization" style="color:#333">🎨 Personalization</div>
          <div class="nav-item" data-v="account" style="color:#333">👤 Account</div>
          <div class="nav-item" data-v="theme" style="color:#333">🌓 Theme</div>
          <div class="nav-item" data-v="wallpaper" style="color:#333">🖼️ Wallpaper</div>
          <div class="nav-item" data-v="lockscreen" style="color:#333">🔒 Lock Screen</div>
          <div class="nav-item" data-v="accent" style="color:#333">🎯 Accent Color</div>
          <div class="nav-item" data-v="taskbar" style="color:#333">📊 Taskbar</div>
          <div class="nav-item" data-v="update" style="color:#333">🔄 Windows Update</div>
          <div class="nav-item" data-v="about" style="color:#333">ℹ️ About</div>
        </div>
        <div class="portal-main">
          <div class="portal-header"><h2 id="set-title">Personalization</h2></div>
          <div class="portal-content" id="set-content"></div>
        </div>
      </div>
    </div>`;

  const nav = body.querySelector('.portal-nav');
  nav.addEventListener('click', e => {
    const it = e.target.closest('.nav-item'); if (!it) return;
    view = it.dataset.v;
    nav.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === it));
    render();
  });

  function render() {
    const c = body.querySelector('#set-content');
    const titles = {
      personalization: 'Personalization', account: 'Account', theme: 'Theme', wallpaper: 'Wallpaper',
      lockscreen: 'Lock Screen', accent: 'Accent Color', taskbar: 'Taskbar', update: 'Windows Update', about: 'About'
    };
    body.querySelector('#set-title').textContent = titles[view];
    if (view === 'personalization') renderPersonalization(c);
    else if (view === 'account') renderAccount(c);
    else if (view === 'theme') renderTheme(c);
    else if (view === 'wallpaper') renderWallpaper(c);
    else if (view === 'lockscreen') renderLockscreen(c);
    else if (view === 'accent') renderAccent(c);
    else if (view === 'taskbar') renderTaskbar(c);
    else if (view === 'update') renderUpdate(c);
    else if (view === 'about') renderAbout(c);
  }

  function renderAccount(c) {
    const avatar = s.avatar || '';
    const userName = s.userName || 'Lab Administrator';
    c.innerHTML = `
      <div class="report-card" style="max-width:500px">
        <h3>Profile Picture</h3>
        <div style="display:flex;gap:20px;align-items:center;margin-top:12px">
          <div id="acc-avatar-preview" style="width:120px;height:120px;border-radius:50%;background:${avatar ? 'url(' + avatar + ') center/cover' : 'linear-gradient(135deg,#0a84ff,#003a70)'};display:flex;align-items:center;justify-content:center;font-size:48px;color:#fff;border:3px solid #e5e5e5">${avatar ? '' : (userName[0]||'U')}</div>
          <div>
            <input type="file" id="acc-avatar-file" accept="image/*" style="display:none">
            <button class="btn btn-primary btn-sm" id="acc-upload">Upload picture</button>
            <button class="btn btn-sm" id="acc-remove" style="margin-top:6px;display:block">Remove picture</button>
            <div class="muted" style="margin-top:8px;font-size:12px">JPG, PNG, or GIF. Max 2MB. Picture is stored locally in your browser.</div>
          </div>
        </div>
      </div>
      <div class="report-card" style="max-width:500px;margin-top:14px">
        <h3>Account Info</h3>
        <div class="form-row" style="margin-top:10px"><label>Display name</label><input class="field" id="acc-name" value="${esc(userName)}"></div>
        <button class="btn btn-primary btn-sm" id="acc-save-name" style="margin-top:8px">Save name</button>
      </div>
      <div class="report-card" style="max-width:500px;margin-top:14px">
        <h3>Sign-in</h3>
        <div style="margin-top:10px;font-size:13px;line-height:1.8">
          <div><b>Account type:</b> <span id="acc-type">Loading...</span></div>
          <div><b>Email:</b> <span id="acc-email">Loading...</span></div>
        </div>
        <button class="btn btn-sm" id="acc-signout" style="margin-top:10px">Sign out</button>
      </div>
      <div class="report-card" style="max-width:500px;margin-top:14px">
        <h3>Change Password</h3>
        <div class="form-row" style="margin-top:10px"><label>Current password</label><input class="field" id="acc-old-pwd" type="password" placeholder="Enter current password"></div>
        <div class="form-row" style="margin-top:8px"><label>New password</label><input class="field" id="acc-new-pwd" type="password" placeholder="Enter new password (min 6 chars)"></div>
        <div class="form-row" style="margin-top:8px"><label>Confirm password</label><input class="field" id="acc-confirm-pwd" type="password" placeholder="Re-enter new password"></div>
        <button class="btn btn-primary btn-sm" id="acc-change-pwd" style="margin-top:10px">Change password</button>
        <div id="acc-pwd-msg" style="margin-top:8px;font-size:13px"></div>
      </div>`;

    const fileInput = c.querySelector('#acc-avatar-file');
    c.querySelector('#acc-upload').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('File too large (max 2MB)'); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        s.avatar = ev.target.result; saveSettings(s); applySettings();
        c.querySelector('#acc-avatar-preview').style.background = 'url(' + ev.target.result + ') center/cover';
        c.querySelector('#acc-avatar-preview').textContent = '';
        // apply to all avatar locations
        document.querySelectorAll('#lock-avatar, #start-user-avatar').forEach(el => {
          el.style.background = 'url(' + ev.target.result + ') center/cover';
          el.textContent = '';
        });
        // persist to the backend so it survives app restarts
        try { await API.put('/api/me/profile', { avatar: ev.target.result }); } catch (err) { toast('Picture saved locally only (server error)'); }
        toast('Profile picture updated');
      };
      reader.readAsDataURL(file);
    };
    c.querySelector('#acc-remove').onclick = async () => {
      s.avatar = ''; saveSettings(s); applySettings();
      c.querySelector('#acc-avatar-preview').style.background = 'linear-gradient(135deg,#0a84ff,#003a70)';
      c.querySelector('#acc-avatar-preview').textContent = (userName[0]||'U');
      document.querySelectorAll('#lock-avatar, #start-user-avatar').forEach(el => {
        el.style.background = '';
        el.textContent = (userName[0]||'U');
      });
      try { await API.put('/api/me/profile', { avatar: '' }); } catch (err) {}
      toast('Profile picture removed');
    };
    c.querySelector('#acc-save-name').onclick = async () => {
      const newName = c.querySelector('#acc-name').value.trim();
      if (!newName) { toast('Display name cannot be empty'); return; }
      s.userName = newName; saveSettings(s);
      document.querySelectorAll('#lock-name, #start-user-name').forEach(el => el.textContent = s.userName);
      if (!s.avatar) document.querySelectorAll('#lock-avatar, #start-user-avatar').forEach(el => el.textContent = (s.userName[0]||'U'));
      try { await API.put('/api/me/profile', { full_name: newName }); } catch (err) { toast('Name saved locally only (server error)'); }
      toast('Display name saved');
    };
    c.querySelector('#acc-signout').onclick = async () => {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
      location.reload();
    };
    c.querySelector('#acc-change-pwd').onclick = async () => {
      const oldP = c.querySelector('#acc-old-pwd').value;
      const newP = c.querySelector('#acc-new-pwd').value;
      const conP = c.querySelector('#acc-confirm-pwd').value;
      const msg = c.querySelector('#acc-pwd-msg');
      if (!oldP || !newP) { msg.style.color = '#e74c3c'; msg.textContent = 'Please fill in all fields.'; return; }
      if (newP.length < 6) { msg.style.color = '#e74c3c'; msg.textContent = 'New password must be at least 6 characters.'; return; }
      if (newP !== conP) { msg.style.color = '#e74c3c'; msg.textContent = 'Passwords do not match.'; return; }
      msg.style.color = '#666'; msg.textContent = 'Changing password...';
      try {
        const r = await fetch('/api/change-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_password: oldP, new_password: newP }),
          credentials: 'same-origin'
        });
        const res = await r.json();
        if (r.ok) {
          msg.style.color = '#2ecc71'; msg.textContent = 'Password changed successfully!';
          c.querySelector('#acc-old-pwd').value = ''; c.querySelector('#acc-new-pwd').value = ''; c.querySelector('#acc-confirm-pwd').value = '';
          toast('Password changed');
        } else {
          msg.style.color = '#e74c3c'; msg.textContent = res.detail || 'Failed to change password.';
        }
      } catch (e) {
        msg.style.color = '#e74c3c'; msg.textContent = 'Error: ' + e.message;
      }
    };
    // load account info from the backend (source of truth for name + avatar)
    fetch('/api/me', { credentials: 'same-origin' }).then(r => r.json()).then(u => {
      c.querySelector('#acc-type').textContent = u.role;
      c.querySelector('#acc-email').textContent = u.username + '@lab.local';
      // sync display name + avatar from the backend into local settings cache
      let changed = false;
      if (u.full_name && u.full_name !== s.userName) { s.userName = u.full_name; changed = true; }
      const beAvatar = isImageAvatar(u.avatar) ? u.avatar : '';
      if (beAvatar !== s.avatar) { s.avatar = beAvatar; changed = true; }
      if (changed) { saveSettings(s); }
      // reflect backend name in the input field
      const nameInput = c.querySelector('#acc-name');
      if (nameInput && u.full_name) nameInput.value = u.full_name;
      // reflect backend avatar in the preview
      const prev = c.querySelector('#acc-avatar-preview');
      if (prev) {
        if (s.avatar) {
          prev.style.background = 'url(' + s.avatar + ') center/cover';
          prev.textContent = '';
        } else {
          prev.style.background = 'linear-gradient(135deg,#0a84ff,#003a70)';
          prev.textContent = (s.userName[0] || 'U');
        }
      }
    }).catch(() => {});
  }

  function renderPersonalization(c) {
    const currentWp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
    const currentTheme = THEMES.find(t => t.id === s.theme) || THEMES[0];
    const currentAccent = ACCENT_COLORS.find(a => a.value === s.accent) || ACCENT_COLORS[0];
    c.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="report-card">
          <h3>Current Wallpaper</h3>
          <div style="height:100px;border-radius:8px;background:${currentWp.css};margin-top:8px"></div>
          <div class="muted" style="margin-top:6px">${esc(currentWp.name)}</div>
          <button class="btn btn-sm btn-primary" id="p-go-wp" style="margin-top:8px">Change wallpaper</button>
        </div>
        <div class="report-card">
          <h3>Current Theme</h3>
          <div style="height:100px;border-radius:8px;background:${currentTheme.id==='dark'?'#2b2b2b':'#f3f3f3'};margin-top:8px;display:flex;align-items:center;justify-content:center;font-size:28px;color:${currentTheme.id==='dark'?'#fff':'#333'}">${currentTheme.id==='dark'?'🌙':'☀️'}</div>
          <div class="muted" style="margin-top:6px">${esc(currentTheme.name)}</div>
          <button class="btn btn-sm btn-primary" id="p-go-theme" style="margin-top:8px">Change theme</button>
        </div>
        <div class="report-card">
          <h3>Accent Color</h3>
          <div style="height:100px;border-radius:8px;background:${currentAccent.value};margin-top:8px"></div>
          <div class="muted" style="margin-top:6px">${esc(currentAccent.name)}</div>
          <button class="btn btn-sm btn-primary" id="p-go-accent" style="margin-top:8px">Change accent</button>
        </div>
        <div class="report-card">
          <h3>Lock Screen</h3>
          <div style="height:100px;border-radius:8px;background:${(LOCKSCREEN_WALLPAPERS.find(w=>w.id===s.lockwallpaper)||LOCKSCREEN_WALLPAPERS[0]).css};margin-top:8px"></div>
          <div class="muted" style="margin-top:6px">${esc((LOCKSCREEN_WALLPAPERS.find(w=>w.id===s.lockwallpaper)||LOCKSCREEN_WALLPAPERS[0]).name)}</div>
          <button class="btn btn-sm btn-primary" id="p-go-lock" style="margin-top:8px">Change lock screen</button>
        </div>
      </div>`;
    c.querySelector('#p-go-wp').onclick = () => { view='wallpaper'; nav.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.v==='wallpaper')); render(); };
    c.querySelector('#p-go-theme').onclick = () => { view='theme'; nav.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.v==='theme')); render(); };
    c.querySelector('#p-go-accent').onclick = () => { view='accent'; nav.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.v==='accent')); render(); };
    c.querySelector('#p-go-lock').onclick = () => { view='lockscreen'; nav.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.v==='lockscreen')); render(); };
  }

  function renderTheme(c) {
    const genThemeIds = JSON.parse(localStorage.getItem('labvm-gen-themes') || '[]');
    const genThemes = genThemeIds.map(id => {
      const m = /^gen-theme-([0-9a-z]+)$/.exec(id);
      if (!m) return null;
      return generateTheme(parseInt(m[1], 36));
    }).filter(Boolean);

    c.innerHTML = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <button class="btn btn-primary" id="th-generate">🎨 Generate Themes</button>
        <span class="muted" style="font-size:12px">Creates 4 unique color schemes instantly</span>
        ${genThemeIds.length > 0 ? '<button class="btn btn-sm" id="th-clear-gen" style="margin-left:auto">Clear generated</button>' : ''}
      </div>
      ${genThemes.length > 0 ? `
        <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Generated</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          ${genThemes.map(t => `
            <div class="report-card" style="cursor:pointer;border:${(s.genTheme||'')===t.id?'2px solid var(--accent)':'1px solid #e5e5e5'}" data-gentheme="${t.id}">
              <h3>${t.mode==='dark'?'🌙':'☀️'} ${esc(t.label)}</h3>
              <div style="height:120px;border-radius:8px;background:${t.winBg};margin-top:8px;display:flex;flex-direction:column;justify-content:flex-end;padding:10px">
                <div style="background:${t.accent};height:30px;border-radius:4px;margin-bottom:6px"></div>
                <div style="background:${t.winBorder};height:20px;border-radius:4px"></div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Preset</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${THEMES.map(t => `
          <div class="report-card" style="cursor:pointer;border:${(s.theme||'light')===t.id && !s.genTheme?'2px solid var(--accent)':'1px solid #e5e5e5'}" data-theme="${t.id}">
            <h3>${t.id==='dark'?'🌙':'☀️'} ${esc(t.name)}</h3>
            <div style="height:120px;border-radius:8px;background:${t.id==='dark'?'#2b2b2b':'#f3f3f3'};margin-top:8px;display:flex;flex-direction:column;justify-content:flex-end;padding:10px">
              <div style="background:${t.id==='dark'?'#3a3a3a':'#e5e5e5'};height:30px;border-radius:4px;margin-bottom:6px"></div>
              <div style="background:${t.id==='dark'?'#1a1a1a':'#d0d0d0'};height:20px;border-radius:4px"></div>
            </div>
          </div>`).join('')}
      </div>`;
    c.querySelectorAll('[data-theme]').forEach(el => el.onclick = () => {
      s.theme = el.dataset.theme; s.genTheme = ''; saveSettings(s); applySettings(); toast('Theme changed to ' + el.dataset.theme); render();
    });
    c.querySelectorAll('[data-gentheme]').forEach(el => el.onclick = () => {
      const id = el.dataset.gentheme;
      const m = /^gen-theme-([0-9a-z]+)$/.exec(id);
      if (!m) return;
      const t = generateTheme(parseInt(m[1], 36));
      s.genTheme = id; s.theme = t.mode === 'dark' ? 'dark' : 'light';
      saveSettings(s);
      // Apply generated theme colors
      document.documentElement.style.setProperty('--accent', t.accent);
      document.documentElement.style.setProperty('--accent-2', t.accent);
      document.documentElement.style.setProperty('--win-bg', t.winBg);
      document.documentElement.style.setProperty('--win-border', t.winBorder);
      document.documentElement.style.setProperty('--text', t.text);
      const taskbar = document.getElementById('taskbar');
      if (taskbar) taskbar.style.background = t.taskbarBg;
      toast('Generated theme applied: ' + t.label);
      render();
    });
    const genBtn = c.querySelector('#th-generate');
    if (genBtn) genBtn.onclick = () => {
      const existing = JSON.parse(localStorage.getItem('labvm-gen-themes') || '[]');
      const fresh = generateThemeBatch(4, existing);
      const allIds = [...existing, ...fresh.map(t => t.id)];
      localStorage.setItem('labvm-gen-themes', JSON.stringify(allIds));
      toast(`Generated ${fresh.length} new themes!`);
      render();
    };
    const clearGen = c.querySelector('#th-clear-gen');
    if (clearGen) clearGen.onclick = () => {
      localStorage.removeItem('labvm-gen-themes');
      if (s.genTheme) { s.genTheme = ''; saveSettings(s); applySettings(); }
      toast('Generated themes cleared');
      render();
    };
  }

  function renderWallpaper(c) {
    const genIds = JSON.parse(localStorage.getItem('labvm-gen-wallpapers') || '[]');
    const genWalls = genIds.map(id => {
      const info = idToSeed(id);
      return info ? generateWallpaper(info.seed, 'wall') : null;
    }).filter(Boolean);

    c.innerHTML = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <button class="btn btn-primary" id="wp-generate">🎨 Generate Wallpapers</button>
        <span class="muted" style="font-size:12px">Creates 6 unique AI-style wallpapers instantly</span>
        ${genIds.length > 0 ? '<button class="btn btn-sm" id="wp-clear-gen" style="margin-left:auto">Clear generated</button>' : ''}
      </div>
      ${genWalls.length > 0 ? `
        <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Generated</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
          ${genWalls.map(w => `
            <div style="cursor:pointer;border:${(s.wallpaper||'default')===w.id?'3px solid var(--accent)':'1px solid #e5e5e5'};border-radius:8px;overflow:hidden" data-wp="${w.id}">
              <div style="height:100px;background:${w.css}"></div>
              <div style="padding:8px;font-size:12px;text-align:center">${esc(w.label)}</div>
            </div>`).join('')}
        </div>` : ''}
      <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Preset</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${WALLPAPERS.map(w => `
          <div style="cursor:pointer;border:${(s.wallpaper||'default')===w.id?'3px solid var(--accent)':'1px solid #e5e5e5'};border-radius:8px;overflow:hidden" data-wp="${w.id}">
            <div style="height:100px;background:${w.css}"></div>
            <div style="padding:8px;font-size:12px;text-align:center">${esc(w.name)}</div>
          </div>`).join('')}
      </div>`;
    c.querySelectorAll('[data-wp]').forEach(el => el.onclick = () => {
      s.wallpaper = el.dataset.wp; saveSettings(s); applySettings(); toast('Wallpaper changed'); render();
    });
    const genBtn = c.querySelector('#wp-generate');
    if (genBtn) genBtn.onclick = () => {
      const existing = JSON.parse(localStorage.getItem('labvm-gen-wallpapers') || '[]');
      const fresh = generateBatch(6, 'wall', existing);
      const allIds = [...existing, ...fresh.map(w => w.id)];
      localStorage.setItem('labvm-gen-wallpapers', JSON.stringify(allIds));
      toast(`Generated ${fresh.length} new wallpapers!`);
      render();
    };
    const clearGen = c.querySelector('#wp-clear-gen');
    if (clearGen) clearGen.onclick = () => {
      localStorage.removeItem('labvm-gen-wallpapers');
      toast('Generated wallpapers cleared');
      render();
    };
  }

  function renderLockscreen(c) {
    const genIds = JSON.parse(localStorage.getItem('labvm-gen-lockscreens') || '[]');
    const genLocks = genIds.map(id => {
      const info = idToSeed(id);
      return info ? generateWallpaper(info.seed, 'lock') : null;
    }).filter(Boolean);

    c.innerHTML = `
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <button class="btn btn-primary" id="lk-generate">🎨 Generate Lock Screens</button>
        <span class="muted" style="font-size:12px">Creates 6 unique lock screen backgrounds</span>
        ${genIds.length > 0 ? '<button class="btn btn-sm" id="lk-clear-gen" style="margin-left:auto">Clear generated</button>' : ''}
      </div>
      ${genLocks.length > 0 ? `
        <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Generated</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
          ${genLocks.map(w => `
            <div style="cursor:pointer;border:${(s.lockwallpaper||'lock-default')===w.id?'3px solid var(--accent)':'1px solid #e5e5e5'};border-radius:8px;overflow:hidden" data-lwp="${w.id}">
              <div style="height:100px;background:${w.css}"></div>
              <div style="padding:8px;font-size:12px;text-align:center">${esc(w.label)}</div>
            </div>`).join('')}
        </div>` : ''}
      <div style="margin-bottom:8px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em">Preset</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${LOCKSCREEN_WALLPAPERS.map(w => `
          <div style="cursor:pointer;border:${(s.lockwallpaper||'lock-default')===w.id?'3px solid var(--accent)':'1px solid #e5e5e5'};border-radius:8px;overflow:hidden" data-lwp="${w.id}">
            <div style="height:100px;background:${w.css}"></div>
            <div style="padding:8px;font-size:12px;text-align:center">${esc(w.name)}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e5e5">
        <h3 style="font-size:14px;margin-bottom:8px">Lock Screen Preview</h3>
        <div id="lock-preview" style="height:200px;border-radius:8px;background:${(LOCKSCREEN_WALLPAPERS.find(w=>w.id===s.lockwallpaper)||LOCKSCREEN_WALLPAPERS[0]).css};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">
          <div style="font-size:48px;font-weight:300">12:00</div>
          <div style="font-size:18px">Wednesday, September 9</div>
          <div style="margin-top:20px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:28px">A</div>
          <div style="margin-top:8px">Lab Administrator</div>
        </div>
      </div>`;
    c.querySelectorAll('[data-lwp]').forEach(el => el.onclick = () => {
      s.lockwallpaper = el.dataset.lwp; saveSettings(s); applySettings(); toast('Lock screen wallpaper changed'); render();
    });
    const genBtn = c.querySelector('#lk-generate');
    if (genBtn) genBtn.onclick = () => {
      const existing = JSON.parse(localStorage.getItem('labvm-gen-lockscreens') || '[]');
      const fresh = generateBatch(6, 'lock', existing);
      const allIds = [...existing, ...fresh.map(w => w.id)];
      localStorage.setItem('labvm-gen-lockscreens', JSON.stringify(allIds));
      toast(`Generated ${fresh.length} new lock screens!`);
      render();
    };
    const clearGen = c.querySelector('#lk-clear-gen');
    if (clearGen) clearGen.onclick = () => {
      localStorage.removeItem('labvm-gen-lockscreens');
      toast('Generated lock screens cleared');
      render();
    };
  }

  function renderAccent(c) {
    c.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
      ${ACCENT_COLORS.map(a => `
        <div style="cursor:pointer;text-align:center" data-accent="${a.value}">
          <div style="height:80px;border-radius:8px;background:${a.value};border:${(s.accent||'#0a84ff')===a.value?'3px solid #333':'1px solid #e5e5e5'}"></div>
          <div style="padding:8px;font-size:12px">${esc(a.name)}</div>
        </div>`).join('')}
    </div>`;
    c.querySelectorAll('[data-accent]').forEach(el => el.onclick = () => {
      s.accent = el.dataset.accent; saveSettings(s); applySettings(); toast('Accent color changed'); render();
    });
  }

  function renderTaskbar(c) {
    c.innerHTML = `
      <div class="report-card">
        <h3>Taskbar Position</h3>
        <div style="margin-top:10px;display:flex;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:1px solid #e5e5e5;border-radius:8px">
            <input type="radio" name="tbpos" value="bottom" ${s.taskbarPos!=='left'?'checked':''}> Bottom
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:1px solid #e5e5e5;border-radius:8px">
            <input type="radio" name="tbpos" value="left" ${s.taskbarPos==='left'?'checked':''}> Left
          </label>
        </div>
      </div>
      <div class="report-card" style="margin-top:14px">
        <h3>Taskbar Behavior</h3>
        <div style="margin-top:10px">
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0">
            <input type="checkbox" id="tb-autohide" ${s.autohide?'checked':''}> Auto-hide taskbar
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0">
            <input type="checkbox" id="tb-showclock" ${s.showClock!==false?'checked':''}> Show clock
          </label>
        </div>
      </div>`;
    c.querySelectorAll('input[name="tbpos"]').forEach(r => r.onchange = () => {
      s.taskbarPos = r.value; saveSettings(s); applySettings(); toast('Taskbar position changed');
    });
    c.querySelector('#tb-autohide').onchange = (e) => {
      s.autohide = e.target.checked; saveSettings(s);
      const tb = document.getElementById('taskbar');
      if (s.autohide) { tb.style.transform = 'translateY(100%)'; tb.style.transition = 'transform .2s'; tb.onmouseenter = () => tb.style.transform = 'translateY(0)'; tb.onmouseleave = () => tb.style.transform = 'translateY(100%)'; }
      else { tb.style.transform = ''; tb.onmouseenter = null; tb.onmouseleave = null; }
      toast('Auto-hide ' + (e.target.checked ? 'enabled' : 'disabled'));
    };
    c.querySelector('#tb-showclock').onchange = (e) => {
      s.showClock = e.target.checked; saveSettings(s);
      document.getElementById('tray-clock').style.display = e.target.checked ? '' : 'none';
      toast('Clock ' + (e.target.checked ? 'shown' : 'hidden'));
    };
  }

  function renderUpdate(c) {
    c.innerHTML = `
      <div class="report-card" style="max-width:600px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <div style="font-size:40px">🔄</div>
          <div>
            <h3 style="margin:0">Windows Update</h3>
            <div class="muted" style="margin-top:4px" id="upd-status">Checking for updates...</div>
          </div>
        </div>
        <div id="upd-body" style="min-height:120px">
          <div style="display:flex;align-items:center;gap:12px;padding:20px;color:#666">
            <div style="font-size:24px;animation:ch-spin 1s linear infinite">🔄</div>
            <div>Checking for updates...</div>
          </div>
        </div>
      </div>`;
    const statusEl = c.querySelector('#upd-status');
    const bodyEl = c.querySelector('#upd-body');
    let checking = false, updateData = null;

    async function doCheck() {
      if (checking) return;
      checking = true;
      statusEl.textContent = 'Checking for updates...';
      bodyEl.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:20px;color:#666">
        <div style="font-size:24px;animation:ch-spin 1s linear infinite">🔄</div>
        <div>Checking for updates...</div>
      </div>`;
      try {
        const res = await API.checkUpdate();
        updateData = res;
        checking = false;
        if (res.error) {
          statusEl.textContent = 'Could not check for updates';
          bodyEl.innerHTML = `<div style="padding:20px;color:#e74c3c">
            <div style="font-size:28px;margin-bottom:8px">⚠️</div>
            <div>${esc(res.error)}</div>
            <div style="margin-top:8px;font-size:12px;color:#999">Make sure you have an internet connection.</div>
          </div>`;
        } else if (res.available) {
          statusEl.textContent = `Update available: ${res.latest_version}`;
          bodyEl.innerHTML = `<div style="padding:16px;border:1px solid #f39c12;border-radius:8px;background:#fef9e7">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="font-size:32px">⬆️</div>
              <div>
                <div style="font-size:16px;font-weight:600;color:#e67e22">A new version is available!</div>
                <div style="font-size:13px;color:#999;margin-top:4px">Current: v${res.current_version} → Latest: ${res.latest_version}</div>
              </div>
            </div>
            <div style="font-size:13px;color:#666;margin-bottom:14px">${res.frozen ? 'Click "Install update" to download and install. The app will restart automatically.' : 'You are running in development mode. Download the installer to update.'}</div>
            <div style="display:flex;gap:8px">
              ${res.frozen
                ? '<button class="btn btn-primary" id="upd-install">⬇️ Install update</button>'
                : '<a href="' + esc(res.installer_url || '#') + '" target="_blank" class="btn btn-primary">⬇️ Download installer</a>'}
              <button class="btn" id="upd-recheck">🔄 Check again</button>
            </div>
            <div id="upd-install-status" style="margin-top:12px;font-size:13px"></div>
          </div>`;
          const installBtn = c.querySelector('#upd-install');
          if (installBtn) installBtn.onclick = async () => {
            installBtn.disabled = true;
            installBtn.textContent = '⬇️ Downloading...';
            const st = c.querySelector('#upd-install-status');
            st.style.color = '#0a84ff';
            st.textContent = 'Downloading and installing the update. The app will restart automatically...';
            try {
              const r = await API.applyUpdate();
              if (r.ok) {
                st.style.color = '#2ecc71';
                st.textContent = r.message || 'Update is being installed. The app will restart shortly.';
                installBtn.textContent = '✓ Installing...';
              } else {
                st.style.color = '#e74c3c';
                st.textContent = r.error || 'Failed to start update.';
                installBtn.disabled = false;
                installBtn.textContent = '⬇️ Install update';
              }
            } catch (e) {
              st.style.color = '#e74c3c';
              st.textContent = 'Error: ' + e.message;
              installBtn.disabled = false;
              installBtn.textContent = '⬇️ Install update';
            }
          };
          const recheck = c.querySelector('#upd-recheck');
          if (recheck) recheck.onclick = doCheck;
        } else {
          statusEl.textContent = `You're up to date — v${res.current_version}`;
          bodyEl.innerHTML = `<div style="padding:24px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">✅</div>
            <div style="font-size:16px;font-weight:600;color:#2ecc71;margin-bottom:6px">You're up to date!</div>
            <div style="font-size:13px;color:#999">Current version: v${res.current_version}</div>
            <div style="font-size:13px;color:#999">Latest version: ${res.latest_version}</div>
            <button class="btn" id="upd-recheck" style="margin-top:16px">🔄 Check for updates</button>
          </div>`;
          const recheck = c.querySelector('#upd-recheck');
          if (recheck) recheck.onclick = doCheck;
        }
      } catch (e) {
        checking = false;
        statusEl.textContent = 'Error checking for updates';
        bodyEl.innerHTML = `<div style="padding:20px;color:#e74c3c">
          <div style="font-size:28px;margin-bottom:8px">⚠️</div>
          <div>${esc(e.message)}</div>
          <button class="btn" id="upd-recheck" style="margin-top:12px">🔄 Try again</button>
        </div>`;
        const recheck = c.querySelector('#upd-recheck');
        if (recheck) recheck.onclick = doCheck;
      }
    }
    doCheck();
  }

  function renderAbout(c) {
    c.innerHTML = `
      <div class="report-card">
        <h3>Lab VM — IT/IAM Help Desk Desktop</h3>
        <div style="margin-top:10px;font-size:13px;line-height:1.8">
          <div><b>Version:</b> <span id="about-version">Loading...</span></div>
          <div><b>Edition:</b> Lab VM Professional</div>
          <div><b>OS:</b> Web-based Windows 11 Simulation</div>
          <div><b>Processor:</b> Virtual (Browser Engine)</div>
          <div><b>Memory:</b> Browser Allocated</div>
          <div><b>Storage:</b> SQLite (labvm.db)</div>
        </div>
      </div>
      <div class="report-card" style="margin-top:14px">
        <h3>Included Labs</h3>
        <div style="margin-top:8px;font-size:13px;line-height:1.8">
          <div>📋 <b>Lab 1:</b> Windows Local Users, Groups & NTFS Permissions</div>
          <div>🔐 <b>Lab 2:</b> Microsoft Entra ID, MFA & Conditional Access</div>
          <div>🎫 <b>Lab 3:</b> Help Desk Ticketing, Knowledge Base & Reports</div>
        </div>
      </div>
      <div class="report-card" style="margin-top:14px">
        <h3>Technologies</h3>
        <div style="margin-top:8px;font-size:13px">FastAPI · SQLite · Vanilla JS · CSS3</div>
      </div>`;
    // Fetch real version from the backend
    fetch('/api/version', { credentials: 'same-origin' }).then(r => r.json()).then(d => {
      const el = c.querySelector('#about-version');
      if (el) el.textContent = 'v' + d.version;
    }).catch(() => {});
  }

  render();
}
