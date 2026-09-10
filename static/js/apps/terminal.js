// Shared terminal command engine for PowerShell and CMD
// All commands operate on the lab SQLite database via the API
import { API } from '../api.js';

export async function executeCommand(cmd, cwd, shell) {
  // shell = 'powershell' | 'cmd'
  const parts = cmd.trim().split(/\s+/);
  const c = parts[0].toLowerCase();
  const args = parts.slice(1);
  const full = cmd.trim();
  const out = [];
  const err = [];

  try {
    // ---- Shared commands (both shells) ----
    if (c === 'help' || c === 'get-help' || c === '?') {
      out.push(shell === 'powershell' ? getPowerShellHelp() : getCmdHelp());
    } else if (c === 'cls' || c === 'clear' || c === 'clear-host') {
      return { clear: true };
    } else if (c === 'echo') {
      out.push(full.slice(full.indexOf(' ') + 1).replace(/^["']|["']$/g, ''));
    } else if (c === 'date' || c === 'get-date') {
      out.push(new Date().toString());
    } else if (c === 'time' || c === 'get-time') {
      out.push(new Date().toLocaleTimeString());
    } else if (c === 'whoami') {
      out.push('labvm\\' + (window.LabVM?.currentUser || 'admin'));
    } else if (c === 'hostname') {
      out.push('LABVM-DESKTOP');
    } else if (c === 'ver') {
      out.push(shell === 'powershell'
        ? 'Windows PowerShell\n(c) Lab VM Simulation. PSVersion 7.4.0'
        : '\nMicrosoft Windows [Version 10.0.22631.3000]\n(c) Lab VM Simulation. All rights reserved.');
    } else if (c === 'systeminfo' || c === 'get-computerinfo') {
      out.push('Host Name:                 LABVM-DESKTOP');
      out.push('OS Name:                   Microsoft Windows 11 Pro (Simulation)');
      out.push('OS Version:                10.0.22631 N/A Build 22631');
      out.push('System Manufacturer:       Lab VM Virtual');
      out.push('System Type:               x64-based PC');
      out.push('Processor(s):              1 Processor(s) Installed.');
      out.push('                           [01]: Intel(R) Core(TM) i7 (Virtual)');
      out.push('Total Physical Memory:     16,384 MB');
      out.push('Available Physical Memory: 8,192 MB');
      out.push('Domain:                    WORKGROUP');
    } else if (c === 'ipconfig') {
      out.push('Windows IP Configuration');
      out.push('');
      out.push('Ethernet adapter Ethernet:');
      out.push('   Connection-specific DNS Suffix  . : lab.local');
      out.push('   IPv4 Address. . . . . . . . . . . : 10.0.0.42');
      out.push('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
      out.push('   Default Gateway . . . . . . . . . : 10.0.0.1');
    } else if (c === 'ping') {
      if (!args[0]) { err.push('Usage: ping <hostname>'); }
      else {
        out.push(`Pinging ${args[0]} with 32 bytes of data:`);
        for (let i = 0; i < 4; i++) out.push(`Reply from 10.0.0.${Math.floor(Math.random()*254)+1}: bytes=32 time=${Math.floor(Math.random()*20)+1}ms TTL=128`);
        out.push(`\nPing statistics for ${args[0]}:`);
        out.push('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)');
      }
    } else if (c === 'tracert') {
      if (!args[0]) { err.push('Usage: tracert <hostname>'); }
      else {
        out.push(`Tracing route to ${args[0]} over a maximum of 30 hops:`);
        out.push('  1     1 ms     1 ms     1 ms  10.0.0.1');
        out.push('  2     5 ms     4 ms     5 ms  192.168.1.1');
        out.push('  3    12 ms    10 ms    11 ms  isp-gw.net');
        out.push('  4    15 ms    14 ms    15 ms  ' + args[0]);
        out.push('Trace complete.');
      }
    } else if (c === 'nslookup') {
      if (!args[0]) { err.push('Usage: nslookup <hostname>'); }
      else {
        out.push(`Server:  dns.lab.local`);
        out.push(`Address:  10.0.0.1`);
        out.push('');
        out.push(`Name:    ${args[0]}`);
        out.push(`Address:  203.0.113.${Math.floor(Math.random()*254)+1}`);
      }
    } else if (c === 'netstat') {
      out.push('Active Connections');
      out.push('  Proto  Local Address          Foreign Address        State');
      out.push('  TCP    10.0.0.42:135          0.0.0.0:0              LISTENING');
      out.push('  TCP    10.0.0.42:445          0.0.0.0:0              LISTENING');
      out.push('  TCP    10.0.0.42:3389         0.0.0.0:0              LISTENING');
      out.push('  TCP    10.0.0.42:8000         0.0.0.0:0              LISTENING');
    } else if (c === 'tasklist' || c === 'get-process') {
      out.push('Image Name                     PID Session Name        Mem Usage');
      out.push('========================= ======== ================ ============');
      out.push('System                            4 Services                 8 K');
      out.push('explorer.exe                   1232 Console               45,210 K');
      out.push('powershell.exe                 2156 Console               32,120 K');
      out.push('LabVM.exe                      3408 Console               28,540 K');
      out.push('chrome.exe                     4520 Console               85,300 K');
    } else if (c === 'shutdown') {
      if (args.includes('/r') || args.includes('-r')) out.push('The system is going down for reboot NOW! (Simulation)');
      else if (args.includes('/s') || args.includes('-s')) out.push('The system is shutting down. (Simulation)');
      else if (args.includes('/a') || args.includes('-a')) out.push('Shutdown aborted. (Simulation)');
      else out.push('Usage: shutdown /s (shutdown) | /r (reboot) | /a (abort)');
    } else if (c === 'exit' || c === 'logout') {
      return { exit: true };
    } else if (c === 'cd' || c === 'set-location') {
      if (!args[0] || args[0] === '~') out.push(cwd);
      else { out.push(args[0]); return { cwd: args[0] }; }
    } else if (c === 'dir' || c === 'ls' || c === 'get-childitem' || c === 'gci') {
      const d = await API.lab1Folders();
      const folder = d.folders.find(f => f.path.toLowerCase() === cwd.toLowerCase()) || d.folders.find(f => f.path === 'C:\\LabData');
      const children = d.folders.filter(f => f.parent_id === (folder?.id || 1));
      if (folder) {
        out.push(` Directory of ${folder.path}`);
        out.push('');
        out.push(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}    <DIR>          .`);
        out.push(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}    <DIR>          ..`);
        children.forEach(f => {
          out.push(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}    ${f.has_test_file ? '         1,024' : '    <DIR>'}          ${f.path.split('\\').pop()}`);
        });
        if (folder.has_test_file) out.push(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}             1,024 test.txt`);
        out.push(`               ${children.length + (folder.has_test_file ? 1 : 0)} File(s)`);
      } else { err.push(`Directory not found: ${cwd}`); }
    } else if (c === 'tree') {
      const d = await API.lab1Folders();
      out.push(`C:\\LabData`);
      d.folders.filter(f => f.parent_id === 1).forEach(f => {
        out.push(`├──${f.path.split('\\').pop()}`);
        d.folders.filter(c2 => c2.parent_id === f.id).forEach(c2 => {
          out.push(`│   └──${c2.path.split('\\').pop()}`);
        });
      });
    } else if (c === 'type' || c === 'cat' || c === 'get-content') {
      if (!args[0]) { err.push('Usage: type <filename>'); }
      else { out.push(`Contents of ${args[0]}:`); out.push('This is a test file in the Lab VM simulation.'); out.push('Created during lab setup.'); }
    } else if (c === 'mkdir' || c === 'md' || c === 'new-item') {
      if (!args[0]) { err.push('Usage: mkdir <name>'); }
      else {
        try { await API.lab1CreateFolder({ path: cwd.endsWith('\\') ? cwd + args[0] : cwd + '\\' + args[0], parent: cwd }); out.push(`Directory created: ${args[0]}`); }
        catch (e) { err.push(e.message); }
      }
    } else if (c === 'del' || c === 'rm' || c === 'remove-item' || c === 'erase') {
      if (!args[0]) { err.push('Usage: del <filename>'); }
      else out.push(`Deleted: ${args[0]} (Simulation - files are managed via File Explorer)`);
    } else if (c === 'copy' || c === 'cp' || c === 'copy-item') {
      if (args.length < 2) { err.push('Usage: copy <source> <dest>'); }
      else out.push(`Copied: ${args[0]} -> ${args[1]} (Simulation)`);
    } else if (c === 'move' || c === 'mv' || c === 'move-item') {
      if (args.length < 2) { err.push('Usage: move <source> <dest>'); }
      else out.push(`Moved: ${args[0]} -> ${args[1]} (Simulation)`);
    } else if (c === 'ren' || c === 'rename' || c === 'rename-item') {
      if (args.length < 2) { err.push('Usage: ren <oldname> <newname>'); }
      else out.push(`Renamed: ${args[0]} -> ${args[1]} (Simulation)`);
    } else if (c === 'attrib' || c === 'get-item') {
      out.push('  A        C:\\LabData\\test.txt');
      out.push('  A    HR  C:\\LabData\\system.dat');
    }

    // ---- Lab 1: Local Users ----
    else if (c === 'get-localuser' || c === 'net user') {
      const d = await API.lab1Users();
      if (args[0]) {
        const u = d.users.find(x => x.username.toLowerCase() === args[0].toLowerCase());
        if (u) {
          out.push(`User name:     ${u.username}`);
          out.push(`Full Name:     ${u.full_name || ''}`);
          out.push(`Description:   ${u.description || ''}`);
          out.push(`Enabled:       ${u.enabled ? 'Yes' : 'No'}`);
          out.push(`Locked:        ${u.locked ? 'Yes' : 'No'}`);
          out.push(`Pwd Expired:   ${u.password_expired ? 'Yes' : 'No'}`);
          out.push(`Groups:        ${(u.groups || []).join(', ')}`);
          out.push(`Created:       ${u.account_created || ''}`);
        } else err.push(`User '${args[0]}' not found.`);
      } else {
        if (shell === 'cmd') {
          out.push('User accounts for \\LABVM-DESKTOP');
          out.push('');
          out.push(d.users.map(u => u.username).join('   '));
        } else {
          out.push('Name                 Enabled  Locked  Groups');
          out.push('----                 -------  ------  ------');
          d.users.forEach(u => out.push(`${u.username.padEnd(20)} ${u.enabled?'True':'False'}   ${u.locked?'True':'False'}   ${(u.groups||[]).join(',')}`));
        }
      }
    } else if (c === 'new-localuser' || c === 'net user /add') {
      const nameArg = shell === 'cmd' ? args.find(a => !a.startsWith('/')) : args[0];
      if (!nameArg) { err.push('Usage: New-LocalUser -Name <username> [-Password <pwd>]'); }
      else {
        try {
          const pwdMatch = full.match(/(?:-Password|password:)\s*"?(\S+?)"?(?:\s|$)/i);
          await API.lab1CreateUser({ username: nameArg, password: pwdMatch ? pwdMatch[1] : 'TempPass#2026', full_name: '', description: 'Created via terminal' });
          out.push(`User '${nameArg}' created successfully.`);
        } catch (e) { err.push(e.message); }
      }
    } else if (c === 'enable-localuser') {
      if (!args[0]) { err.push('Usage: Enable-LocalUser -Name <username>'); }
      else { const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.lab1UpdateUser(u.id, { enabled: 1, locked: 0 }); out.push(`User '${u.username}' enabled.`); } }
    } else if (c === 'disable-localuser' || (c === 'net' && args[0] === 'user' && args.includes('/active:no'))) {
      const name = c === 'net' ? args[1] : args[0];
      if (!name) { err.push('Usage: Disable-LocalUser -Name <username>'); }
      else { const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === name.toLowerCase()); if (!u) err.push(`User '${name}' not found.`); else { await API.lab1UpdateUser(u.id, { enabled: 0 }); out.push(`User '${u.username}' disabled.`); } }
    } else if (c === 'unlock-localuser') {
      if (!args[0]) { err.push('Usage: Unlock-LocalUser -Name <username>'); }
      else { const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.lab1UpdateUser(u.id, { locked: 0 }); out.push(`User '${u.username}' unlocked.`); } }
    } else if (c === 'set-localuser' || (c === 'net' && args[0] === 'user' && !args.includes('/add'))) {
      const ni = full.indexOf('-name'); const pi = full.indexOf('-pwd');
      if (c === 'net' && args[0] === 'user') {
        const name = args[1]; const pwd = args.find(a => !a.startsWith('/') && a !== name);
        if (name && pwd) { const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === name.toLowerCase()); if (u) { await API.lab1UpdateUser(u.id, { password: pwd }); out.push(`Password reset for '${u.username}'.`); } else err.push(`User '${name}' not found.`); }
        else err.push('Usage: net user <username> <newpassword>');
      } else if (ni >= 0 && pi >= 0) {
        const name = full.slice(ni + 5, pi).trim(); const pwd = full.slice(pi + 4).trim().replace(/^["']|["']$/g, '');
        const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === name.toLowerCase());
        if (!u) err.push(`User '${name}' not found.`); else { await API.lab1UpdateUser(u.id, { password: pwd }); out.push(`Password reset for '${u.username}'.`); }
      } else err.push('Usage: Set-LocalUser -Name <user> -Password <pwd>');
    } else if (c === 'remove-localuser' || c === 'del-localuser' || (c === 'net' && args[0] === 'user' && args.includes('/delete'))) {
      const name = c === 'net' ? args[1] : args[0];
      if (!name) { err.push('Usage: Remove-LocalUser -Name <username>'); }
      else { const d = await API.lab1Users(); const u = d.users.find(x => x.username.toLowerCase() === name.toLowerCase()); if (!u) err.push(`User '${name}' not found.`); else { await API.lab1DeleteUser(u.id); out.push(`User '${u.username}' deleted.`); } }
    }

    // ---- Lab 1: Groups ----
    else if (c === 'get-localgroup' || c === 'net localgroup') {
      const d = await API.lab1Groups();
      if (args[0] && c === 'net') {
        const g = d.groups.find(x => x.name.toLowerCase() === args[0].toLowerCase());
        if (g) { out.push(`Alias name: ${g.name}`); out.push(`Members:`); out.push('---'); (g.members || []).forEach(m => out.push(m)); out.push(`The command completed successfully.`); }
        else err.push(`Group '${args[0]}' not found.`);
      } else {
        out.push('Name                 Members');
        out.push('----                 -------');
        d.groups.forEach(g => out.push(`${g.name.padEnd(20)} ${(g.members || []).join(', ')}`));
      }
    } else if (c === 'new-localgroup' || (c === 'net' && args[0] === 'localgroup' && args.includes('/add'))) {
      const name = c === 'net' ? args[1] : args[0];
      if (!name) { err.push('Usage: New-LocalGroup -Name <groupname>'); }
      else { try { await API.lab1CreateGroup({ name, description: 'Created via terminal' }); out.push(`Group '${name}' created.`); } catch (e) { err.push(e.message); } }
    } else if (c === 'add-localgroupmember' || (c === 'net' && args[0] === 'localgroup' && args.includes('/add'))) {
      const gi = full.indexOf('-group'); const mi = full.indexOf('-member');
      if (c === 'net') {
        const gname = args[1]; const uname = args[2];
        if (gname && uname) { const gd = await API.lab1Groups(); const ud = await API.lab1Users(); const g = gd.groups.find(x => x.name.toLowerCase() === gname.toLowerCase()); const u = ud.users.find(x => x.username.toLowerCase() === uname.toLowerCase()); if (g && u) { await API.lab1AddMember(g.id, u.id); out.push(`'${uname}' added to '${gname}'.`); } else err.push('Group or user not found.'); }
        else err.push('Usage: net localgroup <group> <user> /add');
      } else if (gi >= 0 && mi >= 0) {
        const gname = full.slice(gi + 6, mi).trim(); const uname = full.slice(mi + 7).trim();
        const gd = await API.lab1Groups(); const ud = await API.lab1Users();
        const g = gd.groups.find(x => x.name.toLowerCase() === gname.toLowerCase()); const u = ud.users.find(x => x.username.toLowerCase() === uname.toLowerCase());
        if (g && u) { await API.lab1AddMember(g.id, u.id); out.push(`'${uname}' added to '${gname}'.`); } else err.push('Group or user not found.');
      } else err.push('Usage: Add-LocalGroupMember -Group <group> -Member <user>');
    } else if (c === 'remove-localgroupmember' || (c === 'net' && args[0] === 'localgroup' && args.includes('/delete'))) {
      const gname = c === 'net' ? args[1] : (full.match(/-group\s+(\S+)/) || [])[1];
      const uname = c === 'net' ? args[2] : (full.match(/-member\s+(\S+)/) || [])[1];
      if (gname && uname) { const gd = await API.lab1Groups(); const ud = await API.lab1Users(); const g = gd.groups.find(x => x.name.toLowerCase() === gname.toLowerCase()); const u = ud.users.find(x => x.username.toLowerCase() === uname.toLowerCase()); if (g && u) { await API.lab1RemoveMember(g.id, u.id); out.push(`'${uname}' removed from '${gname}'.`); } else err.push('Group or user not found.'); }
      else err.push('Usage: Remove-LocalGroupMember -Group <group> -Member <user>');
    }

    // ---- Lab 1: NTFS ----
    else if (c === 'get-acl' || c === 'icacls') {
      const path = c === 'icacls' ? args[0] : args[0];
      if (!path) { err.push('Usage: Get-Acl <path>'); }
      else { const d = await API.lab1Folders(); const f = d.folders.find(x => x.path.toLowerCase() === path.toLowerCase()); if (!f) err.push(`Path '${path}' not found.`); else { out.push(`Path: ${f.path}`); out.push(''); (f.acls || []).forEach(a => out.push(`${a.principal.padEnd(22)} ${a.inherited ? '(inherited)' : '          '} ${a.permission}`)); } }
    } else if (c === 'test-access') {
      const ui = full.indexOf('-user'); const pi = full.indexOf('-path');
      if (ui < 0 || pi < 0) { err.push('Usage: Test-Access -User <name> -Path <path>'); }
      else {
        const uname = full.slice(ui + 5, pi).trim(); const path = full.slice(pi + 5).trim();
        const ud = await API.lab1Users(); const fd = await API.lab1Folders();
        const u = ud.users.find(x => x.username.toLowerCase() === uname.toLowerCase()); const f = fd.folders.find(x => x.path.toLowerCase() === path.toLowerCase());
        if (!u || !f) err.push('User or path not found.');
        else { const r = await API.lab1TestAccess({ user_id: u.id, folder_id: f.id }); r.steps.forEach(s => out.push(s)); out.push(r.success ? `RESULT: Access allowed (${r.permission})` : 'RESULT: ' + (r.error || 'Access denied')); }
      }
    } else if (c === 'icacls' && args.length > 2) {
      out.push(`Permissions modified for ${args[0]} (Simulation - use File Explorer for full ACL management)`);
    }

    // ---- Lab 2: Entra ID ----
    else if (c === 'get-entrauser' || c === 'get-azureaduser') {
      const d = await API.lab2Users();
      if (args[0]) { const u = d.users.find(x => x.upn.toLowerCase() === args[0].toLowerCase()); if (u) { out.push(`UPN: ${u.upn}`); out.push(`Display Name: ${u.display_name}`); out.push(`Department: ${u.department}`); out.push(`Enabled: ${u.account_enabled ? 'Yes' : 'No'}`); out.push(`MFA Registered: ${u.mfa_registered ? 'Yes' : 'No'}`); out.push(`Groups: ${(u.groups || []).join(', ')}`); } else err.push(`User '${args[0]}' not found.`); }
      else { out.push('UPN'.padEnd(40) + 'Enabled  MFA   Groups'); d.users.forEach(u => out.push(`${u.upn.padEnd(40)} ${u.account_enabled?'Yes':'No '}     ${u.mfa_registered?'Yes':'No '}   ${(u.groups||[]).join(',')}`)); }
    } else if (c === 'get-mfastatus' || c === 'get-mfa') {
      const d = await API.lab2Users(); const u = d.users.find(x => x.upn.toLowerCase() === (args[0]||'').toLowerCase());
      if (!u) err.push(`User '${args[0]}' not found.`);
      else { out.push(`User: ${u.upn}`); out.push(`MFA Registered: ${u.mfa_registered ? 'Yes' : 'No'}`); out.push(`Methods: ${(u.mfa_methods || []).map(m => m.method_type).join(', ') || 'none'}`); out.push(`Groups: ${(u.groups || []).join(', ')}`); }
    } else if (c === 'reset-mfa') {
      if (!args[0]) { err.push('Usage: Reset-Mfa -User <upn>'); }
      else { const d = await API.lab2Users(); const u = d.users.find(x => x.upn.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.lab2MfaReset(u.id); out.push(`MFA reset for '${u.upn}'. All methods removed.`); } }
    } else if (c === 'get-ca' || c === 'get-conditionalaccesspolicy') {
      const d = await API.lab2Policies();
      out.push('Name'.padEnd(30) + 'State'.padEnd(15) + 'Grant'.padEnd(20) + 'Applications');
      d.policies.forEach(p => out.push(`${p.name.padEnd(30)} ${p.state.padEnd(15)} ${p.grant_control.padEnd(20)} ${p.applications}`));
    } else if (c === 'get-signinlog' || c === 'get-azureadauditsigninlog') {
      const d = await API.lab2Signins();
      out.push('Time'.padEnd(22) + 'UPN'.padEnd(35) + 'Result'.padEnd(18) + 'Detail');
      d.logs.forEach(l => out.push(`${(l.time||'').padEnd(22)} ${(l.upn||'').padEnd(35)} ${(l.result||'').padEnd(18)} ${l.detail||''}`));
    } else if (c === 'test-signin') {
      if (!args[0]) { err.push('Usage: Test-SignIn -User <upn>'); }
      else { const d = await API.lab2Users(); const u = d.users.find(x => x.upn.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { const r = await API.lab2GenSignin({ user_id: u.id }); out.push(`Sign-in result: ${r.result}`); out.push(`Error code: ${r.error_code}`); out.push(`Detail: ${r.detail}`); if (r.mfa_policy) out.push(`CA Policy: ${r.mfa_policy}`); } }
    }

    // ---- Lab 3: Tickets ----
    else if (c === 'get-ticket' || c === 'get-servicenowticket') {
      const d = await API.lab3Tickets();
      if (args[0]) { const t = d.tickets.find(x => x.ticket_number.toLowerCase() === args[0].toLowerCase()); if (t) { out.push(`Ticket: ${t.ticket_number}`); out.push(`Title: ${t.title}`); out.push(`Priority: ${t.priority}`); out.push(`Status: ${t.status}`); out.push(`Category: ${t.category}`); out.push(`Assigned: ${t.assigned_agent || 'unassigned'}`); out.push(`Description: ${t.description}`); } else err.push(`Ticket '${args[0]}' not found.`); }
      else { out.push('Ticket#'.padEnd(12) + 'Pri'.padEnd(5) + 'Status'.padEnd(14) + 'Title'); d.tickets.forEach(t => out.push(`${t.ticket_number.padEnd(12)} ${t.priority.padEnd(5)} ${t.status.padEnd(14)} ${t.title}`)); }
    } else if (c === 'new-ticket' || c === 'create-ticket') {
      const ti = full.match(/-title\s+"([^"]+)"/); const ci = full.match(/-category\s+(\S+)/); const ii = full.match(/-impact\s+(\S+)/); const ui = full.match(/-urgency\s+(\S+)/);
      if (!ti) err.push('Usage: New-Ticket -Title "..." -Category <cat> -Impact <H/M/L> -Urgency <H/M/L>');
      else { const r = await API.lab3CreateTicket({ title: ti[1], category: ci ? ci[1] : 'Request', impact: ii ? ii[1] : 'Medium', urgency: ui ? ui[1] : 'Medium' }); out.push(`Created ${r.ticket_number} [${r.priority}]`); }
    } else if (c === 'close-ticket' || c === 'resolve-ticket') {
      const ti = full.match(/-id\s+(\S+)/); const ri = full.match(/-resolution\s+"([^"]+)"/);
      if (!ti) err.push('Usage: Close-Ticket -Id <INC000001> -Resolution "..."');
      else { const d = await API.lab3Tickets(); const t = d.tickets.find(x => x.ticket_number.toLowerCase() === ti[1].toLowerCase()); if (t) { await API.lab3UpdateTicket(t.id, { status: 'Resolved', resolution: ri ? ri[1] : 'Resolved via terminal' }); out.push(`Ticket ${ti[1]} resolved.`); } else err.push(`Ticket '${ti[1]}' not found.`); }
    } else if (c === 'get-kb' || c === 'get-knowledgebase') {
      const d = await API.lab3Kb();
      out.push('Number'.padEnd(10) + 'Title');
      d.articles.forEach(a => out.push(`${a.kb_number.padEnd(10)} ${a.title}`));
    } else if (c === 'get-report' || c === 'get-ticketreport') {
      const r = await API.lab3Reports();
      out.push(`Total tickets: ${r.total}`);
      out.push(`Reopened: ${r.reopened}`);
      out.push(`Escalated: ${r.escalated}`);
      out.push('');
      out.push('By Category:'); r.by_category.forEach(c2 => out.push(`  ${c2.category}: ${c2.c}`));
      out.push('By Priority:'); r.by_priority.forEach(c2 => out.push(`  ${c2.priority}: ${c2.c}`));
    }

    // ---- Active Directory ----
    else if (c === 'get-aduser') {
      const d = await API.get('/api/ad/users');
      if (args[0]) { const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (u) { out.push(`SAM: ${u.sam_account_name}`); out.push(`Name: ${u.display_name}`); out.push(`UPN: ${u.user_principal_name}`); out.push(`DN: ${u.dn}`); out.push(`Enabled: ${u.enabled ? 'Yes' : 'No'}`); out.push(`Locked: ${u.locked ? 'Yes' : 'No'}`); out.push(`Department: ${u.department}`); out.push(`Title: ${u.title}`); out.push(`Email: ${u.email}`); out.push(`Groups: ${(u.groups || []).join(', ')}`); } else err.push(`User '${args[0]}' not found.`); }
      else { out.push('SAM'.padEnd(20) + 'Name'.padEnd(25) + 'Enabled  Locked  Department'); d.forEach(u => out.push(`${u.sam_account_name.padEnd(20)} ${(u.display_name||'').padEnd(25)} ${u.enabled?'Yes':'No '}     ${u.locked?'Yes':'No '}     ${u.department||''}`)); }
    } else if (c === 'new-aduser') {
      const sam = full.match(/-name\s+(\S+)/); const dn = full.match(/-displayname\s+"([^"]+)"/) || full.match(/-displayname\s+(\S+)/);
      if (!sam) err.push('Usage: New-ADUser -Name <sam> -DisplayName "Name" [-Department "IT"] [-Title "Analyst"]');
      else { try { const r = await API.post('/api/ad/users', { sam_account_name: sam[1], display_name: dn ? dn[1] : sam[1], department: (full.match(/-department\s+"([^"]+)"/)||[])[1] || '', title: (full.match(/-title\s+"([^"]+)"/)||[])[1] || '' }); out.push(`Created AD user: ${r.sam_account_name}`); } catch (e) { err.push(e.message); } }
    } else if (c === 'set-aduser') {
      const sam = args[0]; const dept = full.match(/-department\s+"([^"]+)"/); const title = full.match(/-title\s+"([^"]+)"/); const email = full.match(/-email\s+(\S+)/);
      if (!sam) err.push('Usage: Set-ADUser <sam> [-Department "IT"] [-Title "Analyst"] [-Email x@y]');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === sam.toLowerCase()); if (!u) err.push(`User '${sam}' not found.`); else { const upd = {}; if (dept) upd.department = dept[1]; if (title) upd.title = title[1]; if (email) upd.email = email[1]; await API.put(`/api/ad/users/${u.id}`, upd); out.push(`Updated ${sam}`); } }
    } else if (c === 'enable-adaccount') {
      if (!args[0]) err.push('Usage: Enable-ADAccount -Identity <sam>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.put(`/api/ad/users/${u.id}`, { enabled: 1 }); out.push(`Enabled ${args[0]}`); } }
    } else if (c === 'disable-adaccount') {
      if (!args[0]) err.push('Usage: Disable-ADAccount -Identity <sam>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.put(`/api/ad/users/${u.id}`, { enabled: 0 }); out.push(`Disabled ${args[0]}`); } }
    } else if (c === 'unlock-adaccount') {
      if (!args[0]) err.push('Usage: Unlock-ADAccount -Identity <sam>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.post(`/api/ad/users/${u.id}/unlock`, {}); out.push(`Unlocked ${args[0]}`); } }
    } else if (c === 'set-adaccountpassword' || c === 'reset-adpassword') {
      const sam = args[0]; const pwd = full.match(/-newpassword\s+(\S+)/);
      if (!sam) err.push('Usage: Set-ADAccountPassword -Identity <sam> -NewPassword <pwd>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === sam.toLowerCase()); if (!u) err.push(`User '${sam}' not found.`); else { await API.post(`/api/ad/users/${u.id}/reset-password`, { password: pwd ? pwd[1] : 'NewPass#2026' }); out.push(`Password reset for ${sam}`); } }
    } else if (c === 'remove-aduser') {
      if (!args[0]) err.push('Usage: Remove-ADUser -Identity <sam>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { await API.del(`/api/ad/users/${u.id}`); out.push(`Removed ${args[0]}`); } }
    } else if (c === 'get-adgroup') {
      const d = await API.get('/api/ad/groups');
      if (args[0]) { const g = d.find(x => x.name.toLowerCase() === args[0].toLowerCase()); if (g) { out.push(`Name: ${g.name}`); out.push(`Scope: ${g.scope}`); out.push(`Type: ${g.group_type}`); out.push(`Description: ${g.description}`); out.push(`Members: ${(g.members || []).map(m => m.name).join(', ')}`); } else err.push(`Group '${args[0]}' not found.`); }
      else { out.push('Name'.padEnd(25) + 'Scope'.padEnd(15) + 'Members'); d.forEach(g => out.push(`${g.name.padEnd(25)} ${(g.scope||'').padEnd(15)} ${(g.members||[]).length}`)); }
    } else if (c === 'new-adgroup') {
      const nm = full.match(/-name\s+(\S+)/); const sc = full.match(/-groupscope\s+(\S+)/);
      if (!nm) err.push('Usage: New-ADGroup -Name <name> [-GroupScope Global]');
      else { try { const r = await API.post('/api/ad/groups', { name: nm[1], scope: sc ? sc[1] : 'Global' }); out.push(`Created AD group: ${r.name}`); } catch (e) { err.push(e.message); } }
    } else if (c === 'remove-adgroup') {
      if (!args[0]) err.push('Usage: Remove-ADGroup -Identity <name>');
      else { const d = await API.get('/api/ad/groups'); const g = d.find(x => x.name.toLowerCase() === args[0].toLowerCase()); if (!g) err.push(`Group '${args[0]}' not found.`); else { await API.del(`/api/ad/groups/${g.id}`); out.push(`Removed ${args[0]}`); } }
    } else if (c === 'add-adgroupmember') {
      const grp = full.match(/-identity\s+(\S+)/i); const mem = full.match(/-members\s+(\S+)/i);
      if (!grp || !mem) err.push('Usage: Add-ADGroupMember -Identity <group> -Members <sam>');
      else { const gd = await API.get('/api/ad/groups'); const g = gd.find(x => x.name.toLowerCase() === grp[1].toLowerCase()); const ud = await API.get('/api/ad/users'); const u = ud.find(x => x.sam_account_name.toLowerCase() === mem[1].toLowerCase()); if (!g) err.push(`Group '${grp[1]}' not found.`); else if (!u) err.push(`User '${mem[1]}' not found.`); else { await API.post(`/api/ad/groups/${g.id}/members`, { member_id: u.id, member_type: 'user' }); out.push(`Added ${mem[1]} to ${grp[1]}`); } }
    } else if (c === 'remove-adgroupmember') {
      const grp = full.match(/-identity\s+(\S+)/i); const mem = full.match(/-members\s+(\S+)/i);
      if (!grp || !mem) err.push('Usage: Remove-ADGroupMember -Identity <group> -Members <sam>');
      else { const gd = await API.get('/api/ad/groups'); const g = gd.find(x => x.name.toLowerCase() === grp[1].toLowerCase()); const ud = await API.get('/api/ad/users'); const u = ud.find(x => x.sam_account_name.toLowerCase() === mem[1].toLowerCase()); if (!g) err.push(`Group '${grp[1]}' not found.`); else if (!u) err.push(`User '${mem[1]}' not found.`); else { await API.del(`/api/ad/groups/${g.id}/members/${u.id}?member_type=user`); out.push(`Removed ${mem[1]} from ${grp[1]}`); } }
    } else if (c === 'get-adcomputer') {
      const d = await API.get('/api/ad/computers');
      if (args[0]) { const c2 = d.find(x => x.name.toLowerCase() === args[0].toLowerCase()); if (c2) { out.push(`Name: ${c2.name}`); out.push(`OS: ${c2.os}`); out.push(`IP: ${c2.ipv4_address}`); out.push(`Enabled: ${c2.enabled ? 'Yes' : 'No'}`); out.push(`Last Logon: ${c2.last_logon}`); } else err.push(`Computer '${args[0]}' not found.`); }
      else { out.push('Name'.padEnd(15) + 'OS'.padEnd(25) + 'IP'.padEnd(15) + 'Enabled'); d.forEach(c2 => out.push(`${c2.name.padEnd(15)} ${(c2.os||'').padEnd(25)} ${(c2.ipv4_address||'').padEnd(15)} ${c2.enabled?'Yes':'No'}`)); }
    } else if (c === 'get-addomaincontroller' || c === 'get-addomain') {
      const d = await API.get('/api/ad/dcs');
      out.push('Domain: lab.local'); out.push('Forest: lab.local'); out.push('Domain Mode: Windows 2016'); out.push(''); out.push('Domain Controllers:'); d.forEach(dc => out.push(`  ${dc.name} (${dc.os}) - ${dc.site} - Roles: ${dc.roles}`));
    } else if (c === 'get-adorganizationalunit' || c === 'get-adou') {
      const d = await API.get('/api/ad/ous');
      out.push('Name'.padEnd(25) + 'DN'); d.forEach(o => out.push(`${o.name.padEnd(25)} ${o.dn}`));
    } else if (c === 'search-adaccount') {
      const q = full.match(/-filter\s+"([^"]+)"/) || full.match(/-filter\s+(\S+)/);
      const query = q ? q[1] : (args[0] || '');
      const d = await API.get(`/api/ad/search?q=${encodeURIComponent(query)}`);
      if (d.length === 0) out.push('No results found.');
      else { out.push('Type'.padEnd(10) + 'Name'.padEnd(25) + 'DN'); d.forEach(r => out.push(`${r.type.padEnd(10)} ${(r.display_name||r.name||'').padEnd(25)} ${r.dn}`)); }
    } else if (c === 'get-adusermemberof') {
      if (!args[0]) err.push('Usage: Get-ADUserMemberOf -Identity <sam>');
      else { const d = await API.get('/api/ad/users'); const u = d.find(x => x.sam_account_name.toLowerCase() === args[0].toLowerCase()); if (!u) err.push(`User '${args[0]}' not found.`); else { out.push(`Groups for ${u.sam_account_name}:`); (u.groups || []).forEach(g => out.push(`  ${g}`)); } }
    }

    // ---- Misc Windows commands ----
    else if (c === 'color') { out.push('Color changed (Simulation)'); }
    else if (c === 'title') { out.push(`Window title set to: ${args.join(' ')}`); }
    else if (c === 'path') { out.push('PATH=C:\\Windows\\system32;C:\\Windows;C:\\LabData;C:\\LabVM'); }
    else if (c === 'set') { out.push('USERNAME=admin'); out.push('USERPROFILE=C:\\Users\\admin'); out.push('COMPUTERNAME=LABVM-DESKTOP'); out.push('OS=Windows_NT'); out.push('PATH=C:\\Windows\\system32;C:\\Windows;C:\\LabData'); }
    else if (c === 'chcp') { out.push('Active code page: 65001 (UTF-8)'); }
    else if (c === 'cmd') { out.push('Microsoft Windows [Version 10.0.22631.3000]'); out.push('(c) Lab VM Simulation.'); }
    else if (c === 'powershell') { out.push('Windows PowerShell'); out.push('(c) Lab VM Simulation.'); }
    else if (c === 'where' || c === 'get-command') { out.push(args[0] ? `C:\\Windows\\System32\\${args[0]}` : 'Usage: where <command>'); }
    else if (c === 'assoc' || c === 'ftype') { out.push('.txt=txtfile'); out.push('.bat=batfile'); out.push('.ps1=PowerShellScript'); }
    else if (c === 'sfc') { out.push('Beginning system scan...'); out.push('Verification 100% complete.'); out.push('Windows Resource Protection did not find any integrity violations.'); }
    else if (c === 'chkdsk') { out.push('The type of the file system is NTFS.'); out.push('Volume label is LabData.'); out.push('CHKDSK is verifying files...'); out.push('Windows has checked the file system and found no problems.'); }
    else if (c === 'diskpart') { out.push('Microsoft DiskPart version 10.0.22631'); out.push('DISKPART>'); }
    else if (c === 'format') { out.push('Format is a destructive command. Not allowed in simulation.'); }
    else if (c === 'reg' || c === 'regedit') { out.push('Registry Editor (Simulation) - use Settings app for configuration'); }
    else if (c === 'gpupdate' || c === 'gpresult') { out.push('Updating policy...'); out.push('Computer Policy update has completed successfully.'); out.push('User Policy update has completed successfully.'); }
    else if (c === 'winver') { out.push('Microsoft Windows\nVersion 23H2 (OS Build 22631.3000)'); out.push('(c) Lab VM Simulation. All rights reserved.'); }
    else if (c === 'dxdiag') { out.push('DirectX Diagnostic Tool (Simulation)'); out.push('System: Lab VM Desktop'); out.push('DirectX Version: 12'); }
    else if (c === 'msinfo32') { out.push('System Information (Simulation) - use systeminfo command'); }
    else if (c === 'appwiz.cpl') { out.push('Programs and Features (Simulation)'); out.push('Installed programs:'); out.push('  Lab VM Desktop 1.0.0'); out.push('  FastAPI Backend'); out.push('  SQLite Database Engine'); }
    else if (c === 'control' || c === 'control.exe') { out.push('Opening Control Panel... (use Settings app)'); }
    else if (c === 'lusrmgr.msc') { out.push('Opening Local Users and Groups... (use the desktop app)'); }
    else if (c === 'explorer' || c === 'explorer.exe') { out.push('Opening File Explorer... (use the desktop app)'); }
    else if (c === 'notepad' || c === 'notepad.exe') { out.push('Opening Notepad... (use the desktop app)'); }
    else if (c === 'calc' || c === 'calc.exe') { out.push('Opening Calculator... (use the desktop app)'); }
    else if (c === 'taskkill') { out.push(`Process terminated: ${args[0] || 'unknown'} (Simulation)`); }
    else if (c === 'sc' || c === 'sc.exe') { out.push('Service control (Simulation) - use Get-Service for details'); }
    else if (c === 'get-service') { out.push('Status   Name               DisplayName'); out.push('------   ----               -----------'); out.push('Running  LabVM              Lab VM Desktop Service'); out.push('Running  FastAPI            FastAPI Web Server'); out.push('Stopped  Spooler            Print Spooler'); }
    else if (c === 'start-service' || c === 'stop-service' || c === 'restart-service') { out.push(`${c.replace('-service','').replace('start','Start').replace('stop','Stop').replace('restart','Restart')}ing service: ${args[0] || 'unknown'} (Simulation)`); }
    else if (c === 'net') { if (!args[0]) err.push('Usage: net user | net localgroup | net accounts'); else err.push(`net ${args[0]} - use 'net user' or 'net localgroup' for specific commands`); }
    else if (c === 'runas') { out.push('Run as different user (Simulation) - all lab users have access'); }
    else if (c === 'schtasks' || c === 'get-scheduledtask') { out.push('Scheduled tasks (Simulation) - no tasks configured'); }
    else if (c === 'eventvwr' || c === 'get-winevent') { out.push('Event Viewer (Simulation) - use Sign-in Logs app for authentication events'); }
    else if (c === 'perfmon' || c === 'get-counter') { out.push('Performance Monitor (Simulation) - system is healthy'); }
    else if (c === 'print' || c === 'lpr') { out.push('Printing (Simulation) - no printer configured'); }
    else if (c === 'mode') { out.push('Device status: CON'); out.push('    Lines:   50'); out.push('    Columns:  120'); }
    else if (c === 'more' || c === 'less') { if (!args[0]) err.push('Usage: more <filename>'); else out.push(`Displaying ${args[0]}... (use type/cat to view file contents)`); }
    else if (c === 'find' || c === 'findstr' || c === 'select-string') { out.push(`Searching for: ${args[0] || ''}`); out.push('(Use within specific commands to filter results)'); }
    else if (c === 'sort') { out.push('Sort (Simulation) - pipe output through sort for ordering'); }
    else if (c === 'fc' || c === 'compare-object') { out.push('Comparing files... (Simulation)'); }
    else if (c === 'xcopy' || c === 'robocopy') { out.push(`${c}: ${args[0] || ''} -> ${args[1] || ''} (Simulation)`); }
    else if (c === 'cipher') { out.push('Encrypting files... (Simulation) - NTFS encryption not enabled'); }
    else if (c === 'convert') { out.push('Converting filesystem... (Simulation) - already NTFS'); }
    else if (c === 'label') { out.push(`Volume label: ${args[0] || 'LabData'}`); }
    else if (c === 'vol') { out.push('Volume in drive C is LabData'); out.push('Volume Serial Number is 1A2B-3C4D'); }
    else if (c === 'subst') { out.push('Substituted paths (Simulation)'); }
    else if (c === 'mountvol') { out.push('Mount volumes (Simulation)'); }
    else if (c === 'powercfg') { out.push('Power configuration (Simulation) - Balanced (active)'); }
    else if (c === 'bcdedit') { out.push('Boot Configuration Data Editor (Simulation)'); }
    else if (c === 'systemreset' || c === 'systemrefresh') { out.push('System reset (Simulation) - not available in lab'); }
    else if (c === 'dism') { out.push('Deployment Image Servicing and Management (Simulation)'); }
    else if (c === 'pnputil') { out.push('Plug and Play utility (Simulation) - no devices to manage'); }
    else if (c === 'wmic') { out.push('WMIC (Simulation) - use Get-* PowerShell cmdlets instead'); }
    else if (c === 'arp') { out.push('Interface: 10.0.0.42'); out.push('  Internet Address      Physical Address      Type'); out.push('  10.0.0.1             aa-bb-cc-dd-ee-ff    dynamic'); }
    else if (c === 'route') { out.push('Active Routes:'); out.push('Network Destination    Netmask          Gateway          Interface'); out.push('0.0.0.0                0.0.0.0          10.0.0.1         10.0.0.42'); }
    else if (c === 'netsh') { out.push('netsh (Simulation) - network configuration tool'); }
    else if (c === 'telnet') { out.push('Telnet client (Simulation) - use for testing connectivity'); }
    else if (c === 'ftp') { out.push('FTP client (Simulation)'); }
    else if (c === 'curl' || c === 'wget' || c === 'invoke-webrequest') { out.push('HTTP request (Simulation) - use Chrome app for web browsing'); }
    else if (c === 'ssh') { out.push('SSH client (Simulation) - not configured'); }
    else if (c === 'python' || c === 'python3' || c === 'py') { out.push('Python 3.14.0 (Lab VM Simulation)'); out.push('Type "exit()" to quit.'); }
    else if (c === 'node' || c === 'node.exe') { out.push('Node.js v20.10.0 (Lab VM Simulation)'); }
    else if (c === 'git') { out.push('git version 2.43.0 (Lab VM Simulation)'); }
    else if (c === 'npm') { out.push('npm 10.2.3 (Lab VM Simulation)'); }
    else if (c === 'pip') { out.push('pip 24.0 (Lab VM Simulation)'); }
    else if (c === 'az' || c === 'az.cmd') { out.push('Azure CLI 2.55.0 (Lab VM Simulation)'); out.push('Use "az login" to sign in (Simulation)'); }
    else if (c === 'connect-msolservice') { out.push('Connecting to Microsoft Online Service... (Simulation)'); }
    else if (cmd === '') { /* empty line */ }
    else {
      err.push(`'${parts[0]}' is not recognized as an internal or external command.`);
      err.push(`Type 'help' for available commands.`);
    }
  } catch (e) {
    err.push(e.message || String(e));
  }

  return { out, err, cwd };
}

function getPowerShellHelp() {
  return `Available PowerShell commands (Lab VM Simulation):

FILE SYSTEM:
  Get-ChildItem (dir, ls)    List directory contents
  New-Item (mkdir, md)       Create new folder
  Copy-Item (copy, cp)        Copy files
  Move-Item (move, mv)       Move files
  Remove-Item (del, rm)       Delete files
  Rename-Item (ren)          Rename files
  Get-Content (type, cat)    Display file contents
  Test-Path                  Check if path exists
  Tree                       Show folder tree

LOCAL USERS (Lab 1):
  Get-LocalUser [name]       List or show local users
  New-LocalUser -Name <n>    Create a new user
  Enable-LocalUser -Name <n> Enable a user
  Disable-LocalUser -Name <n> Disable a user
  Unlock-LocalUser -Name <n> Unlock a user
  Set-LocalUser -Name <n> -Password <p>  Reset password
  Remove-LocalUser -Name <n> Delete a user

LOCAL GROUPS (Lab 1):
  Get-LocalGroup [name]      List or show groups
  New-LocalGroup -Name <n>   Create a group
  Add-LocalGroupMember -Group <g> -Member <u>
  Remove-LocalGroupMember -Group <g> -Member <u>

NTFS PERMISSIONS (Lab 1):
  Get-Acl <path>             Show NTFS permissions
  Test-Access -User <u> -Path <p>  Test folder access

ENTRA ID / MFA (Lab 2):
  Get-EntraUser [upn]        List or show Entra users
  Get-MfaStatus <upn>        Show MFA methods for a user
  Reset-Mfa -User <upn>      Reset all MFA methods
  Get-CA                     List Conditional Access policies
  Get-SignInLog              Show sign-in logs
  Test-SignIn -User <upn>    Simulate a sign-in attempt

TICKETING (Lab 3):
  Get-Ticket [number]        List or show tickets
  New-Ticket -Title "..." -Category <c> -Impact <H/M/L> -Urgency <H/M/L>
  Close-Ticket -Id <INC000001> -Resolution "..."
  Get-Kb                     List knowledge base articles
  Get-Report                 Show ticket metrics

ACTIVE DIRECTORY:
  Get-ADUser [sam]           List or show AD users
  New-ADUser -Name <sam>     Create AD user
  Set-ADUser <sam>           Update AD user properties
  Enable-ADAccount <sam>     Enable AD account
  Disable-ADAccount <sam>    Disable AD account
  Unlock-ADAccount <sam>     Unlock AD account
  Set-ADAccountPassword      Reset AD password
  Remove-ADUser <sam>        Delete AD user
  Get-ADGroup [name]         List or show AD groups
  New-ADGroup -Name <name>   Create AD group
  Remove-ADGroup <name>     Delete AD group
  Add-ADGroupMember          Add user to group
  Remove-ADGroupMember       Remove user from group
  Get-ADComputer [name]      List or show AD computers
  Get-ADDomain               Show domain info and DCs
  Get-ADOrganizationalUnit   List OUs
  Search-ADAccount -Filter   Search AD objects
  Get-ADUserMemberOf <sam>   Show user group membership

SYSTEM:
  systeminfo                 System information
  ipconfig                   IP configuration
  ping <host>                Ping a host
  tracert <host>             Trace route
  netstat                    Network statistics
  tasklist (Get-Process)     List running processes
  Get-Service                List services
  whoami                     Current user
  hostname                   Computer name
  ver                        Windows version
  date / time                Current date/time
  cls (Clear-Host)           Clear screen
  exit                       Close terminal
  help                       Show this help`;
}

function getCmdHelp() {
  return `Available CMD commands (Lab VM Simulation):

FILE SYSTEM:
  dir                        List directory contents
  mkdir (md)                 Create directory
  copy                       Copy files
  move                       Move files
  del (erase)                Delete files
  ren (rename)               Rename files
  type                       Display file contents
  tree                       Show folder tree
  cd                         Change directory
  attrib                     Show file attributes

LOCAL USERS (Lab 1):
  net user                   List all users
  net user <name>            Show user details
  net user <name> <pwd>      Reset user password
  net user <name> /add       Create a user
  net user <name> /active:no Disable a user
  net user <name> /delete    Delete a user

LOCAL GROUPS (Lab 1):
  net localgroup             List all groups
  net localgroup <name>      Show group members
  net localgroup <name> /add Create a group
  net localgroup <g> <u> /add      Add user to group
  net localgroup <g> <u> /delete  Remove user from group

NTFS (Lab 1):
  icacls <path>              Show NTFS permissions

SYSTEM:
  systeminfo                 System information
  ipconfig                   IP configuration
  ping <host>                Ping a host
  tracert <host>             Trace route
  netstat                    Network statistics
  tasklist                   List processes
  whoami                     Current user
  hostname                   Computer name
  ver                        Windows version
  date / time                Current date/time
  cls                        Clear screen
  exit                       Close terminal
  help                       Show this help

NETWORK:
  nslookup <host>            DNS lookup
  arp                        ARP table
  route                      Routing table
  netsh                      Network shell

UTILITIES:
  sfc /scannow               System file checker
  chkdsk                     Check disk
  gpupdate /force            Update group policy
  shutdown /s                Shutdown
  shutdown /r                Restart
  taskkill /pid <pid>         Kill process`;
}
