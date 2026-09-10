import { API } from '../api.js';
import { toast } from '../wm.js';
import { esc } from './lab1.js';

let adState = { ous: [], users: [], groups: [], computers: [], dcs: [], selectedNode: null, selectedType: null };

async function loadAD() {
  const [ous, users, groups, computers, dcs] = await Promise.all([
    API.get('/api/ad/ous'), API.get('/api/ad/users'), API.get('/api/ad/groups'),
    API.get('/api/ad/computers'), API.get('/api/ad/dcs')
  ]);
  adState.ous = ous; adState.users = users; adState.groups = groups;
  adState.computers = computers; adState.dcs = dcs;
}

// ---------------------------------------------------------------------------
// MMC-style menu bar
// ---------------------------------------------------------------------------
function buildMenuBar(body) {
  const bar = document.createElement('div');
  bar.className = 'ad-menubar';
  const menus = {
    File: [
      { label: 'New ▸ User', act: () => showUserForm(body, null) },
      { label: 'New ▸ Group', act: () => showGroupForm(body, null) },
      { label: 'New ▸ Organizational Unit', act: () => showOUForm(body, null) },
      { label: 'New ▸ Computer', act: () => showComputerForm(body, null) },
      { sep: true },
      { label: 'Exit', act: () => {} },
    ],
    Action: [
      { label: 'Refresh', act: () => refreshAD(body) },
      { sep: true },
      { label: 'New ▸ User', act: () => showUserForm(body, null) },
      { label: 'New ▸ Group', act: () => showGroupForm(body, null) },
      { label: 'New ▸ Organizational Unit', act: () => showOUForm(body, null) },
    ],
    View: [
      { label: 'Expand All', act: () => expandAll(body) },
      { label: 'Collapse All', act: () => collapseAll(body) },
      { sep: true },
      { label: 'Refresh', act: () => refreshAD(body) },
    ],
    Help: [
      { label: 'About Active Directory Users and Computers', act: () => showAbout(body) },
    ],
  };
  for (const label of Object.keys(menus)) {
    const m = document.createElement('span');
    m.className = 'ad-menu-label';
    m.textContent = label;
    m.tabIndex = 0;
    m.onclick = (e) => {
      e.stopPropagation();
      closeAllMenus();
      showDropdown(body, m, menus[label]);
    };
    bar.appendChild(m);
  }
  return bar;
}

function closeAllMenus() {
  document.querySelectorAll('.ad-dropdown').forEach(d => d.remove());
  document.querySelectorAll('.ad-menu-label.open').forEach(m => m.classList.remove('open'));
}

function showDropdown(body, parent, items) {
  parent.classList.add('open');
  const dd = document.createElement('div');
  dd.className = 'ad-dropdown';
  for (const item of items) {
    if (item.sep) { dd.appendChild(document.createElement('hr')); continue; }
    const row = document.createElement('div');
    row.className = 'ad-dropdown-item';
    row.textContent = item.label;
    row.onclick = (e) => { e.stopPropagation(); closeAllMenus(); item.act(); };
    dd.appendChild(row);
  }
  const rect = parent.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  document.body.appendChild(dd);
}

document.addEventListener('click', closeAllMenus, { capture: true });

function expandAll(body) {
  body.querySelectorAll('.ad-tree-children').forEach(c => c.style.display = 'block');
  body.querySelectorAll('.ad-toggle').forEach(t => { if (t.dataset.hasChildren === 'yes') t.textContent = '📂'; });
}
function collapseAll(body) {
  body.querySelectorAll('.ad-tree-children').forEach(c => c.style.display = 'none');
  body.querySelectorAll('.ad-toggle').forEach(t => { if (t.dataset.hasChildren === 'yes') t.textContent = '📁'; });
  // Re-expand root
  const root = body.querySelector('.ad-tree-node[data-root="true"] > .ad-tree-children');
  if (root) root.style.display = 'block';
}
async function refreshAD(body) {
  await loadAD();
  renderTree(body);
  toast('AD refreshed');
}
function showAbout(body) {
  const c = body.querySelector('#ad-content');
  c.innerHTML = `<div class="ad-detail"><h3>About</h3><p style="font-size:12px;line-height:1.7;color:#555">Active Directory Users and Computers — lab.local domain. Manage users, groups, OUs, computers, and domain controllers. All actions are also available as PowerShell cmdlets (Get-ADUser, New-ADUser, etc.).</p></div>`;
}

// ---------------------------------------------------------------------------
// Right-click context menu
// ---------------------------------------------------------------------------
function showContextMenu(body, x, y, items) {
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'ad-context-menu';
  for (const item of items) {
    if (item.sep) { menu.appendChild(document.createElement('hr')); continue; }
    if (item.disabled) {
      const row = document.createElement('div');
      row.className = 'ad-context-item disabled';
      row.textContent = item.label;
      menu.appendChild(row);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'ad-context-item';
    row.textContent = item.label;
    row.onclick = (e) => { e.stopPropagation(); closeAllMenus(); item.act(); };
    menu.appendChild(row);
  }
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);
  // Adjust if off-screen
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 4) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 4) + 'px';
}

// ---------------------------------------------------------------------------
// Tabbed Properties dialog (like the real MMC snap-in)
// ---------------------------------------------------------------------------
function propertiesDialog(body, user) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="ad-props-dialog">
      <div class="ad-props-titlebar">${esc(user.display_name)} Properties</div>
      <div class="ad-props-tabs">
        <div class="ad-tab active" data-tab="general">General</div>
        <div class="ad-tab" data-tab="account">Account</div>
        <div class="ad-tab" data-tab="member">Member Of</div>
      </div>
      <div class="ad-props-body" id="props-body"></div>
      <div class="ad-props-footer">
        <button class="btn btn-sm" id="props-cancel">Cancel</button>
        <button class="btn btn-sm btn-primary" id="props-ok">OK</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const pb = overlay.querySelector('#props-body');
  const groups = user.groups || [];

  function renderTab(tab) {
    if (tab === 'general') {
      pb.innerHTML = `
        <div class="ad-form">
          <div class="form-row"><label>First name</label><input class="field" id="p-fname" value="${esc(user.display_name.split(' ')[0] || '')}"></div>
          <div class="form-row"><label>Last name</label><input class="field" id="p-lname" value="${esc(user.display_name.split(' ').slice(1).join(' ') || '')}"></div>
          <div class="form-row"><label>Display name</label><input class="field" id="p-display" value="${esc(user.display_name)}"></div>
          <div class="form-row"><label>Description</label><input class="field" id="p-desc" value="${esc(user.description || '')}"></div>
          <div class="form-row"><label>Office</label><input class="field" id="p-office" value=""></div>
          <div class="form-row"><label>Telephone</label><input class="field" id="p-phone" value="${esc(user.phone || '')}"></div>
          <div class="form-row"><label>Email</label><input class="field" id="p-email" value="${esc(user.email || '')}"></div>
          <div class="form-row"><label>Web page</label><input class="field" id="p-web" value=""></div>
        </div>`;
    } else if (tab === 'account') {
      pb.innerHTML = `
        <div class="ad-form">
          <div class="form-row"><label>User logon name</label><input class="field" id="p-sam" value="${esc(user.sam_account_name)}" readonly></div>
          <div class="form-row"><label>UPN suffix</label><span class="muted">@lab.local</span></div>
          <div class="form-row"><label>Account status</label><span class="${user.enabled ? 'badge-ok' : 'badge-warn'} badge">${user.enabled ? 'Enabled' : 'Disabled'}</span></div>
          <div class="form-row"><label>Locked out</label><span class="${user.locked ? 'badge-warn' : 'badge-ok'} badge">${user.locked ? 'Yes' : 'No'}</span></div>
          <div class="form-row"><label>Password expired</label><span class="${user.password_expired ? 'badge-warn' : 'badge-ok'} badge">${user.password_expired ? 'Yes' : 'No'}</span></div>
          <div class="form-row"><label>Last logon</label><span class="muted">${esc(user.last_logon || 'Never')}</span></div>
          <div class="form-row"><label>Password last set</label><span class="muted">${esc(user.password_last_set || 'N/A')}</span></div>
          <div class="form-row"><label>Account created</label><span class="muted">${esc(user.account_created || '')}</span></div>
          <div class="form-row"><label>Department</label><input class="field" id="p-dept" value="${esc(user.department || '')}"></div>
          <div class="form-row"><label>Title</label><input class="field" id="p-title" value="${esc(user.title || '')}"></div>
          <div class="form-row"><label>Manager</label><input class="field" id="p-manager" value="${esc(user.manager || '')}"></div>
          <div class="form-row"><label><input type="checkbox" id="p-never-expires" ${user.password_never_expires ? 'checked' : ''}> Password never expires</label></div>
          <div class="form-row"><label><input type="checkbox" id="p-enabled" ${user.enabled ? 'checked' : ''}> Account is enabled</label></div>
        </div>`;
    } else if (tab === 'member') {
      pb.innerHTML = `
        <div class="ad-props-member">
          <div class="ad-props-member-list" id="p-groups">
            ${groups.map(g => `<div class="ad-props-group-row"><span>👥</span><span>${esc(g)}</span><button class="btn btn-sm btn-danger ad-props-remove" data-group="${esc(g)}">Remove</button></div>`).join('') || '<div class="muted" style="padding:8px">No group memberships</div>'}
          </div>
          <div style="margin-top:8px"><button class="btn btn-sm btn-primary" id="p-add-group">➕ Add to Group…</button></div>
        </div>`;
      pb.querySelectorAll('.ad-props-remove').forEach(b => b.onclick = () => {
        const gname = b.dataset.group;
        const grp = adState.groups.find(x => x.name === gname);
        if (grp) {
          API.del(`/api/ad/groups/${grp.id}/members/${user.id}?member_type=user`).then(async () => {
            toast(`Removed from ${gname}`);
            await loadAD();
            const u = adState.users.find(x => x.id === user.id);
            if (u) { user = u; renderTab('member'); }
          }).catch(e => toast('Error: ' + e.message));
        }
      });
      pb.querySelector('#p-add-group').onclick = () => {
        const avail = adState.groups.filter(g => !groups.includes(g.name));
        if (!avail.length) { toast('User is already in all groups'); return; }
        const sel = document.createElement('select');
        sel.className = 'field';
        sel.innerHTML = avail.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
        const dlg = document.createElement('div');
        dlg.className = 'modal-overlay';
        dlg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10001;display:flex;align-items:center;justify-content:center';
        dlg.innerHTML = `<div style="background:#fff;border-radius:8px;padding:16px;width:320px"><h3>Add to Group</h3><div class="form-row"><label>Group</label></div><div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end"><button class="btn btn-sm" id="ag-cancel">Cancel</button><button class="btn btn-sm btn-primary" id="ag-ok">Add</button></div></div>`;
        dlg.querySelector('.form-row').appendChild(sel);
        document.body.appendChild(dlg);
        dlg.querySelector('#ag-cancel').onclick = () => dlg.remove();
        dlg.querySelector('#ag-ok').onclick = async () => {
          try {
            await API.post(`/api/ad/groups/${sel.value}/members`, { member_id: user.id, member_type: 'user' });
            toast('Added to group');
            dlg.remove();
            await loadAD();
            const u = adState.users.find(x => x.id === user.id);
            if (u) { user = u; renderTab('member'); }
          } catch (e) { toast('Error: ' + e.message); }
        };
      };
    }
  }
  renderTab('general');
  overlay.querySelectorAll('.ad-tab').forEach(t => t.onclick = () => {
    overlay.querySelectorAll('.ad-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderTab(t.dataset.tab);
  });
  overlay.querySelector('#props-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#props-ok').onclick = async () => {
    const activeTab = overlay.querySelector('.ad-tab.active').dataset.tab;
    const data = {};
    if (activeTab === 'general') {
      const fname = pb.querySelector('#p-fname').value;
      const lname = pb.querySelector('#p-lname').value;
      data.display_name = (fname + ' ' + lname).trim();
      data.description = pb.querySelector('#p-desc').value;
      data.phone = pb.querySelector('#p-phone').value;
      data.email = pb.querySelector('#p-email').value;
    } else if (activeTab === 'account') {
      data.department = pb.querySelector('#p-dept').value;
      data.title = pb.querySelector('#p-title').value;
      data.manager = pb.querySelector('#p-manager').value;
      data.password_never_expires = pb.querySelector('#p-never-expires').checked ? 1 : 0;
      data.enabled = pb.querySelector('#p-enabled').checked ? 1 : 0;
    }
    try {
      await API.put(`/api/ad/users/${user.id}`, data);
      toast('Properties saved');
      overlay.remove();
      await loadAD();
      renderTree(body);
      const u = adState.users.find(x => x.id === user.id);
      if (u) showUserDetails(body, u);
    } catch (e) { toast('Error: ' + e.message); }
  };
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
export function openADUC(body) {
  body.innerHTML = `
    <div class="app" style="height:100%;display:flex;flex-direction:column">
      <div id="ad-menubar-host"></div>
      <div class="ad-toolbar">
        <button class="btn btn-sm btn-primary" id="ad-refresh">🔄 Refresh</button>
        <button class="btn btn-sm" id="ad-new-user">👤 New User</button>
        <button class="btn btn-sm" id="ad-new-group">👥 New Group</button>
        <button class="btn btn-sm" id="ad-new-ou">📁 New OU</button>
        <button class="btn btn-sm" id="ad-new-computer">💻 New Computer</button>
        <span class="spacer"></span>
        <input class="field" id="ad-search" placeholder="Search AD..." style="width:200px">
        <button class="btn btn-sm" id="ad-search-btn">🔍</button>
      </div>
      <div class="ad-main">
        <div class="ad-tree" id="ad-tree"></div>
        <div class="ad-content" id="ad-content"></div>
      </div>
    </div>`;

  // Inject menu bar
  body.querySelector('#ad-menubar-host').appendChild(buildMenuBar(body));

  body.querySelector('#ad-refresh').onclick = () => refreshAD(body);
  body.querySelector('#ad-new-user').onclick = () => showUserForm(body, null);
  body.querySelector('#ad-new-group').onclick = () => showGroupForm(body, null);
  body.querySelector('#ad-new-ou').onclick = () => showOUForm(body, null);
  body.querySelector('#ad-new-computer').onclick = () => showComputerForm(body, null);
  body.querySelector('#ad-search-btn').onclick = () => doSearch(body);
  body.querySelector('#ad-search').onkeydown = (e) => { if (e.key === 'Enter') doSearch(body); };

  loadAD().then(() => renderTree(body)).catch(e => {
    body.querySelector('#ad-tree').innerHTML = `<div style="padding:20px;color:#e74c3c">Error loading AD: ${esc(e.message)}</div>`;
  });
}

function renderTree(body) {
  const tree = body.querySelector('#ad-tree');
  const root = adState.ous.find(o => o.parent_id === null);
  if (!root) { tree.innerHTML = '<div style="padding:20px">No AD data</div>'; return; }
  tree.innerHTML = '';
  tree.appendChild(buildTreeNode(root, body, 0, true));
}

function buildTreeNode(ou, body, level = 0, isRoot = false) {
  const node = document.createElement('div');
  node.className = 'ad-tree-node';
  if (isRoot) node.dataset.root = 'true';
  node.style.paddingLeft = (level * 14 + 4) + 'px';
  const children = adState.ous.filter(o => o.parent_id === ou.id);
  const ouUsers = adState.users.filter(u => u.ou_id === ou.id);
  const ouGroups = adState.groups.filter(g => g.ou_id === ou.id);
  const ouComputers = adState.computers.filter(c => c.ou_id === ou.id);
  const hasChildren = children.length > 0 || ouUsers.length > 0 || ouGroups.length > 0 || ouComputers.length > 0;
  const expanded = isRoot;
  const icon = isRoot ? '🌐' : ou.name === 'Domain Controllers' ? '🖥️' : '📁';
  node.innerHTML = `
    <div class="ad-tree-item ${expanded ? 'expanded' : ''}" data-ou-id="${ou.id}">
      <span class="ad-toggle" data-has-children="${hasChildren ? 'yes' : 'no'}">${hasChildren ? (expanded ? '📂' : '📁') : ''}</span>
      <span class="ad-icon">${icon}</span>
      <span class="ad-label">${esc(ou.name)}</span>
    </div>
    <div class="ad-tree-children" style="display:${expanded ? 'block' : 'none'}"></div>`;

  const item = node.querySelector('.ad-tree-item');
  const toggle = node.querySelector('.ad-toggle');
  const childrenEl = node.querySelector('.ad-tree-children');

  function toggleExpand() {
    const isExpanded = childrenEl.style.display !== 'none';
    childrenEl.style.display = isExpanded ? 'none' : 'block';
    toggle.textContent = isExpanded ? '📁' : '📂';
    item.classList.toggle('expanded');
  }
  toggle.onclick = (e) => { e.stopPropagation(); toggleExpand(); };
  item.ondblclick = (e) => { e.stopPropagation(); if (hasChildren) toggleExpand(); };
  item.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ad-tree-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    adState.selectedNode = ou.id;
    adState.selectedType = 'ou';
    showOUDetails(body, ou);
  };
  // Right-click context menu on OU
  item.oncontextmenu = (e) => {
    e.preventDefault();
    showContextMenu(body, e.clientX, e.clientY, [
      { label: 'New ▸ User', act: () => showUserForm(body, null, ou.id) },
      { label: 'New ▸ Group', act: () => showGroupForm(body, null, ou.id) },
      { label: 'New ▸ Organizational Unit', act: () => showOUForm(body, null, ou.id) },
      { label: 'New ▸ Computer', act: () => showComputerForm(body, null, ou.id) },
      { sep: true },
      { label: 'Refresh', act: () => refreshAD(body) },
      ...(ou.protected ? [] : [{ label: 'Delete', act: () => deleteOU(body, ou) }]),
    ]);
  };

  children.forEach(child => childrenEl.appendChild(buildTreeNode(child, body, level + 1)));
  ouUsers.forEach(u => childrenEl.appendChild(buildLeafNode(u, 'user', body, level + 1)));
  ouGroups.forEach(g => childrenEl.appendChild(buildLeafNode(g, 'group', body, level + 1)));
  ouComputers.forEach(c => childrenEl.appendChild(buildLeafNode(c, 'computer', body, level + 1)));
  return node;
}

function buildLeafNode(item, type, body, level) {
  const node = document.createElement('div');
  node.className = 'ad-tree-node';
  node.style.paddingLeft = (level * 14 + 4) + 'px';
  const icon = type === 'user' ? (item.enabled ? '👤' : '🚫') : type === 'group' ? '👥' : '💻';
  const label = type === 'user' ? item.display_name : item.name;
  const status = (type === 'user' || type === 'computer') && !item.enabled ? ' (disabled)' : '';
  node.innerHTML = `<div class="ad-tree-item ad-leaf" data-type="${type}" data-id="${item.id}">
    <span class="ad-toggle" style="visibility:hidden"></span>
    <span class="ad-icon">${icon}</span>
    <span class="ad-label">${esc(label)}${status}</span>
  </div>`;
  const row = node.querySelector('.ad-tree-item');
  row.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ad-tree-item').forEach(i => i.classList.remove('selected'));
    row.classList.add('selected');
    adState.selectedNode = item.id;
    adState.selectedType = type;
    if (type === 'user') showUserDetails(body, item);
    else if (type === 'group') showGroupDetails(body, item);
    else if (type === 'computer') showComputerDetails(body, item);
  };
  // Right-click context menu
  row.oncontextmenu = (e) => {
    e.preventDefault();
    const items = [];
    if (type === 'user') {
      items.push({ label: 'Properties…', act: () => propertiesDialog(body, item) });
      items.push({ label: 'Reset Password…', act: () => resetPassword(body, item) });
      items.push({ sep: true });
      if (item.locked) items.push({ label: 'Unlock Account', act: () => unlockAccount(body, item) });
      items.push({ label: item.enabled ? 'Disable Account' : 'Enable Account', act: () => toggleEnable(body, item) });
      items.push({ sep: true });
      items.push({ label: 'Delete', act: () => deleteUser(body, item) });
    } else if (type === 'group') {
      items.push({ label: 'Properties', act: () => showGroupDetails(body, item) });
      items.push({ label: 'Add Member…', act: () => showAddMemberForm(body, item) });
      items.push({ sep: true });
      items.push({ label: 'Delete', act: () => deleteGroup(body, item) });
    } else if (type === 'computer') {
      items.push({ label: 'Properties', act: () => showComputerDetails(body, item) });
      items.push({ sep: true });
      items.push({ label: 'Delete', act: () => deleteComputer(body, item) });
    }
    showContextMenu(body, e.clientX, e.clientY, items);
  };
  return node;
}

// ---------------------------------------------------------------------------
// Quick action helpers (used by context menu)
// ---------------------------------------------------------------------------
async function unlockAccount(body, user) {
  try { await API.post(`/api/ad/users/${user.id}/unlock`, {}); toast('Account unlocked'); await loadAD(); renderTree(body); showUserDetails(body, adState.users.find(u => u.id === user.id)); }
  catch (e) { toast('Error: ' + e.message); }
}
function resetPassword(body, user) {
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10001;display:flex;align-items:center;justify-content:center';
  m.innerHTML = `<div style="background:#fff;border-radius:8px;padding:16px;width:340px"><h3>Reset Password — ${esc(user.display_name)}</h3><div class="form-row"><label>New password</label><input class="field" id="rp-pwd" type="password" value="NewPass#2026"></div><div class="form-row"><label><input type="checkbox" id="rp-unlock" checked> Unlock account</label></div><div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end"><button class="btn btn-sm" id="rp-cancel">Cancel</button><button class="btn btn-sm btn-primary" id="rp-ok">OK</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#rp-cancel').onclick = () => m.remove();
  m.querySelector('#rp-ok').onclick = async () => {
    try {
      await API.post(`/api/ad/users/${user.id}/reset-password`, { password: m.querySelector('#rp-pwd').value });
      if (m.querySelector('#rp-unlock').checked) await API.post(`/api/ad/users/${user.id}/unlock`, {});
      toast('Password reset');
      m.remove();
      await loadAD(); renderTree(body);
      showUserDetails(body, adState.users.find(u => u.id === user.id));
    } catch (e) { toast('Error: ' + e.message); }
  };
}
async function toggleEnable(body, user) {
  try { await API.put(`/api/ad/users/${user.id}`, { enabled: user.enabled ? 0 : 1 }); toast(user.enabled ? 'Account disabled' : 'Account enabled'); await loadAD(); renderTree(body); showUserDetails(body, adState.users.find(u => u.id === user.id)); }
  catch (e) { toast('Error: ' + e.message); }
}
async function deleteUser(body, user) {
  if (!confirm(`Delete user "${user.display_name}"?`)) return;
  try { await API.del(`/api/ad/users/${user.id}`); toast('User deleted'); await loadAD(); renderTree(body); body.querySelector('#ad-content').innerHTML = ''; }
  catch (e) { toast('Error: ' + e.message); }
}
async function deleteGroup(body, group) {
  if (!confirm(`Delete group "${group.name}"?`)) return;
  try { await API.del(`/api/ad/groups/${group.id}`); toast('Group deleted'); await loadAD(); renderTree(body); body.querySelector('#ad-content').innerHTML = ''; }
  catch (e) { toast('Error: ' + e.message); }
}
async function deleteComputer(body, computer) {
  if (!confirm(`Delete computer "${computer.name}"?`)) return;
  try { await API.del(`/api/ad/computers/${computer.id}`); toast('Computer deleted'); await loadAD(); renderTree(body); body.querySelector('#ad-content').innerHTML = ''; }
  catch (e) { toast('Error: ' + e.message); }
}
async function deleteOU(body, ou) {
  if (!confirm(`Delete OU "${ou.name}"? It must be empty.`)) return;
  try { await API.del(`/api/ad/ous/${ou.id}`); toast('OU deleted'); await loadAD(); renderTree(body); body.querySelector('#ad-content').innerHTML = ''; }
  catch (e) { toast('Error: ' + e.message); }
}

// ---------------------------------------------------------------------------
// Detail panels (right pane)
// ---------------------------------------------------------------------------
function showOUDetails(body, ou) {
  const c = body.querySelector('#ad-content');
  const ouUsers = adState.users.filter(u => u.ou_id === ou.id);
  const ouGroups = adState.groups.filter(g => g.ou_id === ou.id);
  const ouComputers = adState.computers.filter(c => c.ou_id === ou.id);
  const childOUs = adState.ous.filter(o => o.parent_id === ou.id);
  // Object list table (MMC style: Name | Type | Description)
  const rows = [
    ...childOUs.map(o => ({ name: o.name, type: 'Organizational Unit', desc: o.description || '', obj: o, kind: 'ou' })),
    ...ouUsers.map(u => ({ name: u.display_name, type: 'User', desc: `${u.title || ''}${u.enabled ? '' : ' — disabled'}`, obj: u, kind: 'user' })),
    ...ouGroups.map(g => ({ name: g.name, type: 'Security Group', desc: g.description || `${(g.members || []).length} member(s)`, obj: g, kind: 'group' })),
    ...ouComputers.map(cp => ({ name: cp.name, type: 'Computer', desc: cp.description || '', obj: cp, kind: 'computer' })),
  ];
  c.innerHTML = `
    <div class="ad-detail">
      <h3 style="margin:0 0 6px">${ou.name === 'lab.local' ? '🌐' : '📁'} ${esc(ou.name)}</h3>
      <div class="ad-prop-grid">
        <div><b>DN:</b> ${esc(ou.dn)}</div>
        <div><b>Description:</b> ${esc(ou.description || '')}</div>
        <div><b>Protected:</b> ${ou.protected ? 'Yes' : 'No'}</div>
        <div><b>Created:</b> ${esc(ou.created || '')}</div>
      </div>
      <div class="ad-objlist-header">
        <span>${rows.length} object(s)</span>
        <span class="muted">Name | Type | Description</span>
      </div>
      <table class="ad-objlist">
        <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr class="ad-objrow" data-kind="${r.kind}" data-id="${r.obj.id}">
            <td>${r.kind === 'user' ? (r.obj.enabled ? '👤' : '🚫') : r.kind === 'group' ? '👥' : r.kind === 'computer' ? '💻' : '📁'} ${esc(r.name)}</td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.desc)}</td>
          </tr>`).join('') || '<tr><td colspan="3" class="muted">This OU is empty</td></tr>'}
        </tbody>
      </table>
      ${!ou.protected ? `<button class="btn btn-sm btn-danger" id="ad-del-ou" style="margin-top:12px">🗑️ Delete OU</button>` : ''}
    </div>`;
  const delBtn = c.querySelector('#ad-del-ou');
  if (delBtn) delBtn.onclick = () => deleteOU(body, ou);
  c.querySelectorAll('.ad-objrow').forEach(tr => tr.onclick = () => {
    const kind = tr.dataset.kind, id = parseInt(tr.dataset.id);
    if (kind === 'user') { const u = adState.users.find(x => x.id === id); if (u) showUserDetails(body, u); }
    else if (kind === 'group') { const g = adState.groups.find(x => x.id === id); if (g) showGroupDetails(body, g); }
    else if (kind === 'computer') { const cp = adState.computers.find(x => x.id === id); if (cp) showComputerDetails(body, cp); }
    else if (kind === 'ou') { const o = adState.ous.find(x => x.id === id); if (o) showOUDetails(body, o); }
  });
}

function showUserDetails(body, user) {
  const c = body.querySelector('#ad-content');
  const isLocked = user.locked, isDisabled = !user.enabled, isExpired = user.password_expired;
  c.innerHTML = `
    <div class="ad-detail">
      <div class="ad-detail-header">
        <h3 style="margin:0">${isDisabled ? '🚫' : '👤'} ${esc(user.display_name)}</h3>
        <div class="ad-actions">
          <button class="btn btn-sm" id="ad-props">📋 Properties…</button>
          ${isLocked ? '<button class="btn btn-sm btn-warning" id="ad-unlock">🔓 Unlock</button>' : ''}
          <button class="btn btn-sm" id="ad-reset-pwd">🔑 Reset Password</button>
          ${isDisabled ? '<button class="btn btn-sm btn-primary" id="ad-enable">✅ Enable</button>' : '<button class="btn btn-sm btn-warning" id="ad-disable">🚫 Disable</button>'}
          <button class="btn btn-sm btn-danger" id="ad-delete-user">🗑️ Delete</button>
        </div>
      </div>
      <div class="ad-prop-grid">
        <div><b>Logon Name:</b> ${esc(user.sam_account_name)}</div>
        <div><b>UPN:</b> ${esc(user.user_principal_name || '')}</div>
        <div><b>DN:</b> ${esc(user.dn || '')}</div>
        <div><b>Department:</b> ${esc(user.department || '')}</div>
        <div><b>Title:</b> ${esc(user.title || '')}</div>
        <div><b>Email:</b> ${esc(user.email || '')}</div>
        <div><b>Phone:</b> ${esc(user.phone || '')}</div>
        <div><b>Manager:</b> ${esc(user.manager || '')}</div>
        <div><b>Description:</b> ${esc(user.description || '')}</div>
        <div><b>Status:</b> ${isDisabled ? '<span style="color:#e74c3c">Disabled</span>' : '<span style="color:#2ecc71">Enabled</span>'}</div>
        <div><b>Locked:</b> ${isLocked ? '<span style="color:#e74c3c">Yes</span>' : 'No'}</div>
        <div><b>Pwd Expired:</b> ${isExpired ? '<span style="color:#e74c3c">Yes</span>' : 'No'}</div>
        <div><b>Pwd Never Expires:</b> ${user.password_never_expires ? 'Yes' : 'No'}</div>
        <div><b>Pwd Last Set:</b> ${esc(user.password_last_set || '')}</div>
        <div><b>Last Logon:</b> ${esc(user.last_logon || 'Never')}</div>
        <div><b>Created:</b> ${esc(user.account_created || '')}</div>
      </div>
      <h4 style="margin-top:12px">Member Of (${(user.groups || []).length})</h4>
      <div class="ad-group-list">
        ${(user.groups || []).map(g => `<span class="ad-group-chip">${esc(g)}</span>`).join('') || '<span class="muted">No groups</span>'}
      </div>
    </div>`;
  c.querySelector('#ad-props').onclick = () => propertiesDialog(body, user);
  const unlockBtn = c.querySelector('#ad-unlock');
  if (unlockBtn) unlockBtn.onclick = () => unlockAccount(body, user);
  c.querySelector('#ad-reset-pwd').onclick = () => resetPassword(body, user);
  const enableBtn = c.querySelector('#ad-enable');
  if (enableBtn) enableBtn.onclick = () => toggleEnable(body, user);
  const disableBtn = c.querySelector('#ad-disable');
  if (disableBtn) disableBtn.onclick = () => toggleEnable(body, user);
  c.querySelector('#ad-delete-user').onclick = () => deleteUser(body, user);
}

function showGroupDetails(body, group) {
  const c = body.querySelector('#ad-content');
  const members = group.members || [];
  c.innerHTML = `
    <div class="ad-detail">
      <div class="ad-detail-header">
        <h3 style="margin:0">👥 ${esc(group.name)}</h3>
        <div class="ad-actions">
          <button class="btn btn-sm" id="ad-edit-group">✏️ Edit</button>
          <button class="btn btn-sm btn-primary" id="ad-add-member">➕ Add Member</button>
          <button class="btn btn-sm btn-danger" id="ad-delete-group">🗑️ Delete</button>
        </div>
      </div>
      <div class="ad-prop-grid">
        <div><b>SAM:</b> ${esc(group.sam_account_name)}</div>
        <div><b>DN:</b> ${esc(group.dn || '')}</div>
        <div><b>Type:</b> ${esc(group.group_type || 'Security')}</div>
        <div><b>Scope:</b> ${esc(group.scope || 'Global')}</div>
        <div><b>Description:</b> ${esc(group.description || '')}</div>
        <div><b>Managed By:</b> ${esc(group.managed_by || '')}</div>
        <div><b>Created:</b> ${esc(group.created || '')}</div>
      </div>
      <h4 style="margin-top:12px">Members (${members.length})</h4>
      <div class="ad-member-list">
        ${members.map(m => `<div class="ad-member">
          <span>${m.type === 'user' ? '👤' : m.type === 'group' ? '👥' : '💻'}</span>
          <span>${esc(m.name || 'Unknown')}</span>
          <button class="btn btn-sm btn-danger ad-remove-member" data-mid="${m.id}" data-mtype="${m.type}">✕</button>
        </div>`).join('') || '<span class="muted">No members</span>'}
      </div>
    </div>`;
  c.querySelector('#ad-edit-group').onclick = () => showGroupForm(body, group);
  c.querySelector('#ad-delete-group').onclick = () => deleteGroup(body, group);
  c.querySelector('#ad-add-member').onclick = () => showAddMemberForm(body, group);
  c.querySelectorAll('.ad-remove-member').forEach(btn => btn.onclick = async () => {
    const mid = parseInt(btn.dataset.mid), mtype = btn.dataset.mtype;
    try { await API.del(`/api/ad/groups/${group.id}/members/${mid}?member_type=${mtype}`); toast('Member removed'); await loadAD(); renderTree(body); showGroupDetails(body, adState.groups.find(g => g.id === group.id)); }
    catch (e) { toast('Error: ' + e.message); }
  });
}

function showComputerDetails(body, computer) {
  const c = body.querySelector('#ad-content');
  c.innerHTML = `
    <div class="ad-detail">
      <div class="ad-detail-header">
        <h3 style="margin:0">💻 ${esc(computer.name)}</h3>
        <div class="ad-actions">
          <button class="btn btn-sm btn-danger" id="ad-delete-computer">🗑️ Delete</button>
        </div>
      </div>
      <div class="ad-prop-grid">
        <div><b>Name:</b> ${esc(computer.name)}</div>
        <div><b>DN:</b> ${esc(computer.dn || '')}</div>
        <div><b>OS:</b> ${esc(computer.os || '')} ${esc(computer.os_version || '')}</div>
        <div><b>IP:</b> ${esc(computer.ipv4_address || '')}</div>
        <div><b>Enabled:</b> ${computer.enabled ? '<span style="color:#2ecc71">Yes</span>' : '<span style="color:#e74c3c">No</span>'}</div>
        <div><b>Last Logon:</b> ${esc(computer.last_logon || 'Never')}</div>
        <div><b>Created:</b> ${esc(computer.created || '')}</div>
        <div><b>Description:</b> ${esc(computer.description || '')}</div>
      </div>
    </div>`;
  c.querySelector('#ad-delete-computer').onclick = () => deleteComputer(body, computer);
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
function showUserForm(body, user, defaultOuId) {
  const c = body.querySelector('#ad-content');
  const isEdit = !!user;
  const ouOptions = adState.ous.map(o => `<option value="${o.id}" ${(user?.ou_id || defaultOuId) === o.id ? 'selected' : ''}>${esc(o.name)} (${esc(o.dn)})</option>`).join('');
  c.innerHTML = `
    <div class="ad-detail">
      <h3 style="margin:0 0 8px">${isEdit ? '✏️ Edit User' : '👤 New User'}</h3>
      <div class="ad-form">
        <div class="form-row"><label>Logon Name (SAM)*</label><input class="field" id="f-sam" value="${esc(user?.sam_account_name || '')}" ${isEdit ? 'readonly' : ''}></div>
        <div class="form-row"><label>Display Name*</label><input class="field" id="f-display" value="${esc(user?.display_name || '')}"></div>
        <div class="form-row"><label>UPN</label><input class="field" id="f-upn" value="${esc(user?.user_principal_name || '')}" placeholder="name@lab.local"></div>
        <div class="form-row"><label>OU</label><select class="field" id="f-ou">${ouOptions}</select></div>
        <div class="form-row"><label>Department</label><input class="field" id="f-dept" value="${esc(user?.department || '')}"></div>
        <div class="form-row"><label>Title</label><input class="field" id="f-title" value="${esc(user?.title || '')}"></div>
        <div class="form-row"><label>Email</label><input class="field" id="f-email" value="${esc(user?.email || '')}"></div>
        <div class="form-row"><label>Phone</label><input class="field" id="f-phone" value="${esc(user?.phone || '')}"></div>
        <div class="form-row"><label>Manager</label><input class="field" id="f-manager" value="${esc(user?.manager || '')}"></div>
        <div class="form-row"><label>Description</label><input class="field" id="f-desc" value="${esc(user?.description || '')}"></div>
        ${!isEdit ? '<div class="form-row"><label>Password</label><input class="field" id="f-pwd" type="password" value="TempPass#2026"></div>' : ''}
        <div class="form-row"><label><input type="checkbox" id="f-never-expires" ${user?.password_never_expires ? 'checked' : ''}> Password never expires</label></div>
        <div class="form-row"><label><input type="checkbox" id="f-enabled" ${user?.enabled !== 0 ? 'checked' : ''}> Account enabled</label></div>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="f-save">${isEdit ? 'Save Changes' : 'Create User'}</button>
        <button class="btn btn-sm" id="f-cancel">Cancel</button>
      </div>
    </div>`;
  c.querySelector('#f-cancel').onclick = () => { if (user) showUserDetails(body, user); else c.innerHTML = ''; };
  c.querySelector('#f-save').onclick = async () => {
    const data = {
      sam_account_name: c.querySelector('#f-sam').value,
      display_name: c.querySelector('#f-display').value,
      user_principal_name: c.querySelector('#f-upn').value || `${c.querySelector('#f-sam').value}@lab.local`,
      ou_id: parseInt(c.querySelector('#f-ou').value),
      department: c.querySelector('#f-dept').value,
      title: c.querySelector('#f-title').value,
      email: c.querySelector('#f-email').value,
      phone: c.querySelector('#f-phone').value,
      manager: c.querySelector('#f-manager').value,
      description: c.querySelector('#f-desc').value,
      password_never_expires: c.querySelector('#f-never-expires').checked ? 1 : 0,
      enabled: c.querySelector('#f-enabled').checked ? 1 : 0,
    };
    if (!isEdit) data.password = c.querySelector('#f-pwd').value;
    try {
      if (isEdit) { await API.put(`/api/ad/users/${user.id}`, data); toast('User updated'); }
      else { await API.post('/api/ad/users', data); toast('User created'); }
      await loadAD(); renderTree(body);
      const updated = adState.users.find(u => u.sam_account_name === data.sam_account_name);
      if (updated) showUserDetails(body, updated);
    } catch (e) { toast('Error: ' + e.message); }
  };
}

function showGroupForm(body, group, defaultOuId) {
  const c = body.querySelector('#ad-content');
  const isEdit = !!group;
  const ouOptions = adState.ous.map(o => `<option value="${o.id}" ${(group?.ou_id || defaultOuId) === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
  c.innerHTML = `
    <div class="ad-detail">
      <h3 style="margin:0 0 8px">${isEdit ? '✏️ Edit Group' : '👥 New Group'}</h3>
      <div class="ad-form">
        <div class="form-row"><label>Group Name*</label><input class="field" id="g-name" value="${esc(group?.name || '')}" ${isEdit ? 'readonly' : ''}></div>
        <div class="form-row"><label>SAM Account Name</label><input class="field" id="g-sam" value="${esc(group?.sam_account_name || '')}"></div>
        <div class="form-row"><label>OU</label><select class="field" id="g-ou">${ouOptions}</select></div>
        <div class="form-row"><label>Group Type</label><select class="field" id="g-type"><option ${group?.group_type === 'Security' ? 'selected' : ''}>Security</option><option ${group?.group_type === 'Distribution' ? 'selected' : ''}>Distribution</option></select></div>
        <div class="form-row"><label>Scope</label><select class="field" id="g-scope"><option ${group?.scope === 'Global' ? 'selected' : ''}>Global</option><option ${group?.scope === 'DomainLocal' ? 'selected' : ''}>DomainLocal</option><option ${group?.scope === 'Universal' ? 'selected' : ''}>Universal</option></select></div>
        <div class="form-row"><label>Description</label><input class="field" id="g-desc" value="${esc(group?.description || '')}"></div>
        <div class="form-row"><label>Managed By</label><input class="field" id="g-managed" value="${esc(group?.managed_by || '')}"></div>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="g-save">${isEdit ? 'Save Changes' : 'Create Group'}</button>
        <button class="btn btn-sm" id="g-cancel">Cancel</button>
      </div>
    </div>`;
  c.querySelector('#g-cancel').onclick = () => { if (group) showGroupDetails(body, group); else c.innerHTML = ''; };
  c.querySelector('#g-save').onclick = async () => {
    const data = {
      name: c.querySelector('#g-name').value,
      sam_account_name: c.querySelector('#g-sam').value || c.querySelector('#g-name').value,
      ou_id: parseInt(c.querySelector('#g-ou').value),
      group_type: c.querySelector('#g-type').value,
      scope: c.querySelector('#g-scope').value,
      description: c.querySelector('#g-desc').value,
      managed_by: c.querySelector('#g-managed').value,
    };
    try {
      if (isEdit) { await API.put(`/api/ad/groups/${group.id}`, data); toast('Group updated'); }
      else { await API.post('/api/ad/groups', data); toast('Group created'); }
      await loadAD(); renderTree(body);
      const updated = adState.groups.find(g => g.name === data.name);
      if (updated) showGroupDetails(body, updated);
    } catch (e) { toast('Error: ' + e.message); }
  };
}

function showOUForm(body, ou, defaultParentId) {
  const c = body.querySelector('#ad-content');
  const parentOptions = adState.ous.filter(o => !o.protected || o.parent_id === null).map(o => `<option value="${o.id}" ${(ou?.parent_id || defaultParentId) === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
  c.innerHTML = `
    <div class="ad-detail">
      <h3 style="margin:0 0 8px">📁 New Organizational Unit</h3>
      <div class="ad-form">
        <div class="form-row"><label>OU Name*</label><input class="field" id="o-name" placeholder="e.g. Marketing"></div>
        <div class="form-row"><label>Parent OU</label><select class="field" id="o-parent">${parentOptions}</select></div>
        <div class="form-row"><label>Description</label><input class="field" id="o-desc"></div>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="o-save">Create OU</button>
        <button class="btn btn-sm" id="o-cancel">Cancel</button>
      </div>
    </div>`;
  c.querySelector('#o-cancel').onclick = () => { c.innerHTML = ''; };
  c.querySelector('#o-save').onclick = async () => {
    const data = { name: c.querySelector('#o-name').value, parent_id: parseInt(c.querySelector('#o-parent').value), description: c.querySelector('#o-desc').value };
    if (!data.name) { toast('OU name is required'); return; }
    try { await API.post('/api/ad/ous', data); toast('OU created'); await loadAD(); renderTree(body); }
    catch (e) { toast('Error: ' + e.message); }
  };
}

function showComputerForm(body, computer, defaultOuId) {
  const c = body.querySelector('#ad-content');
  const ouOptions = adState.ous.map(o => `<option value="${o.id}" ${(computer?.ou_id || defaultOuId) === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
  c.innerHTML = `
    <div class="ad-detail">
      <h3 style="margin:0 0 8px">💻 New Computer</h3>
      <div class="ad-form">
        <div class="form-row"><label>Computer Name*</label><input class="field" id="c-name" placeholder="e.g. WS-MKT-01"></div>
        <div class="form-row"><label>OU</label><select class="field" id="c-ou">${ouOptions}</select></div>
        <div class="form-row"><label>OS</label><input class="field" id="c-os" value="Windows 11 Pro"></div>
        <div class="form-row"><label>IP Address</label><input class="field" id="c-ip" placeholder="10.0.0.x"></div>
        <div class="form-row"><label>Description</label><input class="field" id="c-desc"></div>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="c-save">Create Computer</button>
        <button class="btn btn-sm" id="c-cancel">Cancel</button>
      </div>
    </div>`;
  c.querySelector('#c-cancel').onclick = () => { c.innerHTML = ''; };
  c.querySelector('#c-save').onclick = async () => {
    const data = { name: c.querySelector('#c-name').value, ou_id: parseInt(c.querySelector('#c-ou').value), os: c.querySelector('#c-os').value, ipv4_address: c.querySelector('#c-ip').value, description: c.querySelector('#c-desc').value };
    if (!data.name) { toast('Computer name is required'); return; }
    try { await API.post('/api/ad/computers', data); toast('Computer created'); await loadAD(); renderTree(body); }
    catch (e) { toast('Error: ' + e.message); }
  };
}

function showAddMemberForm(body, group) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10000;display:flex;align-items:center;justify-content:center';
  const userOptions = adState.users.map(u => `<option value="${u.id}">${esc(u.display_name)} (${esc(u.sam_account_name)})</option>`).join('');
  const groupOptions = adState.groups.filter(g => g.id !== group.id).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  const computerOptions = adState.computers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:16px;width:400px;max-height:80vh;overflow:auto">
      <h3 style="margin:0 0 8px">Add Member to ${esc(group.name)}</h3>
      <div class="form-row"><label>Member Type</label>
        <select class="field" id="m-type"><option value="user">User</option><option value="group">Group</option><option value="computer">Computer</option></select>
      </div>
      <div class="form-row"><label>Select User</label><select class="field" id="m-user">${userOptions}</select></div>
      <div class="form-row" style="display:none"><label>Select Group</label><select class="field" id="m-group">${groupOptions}</select></div>
      <div class="form-row" style="display:none"><label>Select Computer</label><select class="field" id="m-computer">${computerOptions}</select></div>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-sm" id="m-cancel">Cancel</button>
        <button class="btn btn-sm btn-primary" id="m-add">Add Member</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#m-type').onchange = (e) => {
    overlay.querySelector('#m-user').parentElement.style.display = e.target.value === 'user' ? '' : 'none';
    overlay.querySelector('#m-group').parentElement.style.display = e.target.value === 'group' ? '' : 'none';
    overlay.querySelector('#m-computer').parentElement.style.display = e.target.value === 'computer' ? '' : 'none';
  };
  overlay.querySelector('#m-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#m-add').onclick = async () => {
    const type = overlay.querySelector('#m-type').value;
    const select = overlay.querySelector(`#m-${type}`);
    const memberId = parseInt(select.value);
    try {
      await API.post(`/api/ad/groups/${group.id}/members`, { member_id: memberId, member_type: type });
      toast('Member added'); overlay.remove();
      await loadAD(); renderTree(body);
      showGroupDetails(body, adState.groups.find(g => g.id === group.id));
    } catch (e) { toast('Error: ' + e.message); }
  };
}

async function doSearch(body) {
  const q = body.querySelector('#ad-search').value;
  if (!q) return;
  try {
    const results = await API.get(`/api/ad/search?q=${encodeURIComponent(q)}`);
    const c = body.querySelector('#ad-content');
    c.innerHTML = `
      <div class="ad-detail">
        <h3 style="margin:0 0 8px">🔍 Search: "${esc(q)}"</h3>
        <table class="ad-objlist">
          <thead><tr><th>Name</th><th>Type</th><th>DN</th></tr></thead>
          <tbody>
            ${results.length === 0 ? '<tr><td colspan="3" class="muted">No results</td></tr>' :
              results.map(r => `<tr class="ad-objrow" data-type="${r.type}" data-id="${r.id}">
                <td>${r.type === 'user' ? '👤' : r.type === 'group' ? '👥' : '💻'} ${esc(r.display_name || r.name)}</td>
                <td>${esc(r.type)}</td>
                <td class="muted">${esc(r.dn || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    c.querySelectorAll('.ad-objrow').forEach(el => el.onclick = () => {
      const type = el.dataset.type, id = parseInt(el.dataset.id);
      if (type === 'user') { const u = adState.users.find(x => x.id === id); if (u) showUserDetails(body, u); }
      else if (type === 'group') { const g = adState.groups.find(x => x.id === id); if (g) showGroupDetails(body, g); }
      else if (type === 'computer') { const cp = adState.computers.find(x => x.id === id); if (cp) showComputerDetails(body, cp); }
    });
  } catch (e) { toast('Search error: ' + e.message); }
}
