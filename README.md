# Lab VM — IT / IAM / Help Desk Desktop Simulation

A browser-based **Windows 11-style desktop** that unifies all three IT/IAM/Help Desk labs into a single login experience. Every tool is a fully interactive replica backed by a real SQLite database, with intentional failure scenarios built in for troubleshooting practice.

> This is a personal training simulation. It is **not** a real Windows OS, not real Microsoft Entra ID, and not real ServiceNow. It simulates those tools for hands-on learning.

## Quick start

```bash
cd lab-vm
pip install -r requirements-dev.txt
python database.py     # (re)create + seed the database
python main.py         # start the server
```

Open http://127.0.0.1:8000 in your browser.

### Login accounts
| Username   | Password        | Role      | Can do |
|------------|-----------------|-----------|-------|
| `admin`    | `LabAdmin#2026` | Admin     | Everything |
| `helpdesk` | `HelpDesk#2026` | Agent     | Tickets, labs, KB |
| `jdoe`     | `Requester#2026`| Requester | Submit tickets |

## What's inside

You log into a Windows 11-style desktop with a Start menu, taskbar, draggable/resizable windows, and desktop icons. Double-click an icon (or use Start) to open an app.

### Lab 1 — Windows Local Users & Access (`lusrmgr`, File Explorer, PowerShell)
- **Local Users and Groups** — create/enable/disable/lock/unlock/delete users, manage group membership, reset passwords, view account state.
- **File Explorer** — browse `C:\LabData` folders, view/edit NTFS ACLs, add/remove permissions, create subfolders.
- **Effective Access** — compute the real effective permission for a user on a folder (account state + group membership + ACLs).
- **Access Test** — simulate a user logging on and opening a folder; returns step-by-step pass/fail with the root cause.
- **PowerShell** — a working simulated terminal (`Get-LocalUser`, `Enable-LocalUser`, `Get-Acl`, `Test-Access`, `Get-MfaStatus`, `Get-Ticket`, etc.) that operates on the same lab data.

### Lab 2 — Microsoft Entra ID & MFA
- **Entra ID Admin Center** — manage cloud users, groups, MFA methods, and Conditional Access policies.
- **MFA** — register/remove methods, perform a help-desk MFA reset.
- **Conditional Access** — create policies, scope them to groups, toggle On / Off / Report-only.
- **Sign-in Logs** — view sign-in events and **simulate a sign-in** that is evaluated against the user's account state, group membership, MFA registration, and matching CA policy.

### Lab 3 — Help Desk / ITSM Simulation
- **Service Desk Console** — full ticket lifecycle (New → Assigned → In Progress → Pending → Resolved → Closed → Reopened), auto-priority from impact×urgency, SLA targets, assignment groups, work notes, resolution.
- **Knowledge Base** — create and browse KB articles.
- **Reports Dashboard** — totals, by category/priority/status, reopened and escalated counts.

## Intentional failure scenarios (troubleshoot these)

The seeded data contains deliberate broken states. Practice diagnosing and fixing them:

| Scenario | Where | Symptom | Root cause |
|----------|-------|---------|------------|
| Locked account | Lab 1 | `LockedUser` cannot log on | Account locked — unlock in lusrmgr |
| Expired password | Lab 1 | `ExpiredPwd` cannot log on | Password expired — reset it |
| Disabled account still in group | Lab 1 | `TermUser` still in `FinanceUsers` | Offboarding incomplete — remove membership |
| HR folder no access | Lab 1 | No group has access to `C:\LabData\HR` | Missing NTFS ACE — add it |
| MFA not registered | Lab 2 | `npatel` fails MFA | In MFA group but no method — register one |
| Disabled user in MFA group | Lab 2 | `tstone` blocked | Disabled account still in `MFA-Lab-Users` |
| Folder access ticket | Lab 3 | INC000003 | Investigate with Lab 1 tools, fix, resolve |
| MFA failure ticket | Lab 3 | INC000004/000005 | Investigate with Lab 2 tools, fix, resolve |
| Offboarding ticket | Lab 3 | INC000010 | Disable account (Lab 1), remove access, verify |
| Excessive privilege | Lab 3 | INC000011 | Remove unnecessary admin rights, test, document |

## Integrated workflow example (folder access incident)

1. Open **Service Desk Console** → open INC000003 "Folder Access Denied".
2. Note the user and the folder.
3. Open **Local Users and Groups** → check the user's group membership.
4. Open **File Explorer** → select the folder → **Effective Access** tab → check the user's access.
5. Use **Access Test** to reproduce the denial and read the root cause.
6. Fix it: add the user to the right group, or add an NTFS ACE.
7. Re-run Access Test to validate.
8. Back in the ticket, add investigation notes and mark Resolved.

The same cross-lab flow works for MFA failures (Service Desk → Entra portal → Sign-in Logs → simulate sign-in → resolve).

## Architecture

```
lab-vm/
├── main.py            # FastAPI: JSON API for all 3 labs + static SPA serving
├── database.py        # SQLite schema + seed data (with intentional failures)
├── build_exe.py       # PyInstaller build script for standalone executable
├── landing.html       # Landing page for the project website
├── requirements.txt
├── README.md
└── static/
    ├── index.html     # Windows 11 desktop shell (login, taskbar, start menu)
    ├── css/
    │   ├── desktop.css  # Windows 11 look (taskbar, windows, start menu)
    │   ├── apps.css     # lab tool + chatbot styling
    │   ├── ad.css       # Active Directory MMC snap-in styling
    │   ├── accessories.css  # Chrome, Notepad++, Calendar, etc.
    │   ├── office.css   # Word, Excel, PowerPoint
    │   └── roadmap.css  # Lab Roadmap
    └── js/
        ├── main.js     # desktop shell, app registry, login, taskbar pinning
        ├── api.js      # API client (labs, Ollama, browser proxy)
        ├── wm.js       # window manager (drag/resize/min/max/close/pin)
        ├── context-menus.js  # Windows-style right-click menus
        └── apps/
            ├── lab1.js      # Local Users & Groups, File Explorer/NTFS, PowerShell
            ├── lab2.js      # Entra portal, MFA, Conditional Access, Sign-in logs
            ├── lab3.js      # Service Desk, Knowledge Base, Reports
            ├── ad.js        # Active Directory Users and Computers (MMC)
            ├── chatbot.js   # Lab Assistant (Ollama-powered AI chat)
            ├── accessories.js  # Chrome, Calculator, Notepad++, Calendar, Sticky Notes
            ├── office.js    # Word, Excel, PowerPoint simulations
            ├── settings.js  # Settings (themes, wallpaper, profile)
            ├── roadmap.js   # Lab Roadmap guide
            └── terminal.js  # PowerShell + CMD terminal
```

## AI Features (Ollama)

The app includes AI-powered features using [Ollama](https://ollama.com):

- **Lab Assistant** — a chatbot that answers questions about IT, IAM, Active Directory, and help desk topics
- **AI Ticket Generation** — auto-generates realistic help desk tickets using Ollama
- **AI Ticket Review** — deterministic checks combined with Ollama-written feedback

To enable AI features:
1. Install Ollama from https://ollama.com/download
2. Run `ollama pull llama3.2`
3. Ollama runs locally — no API keys, no cloud, no data leaves your machine

## Building a standalone executable

```bash
pip install pyinstaller
python build_exe.py
```

The executable is created in `dist/IT_IAM_HelpDesk_Lab/`. Distribute it via GitHub Releases.

## Tech stack
- **Backend:** FastAPI + SQLite (no external DB needed)
- **Frontend:** Vanilla JS (ES modules) + CSS — no build step
- **AI:** Ollama (local LLM, runs on your computer)
- **Runs locally on** `127.0.0.1:8000`

## Disclaimer
Personal training environment. All users, tickets, and data are fictional. This simulates real tools for learning; it is not affiliated with Microsoft or ServiceNow.
