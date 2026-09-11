// API client for Lab VM
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { location.reload(); throw new Error('Unauthorized'); }
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.detail || data.raw || `HTTP ${res.status}`);
  return data;
}

export const API = {
  // generic
  get: (path) => api(path),
  post: (path, body) => api(path, { method: 'POST', body }),
  put: (path, body) => api(path, { method: 'PUT', body }),
  patch: (path, body) => api(path, { method: 'PATCH', body }),
  del: (path) => api(path, { method: 'DELETE' }),
  // auth
  login: (u, p) => api('/api/login', { method: 'POST', body: { username: u, password: p } }),
  logout: () => api('/api/logout', { method: 'POST' }),
  me: () => api('/api/me'),
  // lab1
  lab1Users: () => api('/api/lab1/users'),
  lab1CreateUser: (b) => api('/api/lab1/users', { method: 'POST', body: b }),
  lab1UpdateUser: (id, b) => api(`/api/lab1/users/${id}`, { method: 'PATCH', body: b }),
  lab1DeleteUser: (id) => api(`/api/lab1/users/${id}`, { method: 'DELETE' }),
  lab1Groups: () => api('/api/lab1/groups'),
  lab1CreateGroup: (b) => api('/api/lab1/groups', { method: 'POST', body: b }),
  lab1AddMember: (gid, uid) => api(`/api/lab1/groups/${gid}/members`, { method: 'POST', body: { user_id: uid } }),
  lab1RemoveMember: (gid, uid) => api(`/api/lab1/groups/${gid}/members/${uid}`, { method: 'DELETE' }),
  lab1Folders: () => api('/api/lab1/folders'),
  lab1CreateFolder: (b) => api('/api/lab1/folders', { method: 'POST', body: b }),
  lab1AddAcl: (fid, b) => api(`/api/lab1/folders/${fid}/acls`, { method: 'POST', body: b }),
  lab1RemoveAcl: (fid, aid) => api(`/api/lab1/folders/${fid}/acls/${aid}`, { method: 'DELETE' }),
  lab1EffectiveAccess: (fid, uid) => api(`/api/lab1/effective-access?folder_id=${fid}&user_id=${uid}`),
  lab1TestAccess: (b) => api('/api/lab1/test-access', { method: 'POST', body: b }),
  // lab2
  lab2Users: () => api('/api/lab2/users'),
  lab2CreateUser: (b) => api('/api/lab2/users', { method: 'POST', body: b }),
  lab2UpdateUser: (id, b) => api(`/api/lab2/users/${id}`, { method: 'PATCH', body: b }),
  lab2Groups: () => api('/api/lab2/groups'),
  lab2CreateGroup: (b) => api('/api/lab2/groups', { method: 'POST', body: b }),
  lab2AddMember: (gid, uid) => api(`/api/lab2/groups/${gid}/members`, { method: 'POST', body: { user_id: uid } }),
  lab2RemoveMember: (gid, uid) => api(`/api/lab2/groups/${gid}/members/${uid}`, { method: 'DELETE' }),
  lab2RegisterMfa: (uid, b) => api(`/api/lab2/users/${uid}/mfa`, { method: 'POST', body: b }),
  lab2RemoveMfa: (uid, mid) => api(`/api/lab2/users/${uid}/mfa/${mid}`, { method: 'DELETE' }),
  lab2MfaReset: (uid) => api(`/api/lab2/users/${uid}/mfa-reset`, { method: 'POST' }),
  lab2Policies: () => api('/api/lab2/policies'),
  lab2CreatePolicy: (b) => api('/api/lab2/policies', { method: 'POST', body: b }),
  lab2UpdatePolicy: (id, b) => api(`/api/lab2/policies/${id}`, { method: 'PATCH', body: b }),
  lab2Signins: (uid) => api(`/api/lab2/signins${uid ? '?user_id=' + uid : ''}`),
  lab2GenSignin: (b) => api('/api/lab2/signins/generate', { method: 'POST', body: b }),
  // lab3
  lab3Tickets: (status) => api('/api/lab3/tickets' + (status ? '?status=' + status : '')),
  lab3CreateTicket: (b) => api('/api/lab3/tickets', { method: 'POST', body: b }),
  lab3Ticket: (id) => api(`/api/lab3/tickets/${id}`),
  lab3Note: (id, text) => api(`/api/lab3/tickets/${id}/note`, { method: 'POST', body: { note_text: text } }),
  lab3UpdateTicket: (id, b) => api(`/api/lab3/tickets/${id}`, { method: 'PATCH', body: b }),
  lab3Kb: () => api('/api/lab3/kb'),
  lab3CreateKb: (b) => api('/api/lab3/kb', { method: 'POST', body: b }),
  lab3Reports: () => api('/api/lab3/reports'),
  lab3ReviewTicket: (id) => api(`/api/lab3/tickets/${id}/review`, { method: 'POST' }),
  lab3GenerateWork: () => api('/api/lab3/generate-work', { method: 'POST' }),
  // ollama
  ollamaStatus: () => api('/api/ollama/status'),
  ollamaChat: (messages, model) => api('/api/ollama/chat', { method: 'POST', body: { messages, model } }),
  // browser proxy
  browse: (url) => api('/api/browse?url=' + encodeURIComponent(url)),
  // updates
  checkUpdate: () => api('/api/check-update'),
  applyUpdate: () => api('/api/apply-update', { method: 'POST' }),
};
