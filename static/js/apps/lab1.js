import { API } from '../api.js';
import { toast } from '../wm.js';

// ============ Local Users and Groups (lusrmgr.msc replica) ============
export function openLocalUsers(body) {
  body.innerHTML = `
    <div class="app">
      <div class="mmc-header"><h2 style="font-size:15px;margin:0">Local Users and Groups (lusrmgr.msc)</h2>
        <div class="muted">Lab 1 — Windows local account lifecycle & group-based access</div></div>
      <div class="mmc-tabs"><div class="mmc-tab active" data-tab="users">Users</div><div class="mmc-tab" data-tab="groups">Groups</div></div>
      <div class="app-toolbar">
        <button class="btn btn-sm" id="lu-refresh">↻ Refresh</button>
        <button class="btn btn-primary btn-sm" id="lu-new">+ New user</button>
        <div class="spacer"></div>
        <input class="field" id="lu-search" placeholder="Search users..." style="width:200px">
      </div>
      <div class="app-body" id="lu-body"></div>
    </div>`;
  let tab = 'users';
  let users = [], groups = [];

  async function load() {
    const [u, g] = await Promise.all([API.lab1Users(), API.lab1Groups()]);
    users = u.users; groups = g.groups;
    render();
  }
  function render() {
    const q = (body.querySelector('#lu-search').value || '').toLowerCase();
    const cont = body.querySelector('#lu-body');
    if (tab === 'users') {
      const rows = users.filter(u => u.username.toLowerCase().includes(q)).map(u => `
        <tr class="row-link" data-uid="${u.id}">
          <td><b>${esc(u.username)}</b></td><td>${esc(u.full_name||'')}</td>
          <td>${u.enabled ? '<span class="badge badge-green">Enabled</span>' : '<span class="badge badge-red">Disabled</span>'}</td>
          <td>${u.locked ? '<span class="badge badge-amber">Locked</span>' : '<span class="badge badge-gray">OK</span>'}</td>
          <td>${u.password_expired ? '<span class="badge badge-red">Expired</span>' : '<span class="badge badge-gray">OK</span>'}</td>
          <td>${(u.groups||[]).map(g=>`<span class="tag">${esc(g)}</span>`).join(' ')}</td>
        </tr>`).join('');
      cont.innerHTML = `<table class="data"><thead><tr><th>Name</th><th>Full Name</th><th>Status</th><th>Lockout</th><th>Password</th><th>Groups</th></tr></thead><tbody>${rows}</tbody></table>`;
      cont.querySelectorAll('tr.row-link').forEach(tr => tr.onclick = () => userModal(users.find(u => u.id == tr.dataset.uid)));
    } else {
      const rows = groups.map(g => `
        <tr class="row-link" data-gid="${g.id}">
          <td><b>${esc(g.name)}</b> ${g.built_in ? '<span class="badge badge-gray">Built-in</span>' : ''}</td>
          <td>${esc(g.description||'')}</td>
          <td>${(g.members||[]).map(m=>`<span class="tag">${esc(m)}</span>`).join(' ') || '<span class="muted">no members</span>'}</td>
        </tr>`).join('');
      cont.innerHTML = `<table class="data"><thead><tr><th>Group</th><th>Description</th><th>Members</th></tr></thead><tbody>${rows}</tbody></table>`;
      cont.querySelectorAll('tr.row-link').forEach(tr => tr.onclick = () => groupModal(groups.find(g => g.id == tr.dataset.gid)));
    }
  }

  body.querySelector('.mmc-tabs').addEventListener('click', e => {
    const t = e.target.closest('.mmc-tab'); if (!t) return;
    tab = t.dataset.tab;
    body.querySelectorAll('.mmc-tab').forEach(x => x.classList.toggle('active', x === t));
    render();
  });
  body.querySelector('#lu-refresh').onclick = load;
  body.querySelector('#lu-search').oninput = render;
  body.querySelector('#lu-new').onclick = () => newUserModal();

  async function newUserModal() {
    const m = modal(body, 'Create Local User', `
      <div class="form-row"><label>Username</label><input class="field" id="nu-user"></div>
      <div class="form-row"><label>Full name</label><input class="field" id="nu-full"></div>
      <div class="form-row"><label>Description</label><input class="field" id="nu-desc"></div>
      <div class="form-row"><label>Temporary password</label><input class="field" id="nu-pass" value="TempPass#2026"></div>`);
    m.save.onclick = async () => {
      try {
        await API.lab1CreateUser({ username: m.q('#nu-user').value, full_name: m.q('#nu-full').value, description: m.q('#nu-desc').value, password: m.q('#nu-pass').value });
        m.close(); toast('User created'); load();
      } catch (e) { m.err(e.message); }
    };
  }

  async function userModal(u) {
    const m = modal(body, `User: ${u.username}`, `
      <div class="form-row"><label>Full name</label><input class="field" id="u-full" value="${esc(u.full_name||'')}"></div>
      <div class="form-row"><label>Description</label><input class="field" id="u-desc" value="${esc(u.description||'')}"></div>
      <div style="display:flex;gap:18px;margin:10px 0">
        <label><input type="checkbox" id="u-enabled" ${u.enabled?'checked':''}> Enabled</label>
        <label><input type="checkbox" id="u-locked" ${u.locked?'checked':''}> Account locked</label>
        <label><input type="checkbox" id="u-expired" ${u.password_expired?'checked':''}> Password expired</label>
      </div>
      <div class="form-row"><label>Reset password to</label><input class="field" id="u-pass" placeholder="New password"></div>
      <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
      <div style="font-weight:600;margin-bottom:6px">Group membership</div>
      <div id="u-groups"></div>
      <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
      <div style="font-weight:600;margin-bottom:6px">Troubleshooting actions</div>
      <button class="btn btn-sm" id="u-unlock">Unlock account</button>
      <button class="btn btn-sm" id="u-enable">Enable</button>
      <button class="btn btn-sm btn-danger" id="u-delete">Delete account</button>`);
    renderGroups();
    function renderGroups() {
      const c = m.q('#u-groups');
      c.innerHTML = groups.map(g => {
        const inG = (u.groups||[]).includes(g.name);
        return `<label style="display:block;padding:4px 0"><input type="checkbox" data-gid="${g.id}" ${inG?'checked':''}> ${esc(g.name)}</label>`;
      }).join('');
      c.querySelectorAll('input').forEach(cb => cb.onchange = async () => {
        if (cb.checked) await API.lab1AddMember(cb.dataset.gid, u.id);
        else await API.lab1RemoveMember(cb.dataset.gid, u.id);
        toast('Group membership updated'); load();
      });
    }
    m.save.onclick = async () => {
      try {
        await API.lab1UpdateUser(u.id, {
          full_name: m.q('#u-full').value, description: m.q('#u-desc').value,
          enabled: m.q('#u-enabled').checked ? 1 : 0, locked: m.q('#u-locked').checked ? 1 : 0,
          password_expired: m.q('#u-expired').checked ? 1 : 0,
          ...(m.q('#u-pass').value ? { password: m.q('#u-pass').value } : {}),
        });
        m.close(); toast('User updated'); load();
      } catch (e) { m.err(e.message); }
    };
    m.q('#u-unlock').onclick = async () => { await API.lab1UpdateUser(u.id, { locked: 0 }); m.close(); toast('Account unlocked'); load(); };
    m.q('#u-enable').onclick = async () => { await API.lab1UpdateUser(u.id, { enabled: 1, locked: 0 }); m.close(); toast('Account enabled'); load(); };
    m.q('#u-delete').onclick = async () => { if (confirm(`Delete account ${u.username}?`)) { await API.lab1DeleteUser(u.id); m.close(); toast('Account deleted'); load(); } };
  }

  async function groupModal(g) {
    const m = modal(body, `Group: ${g.name}`, `
      <div class="muted">${esc(g.description||'')}</div>
      <div style="font-weight:600;margin:12px 0 6px">Members</div>
      <div id="g-members"></div>
      <div style="font-weight:600;margin:12px 0 6px">Add member</div>
      <select class="field" id="g-add" style="width:100%"></select>
      <button class="btn btn-sm btn-primary" id="g-addbtn" style="margin-top:8px">Add</button>`);
    const allUsers = users;
    const c = m.q('#g-members');
    function renderMembers() {
      c.innerHTML = (g.members||[]).map(name => {
        const mu = allUsers.find(x => x.username === name);
        return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0">
          <span>${esc(name)}</span><button class="btn btn-sm btn-danger" data-uid="${mu?mu.id:''}">Remove</button></div>`;
      }).join('') || '<div class="muted">No members</div>';
      c.querySelectorAll('button').forEach(b => b.onclick = async () => { await API.lab1RemoveMember(g.id, b.dataset.uid); toast('Removed'); load(); m.close(); });
    }
    m.q('#g-add').innerHTML = allUsers.filter(u => !(g.members||[]).includes(u.username)).map(u => `<option value="${u.id}">${esc(u.username)}</option>`).join('');
    m.q('#g-addbtn').onclick = async () => { await API.lab1AddMember(g.id, parseInt(m.q('#g-add').value)); toast('Added'); load(); m.close(); };
    renderMembers();
  }
  load();
}

// ============ File Explorer + NTFS ============
export function openFileExplorer(body) {
  body.innerHTML = `
    <div class="app">
      <div class="app-toolbar"><h2>File Explorer</h2><span class="muted">— Lab 1: NTFS permissions & access testing</span>
        <div class="spacer"></div><button class="btn btn-sm" id="fe-refresh">↻ Refresh</button></div>
      <div class="split">
        <div class="split-side" id="fe-tree"></div>
        <div class="split-main" id="fe-main"><div class="empty">Select a folder</div></div>
      </div>
    </div>`;
  let folders = [], selected = null;

  async function load() {
    const d = await API.lab1Folders();
    folders = d.folders;
    renderTree();
    if (selected) renderMain();
  }
  function renderTree() {
    const t = body.querySelector('#fe-tree');
    t.innerHTML = folders.map(f => `<div class="tree-item ${selected&&selected.id===f.id?'active':''}" data-fid="${f.id}"><span class="ic">${f.parent_id?'📄':'📁'}</span>${esc(f.path)}</div>`).join('');
    t.querySelectorAll('.tree-item').forEach(el => el.onclick = () => { selected = folders.find(f => f.id == el.dataset.fid); renderTree(); renderMain(); });
  }
  function renderMain() {
    const f = selected;
    const main = body.querySelector('#fe-main');
    const acls = f.acls || [];
    main.innerHTML = `
      <div style="padding:14px">
        <h3 style="margin-bottom:4px">${esc(f.path)}</h3>
        <div class="muted" style="margin-bottom:12px">Test file present: ${f.has_test_file ? 'Yes (test.txt)' : 'No'}</div>
        <div class="mmc-tabs" style="margin-bottom:10px">
          <div class="mmc-tab active" data-ft="security">Security</div>
          <div class="mmc-tab" data-ft="effective">Effective Access</div>
          <div class="mmc-tab" data-ft="test">Access Test</div>
        </div>
        <div id="fe-tab"></div>
      </div>`;
    renderSecurity();
    main.querySelectorAll('.mmc-tab').forEach(t => t.onclick = () => {
      main.querySelectorAll('.mmc-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      if (t.dataset.ft === 'security') renderSecurity();
      else if (t.dataset.ft === 'effective') renderEffective();
      else renderTest();
    });

    function renderSecurity() {
      const c = main.querySelector('#fe-tab');
      c.innerHTML = `
        <div style="margin-bottom:10px"><button class="btn btn-primary btn-sm" id="acl-add">+ Add permission</button>
        <button class="btn btn-sm" id="fld-add">+ New subfolder</button></div>
        <div class="acl-list">${acls.map(a => `<div class="acl-row">
          <span><b>${esc(a.principal)}</b> <span class="muted">(${a.principal_type})</span> ${a.inherited?'<span class="tag">inherited</span>':''}</span>
          <span><span class="badge ${permColor(a.permission)}">${esc(a.permission)}</span>
          <button class="btn btn-sm btn-danger" data-aid="${a.id}" style="margin-left:8px">Remove</button></span>
        </div>`).join('')}</div>`;
      c.querySelectorAll('button[data-aid]').forEach(b => b.onclick = async () => { await API.lab1RemoveAcl(f.id, b.dataset.aid); toast('ACL removed'); load(); });
      c.querySelector('#acl-add').onclick = () => addAclModal(f);
      c.querySelector('#fld-add').onclick = () => addFolderModal(f);
    }
    async function renderEffective() {
      const c = main.querySelector('#fe-tab');
      const us = await API.lab1Users();
      c.innerHTML = `<div class="form-row" style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <label style="margin:0">User:</label><select class="field" id="ea-user" style="flex:1">${us.users.map(u=>`<option value="${u.id}">${esc(u.username)}</option>`).join('')}</select>
        <button class="btn btn-primary btn-sm" id="ea-go">Check</button></div><div id="ea-result"></div>`;
      c.querySelector('#ea-go').onclick = async () => {
        const uid = c.querySelector('#ea-user').value;
        const r = await API.lab1EffectiveAccess(f.id, uid);
        const box = c.querySelector('#ea-result');
        const ok = r.access === 'Allowed';
        box.innerHTML = `<div style="padding:14px;border-radius:6px;background:${ok?'#e8f8e8':'#fde8e8'};border:1px solid ${ok?'#2ecc71':'#e74c3c'}">
          <div style="font-size:16px;font-weight:600">${ok?'✓ Access Allowed':'✗ Access Denied'}</div>
          <div style="margin-top:6px">${esc(r.reason||'')}</div>
          ${r.permission?`<div class="muted" style="margin-top:4px">Effective permission: <b>${esc(r.permission)}</b></div>`:''}
          <div class="muted" style="margin-top:6px">User groups: ${(r.user_groups||[]).join(', ')||'none'}</div>
          ${r.matched_acls&&r.matched_acls.length?`<div class="muted" style="margin-top:6px">Matched ACEs: ${r.matched_acls.map(a=>a.principal+'='+a.permission).join(', ')}</div>`:''}
        </div>`;
      };
    }
    async function renderTest() {
      const c = main.querySelector('#fe-tab');
      const us = await API.lab1Users();
      c.innerHTML = `<div class="form-row" style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <label style="margin:0">User:</label><select class="field" id="at-user" style="flex:1">${us.users.map(u=>`<option value="${u.id}">${esc(u.username)}</option>`).join('')}</select>
        <button class="btn btn-primary btn-sm" id="at-go">Open folder as user</button></div>
        <div id="at-result" class="psterm" style="background:#0c0c0c;color:#ccc;font-family:Consolas,monospace;padding:12px;border-radius:6px;min-height:120px"></div>`;
      c.querySelector('#at-go').onclick = async () => {
        const uid = parseInt(c.querySelector('#at-user').value);
        const r = await API.lab1TestAccess({ user_id: uid, folder_id: f.id });
        const box = c.querySelector('#at-result');
        box.innerHTML = r.steps.map(s => `<div>${esc(s)}</div>`).join('') +
          `<div style="color:${r.success?'#7ee787':'#ff6b6b'};margin-top:6px">${r.success?'✓ SUCCESS':'✗ '+esc(r.error||'Failed')}</div>`;
      };
    }
  }

  async function addAclModal(f) {
    const us = await API.lab1Users(); const gs = await API.lab1Groups();
    const m = modal(body, 'Add NTFS Permission', `
      <div class="form-row"><label>Principal</label>
        <select class="field" id="acl-prin">${us.users.map(u=>`<option value="${esc(u.username)}|user">${esc(u.username)} (User)</option>`).concat(gs.groups.map(g=>`<option value="${esc(g.name)}|group">${esc(g.name)} (Group)</option>`)).join('')}</select></div>
      <div class="form-row"><label>Permission</label><select class="field" id="acl-perm">
        <option>Full Control</option><option>Modify</option><option>Read & Execute</option><option>Read</option><option>Write</option></select></div>`);
    m.save.onclick = async () => {
      try {
        const [principal, ptype] = m.q('#acl-prin').value.split('|');
        await API.lab1AddAcl(f.id, { principal, principal_type: ptype, permission: m.q('#acl-perm').value });
        m.close(); toast('Permission added');
        try { await load(); } catch (e) { console.error('Reload error:', e); }
      } catch (e) { m.err(e.message); }
    };
  }
  async function addFolderModal(f) {
    const m = modal(body, 'New Subfolder', `
      <div class="form-row"><label>Folder path</label><input class="field" id="nf-path" value="${esc(f.path)}\\NewFolder"></div>`);
    m.save.onclick = async () => {
      try {
        await API.lab1CreateFolder({ path: m.q('#nf-path').value, parent: f.path });
        m.close(); toast('Folder created');
        try { await load(); } catch (e) { console.error('Reload error:', e); }
      }
      catch (e) { m.err(e.message); }
    };
  }
  load();
}

// ============ PowerShell simulation ============
export function openPowerShell(body) {
  openTerminal(body, 'powershell');
}

export function openCMD(body) {
  openTerminal(body, 'cmd');
}

function openTerminal(body, shell) {
  const isPS = shell === 'powershell';
  body.innerHTML = `<div class="app"><div class="psterm" id="term-${shell}"></div></div>`;
  const term = body.querySelector(`#term-${shell}`);
  const hist = [];
  let hi = -1;
  let cwd = 'C:\\LabData';
  const banner = isPS
    ? 'Windows PowerShell\n(c) Lab VM Simulation. All commands operate on the lab database.\nType "help" for available commands.\n'
    : '\nMicrosoft Windows [Version 10.0.22631.3000]\n(c) Lab VM Simulation. All rights reserved.\nType "help" for available commands.\n';
  print(banner);
  prompt();

  function print(html, cls) {
    const d = document.createElement('div');
    d.className = 'ps-out' + (cls ? ' ps-' + cls : '');
    d.innerHTML = html;
    term.appendChild(d);
    term.scrollTop = term.scrollHeight;
  }
  function prompt() {
    const line = document.createElement('div');
    line.className = 'ps-input-line';
    const promptStr = isPS ? `PS ${cwd}>` : `${cwd}>`;
    line.innerHTML = `<span class="ps-prompt">${esc(promptStr)}</span><input autofocus>`;
    term.appendChild(line);
    const inp = line.querySelector('input');
    inp.focus();
    inp.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = inp.value.trim();
        line.remove();
        print(`${esc(promptStr)} ${esc(cmd)}`);
        if (cmd) { hist.push(cmd); hi = hist.length; await run(cmd); }
        prompt();
      } else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; inp.value = hist[hi] || ''; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) { hi++; inp.value = hist[hi] || ''; } else { hi = hist.length; inp.value = ''; } }
    });
  }
  async function run(cmd) {
    try {
      const { executeCommand } = await import('./terminal.js');
      const result = await executeCommand(cmd, cwd, shell);
      if (result.clear) { term.innerHTML = ''; return; }
      if (result.exit) { print('Terminal closed.'); return; }
      if (result.cwd) cwd = result.cwd;
      if (result.out) result.out.forEach(l => print(esc(l)));
      if (result.err) result.err.forEach(l => print(esc(l), 'err'));
    } catch (e) { print(esc(e.message), 'err'); }
  }
}

// ============ helpers ============
export function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c])); }
function permColor(p) { return { 'Full Control': 'badge-red', 'Modify': 'badge-amber', 'Read & Execute': 'badge-blue', 'Read': 'badge-gray', 'Write': 'badge-purple' }[p] || 'badge-gray'; }
function formatUserRow(u) { return u; }

export function modal(body, title, contentHtml) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">
    <div class="modal-head"><span>${title}</span><button class="btn btn-sm" style="border:none;background:none;font-size:18px">×</button></div>
    <div class="modal-body">${contentHtml}</div>
    <div class="modal-foot"><button class="btn btn-sm m-cancel">Cancel</button><button class="btn btn-primary btn-sm m-save">Save</button></div>
    <div class="m-err" style="color:#e74c3c;font-size:12px;padding:0 18px 10px;min-height:18px"></div></div>`;
  body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.modal-head button').onclick = close;
  ov.querySelector('.m-cancel').onclick = close;
  return {
    q: (s) => ov.querySelector(s),
    close,
    err: (m) => ov.querySelector('.m-err').textContent = m,
    save: ov.querySelector('.m-save'),
  };
}
