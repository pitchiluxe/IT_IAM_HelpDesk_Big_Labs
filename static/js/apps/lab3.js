import { API } from '../api.js';
import { toast } from '../wm.js';
import { modal, esc } from './lab1.js';

const CATEGORIES = ['Account & Access', 'MFA / Identity', 'Hardware', 'Software', 'Network', 'Security', 'Request'];
const STATUSES = ['New', 'Assigned', 'In Progress', 'Pending User', 'Resolved', 'Closed', 'Reopened'];
const GROUPS = ['L1 Help Desk', 'L2 IAM', 'L2/L3 Infrastructure', 'Security'];

// Priority color coding (matching the reference app)
const PRIORITY_COLORS = {
  P1: { bg: '#2a1414', border: '#ef4444', badge: '#ef4444', emoji: '🔴', rank: 0, sla: 2 * 3600 * 1000 },     // 2 hours
  P2: { bg: '#2a1f14', border: '#f97316', badge: '#f97316', emoji: '🟠', rank: 1, sla: 8 * 3600 * 1000 },     // 8 hours
  P3: { bg: '#14181f', border: '#3b82f6', badge: '#3b82f6', emoji: '🔵', rank: 2, sla: 24 * 3600 * 1000 },   // 24 hours
  P4: { bg: '#18191b', border: '#6b7280', badge: '#6b7280', emoji: '⚪', rank: 3, sla: 72 * 3600 * 1000 },   // 72 hours
};

const KIND_EMOJI = {
  'password-reset': '🔑', 'mfa-issue': '📱', 'onboarding': '🔓', 'termination': '⚰️',
  'access-request': '🔐', 'incident': '⚠️', 'transfer': '🔀', 'Account & Access': '🔐',
  'MFA / Identity': '📱', 'Hardware': '🖥️', 'Software': '💿', 'Network': '🌐',
  'Security': '🔒', 'Request': '📝',
};

const TICKET_TEMPLATES = [
  { kind: 'password-reset', label: 'Password Reset', emoji: '🔑', priority: 'P2', cat: 'Account & Access', subject: 'Password reset request', body: 'User locked out after multiple failed login attempts. Verify identity, reset password, communicate securely.' },
  { kind: 'mfa-issue', label: 'MFA Issue', emoji: '📱', priority: 'P2', cat: 'MFA / Identity', subject: 'MFA device problem', body: 'User reports repeated MFA prompts or lost device. Verify, reset MFA, audit recent sign-ins.' },
  { kind: 'onboarding', label: 'New Hire', emoji: '🔓', priority: 'P3', cat: 'Request', subject: 'Onboard new team member', body: 'Provision account, assign to department group, schedule orientation.' },
  { kind: 'termination', label: 'Termination', emoji: '⚰️', priority: 'P1', cat: 'Security', subject: 'Terminate employee access', body: 'Disable account, revoke active sessions, remove from all groups.' },
  { kind: 'access-request', label: 'Access Request', emoji: '🔐', priority: 'P3', cat: 'Account & Access', subject: 'Application access request', body: 'User requests access to additional app/role. Verify justification, check least-privilege.' },
  { kind: 'incident', label: 'Security Incident', emoji: '⚠️', priority: 'P1', cat: 'Security', subject: 'Possible security incident', body: 'Suspicious activity detected. Triage, contain, document, and escalate per IR plan.' },
];

function formatElapsed(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

function formatSLA(createdAt, priority) {
  const sla = PRIORITY_COLORS[priority]?.sla;
  if (!sla) return null;
  const created = new Date(createdAt).getTime();
  const remaining = sla - (Date.now() - created);
  if (remaining <= 0) return { text: '⚠️ OVERDUE', color: '#ef4444', overdue: true };
  const min = Math.floor(remaining / 60000), sec = Math.floor((remaining % 60000) / 1000);
  const pct = remaining / sla;
  const color = pct > 0.5 ? '#3b82f6' : pct > 0.25 ? '#d7ba7d' : '#ef4444';
  return { text: `⏱️ ${min}m ${String(sec).padStart(2, '0')}s`, color };
}

function statusColor(s) {
  return { 'New': 'badge-info', 'Assigned': 'badge-info', 'In Progress': 'badge-info', 'Pending User': 'badge-warn',
    'Resolved': 'badge-ok', 'Closed': 'badge-ok', 'Reopened': 'badge-warn' }[s] || 'badge-info';
}

// ============ Service Desk Console ============
export function openServiceDesk(body) {
  let sortMode = 'priority';
  let filterKind = 'all';
  let searchQuery = '';
  let allTickets = [];
  const selectedIds = new Set();
  const reviews = new Map();
  const expandedNotes = new Set();
  let slaInterval = null;

  body.innerHTML = `
    <div class="app" style="height:100%;display:flex;flex-direction:column">
      <div class="app-toolbar" style="gap:6px">
        <h2>🎫 Service Desk</h2>
        <span class="muted">— Ticket Queue</span>
        <div class="spacer"></div>
        <span id="sd-ollama-status" style="font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #ddd;cursor:help" title="Ollama AI status">⏳ Ollama…</span>
        <button class="btn btn-sm btn-primary" id="sd-gen">🤖 Generate Work</button>
        <button class="btn btn-sm" id="sd-gen-multi" title="Generate multiple tickets at once">🤖 Generate 5</button>
        <button class="btn btn-sm" id="sd-new">➕ New</button>
        <button class="btn btn-sm" id="sd-refresh">↻</button>
      </div>
      <div class="app-body" id="sd-body" style="overflow-y:auto;padding:8px"></div>
    </div>`;

  const wrap = body.querySelector('#sd-body');

  // Check Ollama status and update the badge
  (async () => {
    const badge = body.querySelector('#sd-ollama-status');
    if (!badge) return;
    try {
      const r = await fetch('/api/ollama/status', { credentials: 'same-origin' });
      const d = await r.json();
      if (d.available) {
        badge.textContent = '🟢 Ollama: ' + (d.model || 'ready');
        badge.style.borderColor = '#2ecc71';
        badge.style.color = '#2ecc71';
        badge.title = `Ollama is running (${d.model}). Ticket prose will be AI-generated.`;
      } else {
        badge.textContent = '⚪ Ollama: offline';
        badge.style.borderColor = '#ccc';
        badge.style.color = '#888';
        badge.title = 'Ollama is not running. Tickets will use built-in scenarios. Install Ollama and run "ollama serve" for AI-generated tickets.';
      }
    } catch {
      badge.textContent = '⚪ Ollama: offline';
      badge.style.borderColor = '#ccc';
      badge.style.color = '#888';
    }
  })();

  async function load() {
    try {
      const d = await API.lab3Tickets();
      allTickets = d.tickets;
      render();
    } catch (e) {
      wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`;
    }
  }

  function sortTickets(tickets) {
    const copy = [...tickets];
    if (sortMode === 'priority') {
      copy.sort((a, b) => (PRIORITY_COLORS[a.priority]?.rank || 9) - (PRIORITY_COLORS[b.priority]?.rank || 9) || new Date(b.created_time) - new Date(a.created_time));
    } else if (sortMode === 'created') {
      copy.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));
    } else if (sortMode === 'status') {
      copy.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
    }
    return copy;
  }

  function render() {
    let open = allTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
    const resolved = allTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');

    // Apply filter
    if (filterKind !== 'all') {
      open = open.filter(t => t.category === filterKind || t.subcategory === filterKind);
    }
    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      open = open.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    open = sortTickets(open);

    // Priority counts
    const pcounts = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const t of allTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed')) pcounts[t.priority] = (pcounts[t.priority] || 0) + 1;
    const breakdown = Object.entries(PRIORITY_COLORS).filter(([p]) => pcounts[p] > 0)
      .map(([p, c]) => `<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;background:${c.bg};border:1px solid ${c.border};font-size:10px;color:${c.border}">${c.emoji} ${pcounts[p]} ${p}</span>`).join(' ');

    let html = `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:8px">
        <span style="font-size:18px">🎫</span>
        <div style="flex:1">
          <div style="font-size:13px;color:var(--accent);font-weight:600">${open.length} open · ${resolved.length} resolved</div>
          <div style="font-size:11px;color:#888;margin-top:1px">${open.length > 0 ? 'Work the queue below' : resolved.length > 0 ? 'All tickets resolved — great work!' : 'No tickets yet — use Generate Work or New to raise one.'}</div>
          ${open.length > 0 ? `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">${breakdown}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;padding:6px 8px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <input type="text" id="sd-search" placeholder="🔍 Search subject / body…" value="${esc(searchQuery)}"
            style="flex:1;min-width:160px;border:1px solid #ccc;border-radius:3px;padding:4px 8px;font-size:12px">
          <span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Sort:</span>
          <select id="sd-sort" style="border:1px solid #ccc;border-radius:3px;padding:3px 6px;font-size:11px;cursor:pointer">
            <option value="priority" ${sortMode === 'priority' ? 'selected' : ''}>Priority (P1 → P4)</option>
            <option value="created" ${sortMode === 'created' ? 'selected' : ''}>Created (Newest)</option>
            <option value="status" ${sortMode === 'status' ? 'selected' : ''}>Status (Open First)</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin-right:4px">Filter:</span>
          ${['all', ...CATEGORIES].map(fk => {
            const isActive = fk === filterKind;
            const count = fk === 'all' ? open.length : allTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed' && (t.category === fk || t.subcategory === fk)).length;
            const emoji = fk === 'all' ? '📋' : (KIND_EMOJI[fk] || '🎫');
            return `<button class="sd-chip" data-filter="${fk}" style="background:${isActive ? 'var(--accent)' : '#fff'};color:${isActive ? '#fff' : '#666'};border:1px solid ${isActive ? 'var(--accent)' : '#ddd'};border-radius:12px;padding:2px 10px;font-size:11px;cursor:pointer;font-weight:${isActive ? '600' : '400'}">${emoji} ${fk === 'all' ? 'All' : fk} (${count})</button>`;
          }).join('')}
        </div>
      </div>`;

    if (selectedIds.size > 0) {
      html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(59,130,246,0.08);border:1px solid var(--accent);border-radius:3px;margin-bottom:8px">
        <span style="color:var(--accent);font-size:12px;font-weight:600">${selectedIds.size} selected</span>
        <button class="btn btn-sm btn-primary" id="sd-bulk-resolve">✓ Resolve all</button>
        <button class="btn btn-sm" id="sd-bulk-assign">👤 Assign all to me</button>
        <button class="btn btn-sm" id="sd-bulk-clear">Clear</button>
      </div>`;
    }

    if (open.length === 0 && allTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length > 0) {
      html += `<div style="text-align:center;padding:24px 12px;color:#888;font-size:13px;border:1px dashed #ddd;border-radius:4px">No tickets match your search/filter.</div>`;
    }

    // Open ticket cards
    for (const t of open) {
      const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.P4;
      const sla = formatSLA(t.created_time, t.priority);
      const isSelected = selectedIds.has(t.id);
      const kindColor = { 'Account & Access': '#a78bfa', 'MFA / Identity': '#fb923c', 'Security': '#ef4444', 'Request': '#3b82f6' }[t.category] || '#888';
      const kindEm = KIND_EMOJI[t.subcategory] || KIND_EMOJI[t.category] || '🎫';
      const elapsed = formatElapsed(Date.now() - new Date(t.created_time).getTime());
      const review = reviews.get(t.id);

      html += `<div class="ticket-card" data-tid="${t.id}" style="background:${pc.bg};border:1px solid ${isSelected ? 'var(--accent)' : '#e0e0e0'};border-left:3px solid ${pc.border};border-radius:4px;padding:10px 12px;margin-bottom:8px;font-size:12px;position:relative;${isSelected ? 'box-shadow:0 0 0 1px var(--accent)' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:6px;flex:1">
            <input type="checkbox" class="tix-cb" data-tid="${t.id}" ${isSelected ? 'checked' : ''} style="cursor:pointer">
            <span style="font-weight:600;flex:1;color:#f0f0f0">${esc(t.ticket_number)} — ${esc(t.title)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${sla ? `<span data-sla-for="${t.id}" style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;background:${sla.color}22;border:1px solid ${sla.color};color:${sla.color};font-size:10px;font-weight:600">${sla.text}</span>` : ''}
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:3px;background:${pc.badge};color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">${pc.emoji} ${t.priority}</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:6px;margin-bottom:6px">
          <span style="color:${kindColor};font-size:10px;text-transform:uppercase;letter-spacing:0.05em">${kindEm} ${esc(t.subcategory || t.category || '')}</span>
          <span data-age-for="${t.id}" style="color:#aaa;font-size:10px">${t.assigned_agent ? `👤 ${esc(t.assigned_agent)}` : 'Unassigned'} · ⏱️ ${elapsed}</span>
        </div>
        <div style="color:#d0d0d0;margin-bottom:8px">${esc(t.description || '')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm" data-act="assign" data-tid="${t.id}">Assign to me</button>
          <button class="btn btn-sm btn-primary" data-act="resolve" data-tid="${t.id}">Resolve</button>
          <button class="btn btn-sm" data-act="escalate" data-tid="${t.id}" style="border-color:#f97316;color:#f97316">⚠️ Escalate</button>
          <button class="btn btn-sm" data-act="notes" data-tid="${t.id}">${expandedNotes.has(t.id) ? '▼' : '▶'} Notes</button>
          <button class="btn btn-sm" data-act="detail" data-tid="${t.id}">📋 Details</button>
        </div>`;

      // Review panel
      if (review) {
        const ok = review.passed;
        html += `<div style="margin-top:10px;padding:10px 12px;border-radius:6px;font-size:11.5px;line-height:1.6;border:1px solid ${ok ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)'};background:#f9f9f9">
          <div style="font-weight:600;margin-bottom:6px;color:${ok ? '#2ecc71' : '#e74c3c'}">${ok ? '✓ Review passed' : '✗ Review found outstanding work'}</div>
          <div style="color:#444;white-space:pre-wrap;margin-bottom:8px">${esc(review.summary)}</div>`;
        for (const check of review.checks) {
          html += `<div style="display:flex;gap:7px;align-items:flex-start;color:#888;margin-top:3px"><span style="flex-shrink:0;color:${check.passed ? '#2ecc71' : '#e74c3c'}">${check.passed ? '✓' : '✗'}</span><span>${esc(check.label)} — ${esc(check.detail)}</span></div>`;
        }
        html += `<div style="color:#888;opacity:0.7;margin-top:8px;font-size:10.5px">${review.source === 'ollama' ? 'Checks run against the directory; feedback written by Ollama.' : 'Checks run against the directory. Written feedback needs Ollama.'}</div></div>`;
      }

      // Notes section
      if (expandedNotes.has(t.id)) {
        html += `<div style="margin-top:8px;padding:8px;background:#f5f5f5;border-radius:4px" id="notes-${t.id}"><div style="font-size:11px;color:#888;margin-bottom:4px">Loading notes…</div></div>`;
      }

      html += `</div>`;
    }

    // Resolved tickets (collapsed)
    if (resolved.length > 0) {
      html += `<details style="margin-top:12px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:#666;padding:6px">✓ Resolved (${resolved.length})</summary>`;
      for (const t of resolved) {
        const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.P4;
        html += `<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-left:3px solid ${pc.border};border-radius:4px;padding:6px 10px;margin-bottom:4px;font-size:11px;display:flex;align-items:center;gap:6px">
          <span style="font-weight:600">${esc(t.ticket_number)}</span>
          <span style="flex:1">${esc(t.title)}</span>
          <span style="color:#888">${esc(t.priority)}</span>
          <button class="btn btn-sm" data-act="detail" data-tid="${t.id}">View</button>
        </div>`;
      }
      html += `</details>`;
    }

    wrap.innerHTML = html;

    // Wire up events
    const search = wrap.querySelector('#sd-search');
    if (search) {
      search.oninput = () => { searchQuery = search.value; render(); };
      // Preserve focus after re-render
      if (searchQuery) search.focus();
    }
    const sortSel = wrap.querySelector('#sd-sort');
    if (sortSel) sortSel.onchange = () => { sortMode = sortSel.value; render(); };

    wrap.querySelectorAll('.sd-chip').forEach(c => c.onclick = () => { filterKind = c.dataset.filter; render(); });
    wrap.querySelectorAll('.tix-cb').forEach(cb => cb.onchange = () => {
      const id = parseInt(cb.dataset.tid);
      if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
      render();
    });
    wrap.querySelectorAll('[data-act]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const act = b.dataset.act, tid = parseInt(b.dataset.tid);
      if (act === 'assign') assignTicket(tid);
      else if (act === 'resolve') resolveTicket(tid);
      else if (act === 'escalate') escalateTicket(tid);
      else if (act === 'notes') toggleNotes(tid);
      else if (act === 'detail') ticketDetail(tid);
    });
    wrap.querySelectorAll('.ticket-card').forEach(c => c.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      ticketDetail(parseInt(c.dataset.tid));
    });

    const bulkResolve = wrap.querySelector('#sd-bulk-resolve');
    if (bulkResolve) bulkResolve.onclick = () => bulkAction('resolve');
    const bulkAssign = wrap.querySelector('#sd-bulk-assign');
    if (bulkAssign) bulkAssign.onclick = () => bulkAction('assign');
    const bulkClear = wrap.querySelector('#sd-bulk-clear');
    if (bulkClear) bulkClear.onclick = () => { selectedIds.clear(); render(); };

    // Load expanded notes
    expandedNotes.forEach(tid => loadNotes(tid));
  }

  async function assignTicket(tid) {
    try {
      await API.lab3UpdateTicket(tid, { assigned_agent: 'admin', status: 'Assigned' });
      toast('Ticket assigned to you');
      load();
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function escalateTicket(tid) {
    try {
      await API.lab3UpdateTicket(tid, { priority: 'P1', assignment_group: 'L2 IAM' });
      toast('Escalated to urgent / L2 IAM');
      load();
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function resolveTicket(tid) {
    const t = allTickets.find(x => x.id === tid);
    if (!t) return;
    const m = modal(body, 'Resolve Ticket', `
      <div class="form-row"><label>Resolution summary</label><textarea class="field" id="rt-res" rows="4" placeholder="Document what you investigated and what you did to resolve this ticket…"></textarea></div>`);
    m.save.onclick = async () => {
      try {
        const res = m.q('#rt-res').value;
        await API.lab3UpdateTicket(tid, { status: 'Resolved', resolution: res });
        m.close();
        toast('Ticket resolved');
        // Run AI review
        try {
          reviews.set(tid, 'pending');
          const review = await API.lab3ReviewTicket(tid);
          reviews.set(tid, review);
          render();
        } catch (e) {
          reviews.delete(tid);
        }
        load();
      } catch (e) { m.err(e.message); }
    };
  }

  async function bulkAction(act) {
    let done = 0;
    for (const id of [...selectedIds]) {
      try {
        if (act === 'resolve') {
          await API.lab3UpdateTicket(id, { status: 'Resolved', resolution: 'Bulk resolved' });
          // AI review
          try { const r = await API.lab3ReviewTicket(id); reviews.set(id, r); } catch {}
        } else if (act === 'assign') {
          await API.lab3UpdateTicket(id, { assigned_agent: 'admin', status: 'Assigned' });
        }
        done++;
      } catch {}
    }
    selectedIds.clear();
    toast(`${act === 'resolve' ? 'Resolved' : 'Assigned'} ${done} ticket(s)`);
    load();
  }

  async function toggleNotes(tid) {
    if (expandedNotes.has(tid)) expandedNotes.delete(tid);
    else expandedNotes.add(tid);
    render();
  }

  async function loadNotes(tid) {
    const el = wrap.querySelector(`#notes-${tid}`);
    if (!el) return;
    try {
      const d = await API.lab3Ticket(tid);
      let html = '<div style="font-size:11px;font-weight:600;margin-bottom:4px">Work Notes</div>';
      for (const n of d.notes) {
        html += `<div style="background:#fff;border-left:3px solid var(--accent);padding:4px 8px;margin:4px 0;border-radius:0 3px 3px 0;font-size:11px"><div style="font-size:10px;color:#888;margin-bottom:2px">${esc(n.created_by)} · ${esc(n.created_time)}</div>${esc(n.note_text)}</div>`;
      }
      html += `<div style="display:flex;gap:4px;margin-top:6px"><input class="field" id="note-input-${tid}" placeholder="Add work note…" style="flex:1;font-size:11px"><button class="btn btn-sm btn-primary" id="note-add-${tid}">Add</button></div>`;
      el.innerHTML = html;
      const addBtn = el.querySelector(`#note-add-${tid}`);
      const input = el.querySelector(`#note-input-${tid}`);
      if (addBtn) addBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;
        try { await API.lab3Note(tid, text); input.value = ''; loadNotes(tid); } catch (e) { toast('Error: ' + e.message); }
      };
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') addBtn.click(); };
    } catch (e) {
      el.innerHTML = `<div style="font-size:11px;color:#e74c3c">Error loading notes: ${esc(e.message)}</div>`;
    }
  }

  async function ticketDetail(tid) {
    try {
      const d = await API.lab3Ticket(tid);
      const t = d.ticket;
      const m = modal(body, `${t.ticket_number} — ${t.title}`, `
        <div style="font-size:12px;line-height:1.7">
          <div><b>Status:</b> ${esc(t.status)} | <b>Priority:</b> ${esc(t.priority)} | <b>Category:</b> ${esc(t.category || '')}</div>
          <div><b>Assigned to:</b> ${esc(t.assigned_agent || 'Unassigned')} | <b>Group:</b> ${esc(t.assignment_group || '')}</div>
          <div><b>Requester:</b> ${esc(t.requester || '')}</div>
          <div><b>Created:</b> ${esc(t.created_time)} | <b>SLA Target:</b> ${esc((t.sla_target || '').slice(0, 16))}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:8px 0">
          <div><b>Description:</b></div><div style="color:#555;margin-top:4px">${esc(t.description || '')}</div>
          ${t.resolution ? `<div style="margin-top:8px"><b>Resolution:</b></div><div style="color:#555;margin-top:4px">${esc(t.resolution)}</div>` : ''}
          <div style="margin-top:12px"><b>Work Notes (${d.notes.length}):</b></div>
          ${d.notes.map(n => `<div style="background:#f7f9fc;border-left:3px solid var(--accent);padding:6px 10px;margin:4px 0;border-radius:0 4px 4px 0;font-size:11px"><div style="font-size:10px;color:#888;margin-bottom:2px">${esc(n.created_by)} · ${esc(n.created_time)}</div>${esc(n.note_text)}</div>`).join('') || '<div style="color:#888;font-size:11px">No notes yet</div>'}
        </div>`);
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function newTicket() {
    // Quick-create with templates
    const m = modal(body, 'New Ticket', `
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
        ${TICKET_TEMPLATES.map((t, i) => `<button class="btn btn-sm tmpl-btn" data-tmpl="${i}" style="font-size:11px">${t.emoji} ${t.label}</button>`).join('')}
      </div>
      <div class="form-row"><label>Title</label><input class="field" id="nt-title"></div>
      <div class="form-row"><label>Description</label><textarea class="field" id="nt-desc" rows="3"></textarea></div>
      <div class="form-row"><label>Category</label><select class="field" id="nt-cat">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="form-row"><label>Subcategory</label><input class="field" id="nt-sub"></div>
      <div class="form-row"><label>Impact</label><select class="field" id="nt-imp"><option>High</option><option>Medium</option><option>Low</option></select></div>
      <div class="form-row"><label>Urgency</label><select class="field" id="nt-urg"><option>High</option><option>Medium</option><option>Low</option></select></div>
      <div class="form-row"><label>Assignment group</label><select class="field" id="nt-grp">${GROUPS.map(g => `<option>${g}</option>`).join('')}</select></div>`);
    m.querySelectorAll('.tmpl-btn').forEach(b => b.onclick = () => {
      const t = TICKET_TEMPLATES[parseInt(b.dataset.tmpl)];
      m.q('#nt-title').value = t.subject;
      m.q('#nt-desc').value = t.body;
      m.q('#nt-cat').value = t.cat;
      m.q('#nt-sub').value = t.kind;
      if (t.priority === 'P1') { m.q('#nt-imp').value = 'High'; m.q('#nt-urg').value = 'High'; }
      else if (t.priority === 'P2') { m.q('#nt-imp').value = 'Medium'; m.q('#nt-urg').value = 'High'; }
      else { m.q('#nt-imp').value = 'Low'; m.q('#nt-urg').value = 'Medium'; }
    });
    m.save.onclick = async () => {
      try {
        await API.lab3CreateTicket({
          title: m.q('#nt-title').value, description: m.q('#nt-desc').value,
          category: m.q('#nt-cat').value, subcategory: m.q('#nt-sub').value,
          impact: m.q('#nt-imp').value, urgency: m.q('#nt-urg').value,
          assignment_group: m.q('#nt-grp').value,
        });
        m.close();
        toast('Ticket created');
        load();
      } catch (e) { m.err(e.message); }
    };
  }

  async function generateWork(count) {
    const btn = body.querySelector(count > 1 ? '#sd-gen-multi' : '#sd-gen');
    const orig = btn.textContent;
    btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '🤖 Generating…';
    try {
      const r = await fetch('/api/lab3/generate-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ count: count || 1 }),
      });
      const res = await r.json();
      if (res.raised > 1) {
        toast(`Raised ${res.raised} tickets${res.used_ollama ? ' (written by Ollama)' : ''}`);
      } else {
        const t = (res.tickets || [])[0];
        toast(`Raised ${t?.ticket_number || 'ticket'}${res.used_ollama ? ' (written by Ollama)' : ''}`);
      }
      load();
    } catch (e) {
      toast('Could not generate work: ' + e.message);
    } finally {
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = orig;
    }
  }

  body.querySelector('#sd-refresh').onclick = load;
  body.querySelector('#sd-new').onclick = newTicket;
  body.querySelector('#sd-gen').onclick = () => generateWork(1);
  body.querySelector('#sd-gen-multi').onclick = () => generateWork(5);

  // SLA tick — update badges every second without full re-render
  slaInterval = setInterval(() => {
    if (!document.contains(body)) { clearInterval(slaInterval); return; }
    wrap.querySelectorAll('[data-sla-for]').forEach(el => {
      const t = allTickets.find(x => x.id === parseInt(el.dataset.slaFor));
      if (!t) return;
      const sla = formatSLA(t.created_time, t.priority);
      if (!sla) { el.remove(); return; }
      el.textContent = sla.text;
      el.style.background = sla.color + '22';
      el.style.borderColor = sla.color;
      el.style.color = sla.color;
    });
    wrap.querySelectorAll('[data-age-for]').forEach(el => {
      const t = allTickets.find(x => x.id === parseInt(el.dataset.ageFor));
      if (!t) return;
      const who = t.assigned_agent ? `👤 ${t.assigned_agent}` : 'Unassigned';
      el.textContent = `${who} · ⏱️ ${formatElapsed(Date.now() - new Date(t.created_time).getTime())}`;
    });
  }, 1000);

  load();
}


// ============ Knowledge Base ============
export function openKnowledgeBase(body) {
  body.innerHTML = `
    <div class="app">
      <div class="app-toolbar"><h2>📚 Knowledge Base</h2><div class="spacer"></div>
        <button class="btn btn-sm btn-primary" id="kb-new">+ New Article</button></div>
      <div class="app-body" id="kb-body" style="padding:10px"></div>
    </div>`;
  async function load() {
    const d = await API.lab3Kb();
    render(d.articles || d);
  }
  function render(articles) {
    const c = body.querySelector('#kb-body');
    if (!articles.length) { c.innerHTML = '<div class="empty">No KB articles yet.</div>'; return; }
    c.innerHTML = articles.map(a => `<div class="kb-article" data-kid="${a.id}" style="cursor:pointer">
      <h3 style="margin:0 0 4px">${esc(a.kb_number)} — ${esc(a.title)}</h3>
      <div class="muted">${esc(a.category || '')}</div>
      <div style="margin-top:6px;font-size:12px;color:#555;line-height:1.6">${esc((a.content || '').slice(0, 200))}${(a.content || '').length > 200 ? '…' : ''}</div>
    </div>`).join('');
    c.querySelectorAll('.kb-article').forEach(el => el.onclick = () => viewArticle(parseInt(el.dataset.kid)));
  }
  async function viewArticle(id) {
    const d = await API.lab3Kb();
    const a = (d.articles || d).find(x => x.id === id);
    if (!a) return;
    modal(body, `${a.kb_number} — ${a.title}`, `<div class="kb-article" style="padding:0">${esc(a.content || '')}</div>`);
  }
  body.querySelector('#kb-new').onclick = () => {
    const m = modal(body, 'New KB Article', `
      <div class="form-row"><label>Title</label><input class="field" id="ka-title"></div>
      <div class="form-row"><label>Category</label><input class="field" id="ka-cat"></div>
      <div class="form-row"><label>Content</label><textarea class="field" id="ka-content" rows="8"></textarea></div>`);
    m.save.onclick = async () => {
      try {
        await API.lab3CreateKb({ title: m.q('#ka-title').value, category: m.q('#ka-cat').value, content: m.q('#ka-content').value });
        m.close(); toast('KB article created'); load();
      } catch (e) { m.err(e.message); }
    };
  };
  load();
}


// ============ Reports Dashboard ============
export function openReports(body) {
  body.innerHTML = `<div class="app"><div class="app-toolbar"><h2>📊 Reports Dashboard</h2></div><div class="app-body" id="rp-body" style="padding:10px"></div></div>`;
  async function load() {
    const d = await API.lab3Reports();
    const c = body.querySelector('#rp-body');
    c.innerHTML = `
      <div class="report-grid">
        <div class="report-card"><h3>Total Tickets</h3><div class="big">${d.total}</div></div>
        <div class="report-card"><h3>Escalated</h3><div class="big" style="color:#f97316">${d.escalated}</div></div>
        <div class="report-card"><h3>Reopened</h3><div class="big" style="color:#e74c3c">${d.reopened}</div></div>
      </div>
      <div style="margin-top:12px">
        <h3 style="font-size:13px;margin-bottom:6px">By Category</h3>
        ${d.by_category.map(r => `<div class="report-row"><span>${esc(r.category)}</span><b>${r.c}</b></div>`).join('')}
      </div>
      <div style="margin-top:12px">
        <h3 style="font-size:13px;margin-bottom:6px">By Priority</h3>
        ${d.by_priority.map(r => `<div class="report-row"><span>${esc(r.priority)}</span><b>${r.c}</b></div>`).join('')}
      </div>
      <div style="margin-top:12px">
        <h3 style="font-size:13px;margin-bottom:6px">By Status</h3>
        ${d.by_status.map(r => `<div class="report-row"><span>${esc(r.status)}</span><b>${r.c}</b></div>`).join('')}
      </div>`;
  }
  load();
}
