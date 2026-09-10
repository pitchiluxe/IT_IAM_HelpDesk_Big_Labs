import { toast } from '../wm.js';
import { esc } from './lab1.js';

const LABS = [
  {
    id: 'lab1',
    title: 'Lab 1: Windows Local Users & Access Management',
    icon: '🖥️',
    color: '#0a84ff',
    description: 'Learn Windows local user lifecycle, groups, NTFS permissions, and access troubleshooting.',
    app: 'lusrmgr',
    steps: [
      { title: 'Open Local Users and Groups', detail: 'Double-click the "Local Users" icon on the desktop. This opens lusrmgr.msc — the Windows local user management console.', action: 'lusrmgr' },
      { title: 'Review seeded users', detail: 'You will see 7 local users: LabAdmin, HelpDeskUser, FinanceTest, ITUser01, TermUser, LockedUser, ExpiredPwd. Note their status (enabled, locked, expired).', action: 'lusrmgr' },
      { title: 'Identify the locked account', detail: 'Find "LockedUser" — the account is locked out. In a real job, this happens when a user enters wrong passwords too many times.', action: 'lusrmgr' },
      { title: 'Unlock the locked account', detail: 'Select LockedUser, click "Unlock", and confirm. This simulates the real Windows action of unchecking "Account is locked out".', action: 'lusrmgr' },
      { title: 'Find the disabled user still in a group', detail: 'Look at TermUser — this is a terminated employee. Check their group memberships. They are still in FinanceUsers, which is a security issue.', action: 'lusrmgr' },
      { title: 'Remove TermUser from FinanceUsers', detail: 'Select TermUser, go to Groups, and remove them from FinanceUsers. This is part of the offboarding process.', action: 'lusrmgr' },
      { title: 'Fix the expired password', detail: 'Find ExpiredPwd — their password is expired. Reset their password to a new value. This clears the expired flag.', action: 'lusrmgr' },
      { title: 'Create a new local user', detail: 'Click "New User" and create a test user with username "TestUser01", full name "Test User One", and a password. This simulates onboarding.', action: 'lusrmgr' },
      { title: 'Open File Explorer', detail: 'Double-click "File Explorer" on the desktop. Navigate through C:\\LabData folders: Public, IT, Finance, HR.', action: 'explorer' },
      { title: 'Check NTFS permissions on Finance folder', detail: 'Select C:\\LabData\\Finance, click the Security tab. You will see FinanceUsers has Modify access. This is correct group-based access.', action: 'explorer' },
      { title: 'Check NTFS permissions on HR folder', detail: 'Select C:\\LabData\\HR. Notice there is no explicit ACL for an HR group — only inherited Users read access. This is an intentional failure.', action: 'explorer' },
      { title: 'Test access to HR folder', detail: 'Use the "Test Access" feature to simulate a user trying to write to HR. It should fail because no HR group has been granted write access.', action: 'explorer' },
      { title: 'Add an HR group ACL', detail: 'Add a new ACL entry for a group (e.g., "Users") with Modify permission on the HR folder. Then test access again — it should now succeed.', action: 'explorer' },
      { title: 'Use Effective Access', detail: 'Select a folder and a user, then click "Effective Access". This shows the cumulative permissions from all group memberships and inheritance — a key troubleshooting tool.', action: 'explorer' },
      { title: 'Open PowerShell', detail: 'Double-click "PowerShell" on the desktop. Try commands: Get-LocalUser, Get-LocalGroup, Get-Acl, Test-Access. Type "help" for the full command list.', action: 'powershell' },
      { title: 'Document your work', detail: 'Take screenshots of: user list, group memberships, NTFS permissions, effective access results. Write a summary of what you found and fixed.', action: null },
    ],
  },
  {
    id: 'lab2',
    title: 'Lab 2: Microsoft Entra ID & MFA Troubleshooting',
    icon: '🔐',
    color: '#9b59b6',
    description: 'Manage Entra ID users, groups, MFA registration, Conditional Access, and sign-in investigation.',
    app: 'entra',
    steps: [
      { title: 'Open Entra ID Admin Center', detail: 'Double-click "Entra ID Admin Center" on the desktop. This simulates the Microsoft Entra admin center.', action: 'entra' },
      { title: 'Review Entra users', detail: 'You will see 7 Entra users with UPNs like jdoe@laborg.onmicrosoft.com. Note their account status, MFA registration, and group memberships.', action: 'entra' },
      { title: 'Find the user with no MFA method', detail: 'Look at Nina Patel (npatel@laborg.onmicrosoft.com). She is in the MFA-Lab-Users group but has NO MFA method registered. This is a security gap.', action: 'entra' },
      { title: 'Register MFA for Nina Patel', detail: 'Select npatel, go to MFA methods, and register an Authenticator App. This simulates helping a user register MFA via the security info page.', action: 'entra' },
      { title: 'Find the disabled user still in groups', detail: 'Look at Tom Stone (tstone@laborg.onmicrosoft.com). The account is disabled but still in MFA-Lab-Users and Finance-Team. This is an offboarding issue.', action: 'entra' },
      { title: 'Remove Tom Stone from all groups', detail: 'Select tstone and remove them from MFA-Lab-Users and Finance-Team. Disabled accounts should not retain group memberships.', action: 'entra' },
      { title: 'Review Conditional Access policies', detail: 'Click "Conditional Access" in the left nav. You will see 3 policies: CA-LAB-Require-MFA (On), CA-LAB-Block-Legacy-Auth (On), CA-LAB-MFA-Admins (Report-only).', action: 'entra' },
      { title: 'Understand CA policy scope', detail: 'CA-LAB-Require-MFA is scoped to the MFA-Lab-Users group. This means anyone in that group must complete MFA to sign in.', action: 'entra' },
      { title: 'Open Sign-in Logs', detail: 'Double-click "Sign-in Logs" on the desktop. Review the sign-in attempts — some succeeded, some failed MFA, some were blocked by CA.', action: 'signins' },
      { title: 'Investigate the MFA failure', detail: 'Find the sign-in log for npatel — it shows "MFA Failed" with error 50074. The detail says "User has no registered MFA method". This connects to the earlier step.', action: 'signins' },
      { title: 'Investigate the blocked sign-in', detail: 'Find the sign-in for tstone — it shows "Blocked by CA" with error 53003. The account is disabled, so sign-in is blocked even before MFA.', action: 'signins' },
      { title: 'Generate a test sign-in', detail: 'Use the "Generate Sign-in" feature to simulate a sign-in for a user. Observe how the CA policy and MFA status affect the result.', action: 'signins' },
      { title: 'Test with PowerShell', detail: 'Open PowerShell and try: Get-EntraUser, Get-MfaStatus, Get-CA, Get-SignInLog, Test-SignIn. These simulate the Microsoft Graph PowerShell cmdlets.', action: 'powershell' },
      { title: 'Document your work', detail: 'Take screenshots of: user list with MFA status, CA policies, sign-in logs with failures. Write a summary of the MFA troubleshooting workflow.', action: null },
    ],
  },
  {
    id: 'lab3',
    title: 'Lab 3: Help Desk Ticketing Simulation',
    icon: '🎫',
    color: '#e67e22',
    description: 'Work a ServiceNow-style ticket queue: triage, assign, investigate, escalate, resolve, and document.',
    app: 'servicedesk',
    steps: [
      { title: 'Open Service Desk Console', detail: 'Double-click "Service Desk Console" on the desktop. This is your help desk ticketing system.', action: 'servicedesk' },
      { title: 'Review the ticket queue', detail: 'You will see 15 tickets with various priorities (P1-P4), statuses, and categories. Read through them to understand the workload.', action: 'servicedesk' },
      { title: 'Triage INC000003 — Folder Access Denied', detail: 'Open INC000003. A user cannot access the Finance folder. This connects to Lab 1 — you need to check NTFS permissions and group membership.', action: 'servicedesk' },
      { title: 'Investigate the access issue', detail: 'Open Local Users and Groups (Lab 1) and check if the requester is in the FinanceUsers group. If not, add them. Then verify NTFS permissions on the Finance folder.', action: 'lusrmgr' },
      { title: 'Resolve INC000003', detail: 'Back in the ticket, add a work note documenting your investigation, then resolve the ticket with a resolution summary.', action: 'servicedesk' },
      { title: 'Triage INC000004 — MFA Registration Problem', detail: 'Open INC000004. A user cannot register MFA. This connects to Lab 2 — check their Entra account and group membership.', action: 'servicedesk' },
      { title: 'Investigate the MFA issue', detail: 'Open Entra ID Admin Center (Lab 2) and verify the user is in the MFA-Lab-Users group. Check if they have any MFA methods registered. Register one if needed.', action: 'entra' },
      { title: 'Resolve INC000004', detail: 'Document your investigation in the ticket and resolve it with a clear resolution summary.', action: 'servicedesk' },
      { title: 'Triage INC000010 — Terminated User Access Removal', detail: 'Open INC000010. An employee was terminated and all access must be removed. This is an offboarding task that spans all labs.', action: 'servicedesk' },
      { title: 'Disable the AD account', detail: 'Open Active Directory and find the terminated user (Tom Lee / tlee). Disable the account if not already disabled.', action: 'aduc' },
      { title: 'Remove from AD groups', detail: 'In Active Directory, remove tlee from all groups (especially Sales-Dept). Disabled accounts should not retain group access.', action: 'aduc' },
      { title: 'Remove from Entra groups', detail: 'Open Entra ID Admin Center and remove tstone from all Entra groups (MFA-Lab-Users, Finance-Team).', action: 'entra' },
      { title: 'Resolve INC000010', detail: 'Document all actions taken in the ticket: AD account disabled, AD groups removed, Entra groups removed. Resolve the ticket.', action: 'servicedesk' },
      { title: 'Triage INC000011 — Excessive Privilege Report', detail: 'Open INC000011. A help desk account has administrator rights. This is a least-privilege violation. Investigate and remediate.', action: 'servicedesk' },
      { title: 'Review the Knowledge Base', detail: 'Double-click "Knowledge Base" on the desktop. Read KB001 (Account Unlock), KB002 (Folder Access), KB003 (MFA Registration). These articles guide common resolutions.', action: 'kb' },
      { title: 'Open Reports Dashboard', detail: 'Double-click "Reports Dashboard" to see ticket metrics: total, escalated, by category, by priority. This is how managers track team performance.', action: 'reports' },
      { title: 'Document your work', detail: 'Take screenshots of: ticket dashboard, resolved tickets, KB articles, reports. Write a summary of the ticket lifecycle and cross-lab workflows.', action: null },
    ],
  },
  {
    id: 'lab4',
    title: 'Lab 4: Active Directory Administration',
    icon: '🏢',
    color: '#2ecc71',
    description: 'Manage Active Directory users, groups, OUs, computers, and domain controllers for the lab.local domain.',
    app: 'aduc',
    steps: [
      { title: 'Open Active Directory Users and Computers', detail: 'Double-click the "Active Directory" (🏢) icon on the desktop. This opens ADUC for the lab.local domain.', action: 'aduc' },
      { title: 'Explore the domain tree', detail: 'Expand the domain tree on the left. You will see OUs: Domain Controllers, IT, Finance, Engineering, Sales, Service Accounts, Disabled. Click each to see its contents.', action: 'aduc' },
      { title: 'Review AD users', detail: 'Click through the OUs to see all 13 AD users. Note their properties: SAM account name, department, title, manager, account status.', action: 'aduc' },
      { title: 'Find the locked AD account', detail: 'Look in the Finance OU for Jose Martinez (jmartinez). The account is locked. This simulates a user who entered too many wrong passwords.', action: 'aduc' },
      { title: 'Unlock jmartinez', detail: 'Select jmartinez, click "Unlock". This is the same as running Unlock-ADAccount in PowerShell.', action: 'aduc' },
      { title: 'Find the disabled user still in a group', detail: 'Look in the Disabled OU for Tom Lee (tlee). The account is disabled but still in Sales-Dept. This is an offboarding security issue.', action: 'aduc' },
      { title: 'Remove tlee from Sales-Dept', detail: 'Select tlee, view their group memberships, and remove them from Sales-Dept. Disabled accounts should not retain group access.', action: 'aduc' },
      { title: 'Create a new AD user', detail: 'Click "New User" and create a user in the IT OU: SAM name "newuser01", display name "New User One", department "IT", title "Analyst".', action: 'aduc' },
      { title: 'Add the new user to a group', detail: 'Select the new user, or open a group (e.g., IT-Admins) and add the user as a member. This grants them the group permissions.', action: 'aduc' },
      { title: 'Reset a user password', detail: 'Select any user and click "Reset Password". Enter a new password. This simulates helping a user who forgot their password.', action: 'aduc' },
      { title: 'Review AD groups', detail: 'Browse through all 16 AD groups. Note the built-in groups (Domain Admins, Domain Users, etc.) and custom groups (IT-Admins, Finance-Dept, etc.).', action: 'aduc' },
      { title: 'Create a new AD group', detail: 'Click "New Group" and create a group called "Marketing-Dept" in the IT OU with Global scope.', action: 'aduc' },
      { title: 'Review AD computers', detail: 'Browse through all 8 computers. Note DC01, DC02 (domain controllers), FS01 (file server), and workstations in department OUs.', action: 'aduc' },
      { title: 'Find the stale computer account', detail: 'Look in the Disabled OU for WS-OLD-01. This computer is disabled and has not logged on in 120 days. It should be cleaned up.', action: 'aduc' },
      { title: 'Delete the stale computer', detail: 'Select WS-OLD-01 and delete it. In a real environment, you would verify the computer is decommissioned before deleting the AD account.', action: 'aduc' },
      { title: 'Create a new OU', detail: 'Click "New OU" and create an OU called "Marketing" under the domain root. This is how you organize department-specific objects.', action: 'aduc' },
      { title: 'Search Active Directory', detail: 'Use the search bar at the top to search for "admin" or any name. This simulates the AD search function used to find objects quickly.', action: 'aduc' },
      { title: 'Use AD PowerShell commands', detail: 'Open PowerShell and try: Get-ADUser, Get-ADGroup, Get-ADComputer, Get-ADDomain, New-ADUser, Disable-ADAccount, Add-ADGroupMember. Type "help" for the full list.', action: 'powershell' },
      { title: 'Document your work', detail: 'Take screenshots of: AD tree, user properties, group memberships, computer list. Write a summary of AD administration tasks.', action: null },
    ],
  },
];

export function openRoadmap(body) {
  let activeLab = 0;
  let activeStep = 0;
  let completedSteps = JSON.parse(localStorage.getItem('labvm-roadmap-progress') || '{}');

  function saveProgress() {
    localStorage.setItem('labvm-roadmap-progress', JSON.stringify(completedSteps));
  }

  function getProgress(labId) {
    return completedSteps[labId] || [];
  }

  function getApp(actionId) {
    return (window.LabVM?.APPS || []).find(a => a.id === actionId);
  }

  function launchApp(actionId) {
    const app = getApp(actionId);
    if (app && window.LabVM?.launch) window.LabVM.launch(app);
    else toast('App "' + actionId + '" not found');
  }

  function render() {
    const lab = LABS[activeLab];
    const progress = getProgress(lab.id);
    const done = progress.filter(Boolean).length;
    const total = lab.steps.length;
    const pct = Math.round((done / total) * 100);

    // Sidebar: lab list
    const sidebarHtml = LABS.map((l, i) => {
      const p = getProgress(l.id);
      const d = p.filter(Boolean).length;
      const t = l.steps.length;
      const lp = Math.round((d / t) * 100);
      return `<div class="rm-lab ${i === activeLab ? 'active' : ''}" data-lab="${i}" style="--lab-color:${l.color}">
        <div class="rm-lab-icon">${l.icon}</div>
        <div class="rm-lab-body">
          <div class="rm-lab-name">${esc(l.title.replace(/^Lab \d+: /, 'Lab ' + (i+1) + ': '))}</div>
          <div class="rm-lab-bar"><div class="rm-lab-bar-fill" style="width:${lp}%;background:${l.color}"></div></div>
          <div class="rm-lab-meta">${d}/${t} · ${lp}%</div>
        </div>
      </div>`;
    }).join('');

    // Step list (middle column)
    const stepsHtml = lab.steps.map((step, i) => {
      const isDone = progress[i];
      const isActive = i === activeStep;
      return `<div class="rm-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" data-step="${i}">
        <div class="rm-step-num">${isDone ? '✓' : (i + 1)}</div>
        <div class="rm-step-title">${esc(step.title)}</div>
      </div>`;
    }).join('');

    // Detail panel (right column)
    const step = lab.steps[activeStep];
    const isDone = progress[activeStep];
    const app = step.action ? getApp(step.action) : null;
    const appLabel = app ? app.title : step.action;
    const appIcon = app ? app.icon : '';

    const detailHtml = `
      <div class="rm-detail-head" style="--lab-color:${lab.color}">
        <div class="rm-detail-num ${isDone ? 'done' : ''}">${isDone ? '✓' : (activeStep + 1)}</div>
        <div class="rm-detail-title">${esc(step.title)}</div>
      </div>
      <div class="rm-detail-desc">${esc(step.detail)}</div>
      ${step.action ? `<button class="rm-launch" data-action="${step.action}">${appIcon} Open ${esc(appLabel)} →</button>` : ''}
      <div class="rm-detail-actions">
        <button class="rm-toggle ${isDone ? 'rm-btn-undo' : 'rm-btn-done'}" data-step="${activeStep}">
          ${isDone ? '↩ Mark incomplete' : '✓ Mark complete'}
        </button>
        ${activeStep > 0 ? `<button class="rm-nav" id="rm-step-prev">← Prev</button>` : ''}
        ${activeStep < lab.steps.length - 1 ? `<button class="rm-nav" id="rm-step-next">Next →</button>` : ''}
      </div>`;

    body.innerHTML = `
      <div class="rm-root">
        <!-- Column 1: Lab list -->
        <div class="rm-col-labs">
          <div class="rm-col-header">
            <span>🗺️</span> Lab Roadmap
          </div>
          <div class="rm-lab-list">${sidebarHtml}</div>
          <div class="rm-col-footer">
            <button class="rm-reset" id="rm-reset">🔄 Reset progress</button>
          </div>
        </div>

        <!-- Column 2: Step list -->
        <div class="rm-col-steps">
          <div class="rm-col-header" style="border-left:3px solid ${lab.color}">
            <span class="rm-col-icon">${lab.icon}</span>
            <div class="rm-col-title">${esc(lab.title)}</div>
            <div class="rm-col-pct" style="color:${lab.color}">${pct}%</div>
          </div>
          <div class="rm-step-list">${stepsHtml}</div>
          <div class="rm-lab-nav">
            ${activeLab > 0 ? `<button class="rm-nav" id="rm-prev-lab">← Previous Lab</button>` : '<span></span>'}
            ${activeLab < LABS.length - 1 ? `<button class="rm-nav rm-nav-primary" id="rm-next-lab">Next Lab →</button>` : ''}
            ${activeLab === LABS.length - 1 ? `<button class="rm-nav rm-nav-primary" id="rm-finish">🎉 Finished!</button>` : ''}
          </div>
        </div>

        <!-- Column 3: Step detail -->
        <div class="rm-col-detail" id="rm-detail">${detailHtml}</div>
      </div>`;

    // Wire up events
    body.querySelectorAll('.rm-lab').forEach(el => {
      el.onclick = () => { activeLab = parseInt(el.dataset.lab); activeStep = 0; render(); };
    });
    body.querySelectorAll('.rm-step').forEach(el => {
      el.onclick = () => { activeStep = parseInt(el.dataset.step); render(); };
    });

    const launchBtn = body.querySelector('.rm-launch');
    if (launchBtn) launchBtn.onclick = (e) => { e.stopPropagation(); launchApp(e.target.dataset.action); };

    const toggleBtn = body.querySelector('.rm-toggle');
    if (toggleBtn) toggleBtn.onclick = (e) => {
      e.stopPropagation();
      if (!completedSteps[lab.id]) completedSteps[lab.id] = [];
      completedSteps[lab.id][activeStep] = !completedSteps[lab.id][activeStep];
      saveProgress();
      render();
    };

    const stepPrev = body.querySelector('#rm-step-prev');
    if (stepPrev) stepPrev.onclick = () => { activeStep--; render(); };
    const stepNext = body.querySelector('#rm-step-next');
    if (stepNext) stepNext.onclick = () => { activeStep++; render(); };

    const prevLab = body.querySelector('#rm-prev-lab');
    if (prevLab) prevLab.onclick = () => { activeLab--; activeStep = 0; render(); };
    const nextLab = body.querySelector('#rm-next-lab');
    if (nextLab) nextLab.onclick = () => { activeLab++; activeStep = 0; render(); };
    const finishBtn = body.querySelector('#rm-finish');
    if (finishBtn) finishBtn.onclick = () => {
      const totalSteps = LABS.reduce((s, l) => s + l.steps.length, 0);
      const doneSteps = LABS.reduce((s, l) => s + (completedSteps[l.id] || []).filter(Boolean).length, 0);
      toast(`🎉 Completed ${doneSteps}/${totalSteps} steps across all labs!`);
    };

    const resetBtn = body.querySelector('#rm-reset');
    if (resetBtn) resetBtn.onclick = () => {
      if (confirm('Reset all roadmap progress?')) {
        completedSteps = {};
        localStorage.removeItem('labvm-roadmap-progress');
        render();
      }
    };
  }

  render();
}
