import { toast } from '../wm.js';
import { esc } from './lab1.js';

// ============ Okta Admin Console (simulated) ============
// Self-contained mock of the Okta identity management portal.
// Uses in-memory data so the learner can explore the UI without a backend.

const OKTA_USERS = [
  { id: 1, name: 'Sarah Chen',     email: 'sarah.chen@laborg.okta.com',   status: 'Active',    mfa: 'Authenticator App', groups: ['Everyone', 'Engineering', 'Okta-Admins'], lastLogin: '2026-01-15 09:14' },
  { id: 2, name: 'Marcus Johnson',  email: 'marcus.j@laborg.okta.com',     status: 'Active',    mfa: 'SMS',               groups: ['Everyone', 'Sales'],                      lastLogin: '2026-01-14 17:02' },
  { id: 3, name: 'Priya Patel',     email: 'priya.patel@laborg.okta.com',  status: 'Active',    mfa: 'None',              groups: ['Everyone', 'Finance'],                    lastLogin: '2026-01-13 11:30' },
  { id: 4, name: 'David Wilson',    email: 'd.wilson@laborg.okta.com',      status: 'Suspended', mfa: 'Authenticator App', groups: ['Everyone'],                               lastLogin: '2025-12-20 14:45' },
  { id: 5, name: 'Lisa Garcia',     email: 'lisa.garcia@laborg.okta.com',   status: 'Active',    mfa: 'Email',             groups: ['Everyone', 'HR', 'Okta-Admins'],          lastLogin: '2026-01-15 08:00' },
  { id: 6, name: 'Tom Reddy',       email: 'tom.reddy@laborg.okta.com',     status: 'Locked Out',mfa: 'Authenticator App', groups: ['Everyone', 'Engineering'],               lastLogin: '2026-01-10 10:15' },
  { id: 7, name: 'Emily Davis',     email: 'emily.davis@laborg.okta.com',   status: 'Active',    mfa: 'None',              groups: ['Everyone', 'Marketing'],                   lastLogin: '2026-01-14 13:20' },
];

const OKTA_GROUPS = [
  { name: 'Everyone',      desc: 'All users in the organization',           members: 7 },
  { name: 'Engineering',   desc: 'Engineering team — access to code repos',  members: 2 },
  { name: 'Sales',         desc: 'Sales team — access to CRM',               members: 1 },
  { name: 'Finance',       desc: 'Finance team — access to financial apps',  members: 1 },
  { name: 'HR',            desc: 'HR team — access to employee records',     members: 1 },
  { name: 'Marketing',     desc: 'Marketing team — access to campaigns',     members: 1 },
  { name: 'Okta-Admins',   desc: 'Okta administrators — full access',        members: 2 },
];

const OKTA_APPS = [
  { name: 'Microsoft 365',       category: 'Productivity',  status: 'Active',   assigned: 7, sso: 'SAML 2.0' },
  { name: 'Salesforce',          category: 'CRM',           status: 'Active',   assigned: 1, sso: 'SAML 2.0' },
  { name: 'Slack',               category: 'Communication', status: 'Active',   assigned: 7, sso: 'OIDC' },
  { name: 'GitHub Enterprise',   category: 'Development',   status: 'Active',   assigned: 2, sso: 'SAML 2.0' },
  { name: 'Workday',             category: 'HR',            status: 'Active',   assigned: 1, sso: 'SAML 2.0' },
  { name: 'Zendesk',             category: 'Support',       status: 'Inactive', assigned: 0, sso: 'OIDC' },
];

const OKTA_POLICIES = [
  { name: 'MFA Required for All',     rule: 'All users must complete MFA',                          status: 'Active' },
  { name: 'Block Legacy Auth',        rule: 'Block basic authentication (IMAP, POP, SMTP)',         status: 'Active' },
  { name: 'Admin MFA Enforced',       rule: 'Okta-Admins group requires hardware key',              status: 'Active' },
  { name: 'Salesforce Access Policy', rule: 'Sales group can access Salesforce from any location',  status: 'Active' },
];

export function openOkta(body) {
  body.innerHTML = `
    <div class="app" style="height:100%">
      <div class="portal">
        <div class="portal-nav">
          <div class="nav-brand">🟦 Okta</div>
          <div class="nav-item active" data-v="users">👥 Users</div>
          <div class="nav-item" data-v="groups">📁 Groups</div>
          <div class="nav-item" data-v="apps">📦 Applications</div>
          <div class="nav-item" data-v="policies">🛡️ Sign-in Policies</div>
        </div>
        <div class="portal-main">
          <div class="portal-header"><h2 id="ok-title">Users</h2><div class="muted" id="ok-sub">Okta Identity Management — laborg.okta.com</div></div>
          <div class="portal-content" id="ok-content"></div>
        </div>
      </div>
    </div>`;

  let view = 'users';

  body.querySelector('.portal-nav').addEventListener('click', e => {
    const it = e.target.closest('.nav-item'); if (!it) return;
    view = it.dataset.v;
    body.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === it));
    render();
  });

  function render() {
    const c = body.querySelector('#ok-content');
    const titles = { users: 'Users', groups: 'Groups', apps: 'Applications', policies: 'Sign-in Policies' };
    body.querySelector('#ok-title').textContent = titles[view];
    if (view === 'users') renderUsers(c);
    else if (view === 'groups') renderGroups(c);
    else if (view === 'apps') renderApps(c);
    else renderPolicies(c);
  }

  function statusBadge(s) {
    const cls = s === 'Active' ? 'badge-green' : s === 'Suspended' ? 'badge-red' : 'badge-yellow';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function mfaBadge(m) {
    return m === 'None' ? '<span class="badge badge-red">Not registered</span>' : `<span class="badge badge-green">${esc(m)}</span>`;
  }

  function renderUsers(c) {
    c.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" id="ok-newuser">+ New user</button></div>
      <table class="data"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>MFA</th><th>Groups</th><th>Last Login</th></tr></thead>
      <tbody>${OKTA_USERS.map(u => `<tr class="row-link" data-uid="${u.id}">
        <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
        <td>${statusBadge(u.status)}</td><td>${mfaBadge(u.mfa)}</td>
        <td>${u.groups.map(g => `<span class="tag">${esc(g)}</span>`).join(' ')}</td>
        <td>${esc(u.lastLogin)}</td>
      </tr>`).join('')}</tbody></table>`;
    c.querySelectorAll('tr.row-link').forEach(tr => tr.onclick = () => userModal(OKTA_USERS.find(u => u.id == tr.dataset.uid)));
    c.querySelector('#ok-newuser').onclick = () => toast('User creation is simulated in this lab');
  }

  function userModal(u) {
    const m = modal(`<h3>${esc(u.name)}</h3><p style="color:#666;margin:4px 0 16px">${esc(u.email)}</p>
      <table class="data" style="margin-bottom:12px">
        <tr><td><b>Status</b></td><td>${statusBadge(u.status)}</td></tr>
        <tr><td><b>MFA</b></td><td>${mfaBadge(u.mfa)}</td></tr>
        <tr><td><b>Groups</b></td><td>${u.groups.map(g => `<span class="tag">${esc(g)}</span>`).join(' ')}</td></tr>
        <tr><td><b>Last Login</b></td><td>${esc(u.lastLogin)}</td></tr>
      </table>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" id="ok-reset-mfa">Reset MFA</button>
        <button class="btn btn-sm" id="ok-suspend">${u.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</button>
        <button class="btn btn-sm" id="ok-unlock" ${u.status === 'Locked Out' ? '' : 'disabled'}>Unlock</button>
      </div>`);
    m.querySelector('#ok-reset-mfa').onclick = () => { u.mfa = 'None'; toast('MFA reset for ' + u.name); m.close(); render(); };
    m.querySelector('#ok-suspend').onclick = () => { u.status = u.status === 'Suspended' ? 'Active' : 'Suspended'; toast(u.status === 'Suspended' ? 'User suspended' : 'User reactivated'); m.close(); render(); };
    const ub = m.querySelector('#ok-unlock'); if (ub) ub.onclick = () => { u.status = 'Active'; toast('User unlocked'); m.close(); render(); };
  }

  function renderGroups(c) {
    c.innerHTML = `<table class="data"><thead><tr><th>Group</th><th>Description</th><th>Members</th></tr></thead>
      <tbody>${OKTA_GROUPS.map(g => `<tr><td><b>${esc(g.name)}</b></td><td>${esc(g.desc)}</td><td>${g.members}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderApps(c) {
    c.innerHTML = `<table class="data"><thead><tr><th>Application</th><th>Category</th><th>SSO</th><th>Status</th><th>Assigned</th></tr></thead>
      <tbody>${OKTA_APPS.map(a => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.category)}</td><td>${esc(a.sso)}</td>
        <td>${statusBadge(a.status)}</td><td>${a.assigned}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderPolicies(c) {
    c.innerHTML = `<table class="data"><thead><tr><th>Policy</th><th>Rule</th><th>Status</th></tr></thead>
      <tbody>${OKTA_POLICIES.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.rule)}</td><td>${statusBadge(p.status)}</td></tr>`).join('')}</tbody></table>`;
  }

  render();
}
