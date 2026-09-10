"""
Lab VM database layer.
SQLite schema + seed data for all three labs:
  Lab 1 - Windows local users, groups, folders, NTFS ACLs
  Lab 2 - Entra ID users, groups, MFA methods, Conditional Access, sign-in logs
  Lab 3 - Help desk tickets, notes, knowledge base, users
"""
import sqlite3
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
def _now_dt():
    return datetime.now(timezone.utc)

# When bundled with PyInstaller, use the exe's directory so the database
# persists next to the executable instead of in a temp folder.
if getattr(sys, 'frozen', False):
    DATABASE_PATH = Path(os.path.dirname(sys.executable)) / "labvm.db"
else:
    DATABASE_PATH = Path(__file__).parent / "labvm.db"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(reset: bool = False):
    conn = get_db()
    cur = conn.cursor()

    if reset:
        for t in [
            "ticket_notes", "tickets", "knowledge_base", "sign_in_logs",
            "ca_policy_scopes", "ca_policies", "mfa_methods", "entra_group_members",
            "entra_groups", "entra_users", "folder_acls", "folders",
            "local_group_members", "local_groups", "local_users", "users",
        ]:
            cur.execute(f"DROP TABLE IF EXISTS {t}")

    # ---- Auth / portal users (the people who log into the Lab VM desktop) ----
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,            -- admin | agent | requester
            full_name TEXT,
            email TEXT,
            avatar TEXT
        )
    ''')

    # ---- Lab 1: Windows local users ----
    cur.execute('''
        CREATE TABLE IF NOT EXISTS local_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT,
            description TEXT,
            enabled INTEGER DEFAULT 1,
            locked INTEGER DEFAULT 0,
            password_expired INTEGER DEFAULT 0,
            password_last_set TEXT,
            account_created TEXT,
            last_logon TEXT,
            password TEXT
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS local_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            built_in INTEGER DEFAULT 0
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS local_group_members (
            group_id INTEGER,
            user_id INTEGER,
            PRIMARY KEY (group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES local_groups(id),
            FOREIGN KEY (user_id) REFERENCES local_users(id)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            parent_id INTEGER,
            has_test_file INTEGER DEFAULT 1
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS folder_acls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id INTEGER NOT NULL,
            principal TEXT NOT NULL,          -- user or group name
            principal_type TEXT NOT NULL,     -- user | group | builtin
            permission TEXT NOT NULL,          -- Full Control | Modify | Read & Execute | Read | Write
            inherited INTEGER DEFAULT 0,
            allow INTEGER DEFAULT 1,
            FOREIGN KEY (folder_id) REFERENCES folders(id)
        )
    ''')

    # ---- Lab 2: Entra ID ----
    cur.execute('''
        CREATE TABLE IF NOT EXISTS entra_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upn TEXT UNIQUE NOT NULL,
            display_name TEXT,
            job_title TEXT,
            department TEXT,
            account_enabled INTEGER DEFAULT 1,
            sign_in_blocked INTEGER DEFAULT 0,
            created TEXT,
            last_signin TEXT
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS entra_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            display_name TEXT UNIQUE NOT NULL,
            description TEXT,
            group_type TEXT DEFAULT 'Security'
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS entra_group_members (
            group_id INTEGER,
            user_id INTEGER,
            PRIMARY KEY (group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES entra_groups(id),
            FOREIGN KEY (user_id) REFERENCES entra_users(id)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS mfa_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            method_type TEXT NOT NULL,        -- Authenticator App | Phone | Email | FIDO2 Key
            status TEXT NOT NULL,             -- registered | pending
            is_default INTEGER DEFAULT 0,
            registered_on TEXT,
            FOREIGN KEY (user_id) REFERENCES entra_users(id)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS ca_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            state TEXT NOT NULL,              -- On | Off | Report-only
            applications TEXT NOT NULL,       -- 'All cloud apps' or specific
            grant_control TEXT NOT NULL,     -- Require MFA | Block access | Require MFA + compliant device
            created TEXT,
            report_only INTEGER DEFAULT 0
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS ca_policy_scopes (
            policy_id INTEGER,
            group_id INTEGER,
            scope_type TEXT DEFAULT 'include',  -- include | exclude
            PRIMARY KEY (policy_id, group_id, scope_type),
            FOREIGN KEY (policy_id) REFERENCES ca_policies(id),
            FOREIGN KEY (group_id) REFERENCES entra_groups(id)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS sign_in_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            upn TEXT,
            app TEXT,
            time TEXT,
            ip TEXT,
            client_app TEXT,
            result TEXT,                     -- Success | MFA Failed | Blocked by CA | Invalid credentials | Account locked
            error_code TEXT,
            conditional_access TEXT,
            detail TEXT,
            FOREIGN KEY (user_id) REFERENCES entra_users(id)
        )
    ''')

    # ---- Lab 3: Ticketing ----
    cur.execute('''
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT,
            subcategory TEXT,
            impact TEXT,
            urgency TEXT,
            priority TEXT,
            status TEXT,
            assignment_group TEXT,
            assigned_agent TEXT,
            created_time TEXT,
            updated_time TEXT,
            sla_target TEXT,
            resolution TEXT,
            requester TEXT
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS ticket_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER,
            note_text TEXT,
            created_by TEXT,
            created_time TEXT,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kb_number TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            category TEXT,
            created_time TEXT
        )
    ''')

    # ===== Active Directory =====
    cur.executescript('''
        CREATE TABLE IF NOT EXISTS ad_ous (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dn TEXT NOT NULL,
            parent_id INTEGER,
            description TEXT,
            protected INTEGER DEFAULT 0,
            created TEXT
        );
        CREATE TABLE IF NOT EXISTS ad_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sam_account_name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            user_principal_name TEXT,
            dn TEXT,
            ou_id INTEGER,
            enabled INTEGER DEFAULT 1,
            locked INTEGER DEFAULT 0,
            password_expired INTEGER DEFAULT 0,
            password_never_expires INTEGER DEFAULT 0,
            cannot_change_password INTEGER DEFAULT 0,
            smartcard_required INTEGER DEFAULT 0,
            department TEXT,
            title TEXT,
            email TEXT,
            phone TEXT,
            manager TEXT,
            description TEXT,
            password TEXT,
            password_last_set TEXT,
            last_logon TEXT,
            account_created TEXT,
            home_drive TEXT,
            home_directory TEXT,
            profile_path TEXT,
            logon_script TEXT
        );
        CREATE TABLE IF NOT EXISTS ad_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            sam_account_name TEXT NOT NULL,
            dn TEXT,
            ou_id INTEGER,
            group_type TEXT DEFAULT 'Security',
            scope TEXT DEFAULT 'Global',
            description TEXT,
            managed_by TEXT,
            created TEXT
        );
        CREATE TABLE IF NOT EXISTS ad_group_members (
            group_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            member_type TEXT DEFAULT 'user',
            PRIMARY KEY (group_id, member_id, member_type)
        );
        CREATE TABLE IF NOT EXISTS ad_computers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            dn TEXT,
            ou_id INTEGER,
            os TEXT,
            os_version TEXT,
            enabled INTEGER DEFAULT 1,
            last_logon TEXT,
            created TEXT,
            ipv4_address TEXT,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS ad_domain_controllers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dn TEXT,
            os TEXT,
            site TEXT,
            roles TEXT,
            enabled INTEGER DEFAULT 1,
            created TEXT
        );
    ''')

    seed(conn)
    conn.commit()
    conn.close()


def seed(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] > 0:
        return  # already seeded

    now = _now()

    # ---- Portal users (log into the desktop) ----
    cur.executemany(
        "INSERT INTO users (username, password, role, full_name, email, avatar) VALUES (?,?,?,?,?,?)",
        [
            ("admin", "LabAdmin#2026", "admin", "Lab Administrator", "admin@lab.local", "A"),
            ("helpdesk", "HelpDesk#2026", "agent", "Help Desk Agent", "helpdesk@lab.local", "H"),
            ("jdoe", "Requester#2026", "requester", "Jane Doe (Requester)", "jdoe@lab.local", "J"),
        ],
    )

    # =====================================================================
    # LAB 1 - Windows local users, groups, folders, NTFS
    # =====================================================================
    cur.executemany(
        "INSERT INTO local_users (username, full_name, description, enabled, locked, password_expired, password_last_set, account_created, last_logon, password) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            ("LabAdmin", "Lab Administrator", "Break-glass lab administrator", 1, 0, 0, now, now, now, "LabAdmin#2026"),
            ("HelpDeskUser", "Help Desk Training User", "Training help desk account", 1, 0, 0, now, now, now, "HelpDesk#2026"),
            ("FinanceTest", "Finance Test User", "Finance department test user", 1, 0, 0, now, now, now, "Finance#2026"),
            ("ITUser01", "IT User One", "IT department test user", 1, 0, 0, now, now, now, "ITUser#2026"),
            # INTENTIONAL FAILURE: a disabled account the user must troubleshoot
            ("TermUser", "Terminated Employee", "Departed employee - should be disabled", 1, 0, 0, now, now, now, "Term#2026"),
            ("LockedUser", "Locked Test User", "Account that got locked out", 1, 1, 0, now, now, now, "Locked#2026"),
            ("ExpiredPwd", "Expired Password User", "Password expired - must reset", 1, 0, 1, (_now_dt() - timedelta(days=90)).isoformat(timespec="seconds"), now, now, "Old#2026"),
        ],
    )

    cur.executemany(
        "INSERT INTO local_groups (name, description, built_in) VALUES (?,?,?)",
        [
            ("Administrators", "Full system access", 1),
            ("Users", "Standard users", 1),
            ("Guests", "Limited access", 1),
            ("ITSupport", "Training IT support group", 0),
            ("FinanceUsers", "Finance department access group", 0),
        ],
    )

    # group memberships (resolve ids after insert)
    def gid(name):
        r = cur.execute("SELECT id FROM local_groups WHERE name=?", (name,)).fetchone()
        return r[0] if r else None

    def uid(name):
        r = cur.execute("SELECT id FROM local_users WHERE username=?", (name,)).fetchone()
        return r[0] if r else None

    memberships = [
        ("Administrators", "LabAdmin"),
        ("Users", "HelpDeskUser"), ("Users", "FinanceTest"), ("Users", "ITUser01"), ("Users", "TermUser"), ("Users", "LockedUser"), ("Users", "ExpiredPwd"),
        ("ITSupport", "HelpDeskUser"), ("ITSupport", "ITUser01"),
        ("FinanceUsers", "FinanceTest"),
        # INTENTIONAL FAILURE: TermUser still in FinanceUsers (should have been removed on offboarding)
        ("FinanceUsers", "TermUser"),
        ("Guests", "Guest") if False else ("Guests", None),
    ]
    for g, u in memberships:
        if u is None:
            continue
        cur.execute("INSERT OR IGNORE INTO local_group_members (group_id, user_id) VALUES (?,?)", (gid(g), uid(u)))

    # Folders
    cur.executemany(
        "INSERT INTO folders (path, parent_id, has_test_file) VALUES (?,?,?)",
        [
            ("C:\\LabData", None, 0),
            ("C:\\LabData\\Public", 1, 1),
            ("C:\\LabData\\IT", 1, 1),
            ("C:\\LabData\\Finance", 1, 1),
            ("C:\\LabData\\HR", 1, 1),
        ],
    )

    def fid(path):
        r = cur.execute("SELECT id FROM folders WHERE path=?", (path,)).fetchone()
        return r[0] if r else None

    # NTFS ACLs
    acl_rows = [
        # C:\LabData (root - inherits to children)
        (fid("C:\\LabData"), "SYSTEM", "builtin", "Full Control", 0, 1),
        (fid("C:\\LabData"), "Administrators", "builtin", "Full Control", 0, 1),
        (fid("C:\\LabData"), "Users", "builtin", "Read & Execute", 0, 1),
        # Public
        (fid("C:\\LabData\\Public"), "SYSTEM", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\Public"), "Administrators", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\Public"), "Users", "builtin", "Read & Execute", 1, 1),
        (fid("C:\\LabData\\Public"), "ITSupport", "group", "Modify", 0, 1),
        # IT
        (fid("C:\\LabData\\IT"), "SYSTEM", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\IT"), "Administrators", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\IT"), "ITSupport", "group", "Modify", 0, 1),
        # Finance
        (fid("C:\\LabData\\Finance"), "SYSTEM", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\Finance"), "Administrators", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\Finance"), "FinanceUsers", "group", "Modify", 0, 1),
        # HR - INTENTIONAL FAILURE: no explicit ACL for HR group, so only inherited Users read
        (fid("C:\\LabData\\HR"), "SYSTEM", "builtin", "Full Control", 1, 1),
        (fid("C:\\LabData\\HR"), "Administrators", "builtin", "Full Control", 1, 1),
    ]
    cur.executemany(
        "INSERT INTO folder_acls (folder_id, principal, principal_type, permission, inherited, allow) VALUES (?,?,?,?,?,?)",
        acl_rows,
    )

    # =====================================================================
    # LAB 2 - Entra ID
    # =====================================================================
    cur.executemany(
        "INSERT INTO entra_users (upn, display_name, job_title, department, account_enabled, sign_in_blocked, created, last_signin) VALUES (?,?,?,?,?,?,?,?)",
        [
            ("labadmin@laborg.onmicrosoft.com", "Lab Administrator", "IT Admin", "IT", 1, 0, now, now),
            ("helpdesk@laborg.onmicrosoft.com", "Help Desk Agent", "Support Analyst", "IT", 1, 0, now, now),
            ("jdoe@laborg.onmicrosoft.com", "Jane Doe", "Accountant", "Finance", 1, 0, now, now),
            ("bsmith@laborg.onmicrosoft.com", "Bob Smith", "Analyst", "Finance", 1, 0, now, now),
            ("mlee@laborg.onmicrosoft.com", "Min Lee", "Developer", "Engineering", 1, 0, now, now),
            # INTENTIONAL FAILURE: account disabled but still in MFA group
            ("tstone@laborg.onmicrosoft.com", "Tom Stone", "Former Employee", "Finance", 0, 0, now, (_now_dt() - timedelta(days=10)).isoformat(timespec="seconds")),
            # INTENTIONAL FAILURE: no MFA registered despite being in MFA-required group
            ("npatel@laborg.onmicrosoft.com", "Nina Patel", "Analyst", "Engineering", 1, 0, now, now),
        ],
    )

    cur.executemany(
        "INSERT INTO entra_groups (display_name, description, group_type) VALUES (?,?,?)",
        [
            ("MFA-Lab-Users", "Users required to perform MFA", "Security"),
            ("HelpDesk-Lab", "Help desk simulation team", "Security"),
            ("Finance-Team", "Finance department", "Security"),
            ("Engineering-Team", "Engineering department", "Security"),
            ("GlobalAdmins", "Global administrators (break-glass)", "Security"),
        ],
    )

    def egid(name):
        r = cur.execute("SELECT id FROM entra_groups WHERE display_name=?", (name,)).fetchone()
        return r[0] if r else None

    def euid(upn):
        r = cur.execute("SELECT id FROM entra_users WHERE upn=?", (upn,)).fetchone()
        return r[0] if r else None

    entra_memberships = [
        ("MFA-Lab-Users", "jdoe@laborg.onmicrosoft.com"),
        ("MFA-Lab-Users", "bsmith@laborg.onmicrosoft.com"),
        ("MFA-Lab-Users", "mlee@laborg.onmicrosoft.com"),
        ("MFA-Lab-Users", "npatel@laborg.onmicrosoft.com"),  # in MFA group but no method registered
        ("MFA-Lab-Users", "tstone@laborg.onmicrosoft.com"),  # disabled but still in group
        ("HelpDesk-Lab", "helpdesk@laborg.onmicrosoft.com"),
        ("Finance-Team", "jdoe@laborg.onmicrosoft.com"),
        ("Finance-Team", "bsmith@laborg.onmicrosoft.com"),
        ("Finance-Team", "tstone@laborg.onmicrosoft.com"),
        ("Engineering-Team", "mlee@laborg.onmicrosoft.com"),
        ("Engineering-Team", "npatel@laborg.onmicrosoft.com"),
        ("GlobalAdmins", "labadmin@laborg.onmicrosoft.com"),
    ]
    for g, u in entra_memberships:
        cur.execute("INSERT OR IGNORE INTO entra_group_members (group_id, user_id) VALUES (?,?)", (egid(g), euid(u)))

    # MFA methods
    cur.executemany(
        "INSERT INTO mfa_methods (user_id, method_type, status, is_default, registered_on) VALUES (?,?,?,?,?)",
        [
            (euid("labadmin@laborg.onmicrosoft.com"), "Authenticator App", "registered", 1, now),
            (euid("labadmin@laborg.onmicrosoft.com"), "Phone", "registered", 0, now),
            (euid("labadmin@laborg.onmicrosoft.com"), "FIDO2 Key", "registered", 0, now),
            (euid("helpdesk@laborg.onmicrosoft.com"), "Authenticator App", "registered", 1, now),
            (euid("helpdesk@laborg.onmicrosoft.com"), "Phone", "registered", 0, now),
            (euid("jdoe@laborg.onmicrosoft.com"), "Authenticator App", "registered", 1, now),
            (euid("bsmith@laborg.onmicrosoft.com"), "Phone", "registered", 1, now),
            (euid("mlee@laborg.onmicrosoft.com"), "Authenticator App", "registered", 1, now),
            # npatel: NO methods registered (intentional failure)
        ],
    )

    # Conditional Access policies
    cur.executemany(
        "INSERT INTO ca_policies (name, state, applications, grant_control, created, report_only) VALUES (?,?,?,?,?,?)",
        [
            ("CA-LAB-Require-MFA", "On", "All cloud apps", "Require MFA", now, 0),
            ("CA-LAB-Block-Legacy-Auth", "On", "Exchange ActiveSync, IMAP, POP", "Block access", now, 0),
            ("CA-LAB-MFA-Admins", "Report-only", "All cloud apps", "Require MFA", now, 1),
        ],
    )

    # Scope CA-LAB-Require-MFA to MFA-Lab-Users
    mfa_gid = egid("MFA-Lab-Users")
    admin_gid = egid("GlobalAdmins")
    ca_mfa = cur.execute("SELECT id FROM ca_policies WHERE name='CA-LAB-Require-MFA'").fetchone()[0]
    ca_admins = cur.execute("SELECT id FROM ca_policies WHERE name='CA-LAB-MFA-Admins'").fetchone()[0]
    cur.execute("INSERT INTO ca_policy_scopes (policy_id, group_id, scope_type) VALUES (?,?,?)", (ca_mfa, mfa_gid, "include"))
    cur.execute("INSERT INTO ca_policy_scopes (policy_id, group_id, scope_type) VALUES (?,?,?)", (ca_admins, admin_gid, "include"))

    # Sign-in logs
    cur.executemany(
        "INSERT INTO sign_in_logs (user_id, upn, app, time, ip, client_app, result, error_code, conditional_access, detail) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            (euid("jdoe@laborg.onmicrosoft.com"), "jdoe@laborg.onmicrosoft.com", "Microsoft 365", now, "203.0.113.24", "Browser", "Success", "0", "CA-LAB-Require-MFA: MFA passed", "Interactive sign-in succeeded after MFA"),
            (euid("npatel@laborg.onmicrosoft.com"), "npatel@laborg.onmicrosoft.com", "Microsoft 365", now, "203.0.113.55", "Browser", "MFA Failed", "50074", "CA-LAB-Require-MFA: MFA challenged", "User has no registered MFA method - cannot satisfy challenge"),
            (euid("tstone@laborg.onmicrosoft.com"), "tstone@laborg.onmicrosoft.com", "Microsoft 365", now, "198.51.100.7", "Browser", "Blocked by CA", "53003", "CA-LAB-Require-MFA: Blocked", "Account disabled - sign-in blocked"),
            (euid("bsmith@laborg.onmicrosoft.com"), "bsmith@laborg.onmicrosoft.com", "Azure Portal", now, "203.0.113.24", "Browser", "Success", "0", "CA-LAB-Require-MFA: MFA passed", "Interactive sign-in succeeded"),
            (euid("mlee@laborg.onmicrosoft.com"), "mlee@laborg.onmicrosoft.com", "Microsoft 365", now, "203.0.113.99", "Mobile App", "MFA Failed", "500121", "CA-LAB-Require-MFA: MFA failed", "Authenticator push denied by user"),
            (euid("helpdesk@laborg.onmicrosoft.com"), "helpdesk@laborg.onmicrosoft.com", "Azure Portal", now, "203.0.113.10", "Browser", "Success", "0", "No CA policy matched", "Help desk account sign-in"),
        ],
    )

    # =====================================================================
    # LAB 3 - Tickets, KB
    # =====================================================================
    sla = {
        "P1": (_now_dt() + timedelta(hours=2)).isoformat(timespec="seconds"),
        "P2": (_now_dt() + timedelta(hours=8)).isoformat(timespec="seconds"),
        "P3": (_now_dt() + timedelta(hours=24)).isoformat(timespec="seconds"),
        "P4": (_now_dt() + timedelta(hours=72)).isoformat(timespec="seconds"),
    }
    cur.executemany(
        "INSERT INTO tickets (ticket_number, title, description, category, subcategory, impact, urgency, priority, status, assignment_group, assigned_agent, created_time, updated_time, sla_target, resolution, requester) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            ("INC000001", "Password Reset Request", "User cannot log in to Windows - forgot password", "Account & Access", "Password Reset", "Medium", "High", "P2", "In Progress", "L1 Help Desk", "helpdesk", now, now, sla["P2"], "", "jdoe"),
            ("INC000002", "Locked Local Account", "Account locked after repeated failed logins", "Account & Access", "Account Lockout", "High", "High", "P1", "Assigned", "L1 Help Desk", "helpdesk", now, now, sla["P1"], "", "jdoe"),
            ("INC000003", "Folder Access Denied", "Cannot access Finance folder - access denied error", "Account & Access", "Folder Permissions", "High", "Medium", "P2", "New", "L1 Help Desk", "", now, now, sla["P2"], "", "jdoe"),
            ("INC000004", "MFA Registration Problem", "Cannot register authenticator app for MFA", "MFA / Identity", "MFA Registration", "Medium", "Medium", "P3", "New", "L2 IAM", "", now, now, sla["P3"], "", "jdoe"),
            ("INC000005", "MFA Prompt Not Appearing", "User is not being prompted for MFA at sign-in", "MFA / Identity", "MFA Enforcement", "Medium", "High", "P2", "New", "L2 IAM", "", now, now, sla["P2"], "", "jdoe"),
            ("INC000006", "Software Installation Request", "Request to install Adobe Acrobat Reader", "Software", "Installation", "Low", "Low", "P4", "New", "L1 Help Desk", "", now, now, sla["P4"], "", "jdoe"),
            ("INC000007", "VPN Connectivity Issue", "Cannot connect to corporate VPN", "Network", "VPN", "High", "High", "P1", "New", "L2/L3 Infrastructure", "", now, now, sla["P1"], "", "jdoe"),
            ("INC000008", "Suspicious Sign-in Report", "User reports sign-in from unfamiliar location", "Security", "Suspicious Activity", "High", "High", "P1", "New", "Security", "", now, now, sla["P1"], "", "jdoe"),
            ("INC000009", "New User Access Request", "Onboard new employee - needs accounts and access", "Request", "Onboarding", "Medium", "Medium", "P3", "New", "L1 Help Desk", "", now, now, sla["P3"], "", "jdoe"),
            ("INC000010", "Terminated User Access Removal", "Offboard departed employee - disable and remove access", "Request", "Offboarding", "Medium", "High", "P2", "New", "L1 Help Desk", "", now, now, sla["P2"], "", "jdoe"),
            ("INC000011", "Excessive Privilege Report", "Help desk account found to have administrator rights", "Security", "Least Privilege", "High", "Medium", "P2", "New", "Security", "", now, now, sla["P2"], "", "jdoe"),
            ("INC000012", "Printer Issue", "Network printer offline for Finance team", "Hardware", "Printer", "Medium", "Low", "P3", "New", "L1 Help Desk", "", now, now, sla["P3"], "", "jdoe"),
            ("INC000013", "Repeated Application Crash", "Excel crashes on launch for multiple users", "Software", "Application Crash", "Medium", "Medium", "P3", "New", "L1 Help Desk", "", now, now, sla["P3"], "", "jdoe"),
            ("INC000014", "Azure VM Login Issue", "Cannot RDP to lab VM", "Account & Access", "VM Access", "High", "High", "P1", "New", "L2/L3 Infrastructure", "", now, now, sla["P1"], "", "jdoe"),
            ("INC000015", "Knowledge Base Request", "Need KB article for folder access request process", "Request", "Documentation", "Low", "Low", "P4", "Resolved", "L1 Help Desk", "helpdesk", now, now, sla["P4"], "Created KB005 covering folder access request procedure", "jdoe"),
        ],
    )

    cur.executemany(
        "INSERT INTO knowledge_base (kb_number, title, content, category, created_time) VALUES (?,?,?,?,?)",
        [
            ("KB001", "Windows Local Account Unlock Procedure", "Purpose: Unlock a locked local Windows account.\n\nPrerequisites: Administrator or Account Operator rights.\n\nProcedure:\n1. Open Local Users and Groups (lusrmgr.msc)\n2. Locate the locked user\n3. Uncheck 'Account is locked out'\n4. Have the user retry logon\n\nValidation: User can log on successfully.\n\nEscalation: If the account re-locks immediately, investigate the source of failed attempts (mapped drives, scheduled tasks, mobile devices).", "Account & Access", now),
            ("KB002", "Requesting Folder Access", "Purpose: Grant a user access to a protected folder.\n\nPrerequisites: Approved access request.\n\nProcedure:\n1. Verify the user's group membership matches the required access\n2. Check NTFS permissions on the folder Security tab\n3. Add the user or their group with the minimum required permission\n4. Have the user test access\n\nValidation: User can open/read/write files as required.\n\nEscalation: If access is still denied, check effective access and inheritance.", "Account & Access", now),
            ("KB003", "MFA Registration Troubleshooting", "Purpose: Help a user register an MFA method.\n\nPrerequisites: User account is enabled and in an MFA-required group.\n\nProcedure:\n1. Verify the user is in the correct group (e.g. MFA-Lab-Users)\n2. Verify no registered methods exist\n3. Have the user register via the security info page\n4. Confirm registration in the admin center\n5. Test sign-in\n\nValidation: User is prompted for MFA and completes it.\n\nEscalation: If registration fails, check Conditional Access policy scope and authentication method policy.", "MFA / Identity", now),
            ("KB004", "Basic Azure VM Login Troubleshooting", "Purpose: Diagnose RDP connection failures to an Azure VM.\n\nProcedure:\n1. Verify the VM is running in Azure\n2. Check NSG allows RDP (3389) from your source IP\n3. Verify the local account is enabled and not locked\n4. Reset password via Azure if needed\n5. Check boot diagnostics\n\nValidation: Successful RDP connection.\n\nEscalation: Platform-level failures go to L2/L3 Infrastructure.", "Network", now),
            ("KB005", "How to Write a Complete Help Desk Ticket", "Purpose: Ensure tickets contain enough information to resolve quickly.\n\nRequired fields:\n- Clear title\n- User impact (who/what is affected)\n- Symptom and error message\n- Steps already tried\n- Category and priority\n\nFormat for notes: Symptoms / Investigation / Actions / Validation / Resolution.", "Request", now),
        ],
    )

    # =====================================================================
    # ACTIVE DIRECTORY - lab.local domain
    # =====================================================================
    cur.executemany(
        "INSERT INTO ad_ous (name, dn, parent_id, description, protected, created) VALUES (?,?,?,?,?,?)",
        [
            ("lab.local", "DC=lab,DC=local", None, "Domain root", 1, now),
            ("Domain Controllers", "OU=Domain Controllers,DC=lab,DC=local", 1, "Built-in OU for DCs", 1, now),
            ("Users", "CN=Users,DC=lab,DC=local", 1, "Built-in users container", 1, now),
            ("Computers", "CN=Computers,DC=lab,DC=local", 1, "Built-in computers container", 1, now),
            ("IT", "OU=IT,DC=lab,DC=local", 1, "IT department", 0, now),
            ("Finance", "OU=Finance,DC=lab,DC=local", 1, "Finance department", 0, now),
            ("Engineering", "OU=Engineering,DC=lab,DC=local", 1, "Engineering department", 0, now),
            ("Sales", "OU=Sales,DC=lab,DC=local", 1, "Sales department", 0, now),
            ("Service Accounts", "OU=Service Accounts,DC=lab,DC=local", 1, "Service and application accounts", 0, now),
            ("Disabled", "OU=Disabled,DC=lab,DC=local", 1, "Disabled accounts", 0, now),
        ],
    )

    def ouid(dn):
        r = cur.execute("SELECT id FROM ad_ous WHERE dn=?", (dn,)).fetchone()
        return r[0] if r else None

    ou_it = ouid("OU=IT,DC=lab,DC=local")
    ou_fin = ouid("OU=Finance,DC=lab,DC=local")
    ou_eng = ouid("OU=Engineering,DC=lab,DC=local")
    ou_sales = ouid("OU=Sales,DC=lab,DC=local")
    ou_svc = ouid("OU=Service Accounts,DC=lab,DC=local")
    ou_disabled = ouid("OU=Disabled,DC=lab,DC=local")
    ou_users = ouid("CN=Users,DC=lab,DC=local")

    cur.executemany(
        "INSERT INTO ad_users (sam_account_name, display_name, user_principal_name, dn, ou_id, enabled, locked, password_expired, password_never_expires, department, title, email, phone, manager, description, password, password_last_set, last_logon, account_created, home_drive, home_directory, profile_path, logon_script) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            ("Administrator", "Administrator", "administrator@lab.local", "CN=Administrator,CN=Users,DC=lab,DC=local", ou_users, 1, 0, 0, 1, "IT", "Domain Admin", "admin@lab.local", "x5000", "", "Built-in domain administrator", "Admin#2026", now, now, now, "H:", "\\\\fs01\\home$", "", ""),
            ("helpdesk", "Help Desk Agent", "helpdesk@lab.local", "CN=Help Desk Agent,OU=IT,DC=lab,DC=local", ou_it, 1, 0, 0, 0, "IT", "Support Analyst", "helpdesk@lab.local", "x5100", "Administrator", "Help desk agent account", "HelpDesk#2026", now, now, now, "H:", "\\\\fs01\\home$\\helpdesk", "", ""),
            ("jsmith", "John Smith", "jsmith@lab.local", "CN=John Smith,OU=IT,DC=lab,DC=local", ou_it, 1, 0, 0, 0, "IT", "Systems Administrator", "jsmith@lab.local", "x5101", "Administrator", "IT sysadmin", "JSmith#2026", now, now, now, "H:", "\\\\fs01\\home$\\jsmith", "", ""),
            ("mwilson", "Mary Wilson", "mwilson@lab.local", "CN=Mary Wilson,OU=Finance,DC=lab,DC=local", ou_fin, 1, 0, 0, 0, "Finance", "Finance Manager", "mwilson@lab.local", "x5200", "helpdesk", "Finance manager", "MWilson#2026", now, now, now, "H:", "\\\\fs01\\home$\\mwilson", "", ""),
            ("bthompson", "Bob Thompson", "bthompson@lab.local", "CN=Bob Thompson,OU=Finance,DC=lab,DC=local", ou_fin, 1, 0, 0, 0, "Finance", "Accountant", "bthompson@lab.local", "x5201", "mwilson", "Accountant", "BThompson#2026", now, now, now, "H:", "\\\\fs01\\home$\\bthompson", "", ""),
            ("sgarcia", "Sofia Garcia", "sgarcia@lab.local", "CN=Sofia Garcia,OU=Engineering,DC=lab,DC=local", ou_eng, 1, 0, 0, 0, "Engineering", "Senior Developer", "sgarcia@lab.local", "x5300", "helpdesk", "Senior developer", "SGarcia#2026", now, now, now, "H:", "\\\\fs01\\home$\\sgarcia", "", ""),
            ("dkim", "David Kim", "dkim@lab.local", "CN=David Kim,OU=Engineering,DC=lab,DC=local", ou_eng, 1, 0, 0, 0, "Engineering", "Developer", "dkim@lab.local", "x5301", "sgarcia", "Developer", "DKim#2026", now, now, now, "H:", "\\\\fs01\\home$\\dkim", "", ""),
            ("ljohnson", "Lisa Johnson", "ljohnson@lab.local", "CN=Lisa Johnson,OU=Sales,DC=lab,DC=local", ou_sales, 1, 0, 0, 0, "Sales", "Sales Director", "ljohnson@lab.local", "x5400", "helpdesk", "Sales director", "LJohnson#2026", now, now, now, "H:", "\\\\fs01\\home$\\ljohnson", "", ""),
            ("rwilliams", "Rob Williams", "rwilliams@lab.local", "CN=Rob Williams,OU=Sales,DC=lab,DC=local", ou_sales, 1, 0, 0, 0, "Sales", "Sales Rep", "rwilliams@lab.local", "x5401", "ljohnson", "Sales representative", "RWilliams#2026", now, now, now, "H:", "\\\\fs01\\home$\\rwilliams", "", ""),
            ("jmartinez", "Jose Martinez", "jmartinez@lab.local", "CN=Jose Martinez,OU=Finance,DC=lab,DC=local", ou_fin, 1, 1, 0, 0, "Finance", "Accountant", "jmartinez@lab.local", "x5202", "mwilson", "Locked out - too many failed attempts", "JMartinez#2026", now, now, now, "H:", "\\\\fs01\\home$\\jmartinez", "", ""),
            ("tlee", "Tom Lee", "tlee@lab.local", "CN=Tom Lee,OU=Disabled,DC=lab,DC=local", ou_disabled, 0, 0, 0, 0, "Sales", "Former Sales Rep", "tlee@lab.local", "", "ljohnson", "Terminated - account disabled", "TLee#2026", now, now, now, "", "", "", ""),
            ("svc_backup", "Backup Service Account", "svc_backup@lab.local", "CN=Backup Service Account,OU=Service Accounts,DC=lab,DC=local", ou_svc, 1, 0, 0, 1, "IT", "Service Account", "", "", "Administrator", "Backup service account - password never expires", "SvcBackup#2026", now, now, now, "", "", "", ""),
            ("svc_sql", "SQL Service Account", "svc_sql@lab.local", "CN=SQL Service Account,OU=Service Accounts,DC=lab,DC=local", ou_svc, 1, 0, 0, 1, "IT", "Service Account", "", "", "Administrator", "SQL Server service account", "SvcSQL#2026", now, now, now, "", "", "", ""),
        ],
    )

    cur.executemany(
        "INSERT INTO ad_groups (name, sam_account_name, dn, ou_id, group_type, scope, description, managed_by, created) VALUES (?,?,?,?,?,?,?,?,?)",
        [
            ("Domain Admins", "Domain Admins", "CN=Domain Admins,CN=Users,DC=lab,DC=local", ou_users, "Security", "Global", "Designated administrators of the domain", "Administrator", now),
            ("Domain Users", "Domain Users", "CN=Domain Users,CN=Users,DC=lab,DC=local", ou_users, "Security", "Global", "All domain users", "Administrator", now),
            ("Domain Computers", "Domain Computers", "CN=Domain Computers,CN=Users,DC=lab,DC=local", ou_users, "Security", "Global", "All domain computers", "Administrator", now),
            ("Enterprise Admins", "Enterprise Admins", "CN=Enterprise Admins,CN=Users,DC=lab,DC=local", ou_users, "Security", "Universal", "Full enterprise admin", "Administrator", now),
            ("Schema Admins", "Schema Admins", "CN=Schema Admins,CN=Users,DC=lab,DC=local", ou_users, "Security", "Universal", "Schema administrators", "Administrator", now),
            ("DNSAdmins", "DNSAdmins", "CN=DNSAdmins,CN=Users,DC=lab,DC=local", ou_users, "Security", "DomainLocal", "DNS administrators", "Administrator", now),
            ("Account Operators", "Account Operators", "CN=Account Operators,CN=Users,DC=lab,DC=local", ou_users, "Security", "DomainLocal", "Can manage user accounts and groups", "Administrator", now),
            ("Server Operators", "Server Operators", "CN=Server Operators,CN=Users,DC=lab,DC=local", ou_users, "Security", "DomainLocal", "Server operators", "Administrator", now),
            ("IT-Admins", "IT-Admins", "CN=IT-Admins,OU=IT,DC=lab,DC=local", ou_it, "Security", "Global", "IT department administrators", "helpdesk", now),
            ("HelpDesk-Team", "HelpDesk-Team", "CN=HelpDesk-Team,OU=IT,DC=lab,DC=local", ou_it, "Security", "Global", "Help desk team members", "helpdesk", now),
            ("Finance-Dept", "Finance-Dept", "CN=Finance-Dept,OU=Finance,DC=lab,DC=local", ou_fin, "Security", "Global", "Finance department access", "mwilson", now),
            ("Engineering-Dept", "Engineering-Dept", "CN=Engineering-Dept,OU=Engineering,DC=lab,DC=local", ou_eng, "Security", "Global", "Engineering department access", "sgarcia", now),
            ("Sales-Dept", "Sales-Dept", "CN=Sales-Dept,OU=Sales,DC=lab,DC=local", ou_sales, "Security", "Global", "Sales department access", "ljohnson", now),
            ("FileShare-RW", "FileShare-RW", "CN=FileShare-RW,OU=IT,DC=lab,DC=local", ou_it, "Security", "DomainLocal", "Read-write access to file shares", "helpdesk", now),
            ("VPN-Users", "VPN-Users", "CN=VPN-Users,OU=IT,DC=lab,DC=local", ou_it, "Security", "Global", "Users allowed VPN access", "helpdesk", now),
            ("All-Staff", "All-Staff", "CN=All-Staff,CN=Users,DC=lab,DC=local", ou_users, "Security", "Global", "Distribution group for all staff", "Administrator", now),
        ],
    )

    def agid(name):
        r = cur.execute("SELECT id FROM ad_groups WHERE name=?", (name,)).fetchone()
        return r[0] if r else None

    def auid(sam):
        r = cur.execute("SELECT id FROM ad_users WHERE sam_account_name=?", (sam,)).fetchone()
        return r[0] if r else None

    ad_memberships = [
        ("Domain Admins", "Administrator", "user"),
        ("Domain Users", "helpdesk", "user"), ("Domain Users", "jsmith", "user"), ("Domain Users", "mwilson", "user"),
        ("Domain Users", "bthompson", "user"), ("Domain Users", "sgarcia", "user"), ("Domain Users", "dkim", "user"),
        ("Domain Users", "ljohnson", "user"), ("Domain Users", "rwilliams", "user"), ("Domain Users", "jmartinez", "user"),
        ("Domain Users", "tlee", "user"), ("Domain Users", "svc_backup", "user"), ("Domain Users", "svc_sql", "user"),
        ("IT-Admins", "jsmith", "user"),
        ("HelpDesk-Team", "helpdesk", "user"),
        ("Finance-Dept", "mwilson", "user"), ("Finance-Dept", "bthompson", "user"), ("Finance-Dept", "jmartinez", "user"),
        ("Engineering-Dept", "sgarcia", "user"), ("Engineering-Dept", "dkim", "user"),
        ("Sales-Dept", "ljohnson", "user"), ("Sales-Dept", "rwilliams", "user"),
        ("Sales-Dept", "tlee", "user"),
        ("VPN-Users", "helpdesk", "user"), ("VPN-Users", "jsmith", "user"), ("VPN-Users", "sgarcia", "user"),
        ("FileShare-RW", "helpdesk", "user"), ("FileShare-RW", "mwilson", "user"), ("FileShare-RW", "bthompson", "user"),
        ("All-Staff", "Administrator", "user"), ("All-Staff", "helpdesk", "user"), ("All-Staff", "jsmith", "user"),
        ("All-Staff", "mwilson", "user"), ("All-Staff", "bthompson", "user"), ("All-Staff", "sgarcia", "user"),
        ("All-Staff", "dkim", "user"), ("All-Staff", "ljohnson", "user"), ("All-Staff", "rwilliams", "user"),
        ("All-Staff", "jmartinez", "user"),
    ]
    for g, u, t in ad_memberships:
        cur.execute("INSERT OR IGNORE INTO ad_group_members (group_id, member_id, member_type) VALUES (?,?,?)", (agid(g), auid(u), t))

    cur.executemany(
        "INSERT INTO ad_computers (name, dn, ou_id, os, os_version, enabled, last_logon, created, ipv4_address, description) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            ("DC01", "CN=DC01,OU=Domain Controllers,DC=lab,DC=local", ouid("OU=Domain Controllers,DC=lab,DC=local"), "Windows Server 2022", "10.0.20348", 1, now, now, "10.0.0.10", "Primary Domain Controller"),
            ("DC02", "CN=DC02,OU=Domain Controllers,DC=lab,DC=local", ouid("OU=Domain Controllers,DC=lab,DC=local"), "Windows Server 2022", "10.0.20348", 1, now, now, "10.0.0.11", "Secondary Domain Controller"),
            ("FS01", "CN=FS01,OU=IT,DC=lab,DC=local", ou_it, "Windows Server 2022", "10.0.20348", 1, now, now, "10.0.0.20", "File Server"),
            ("WS-FIN-01", "CN=WS-FIN-01,OU=Finance,DC=lab,DC=local", ou_fin, "Windows 11 Pro", "10.0.22631", 1, now, now, "10.0.0.101", "Finance workstation"),
            ("WS-FIN-02", "CN=WS-FIN-02,OU=Finance,DC=lab,DC=local", ou_fin, "Windows 11 Pro", "10.0.22631", 1, now, now, "10.0.0.102", "Finance workstation"),
            ("WS-ENG-01", "CN=WS-ENG-01,OU=Engineering,DC=lab,DC=local", ou_eng, "Windows 11 Pro", "10.0.22631", 1, now, now, "10.0.0.201", "Engineering workstation"),
            ("WS-SALES-01", "CN=WS-SALES-01,OU=Sales,DC=lab,DC=local", ou_sales, "Windows 11 Pro", "10.0.22631", 1, now, now, "10.0.0.301", "Sales workstation"),
            ("WS-OLD-01", "CN=WS-OLD-01,OU=Disabled,DC=lab,DC=local", ou_disabled, "Windows 10 Pro", "10.0.19045", 0, (_now_dt() - timedelta(days=120)).isoformat(timespec="seconds"), (_now_dt() - timedelta(days=365)).isoformat(timespec="seconds"), "10.0.0.199", "Stale computer - disabled, not cleaned up"),
        ],
    )

    cur.executemany(
        "INSERT INTO ad_domain_controllers (name, dn, os, site, roles, enabled, created) VALUES (?,?,?,?,?,?,?)",
        [
            ("DC01", "CN=DC01,OU=Domain Controllers,DC=lab,DC=local", "Windows Server 2022", "Default-First-Site", "PDC, RID, Infrastructure, Schema, Domain Naming", 1, now),
            ("DC02", "CN=DC02,OU=Domain Controllers,DC=lab,DC=local", "Windows Server 2022", "Default-First-Site", "Global Catalog", 1, now),
        ],
    )


if __name__ == "__main__":
    init_db(reset=True)
    print("Lab VM database initialized and seeded.")

