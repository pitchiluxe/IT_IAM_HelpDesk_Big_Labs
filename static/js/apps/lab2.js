import { API } from '../api.js';
import { toast } from '../wm.js';
import { modal, esc } from './lab1.js';

// ============ Entra ID Admin Center ============
export function openEntraPortal(body) {
  body.innerHTML = `
    <div class="app" style="height:100%">
      <div class="portal">
        <div class="portal-nav">
          <div class="nav-brand">🔐 Entra ID</div>
          <div class="nav-item active" data-v="users">👥 Users</div>
          <div class="nav-item" data-v="groups">📁 Groups</div>
          <div class="nav-item" data-v="mfa">🔑 MFA</div>
          <div class="nav-item" data-v="ca">🛡️ Conditional Access</div>
        </div>
        <div class="portal-main">
          <div class="portal-header"><h2 id="ep-title">Users</h2><div class="muted" id="ep-sub">Lab 2 — Microsoft Entra ID identity & MFA</div></div>
          <div class="portal-content" id="ep-content"></div>
        </div>
      </div>
    </div>`;
  let view = 'users', users = [], groups = [], policies = [];

  async function load() {
    [users, groups, policies] = await Promise.all([API.lab2Users(), API.lab2Groups(), API.lab2Policies()]);
    users = users.users; groups = groups.groups; policies = policies.policies;
    render();
  }
  body.querySelector('.portal-nav').addEventListener('click', e => {
    const it = e.target.closest('.nav-item'); if (!it) return;
    view = it.dataset.v;
    body.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === it));
    render();
  });

  function render() {
    const c = body.querySelector('#ep-content');
    const titles = { users: 'Users', groups: 'Groups', mfa: 'Authentication Methods', ca: 'Conditional Access' };
    body.querySelector('#ep-title').textContent = titles[view];
    if (view === 'users') renderUsers(c);
    else if (view === 'groups') renderGroups(c);
    else if (view === 'mfa') renderMfa(c);
    else renderCa(c);
  }

  function renderUsers(c) {
    c.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" id="eu-new">+ New user</button></div>
      <table class="data"><thead><tr><th>UPN</th><th>Display name</th><th>Department</th><th>Status</th><th>Groups</th><th>MFA</th></tr></thead>
      <tbody>${users.map(u => `<tr class="row-link" data-uid="${u.id}">
        <td><b>${esc(u.upn)}</b></td><td>${esc(u.display_name)}</td><td>${esc(u.department||'')}</td>
        <td>${u.account_enabled?'<span class="badge badge-green">Enabled</span>':'<span class="badge badge-red">Disabled</span>'}</td>
        <td>${(u.groups||[]).map(g=>`<span class="tag">${esc(g)}</span>`).join(' ')}</td>
        <td>${u.mfa_registered?'<span class="badge badge-green">Registered</span>':'<span class="badge badge-red">Not registered</span>'}</td>
      </tr>`).join('')}</tbody></table>`;
    c.querySelectorAll('tr.row-link').forEach(tr => tr.onclick = () => userModal(users.find(u => u.id == tr.dataset.uid)));
    c.querySelector('#eu-new').onclick = () => newUserModal();
  }

  function renderGroups(c) {
    c.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" id="eg-new">+ New group</button></div>
      <table class="data"><thead><tr><th>Display name</th><th>Type</th><th>Description</th><th>Members</th></tr></thead>
      <tbody>${groups.map(g => `<tr class="row-link" data-gid="${g.id}">
        <td><b>${esc(g.display_name)}</b></td><td>${esc(g.group_type||'Security')}</td><td>${esc(g.description||'')}</td>
        <td>${(g.members||[]).map(m=>`<span class="tag">${esc(m)}</span>`).join(' ')||'<span class="muted">none</span>'}</td>
      </tr>`).join('')}</tbody></table>`;
    c.querySelectorAll('tr.row-link').forEach(tr => tr.onclick = () => groupModal(groups.find(g => g.id == tr.dataset.gid)));
    c.querySelector('#eg-new').onclick = () => { const m = modal(body, 'New group', `<div class="form-row"><label>Display name</label><input class="field" id="ng-name"></div><div class="form-row"><label>Description</label><input class="field" id="ng-desc"></div>`); m.save.onclick = async () => { await API.lab2CreateGroup({ display_name: m.q('#ng-name').value, description: m.q('#ng-desc').value }); m.close(); toast('Group created'); load(); }; };
  }

  function renderMfa(c) {
    c.innerHTML = `<table class="data"><thead><tr><th>User</th><th>UPN</th><th>Methods</th><th>MFA status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td><b>${esc(u.display_name)}</b></td><td>${esc(u.upn)}</td>
        <td>${(u.mfa_methods||[]).map(m=>`<span class="tag">${esc(m.method_type)}${m.is_default?' ★':''}</span>`).join(' ')||'<span class="muted">none</span>'}</td>
        <td>${u.mfa_registered?'<span class="badge badge-green">Registered</span>':'<span class="badge badge-red">Not registered</span>'}</td>
        <td><button class="btn btn-sm" data-mfa-add="${u.id}">Register</button> <button class="btn btn-sm btn-danger" data-mfa-rst="${u.id}">Reset MFA</button></td>
      </tr>`).join('')}</tbody></table>`;
    c.querySelectorAll('button[data-mfa-add]').forEach(b => b.onclick = () => mfaModal(users.find(u => u.id == b.dataset.mfaAdd)));
    c.querySelectorAll('button[data-mfa-rst]').forEach(b => b.onclick = async () => { if (confirm('Reset (remove) all MFA methods for this user?')) { await API.lab2MfaReset(b.dataset.mfaRst); toast('MFA reset - user must re-register'); load(); } });
  }

  function renderCa(c) {
    c.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" id="ca-new">+ New policy</button>
      <span class="muted" style="margin-left:10px">Toggle a policy between On / Off / Report-only to test enforcement.</span></div>
      ${policies.map(p => `<div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><b>${esc(p.name)}</b> <span class="badge ${p.state==='On'?'badge-green':p.state==='Report-only'?'badge-amber':'badge-gray'}">${esc(p.state)}</span></div>
          <select class="field" style="width:140px" data-ca="${p.id}">
            <option ${p.state==='On'?'selected':''}>On</option><option ${p.state==='Off'?'selected':''}>Off</option><option ${p.state==='Report-only'?'selected':''}>Report-only</option></select>
        </div>
        <div class="muted" style="margin-top:6px">Applications: ${esc(p.applications)} · Grant: ${esc(p.grant_control)}</div>
        <div class="muted" style="margin-top:4px">Scoped to groups: ${(p.scopes||[]).map(s=>`<span class="tag">${esc(s.group)} (${s.scope_type})</span>`).join(' ')||'<span class="muted">All users</span>'}</div>
      </div>`).join('')}`;
    c.querySelector('#ca-new').onclick = () => caModal();
    c.querySelectorAll('select[data-ca]').forEach(s => s.onchange = async () => { await API.lab2UpdatePolicy(s.dataset.ca, { state: s.value }); toast('Policy state updated'); load(); });
  }

  async function userModal(u) {
    const m = modal(body, `User: ${u.display_name}`, `
      <div class="form-row"><label>UPN</label><input class="field" value="${esc(u.upn)}" disabled></div>
      <div class="form-row"><label>Display name</label><input class="field" id="u-dn" value="${esc(u.display_name)}"></div>
      <div class="form-row"><label>Job title</label><input class="field" id="u-jt" value="${esc(u.job_title||'')}"></div>
      <div class="form-row"><label>Department</label><input class="field" id="u-dep" value="${esc(u.department||'')}"></div>
      <div style="display:flex;gap:18px;margin:10px 0"><label><input type="checkbox" id="u-en" ${u.account_enabled?'checked':''}> Account enabled</label>
      <label><input type="checkbox" id="u-bl" ${u.sign_in_blocked?'checked':''}> Sign-in blocked</label></div>
      <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
      <div style="font-weight:600;margin-bottom:6px">Group membership</div><div id="u-grp"></div>
      <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
      <div style="font-weight:600;margin-bottom:6px">MFA methods</div><div id="u-mfa"></div>
      <button class="btn btn-sm" id="u-mfa-add" style="margin-top:8px">+ Register method</button>
      <button class="btn btn-sm btn-danger" id="u-mfa-reset" style="margin-top:8px">Reset all MFA</button>`);
    m.q('#u-grp').innerHTML = groups.map(g => `<label style="display:block;padding:4px 0"><input type="checkbox" data-gid="${g.id}" ${(u.groups||[]).includes(g.display_name)?'checked':''}> ${esc(g.display_name)}</label>`).join('');
    m.q('#u-grp').querySelectorAll('input').forEach(cb => cb.onchange = async () => {
      if (cb.checked) await API.lab2AddMember(cb.dataset.gid, u.id); else await API.lab2RemoveMember(cb.dataset.gid, u.id);
      toast('Membership updated'); load();
    });
    function renderMfa() {
      m.q('#u-mfa').innerHTML = (u.mfa_methods||[]).map(mm => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(mm.method_type)}${mm.is_default?' (default)':''}</span><button class="btn btn-sm btn-danger" data-mid="${mm.id}">Remove</button></div>`).join('') || '<div class="muted">No methods registered</div>';
      m.q('#u-mfa').querySelectorAll('button').forEach(b => b.onclick = async () => { await API.lab2RemoveMfa(u.id, b.dataset.mid); toast('Method removed'); m.close(); load(); });
    }
    renderMfa();
    m.q('#u-mfa-add').onclick = () => mfaModal(u, () => { m.close(); load(); });
    m.q('#u-mfa-reset').onclick = async () => { if (confirm('Remove all MFA methods?')) { await API.lab2MfaReset(u.id); toast('MFA reset'); m.close(); load(); } };
    m.save.onclick = async () => {
      await API.lab2UpdateUser(u.id, { display_name: m.q('#u-dn').value, job_title: m.q('#u-jt').value, department: m.q('#u-dep').value, account_enabled: m.q('#u-en').checked?1:0, sign_in_blocked: m.q('#u-bl').checked?1:0 });
      m.close(); toast('User updated'); load();
    };
  }

  async function groupModal(g) {
    const m = modal(body, `Group: ${g.display_name}`, `<div class="muted">${esc(g.description||'')}</div>
      <div style="font-weight:600;margin:12px 0 6px">Members</div><div id="g-mem"></div>
      <div style="font-weight:600;margin:12px 0 6px">Add member</div><select class="field" id="g-add" style="width:100%"></select>
      <button class="btn btn-sm btn-primary" id="g-addbtn" style="margin-top:8px">Add</button>`);
    m.q('#g-mem').innerHTML = (g.members||[]).map(upn => { const mu = users.find(x=>x.upn===upn); return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0"><span>${esc(upn)}</span><button class="btn btn-sm btn-danger" data-uid="${mu?mu.id:''}">Remove</button></div>`; }).join('') || '<div class="muted">No members</div>';
    m.q('#g-mem').querySelectorAll('button').forEach(b => b.onclick = async () => { await API.lab2RemoveMember(g.id, b.dataset.uid); toast('Removed'); m.close(); load(); });
    m.q('#g-add').innerHTML = users.filter(u => !(g.members||[]).includes(u.upn)).map(u => `<option value="${u.id}">${esc(u.upn)}</option>`).join('');
    m.q('#g-addbtn').onclick = async () => { await API.lab2AddMember(g.id, parseInt(m.q('#g-add').value)); toast('Added'); m.close(); load(); };
  }

  async function mfaModal(u, after) {
    const m = modal(body, `Register MFA method — ${u.display_name}`, `
      <div class="form-row"><label>Method</label><select class="field" id="mm-type">
        <option>Authenticator App</option><option>Phone</option><option>Email</option><option>FIDO2 Key</option></select></div>`);
    m.save.onclick = async () => { await API.lab2RegisterMfa(u.id, { method_type: m.q('#mm-type').value }); m.close(); toast('MFA method registered'); if (after) after(); else load(); };
  }

  async function caModal() {
    const m = modal(body, 'New Conditional Access Policy', `
      <div class="form-row"><label>Policy name</label><input class="field" id="cp-name"></div>
      <div class="form-row"><label>State</label><select class="field" id="cp-state"><option>Report-only</option><option>On</option><option>Off</option></select></div>
      <div class="form-row"><label>Applications</label><input class="field" id="cp-apps" value="All cloud apps"></div>
      <div class="form-row"><label>Grant control</label><select class="field" id="cp-grant"><option>Require MFA</option><option>Block access</option><option>Require MFA + compliant device</option></select></div>
      <div class="form-row"><label>Include groups</label><div id="cp-groups" style="max-height:120px;overflow:auto;border:1px solid #ddd;border-radius:5px;padding:6px">${groups.map(g=>`<label style="display:block"><input type="checkbox" value="${g.id}"> ${esc(g.display_name)}</label>`).join('')}</div></div>`);
    m.save.onclick = async () => {
      const inc = [...m.q('#cp-groups').querySelectorAll('input:checked')].map(x => parseInt(x.value));
      await API.lab2CreatePolicy({ name: m.q('#cp-name').value, state: m.q('#cp-state').value, applications: m.q('#cp-apps').value, grant_control: m.q('#cp-grant').value, include_groups: inc });
      m.close(); toast('Policy created'); load();
    };
  }
  load();
}

// ============ Sign-in Logs Investigator ============
export function openSignInLogs(body) {
  body.innerHTML = `
    <div class="app">
      <div class="app-toolbar"><h2>Sign-in Logs</h2><span class="muted">— Lab 2: investigate authentication failures</span>
        <div class="spacer"></div><button class="btn btn-sm" id="sl-refresh">↻ Refresh</button></div>
      <div class="app-body" style="padding:14px">
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-end">
          <div><label class="muted">Filter by user</label><select class="field" id="sl-user" style="width:240px"><option value="">All users</option></select></div>
          <button class="btn btn-primary btn-sm" id="sl-gen">+ Simulate sign-in</button>
        </div>
        <div id="sl-list"></div>
      </div>
    </div>`;
  let users = [];
  async function load() {
    const ud = await API.lab2Users(); users = ud.users;
    body.querySelector('#sl-user').innerHTML = `<option value="">All users</option>` + users.map(u => `<option value="${u.id}">${esc(u.upn)}</option>`).join('');
    render();
  }
  async function render() {
    const uid = body.querySelector('#sl-user').value;
    const d = await API.lab2Signins(uid || undefined);
    const c = body.querySelector('#sl-list');
    c.innerHTML = `<table class="data"><thead><tr><th>Time</th><th>User</th><th>App</th><th>IP</th><th>Result</th><th>Conditional Access</th><th>Detail</th></tr></thead>
      <tbody>${d.logs.map(l => `<tr>
        <td>${esc(l.time)}</td><td><b>${esc(l.upn)}</b></td><td>${esc(l.app)}</td><td>${esc(l.ip)}</td>
        <td>${resultBadge(l.result)}</td><td>${esc(l.conditional_access||'')}</td><td style="max-width:300px">${esc(l.detail||'')}</td>
      </tr>`).join('')}</tbody></table>`;
  }
  body.querySelector('#sl-refresh').onclick = render;
  body.querySelector('#sl-user').onchange = render;
  body.querySelector('#sl-gen').onclick = () => genModal();
  async function genModal() {
    const m = modal(body, 'Simulate Sign-in Attempt', `
      <div class="form-row"><label>User</label><select class="field" id="gs-user">${users.map(u=>`<option value="${u.id}">${esc(u.upn)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Application</label><input class="field" id="gs-app" value="Microsoft 365"></div>
      <div class="form-row"><label>IP address</label><input class="field" id="gs-ip" value="203.0.113.50"></div>
      <div class="muted" style="margin-bottom:8px">The simulation evaluates the user's account state, group membership, MFA registration, and matching Conditional Access policy.</div>`);
    m.save.textContent = 'Run sign-in';
    m.save.onclick = async () => {
      const r = await API.lab2GenSignin({ user_id: parseInt(m.q('#gs-user').value), app: m.q('#gs-app').value, ip: m.q('#gs-ip').value });
      m.close();
      toast(`Sign-in result: ${r.result}`);
      render();
    };
  }
  load();
}

function resultBadge(r) {
  const m = { 'Success': 'badge-green', 'MFA Failed': 'badge-red', 'Blocked by CA': 'badge-red', 'Invalid credentials': 'badge-amber', 'Account locked': 'badge-amber' };
  return `<span class="badge ${m[r]||'badge-gray'}">${esc(r)}</span>`;
}
