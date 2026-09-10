"""
Lab VM - unified FastAPI backend.
Serves the Windows 11 desktop SPA (static/) and a JSON API for all three labs.
Run:  python main.py  (or)  uvicorn main:app --reload
"""
from fastapi import FastAPI, Request, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime, timedelta, timezone
import secrets
import httpx

from database import get_db, init_db, _now, _now_dt

app = FastAPI(title="IT/IAM Help Desk Lab VM")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# In-memory sessions
sessions = {}


def _now_str():
    return _now()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def current_user(request: Request):
    sid = request.cookies.get("session_id")
    if sid and sid in sessions:
        return sessions[sid]
    return None


def require_user(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    return u


def require_admin(request: Request):
    u = require_user(request)
    if u["role"] != "admin":
        raise HTTPException(403, "Administrator role required")
    return u


@app.post("/api/login")
async def login(request: Request):
    body = await request.json()
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (body.get("username"), body.get("password")),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "Invalid credentials")
    sid = secrets.token_urlsafe(32)
    sessions[sid] = dict(row)
    resp = JSONResponse({"user": {"username": row["username"], "role": row["role"], "full_name": row["full_name"]}})
    resp.set_cookie("session_id", sid, httponly=True)
    return resp


@app.post("/api/logout")
async def logout(request: Request):
    sid = request.cookies.get("session_id")
    if sid in sessions:
        del sessions[sid]
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("session_id")
    return resp


@app.get("/api/me")
async def me(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    return {"username": u["username"], "role": u["role"], "full_name": u["full_name"]}


@app.post("/api/change-password")
async def change_password(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    body = await request.json()
    old_pwd = body.get("old_password", "")
    new_pwd = body.get("new_password", "")
    if not new_pwd or len(new_pwd) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (u["username"], old_pwd),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(403, "Current password is incorrect")
    conn.execute("UPDATE users SET password=? WHERE username=?", (new_pwd, u["username"]))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "Password changed successfully"}


# ---------------------------------------------------------------------------
# Lab 1 - Windows local users & groups
# ---------------------------------------------------------------------------
@app.get("/api/lab1/users")
async def lab1_users(request: Request):
    require_user(request)
    conn = get_db()
    users = [dict(r) for r in conn.execute("SELECT * FROM local_users ORDER BY id").fetchall()]
    for u in users:
        groups = [
            r["name"]
            for r in conn.execute(
                "SELECT g.name FROM local_groups g JOIN local_group_members m ON g.id=m.group_id WHERE m.user_id=?",
                (u["id"],),
            ).fetchall()
        ]
        u["groups"] = groups
    conn.close()
    return {"users": users}


@app.post("/api/lab1/users")
async def lab1_create_user(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO local_users (username, full_name, description, enabled, password_last_set, account_created, password) VALUES (?,?,?,?,?,?,?)",
            (b["username"], b.get("full_name", ""), b.get("description", ""), 1, _now_str(), _now_str(), b.get("password", "TempPass#2026")),
        )
        conn.commit()
        uid = conn.execute("SELECT id FROM local_users WHERE username=?", (b["username"],)).fetchone()[0]
        conn.close()
        return {"ok": True, "id": uid}
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"Could not create user: {e}")


@app.patch("/api/lab1/users/{uid}")
async def lab1_update_user(uid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    fields = []
    vals = []
    for k in ["full_name", "description", "enabled", "locked", "password_expired"]:
        if k in b:
            fields.append(f"{k}=?")
            vals.append(int(b[k]) if k in ("enabled", "locked", "password_expired") else b[k])
    if "password" in b:
        fields.append("password=?")
        vals.append(b["password"])
        fields.append("password_last_set=?")
        vals.append(_now_str())
        fields.append("password_expired=0")
        fields.append("locked=0")
    if not fields:
        conn.close()
        return {"ok": True}
    vals.append(uid)
    conn.execute(f"UPDATE local_users SET {','.join(fields)} WHERE id=?", vals)
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/lab1/users/{uid}")
async def lab1_delete_user(uid: int, request: Request):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM local_group_members WHERE user_id=?", (uid,))
    conn.execute("DELETE FROM local_users WHERE id=?", (uid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/lab1/groups")
async def lab1_groups(request: Request):
    require_user(request)
    conn = get_db()
    groups = [dict(r) for r in conn.execute("SELECT * FROM local_groups ORDER BY built_in DESC, name").fetchall()]
    for g in groups:
        members = [
            r["username"]
            for r in conn.execute(
                "SELECT u.username FROM local_users u JOIN local_group_members m ON u.id=m.user_id WHERE m.group_id=?",
                (g["id"],),
            ).fetchall()
        ]
        g["members"] = members
    conn.close()
    return {"groups": groups}


@app.post("/api/lab1/groups")
async def lab1_create_group(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    try:
        conn.execute("INSERT INTO local_groups (name, description, built_in) VALUES (?,?,0)", (b["name"], b.get("description", "")))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"Could not create group: {e}")


@app.post("/api/lab1/groups/{gid}/members")
async def lab1_add_member(gid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("INSERT OR IGNORE INTO local_group_members (group_id, user_id) VALUES (?,?)", (gid, b["user_id"]))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/lab1/groups/{gid}/members/{uid}")
async def lab1_remove_member(gid: int, uid: int, request: Request):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM local_group_members WHERE group_id=? AND user_id=?", (gid, uid))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---- NTFS folders & ACLs ----
@app.get("/api/lab1/folders")
async def lab1_folders(request: Request):
    require_user(request)
    conn = get_db()
    folders = [dict(r) for r in conn.execute("SELECT * FROM folders ORDER BY path").fetchall()]
    for f in folders:
        acls = [dict(r) for r in conn.execute("SELECT * FROM folder_acls WHERE folder_id=?", (f["id"],)).fetchall()]
        f["acls"] = acls
    conn.close()
    return {"folders": folders}


@app.post("/api/lab1/folders")
async def lab1_create_folder(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    parent = conn.execute("SELECT id FROM folders WHERE path=?", (b.get("parent", "C:\\LabData"),)).fetchone()
    pid = parent[0] if parent else None
    conn.execute("INSERT INTO folders (path, parent_id, has_test_file) VALUES (?,?,1)", (b["path"], pid))
    fid = conn.execute("SELECT id FROM folders WHERE path=?", (b["path"],)).fetchone()[0]
    # inherit default ACLs from parent
    if pid:
        for a in conn.execute("SELECT * FROM folder_acls WHERE folder_id=?", (pid,)).fetchall():
            conn.execute(
                "INSERT INTO folder_acls (folder_id, principal, principal_type, permission, inherited, allow) VALUES (?,?,?,?,1,?)",
                (fid, a["principal"], a["principal_type"], a["permission"], a["allow"]),
            )
    conn.commit()
    conn.close()
    return {"ok": True, "id": fid}


@app.post("/api/lab1/folders/{fid}/acls")
async def lab1_add_acl(fid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute(
        "INSERT INTO folder_acls (folder_id, principal, principal_type, permission, inherited, allow) VALUES (?,?,?,?,0,1)",
        (fid, b["principal"], b["principal_type"], b["permission"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/lab1/folders/{fid}/acls/{acl_id}")
async def lab1_remove_acl(fid: int, acl_id: int, request: Request):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM folder_acls WHERE id=? AND folder_id=?", (acl_id, fid))
    conn.commit()
    conn.close()
    return {"ok": True}


# Effective access: compute the highest permission a user has on a folder
PERMISSION_RANK = {"Read": 1, "Read & Execute": 2, "Write": 2, "Modify": 3, "Full Control": 4}


def _user_groups(conn, uid):
    return [
        r["name"]
        for r in conn.execute(
            "SELECT g.name FROM local_groups g JOIN local_group_members m ON g.id=m.group_id WHERE m.user_id=?", (uid,)
        ).fetchall()
    ]


@app.get("/api/lab1/effective-access")
async def lab1_effective_access(request: Request, folder_id: int, user_id: int):
    require_user(request)
    conn = get_db()
    user = conn.execute("SELECT * FROM local_users WHERE id=?", (user_id,)).fetchone()
    folder = conn.execute("SELECT * FROM folders WHERE id=?", (folder_id,)).fetchone()
    if not user or not folder:
        conn.close()
        raise HTTPException(404, "User or folder not found")

    principals = {user["username"]} | set(_user_groups(conn, user_id))
    acls = [dict(r) for r in conn.execute("SELECT * FROM folder_acls WHERE folder_id=?", (folder_id,)).fetchall()]
    matched = [a for a in acls if a["principal"] in principals and a["allow"] == 1]

    if not matched:
        result = {"access": "Denied", "permission": None, "matched_acls": [], "reason": "No matching allow ACE for user or their groups"}
    else:
        best = max(matched, key=lambda a: PERMISSION_RANK.get(a["permission"], 0))
        result = {
            "access": "Allowed",
            "permission": best["permission"],
            "matched_acls": matched,
            "reason": f"Granted via {best['principal']} ({best['principal_type']})",
        }

    # account-state checks that affect real access
    if not user["enabled"]:
        result["access"] = "Denied"
        result["reason"] = "Account is disabled"
    elif user["locked"]:
        result["access"] = "Denied"
        result["reason"] = "Account is locked out"
    elif user["password_expired"]:
        result["access"] = "Denied"
        result["reason"] = "Password is expired - must be reset before logon"

    conn.close()
    return {
        "user": dict(user),
        "folder": dict(folder),
        "user_groups": list(principals - {user["username"]}),
        **result,
    }


@app.post("/api/lab1/test-access")
async def lab1_test_access(request: Request):
    """Simulate a user trying to open a folder and read/write a file."""
    require_user(request)
    b = await request.json()
    conn = get_db()
    user = conn.execute("SELECT * FROM local_users WHERE id=?", (b["user_id"],)).fetchone()
    folder = conn.execute("SELECT * FROM folders WHERE id=?", (b["folder_id"],)).fetchone()
    if not user or not folder:
        conn.close()
        raise HTTPException(404, "User or folder not found")

    principals = {user["username"]} | set(_user_groups(conn, b["user_id"]))
    acls = [dict(r) for r in conn.execute("SELECT * FROM folder_acls WHERE folder_id=?", (b["folder_id"],)).fetchall()]
    matched = [a for a in acls if a["principal"] in principals and a["allow"] == 1]

    steps = []
    if not user["enabled"]:
        steps.append("Logon attempt: account is DISABLED -> logon denied")
        conn.close()
        return {"success": False, "steps": steps, "error": "Account is disabled. Enable the account first."}
    if user["locked"]:
        steps.append("Logon attempt: account is LOCKED -> logon denied")
        conn.close()
        return {"success": False, "steps": steps, "error": "Account is locked. Unlock it in Local Users and Groups."}
    if user["password_expired"]:
        steps.append("Logon attempt: password EXPIRED -> must reset before logon")
        conn.close()
        return {"success": False, "steps": steps, "error": "Password expired. Reset the password."}

    steps.append(f"Logon as {user['username']}: success")
    steps.append(f"Attempt to access {folder['path']}")
    if not matched:
        steps.append("Access check: no matching allow ACE -> ACCESS DENIED")
        conn.close()
        return {"success": False, "steps": steps, "error": "Access denied. Check NTFS permissions and group membership."}
    best = max(matched, key=lambda a: PERMISSION_RANK.get(a["permission"], 0))
    steps.append(f"Access check: matched {best['principal']} -> {best['permission']}")
    if PERMISSION_RANK.get(best["permission"], 0) >= 2:
        steps.append("Opened test file: READ OK")
    if PERMISSION_RANK.get(best["permission"], 0) >= 3:
        steps.append("Wrote test file: WRITE OK")
    conn.close()
    return {"success": True, "steps": steps, "permission": best["permission"]}


# ---------------------------------------------------------------------------
# Lab 2 - Entra ID
# ---------------------------------------------------------------------------
@app.get("/api/lab2/users")
async def lab2_users(request: Request):
    require_user(request)
    conn = get_db()
    users = [dict(r) for r in conn.execute("SELECT * FROM entra_users ORDER BY display_name").fetchall()]
    for u in users:
        groups = [
            r["display_name"]
            for r in conn.execute(
                "SELECT g.display_name FROM entra_groups g JOIN entra_group_members m ON g.id=m.group_id WHERE m.user_id=?",
                (u["id"],),
            ).fetchall()
        ]
        u["groups"] = groups
        methods = [dict(r) for r in conn.execute("SELECT * FROM mfa_methods WHERE user_id=?", (u["id"],)).fetchall()]
        u["mfa_methods"] = methods
        u["mfa_registered"] = len(methods) > 0
    conn.close()
    return {"users": users}


@app.post("/api/lab2/users")
async def lab2_create_user(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO entra_users (upn, display_name, job_title, department, account_enabled, sign_in_blocked, created) VALUES (?,?,?,?,1,0,?)",
            (b["upn"], b.get("display_name", ""), b.get("job_title", ""), b.get("department", ""), _now_str()),
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"Could not create user: {e}")


@app.patch("/api/lab2/users/{uid}")
async def lab2_update_user(uid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    fields, vals = [], []
    for k in ["display_name", "job_title", "department", "account_enabled", "sign_in_blocked"]:
        if k in b:
            fields.append(f"{k}=?")
            vals.append(int(b[k]) if k in ("account_enabled", "sign_in_blocked") else b[k])
    if fields:
        vals.append(uid)
        conn.execute(f"UPDATE entra_users SET {','.join(fields)} WHERE id=?", vals)
        conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/lab2/groups")
async def lab2_groups(request: Request):
    require_user(request)
    conn = get_db()
    groups = [dict(r) for r in conn.execute("SELECT * FROM entra_groups ORDER BY display_name").fetchall()]
    for g in groups:
        members = [
            r["upn"]
            for r in conn.execute(
                "SELECT u.upn FROM entra_users u JOIN entra_group_members m ON u.id=m.user_id WHERE m.group_id=?",
                (g["id"],),
            ).fetchall()
        ]
        g["members"] = members
    conn.close()
    return {"groups": groups}


@app.post("/api/lab2/groups")
async def lab2_create_group(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    try:
        conn.execute("INSERT INTO entra_groups (display_name, description) VALUES (?,?)", (b["display_name"], b.get("description", "")))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"Could not create group: {e}")


@app.post("/api/lab2/groups/{gid}/members")
async def lab2_add_member(gid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("INSERT OR IGNORE INTO entra_group_members (group_id, user_id) VALUES (?,?)", (gid, b["user_id"]))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/lab2/groups/{gid}/members/{uid}")
async def lab2_remove_member(gid: int, uid: int, request: Request):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM entra_group_members WHERE group_id=? AND user_id=?", (gid, uid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/lab2/users/{uid}/mfa")
async def lab2_register_mfa(uid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute(
        "INSERT INTO mfa_methods (user_id, method_type, status, is_default, registered_on) VALUES (?,?,?,0,?)",
        (uid, b["method_type"], "registered", _now_str()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/lab2/users/{uid}/mfa/{mid}")
async def lab2_remove_mfa(uid: int, mid: int, request: Request):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM mfa_methods WHERE id=? AND user_id=?", (mid, uid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/lab2/users/{uid}/mfa-reset")
async def lab2_mfa_reset(uid: int, request: Request):
    """Help desk MFA reset: remove all methods so user must re-register."""
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM mfa_methods WHERE user_id=?", (uid,))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "All MFA methods removed. User must re-register."}


@app.get("/api/lab2/policies")
async def lab2_policies(request: Request):
    require_user(request)
    conn = get_db()
    policies = [dict(r) for r in conn.execute("SELECT * FROM ca_policies ORDER BY id").fetchall()]
    for p in policies:
        scopes = [
            {"group": r["display_name"], "scope_type": r["scope_type"]}
            for r in conn.execute(
                "SELECT g.display_name, s.scope_type FROM ca_policy_scopes s JOIN entra_groups g ON s.group_id=g.id WHERE s.policy_id=?",
                (p["id"],),
            ).fetchall()
        ]
        p["scopes"] = scopes
    conn.close()
    return {"policies": policies}


@app.post("/api/lab2/policies")
async def lab2_create_policy(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute(
        "INSERT INTO ca_policies (name, state, applications, grant_control, created, report_only) VALUES (?,?,?,?,?,?)",
        (b["name"], b.get("state", "On"), b.get("applications", "All cloud apps"), b.get("grant_control", "Require MFA"), _now_str(), 1 if b.get("state") == "Report-only" else 0),
    )
    pid = conn.execute("SELECT id FROM ca_policies WHERE name=?", (b["name"],)).fetchone()[0]
    for gid in b.get("include_groups", []):
        conn.execute("INSERT OR IGNORE INTO ca_policy_scopes (policy_id, group_id, scope_type) VALUES (?,?,?)", (pid, gid, "include"))
    conn.commit()
    conn.close()
    return {"ok": True, "id": pid}


@app.patch("/api/lab2/policies/{pid}")
async def lab2_update_policy(pid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    if "state" in b:
        conn.execute("UPDATE ca_policies SET state=?, report_only=? WHERE id=?", (b["state"], 1 if b["state"] == "Report-only" else 0, pid))
    if "include_groups" in b:
        conn.execute("DELETE FROM ca_policy_scopes WHERE policy_id=?", (pid,))
        for gid in b["include_groups"]:
            conn.execute("INSERT OR IGNORE INTO ca_policy_scopes (policy_id, group_id, scope_type) VALUES (?,?,?)", (pid, gid, "include"))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/lab2/signins")
async def lab2_signins(request: Request, user_id: Optional[int] = None):
    require_user(request)
    conn = get_db()
    if user_id:
        rows = conn.execute("SELECT * FROM sign_in_logs WHERE user_id=? ORDER BY time DESC", (user_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM sign_in_logs ORDER BY time DESC").fetchall()
    conn.close()
    return {"logs": [dict(r) for r in rows]}


@app.post("/api/lab2/signins/generate")
async def lab2_generate_signin(request: Request):
    """Simulate a sign-in attempt for a user, evaluated against CA + MFA state."""
    require_user(request)
    b = await request.json()
    conn = get_db()
    user = conn.execute("SELECT * FROM entra_users WHERE id=?", (b["user_id"],)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(404, "User not found")

    groups = [
        r["display_name"]
        for r in conn.execute(
            "SELECT g.display_name FROM entra_groups g JOIN entra_group_members m ON g.id=m.group_id WHERE m.user_id=?",
            (user["id"],),
        ).fetchall()
    ]
    methods = conn.execute("SELECT * FROM mfa_methods WHERE user_id=?", (user["id"],)).fetchall()
    # find MFA policy scoped to a group this user is in
    mfa_policy = None
    for p in conn.execute("SELECT * FROM ca_policies WHERE grant_control LIKE '%MFA%' AND state='On'").fetchall():
        scoped = [r["group_id"] for r in conn.execute("SELECT group_id FROM ca_policy_scopes WHERE policy_id=?", (p["id"],)).fetchall()]
        scoped_names = [conn.execute("SELECT display_name FROM entra_groups WHERE id=?", (g,)).fetchone()[0] for g in scoped]
        if any(gn in groups for gn in scoped_names):
            mfa_policy = dict(p)
            break

    app_name = b.get("app", "Microsoft 365")
    ip = b.get("ip", "203.0.113.50")

    if not user["account_enabled"]:
        result, err, detail = "Blocked by CA", "53003", "Account is disabled - sign-in blocked"
    elif not mfa_policy:
        result, err, detail = "Success", "0", "No Conditional Access policy matched - no MFA required"
    elif len(methods) == 0:
        result, err, detail = "MFA Failed", "50074", f"Policy '{mfa_policy['name']}' requires MFA but user has no registered method"
    else:
        result, err, detail = "Success", "0", f"MFA satisfied via policy '{mfa_policy['name']}'"

    conn.execute(
        "INSERT INTO sign_in_logs (user_id, upn, app, time, ip, client_app, result, error_code, conditional_access, detail) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (user["id"], user["upn"], app_name, _now_str(), ip, "Browser", result, err, mfa_policy["name"] if mfa_policy else "None", detail),
    )
    conn.commit()
    log_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"log_id": log_id, "result": result, "error_code": err, "detail": detail, "mfa_policy": mfa_policy["name"] if mfa_policy else None}


# ---------------------------------------------------------------------------
# Lab 3 - Ticketing
# ---------------------------------------------------------------------------
PRIORITY_MATRIX = {
    ("High", "High"): "P1", ("High", "Medium"): "P2", ("High", "Low"): "P3",
    ("Medium", "High"): "P2", ("Medium", "Medium"): "P3", ("Medium", "Low"): "P3",
    ("Low", "High"): "P3", ("Low", "Medium"): "P4", ("Low", "Low"): "P4",
}
SLA_HOURS = {"P1": 2, "P2": 8, "P3": 24, "P4": 72}


@app.get("/api/lab3/tickets")
async def lab3_tickets(request: Request, status: Optional[str] = None):
    require_user(request)
    conn = get_db()
    if status:
        rows = conn.execute("SELECT * FROM tickets WHERE status=? ORDER BY created_time DESC", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM tickets ORDER BY created_time DESC").fetchall()
    conn.close()
    return {"tickets": [dict(r) for r in rows]}


@app.post("/api/lab3/tickets")
async def lab3_create_ticket(request: Request):
    require_user(request)
    b = await request.json()
    priority = PRIORITY_MATRIX.get((b["impact"], b["urgency"]), "P3")
    sla = (_now_dt() + timedelta(hours=SLA_HOURS.get(priority, 24))).isoformat(timespec="seconds")
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] + 1
    tnum = f"INC{count:06d}"
    conn.execute(
        "INSERT INTO tickets (ticket_number, title, description, category, subcategory, impact, urgency, priority, status, assignment_group, assigned_agent, created_time, updated_time, sla_target, resolution, requester) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (tnum, b["title"], b.get("description", ""), b["category"], b.get("subcategory", ""), b["impact"], b["urgency"], priority, "New", b.get("assignment_group", "L1 Help Desk"), "", _now_str(), _now_str(), sla, "", b.get("requester", "jdoe")),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "ticket_number": tnum, "priority": priority}


@app.get("/api/lab3/tickets/{tid}")
async def lab3_ticket_detail(tid: int, request: Request):
    require_user(request)
    conn = get_db()
    t = conn.execute("SELECT * FROM tickets WHERE id=?", (tid,)).fetchone()
    if not t:
        conn.close()
        raise HTTPException(404, "Ticket not found")
    notes = [dict(r) for r in conn.execute("SELECT * FROM ticket_notes WHERE ticket_id=? ORDER BY created_time", (tid,)).fetchall()]
    conn.close()
    return {"ticket": dict(t), "notes": notes}


@app.post("/api/lab3/tickets/{tid}/note")
async def lab3_add_note(tid: int, request: Request):
    u = require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("INSERT INTO ticket_notes (ticket_id, note_text, created_by, created_time) VALUES (?,?,?,?)", (tid, b["note_text"], u["username"], _now_str()))
    conn.execute("UPDATE tickets SET updated_time=? WHERE id=?", (_now_str(), tid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.patch("/api/lab3/tickets/{tid}")
async def lab3_update_ticket(tid: int, request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    fields, vals = [], []
    for k in ["status", "assignment_group", "assigned_agent", "priority", "resolution"]:
        if k in b:
            fields.append(f"{k}=?")
            vals.append(b[k])
    fields.append("updated_time=?")
    vals.append(_now_str())
    vals.append(tid)
    conn.execute(f"UPDATE tickets SET {','.join(fields)} WHERE id=?", vals)
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/lab3/kb")
async def lab3_kb(request: Request):
    require_user(request)
    conn = get_db()
    rows = conn.execute("SELECT * FROM knowledge_base ORDER BY created_time DESC").fetchall()
    conn.close()
    return {"articles": [dict(r) for r in rows]}


@app.post("/api/lab3/kb")
async def lab3_create_kb(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("INSERT INTO knowledge_base (kb_number, title, content, category, created_time) VALUES (?,?,?,?,?)", (b["kb_number"], b["title"], b["content"], b.get("category", ""), _now_str()))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/lab3/reports")
async def lab3_reports(request: Request):
    require_user(request)
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
    by_category = [dict(r) for r in conn.execute("SELECT category, COUNT(*) as c FROM tickets GROUP BY category").fetchall()]
    by_priority = [dict(r) for r in conn.execute("SELECT priority, COUNT(*) as c FROM tickets GROUP BY priority").fetchall()]
    by_status = [dict(r) for r in conn.execute("SELECT status, COUNT(*) as c FROM tickets GROUP BY status").fetchall()]
    reopened = conn.execute("SELECT COUNT(*) FROM tickets WHERE status='Reopened'").fetchone()[0]
    escalated = conn.execute("SELECT COUNT(*) FROM tickets WHERE assignment_group IN ('L2 IAM','L2/L3 Infrastructure','Security')").fetchone()[0]
    conn.close()
    return {"total": total, "by_category": by_category, "by_priority": by_priority, "by_status": by_status, "reopened": reopened, "escalated": escalated}


# ---------------------------------------------------------------------------
# Ollama AI Integration
# ---------------------------------------------------------------------------
OLLAMA_HOST = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"
OLLAMA_TAGS_URL = f"{OLLAMA_HOST}/api/tags"
OLLAMA_GENERATE_URL = f"{OLLAMA_HOST}/api/generate"
OLLAMA_CHAT_URL = f"{OLLAMA_HOST}/api/chat"


async def ollama_available(timeout_ms: int = 2000) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(OLLAMA_TAGS_URL, timeout=timeout_ms / 1000)
            return r.status_code == 200
    except Exception:
        return False


async def ollama_generate(prompt: str, model: str = OLLAMA_MODEL) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(OLLAMA_GENERATE_URL, json={"model": model, "prompt": prompt, "stream": False})
            if r.status_code == 200:
                return r.json().get("response", "").strip()
    except Exception:
        pass
    return None


@app.get("/api/ollama/status")
async def ollama_status(request: Request):
    require_user(request)
    available = await ollama_available()
    models = []
    if available:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(OLLAMA_TAGS_URL, timeout=3.0)
                if r.status_code == 200:
                    models = [m["name"] for m in r.json().get("models", [])]
        except Exception:
            pass
    return {"available": available, "model": OLLAMA_MODEL, "models": models}


@app.post("/api/ollama/chat")
async def ollama_chat(request: Request):
    require_user(request)
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", OLLAMA_MODEL)
    if not await ollama_available():
        return {"reply": "I'm currently offline. Please make sure Ollama is installed and running (ollama serve). Once Ollama is available, I'll be able to help you with IT, IAM, and help desk topics.", "offline": True}
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(OLLAMA_CHAT_URL, json={"model": model, "messages": messages, "stream": False})
            if r.status_code == 200:
                reply = r.json().get("message", {}).get("content", "").strip()
                return {"reply": reply, "model": model}
            return {"reply": f"Ollama returned status {r.status_code}. Please check that model '{model}' is installed.", "error": True}
    except Exception as e:
        return {"reply": f"Error communicating with Ollama: {str(e)}", "error": True}


@app.post("/api/lab3/tickets/{tid}/review")
async def lab3_review_ticket(tid: int, request: Request):
    require_user(request)
    conn = get_db()
    t = conn.execute("SELECT * FROM tickets WHERE id=?", (tid,)).fetchone()
    if not t:
        conn.close()
        raise HTTPException(404, "Ticket not found")
    t = dict(t)

    # Gather directory state for the review context
    ad_users = [dict(r) for r in conn.execute("SELECT sam_account_name, display_name, enabled, locked, ou_id FROM ad_users").fetchall()]
    ad_groups = [dict(r) for r in conn.execute("SELECT name, ou_id FROM ad_groups").fetchall()]
    ous = [dict(r) for r in conn.execute("SELECT id, name, parent_id FROM ad_ous").fetchall()]
    members = [dict(r) for r in conn.execute("SELECT group_id, member_id FROM ad_group_members WHERE member_type='user'").fetchall()]

    # Build a summary of the directory for the AI
    dir_summary = f"AD Users: {len(ad_users)}, AD Groups: {len(ad_groups)}, OUs: {len(ous)}\n"
    dir_summary += "Users:\n" + "\n".join(f"  {u['sam_account_name']} ({u['display_name']}) - enabled={u['enabled']}, locked={u['locked']}" for u in ad_users[:20])
    dir_summary += f"\n\nTicket: {t['ticket_number']} - {t['title']}\nCategory: {t['category']}\nPriority: {t['priority']}\nStatus: {t['status']}\n"
    dir_summary += f"Description: {t['description']}\nResolution: {t.get('resolution', '')}\n"

    # Deterministic checks
    checks = []
    if t["status"] == "Resolved" or t["status"] == "Closed":
        checks.append({"label": "Ticket status is resolved", "passed": True, "detail": f"Status: {t['status']}"})
    else:
        checks.append({"label": "Ticket status is resolved", "passed": False, "detail": f"Status is '{t['status']}', not Resolved"})

    if t.get("resolution") and len(t["resolution"].strip()) > 10:
        checks.append({"label": "Resolution documented", "passed": True, "detail": "Resolution notes provided"})
    else:
        checks.append({"label": "Resolution documented", "passed": False, "detail": "No resolution notes"})

    if t.get("assigned_agent"):
        checks.append({"label": "Ticket assigned", "passed": True, "detail": f"Assigned to {t['assigned_agent']}"})
    else:
        checks.append({"label": "Ticket assigned", "passed": False, "detail": "Ticket is unassigned"})

    all_passed = all(c["passed"] for c in checks)

    # Try AI summary
    prompt = f"""You are an IT help desk supervisor reviewing a resolved ticket. Give brief, professional feedback (2-3 sentences).

Ticket: {t['ticket_number']} - {t['title']}
Category: {t['category']}
Priority: {t['priority']}
Description: {t['description']}
Resolution: {t.get('resolution', 'No resolution documented')}

Checks: {', '.join(c['label'] + ': ' + ('PASS' if c['passed'] else 'FAIL') for c in checks)}

Write a concise review of whether this ticket was properly resolved. Be direct and professional."""

    ai_summary = await ollama_generate(prompt)
    summary = ai_summary if ai_summary else ("All checks passed - ticket properly resolved." if all_passed else "Outstanding work remains - see checks above.")
    source = "ollama" if ai_summary else "offline"

    conn.close()
    return {
        "passed": all_passed,
        "checks": checks,
        "summary": summary,
        "source": source,
    }


@app.post("/api/lab3/generate-work")
async def lab3_generate_work(request: Request):
    require_user(request)
    conn = get_db()

    # Gather current state
    ad_users = [dict(r) for r in conn.execute("SELECT sam_account_name, display_name, enabled, locked, department, title, ou_id FROM ad_users").fetchall()]
    ad_groups = [dict(r) for r in conn.execute("SELECT name, ou_id FROM ad_groups").fetchall()]
    ous = [dict(r) for r in conn.execute("SELECT id, name, parent_id FROM ad_ous").fetchall()]
    open_tickets = conn.execute("SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Resolved','Closed')").fetchone()[0]

    # Scenario templates
    import random
    scenarios = [
        {"kind": "password-reset", "category": "Access", "priority": "P2", "title": "Password reset request", "desc": "User reports being locked out after multiple failed login attempts."},
        {"kind": "mfa-issue", "category": "Access", "priority": "P2", "title": "MFA device problem", "desc": "User reports repeated MFA prompts or lost authenticator device."},
        {"kind": "onboarding", "category": "Provisioning", "priority": "P3", "title": "New hire onboarding", "desc": "Provision account, assign to department group, schedule orientation."},
        {"kind": "termination", "category": "Deprovisioning", "priority": "P1", "title": "Terminate employee access", "desc": "Disable account, revoke sessions, remove from all groups."},
        {"kind": "access-request", "category": "Access", "priority": "P3", "title": "Application access request", "desc": "User requests access to additional application. Verify justification and least-privilege."},
        {"kind": "incident", "category": "Security", "priority": "P1", "title": "Possible security incident", "desc": "Suspicious activity detected. Triage, contain, document, and escalate per IR plan."},
        {"kind": "transfer", "category": "Provisioning", "priority": "P3", "title": "Department transfer", "desc": "Move user to new group, revoke old group memberships, verify access."},
    ]

    # Pick a random scenario
    scenario = random.choice(scenarios)

    # Try AI-generated prose
    user_list = ", ".join(f"{u['sam_account_name']} ({u['display_name']}, {u.get('department','')})" for u in ad_users[:10])
    prompt = f"""You are generating a realistic IT help desk ticket for a training lab. Write a professional ticket subject and description.

Scenario type: {scenario['kind']}
Priority: {scenario['priority']}
Available users: {user_list}

Write ONLY a JSON object with "subject" (max 80 chars) and "description" (2-3 sentences) fields. Make it realistic and specific to one of the listed users. No markdown, no explanation, just the JSON."""

    ai_text = await ollama_generate(prompt)
    subject = scenario["title"]
    description = scenario["desc"]

    if ai_text:
        try:
            import json
            # Try to extract JSON from the response
            text = ai_text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            parsed = json.loads(text)
            subject = parsed.get("subject", subject)
            description = parsed.get("description", description)
        except Exception:
            pass

    # Create the ticket
    impact = "High" if scenario["priority"] in ("P1",) else "Medium" if scenario["priority"] == "P2" else "Low"
    urgency = "High" if scenario["priority"] in ("P1", "P2") else "Medium" if scenario["priority"] == "P3" else "Low"
    sla = (_now_dt() + timedelta(hours=SLA_HOURS.get(scenario["priority"], 24))).isoformat(timespec="seconds")
    count = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] + 1
    tnum = f"INC{count:06d}"

    conn.execute(
        "INSERT INTO tickets (ticket_number, title, description, category, subcategory, impact, urgency, priority, status, assignment_group, assigned_agent, created_time, updated_time, sla_target, resolution, requester) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (tnum, subject, description, scenario["category"], scenario["kind"], impact, urgency, scenario["priority"], "New", "L1 Help Desk", "", _now_str(), _now_str(), sla, "", "system"),
    )
    conn.commit()
    conn.close()

    return {"ok": True, "ticket_number": tnum, "subject": subject, "used_ollama": ai_text is not None}


# ---------------------------------------------------------------------------
# Browser Proxy — lets the Chrome app actually surf the web
# ---------------------------------------------------------------------------
import re as _re
from urllib.parse import urljoin, urlparse, quote

@app.get("/api/browse")
async def browse_proxy(request: Request, url: str = ""):
    require_user(request)
    if not url:
        return JSONResponse({"error": "No URL provided"}, status_code=400)
    # Normalize URL
    if not url.startswith("http://") and not url.startswith("https://"):
        if "." in url and " " not in url:
            url = "https://" + url
        else:
            url = "https://www.google.com/search?q=" + quote(url)
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})
            content_type = r.headers.get("content-type", "text/html")
            body = r.text
            # Rewrite relative URLs to absolute so resources load inside the iframe
            base = str(r.url)
            parsed = urlparse(base)
            base_origin = f"{parsed.scheme}://{parsed.netloc}"
            # Rewrite relative links, images, scripts, stylesheets
            body = _re.sub(r'href="(/)', f'href="{base_origin}\\1', body)
            body = _re.sub(r"href='(/)", f"href='{base_origin}\\1", body)
            body = _re.sub(r'src="(/)', f'src="{base_origin}\\1', body)
            body = _re.sub(r"src='(/)", f"src='{base_origin}\\1", body)
            body = _re.sub(r'action="(/)', f'action="{base_origin}\\1', body)
            body = _re.sub(r"action='(/)", f"action='{base_origin}\\1", body)
            # Rewrite protocol-relative URLs
            body = _re.sub(r'src="//', f'src="{parsed.scheme}://', body)
            body = _re.sub(r'href="//', f'href="{parsed.scheme}://', body)
            # Inject a <base> tag to handle remaining relative URLs
            body = body.replace("<head>", f'<head><base href="{base}">', 1)
            if "<head>" not in body:
                body = f'<base href="{base}">' + body
            return JSONResponse({"html": body, "url": base, "content_type": content_type})
    except httpx.TimeoutException:
        return JSONResponse({"error": "Request timed out", "url": url}, status_code=504)
    except Exception as e:
        return JSONResponse({"error": str(e), "url": url}, status_code=502)


# ---------------------------------------------------------------------------
# Static SPA + startup
# ---------------------------------------------------------------------------
import sys as _sys
import os as _os

# When bundled with PyInstaller, bundled data files (static/, landing.html)
# are extracted to sys._MEIPASS. When running locally from server/, the
# static/ and landing.html live in the parent directory.
if hasattr(_sys, '_MEIPASS'):
    _BUNDLE_DIR = _sys._MEIPASS
else:
    _BUNDLE_DIR = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))

app.mount("/static", StaticFiles(directory=_os.path.join(_BUNDLE_DIR, "static")), name="static")


@app.get("/")
async def landing():
    return FileResponse(_os.path.join(_BUNDLE_DIR, "landing.html"))


@app.get("/app")
async def app_page():
    return FileResponse(_os.path.join(_BUNDLE_DIR, "static", "index.html"))


# ---------------------------------------------------------------------------
# Contact form (landing page) — sends email without exposing the address
# ---------------------------------------------------------------------------
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

CONTACT_EMAIL = "erickomari243@gmail.com"


@app.post("/api/contact")
async def contact_submit(request: Request):
    try:
        body = await request.json()
        name = (body.get("name") or "").strip()[:100]
        email = (body.get("email") or "").strip()[:200]
        message = (body.get("message") or "").strip()[:5000]
        if not name or not email or not message:
            return {"ok": False, "error": "All fields are required."}
        # Store the message in the database so it is not lost even if SMTP fails
        conn = get_db()
        conn.execute(
            "CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, message TEXT, created TEXT)",
        )
        conn.execute(
            "INSERT INTO contact_messages (name, email, message, created) VALUES (?, ?, ?, ?)",
            (name, email, message, _now()),
        )
        conn.commit()
        conn.close()
        # Attempt to send email (best-effort; does not expose the address to the client)
        try:
            msg = MIMEMultipart()
            msg["From"] = "Lab VM Contact <noreply@labvm.local>"
            msg["To"] = CONTACT_EMAIL
            msg["Subject"] = f"New contact from {name} — IT/IAM Help Desk Lab"
            body_text = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
            msg.attach(MIMEText(body_text, "plain"))
            # Try local SMTP relay (most dev machines won't have this, but the
            # message is stored in the database regardless)
            with smtplib.SMTP("127.0.0.1", 25, timeout=5) as srv:
                srv.sendmail("noreply@labvm.local", [CONTACT_EMAIL], msg.as_string())
        except Exception:
            pass  # Stored in DB; can be retrieved later
        return {"ok": True, "message": "Thank you! Your message has been received."}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Active Directory
# ---------------------------------------------------------------------------
@app.get("/api/ad/ous")
async def ad_ous(request: Request):
    require_user(request)
    conn = get_db()
    ous = [dict(r) for r in conn.execute("SELECT * FROM ad_ous ORDER BY name").fetchall()]
    conn.close()
    return ous


@app.post("/api/ad/ous")
async def ad_create_ou(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    now = _now()
    parent_id = b.get("parent_id")
    parent_dn = ""
    if parent_id:
        r = conn.execute("SELECT dn FROM ad_ous WHERE id=?", (parent_id,)).fetchone()
        if r: parent_dn = r["dn"]
    name = b.get("name", "NewOU")
    if parent_dn and parent_dn.startswith("DC="):
        dn = f"OU={name},{parent_dn}"
    elif parent_dn:
        dn = f"OU={name},{parent_dn}"
    else:
        dn = f"OU={name},DC=lab,DC=local"
    conn.execute("INSERT INTO ad_ous (name, dn, parent_id, description, protected, created) VALUES (?,?,?,?,?,?)",
                 (name, dn, parent_id, b.get("description", ""), 0, now))
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": new_id, "name": name, "dn": dn}


@app.delete("/api/ad/ous/{ou_id}")
async def ad_delete_ou(request: Request, ou_id: int):
    require_user(request)
    conn = get_db()
    ou = conn.execute("SELECT * FROM ad_ous WHERE id=?", (ou_id,)).fetchone()
    if not ou:
        conn.close(); raise HTTPException(404, "OU not found")
    if ou["protected"]:
        conn.close(); raise HTTPException(400, "Cannot delete a protected OU")
    has_users = conn.execute("SELECT COUNT(*) FROM ad_users WHERE ou_id=?", (ou_id,)).fetchone()[0]
    has_groups = conn.execute("SELECT COUNT(*) FROM ad_groups WHERE ou_id=?", (ou_id,)).fetchone()[0]
    has_computers = conn.execute("SELECT COUNT(*) FROM ad_computers WHERE ou_id=?", (ou_id,)).fetchone()[0]
    has_child_ous = conn.execute("SELECT COUNT(*) FROM ad_ous WHERE parent_id=?", (ou_id,)).fetchone()[0]
    if has_users or has_groups or has_computers or has_child_ous:
        conn.close(); raise HTTPException(400, "OU is not empty - move or delete child objects first")
    conn.execute("DELETE FROM ad_ous WHERE id=?", (ou_id,))
    conn.commit(); conn.close()
    return {"ok": True}


@app.get("/api/ad/users")
async def ad_users(request: Request):
    require_user(request)
    conn = get_db()
    users = [dict(r) for r in conn.execute("SELECT * FROM ad_users ORDER BY sam_account_name").fetchall()]
    for u in users:
        groups = [r["name"] for r in conn.execute(
            "SELECT g.name FROM ad_groups g JOIN ad_group_members m ON g.id=m.group_id WHERE m.member_id=? AND m.member_type='user'",
            (u["id"],)
        ).fetchall()]
        u["groups"] = groups
        u.pop("password", None)
    conn.close()
    return users


@app.post("/api/ad/users")
async def ad_create_user(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    now = _now()
    sam = b.get("sam_account_name", "")
    if not sam:
        conn.close(); raise HTTPException(400, "sam_account_name is required")
    existing = conn.execute("SELECT id FROM ad_users WHERE sam_account_name=?", (sam,)).fetchone()
    if existing:
        conn.close(); raise HTTPException(409, f"User {sam} already exists")
    ou_id = b.get("ou_id")
    dn = b.get("dn", f"CN={b.get('display_name', sam)},{_ou_dn(conn, ou_id)}")
    conn.execute("""INSERT INTO ad_users
        (sam_account_name, display_name, user_principal_name, dn, ou_id, enabled, locked, password_expired, password_never_expires,
         department, title, email, phone, manager, description, password, password_last_set, last_logon, account_created,
         home_drive, home_directory, profile_path, logon_script)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sam, b.get("display_name", sam), b.get("user_principal_name", f"{sam}@lab.local"), dn, ou_id,
         1, 0, 0, b.get("password_never_expires", 0),
         b.get("department", ""), b.get("title", ""), b.get("email", ""), b.get("phone", ""), b.get("manager", ""),
         b.get("description", ""), b.get("password", "TempPass#2026"), now, "", now,
         b.get("home_drive", ""), b.get("home_directory", ""), b.get("profile_path", ""), b.get("logon_script", "")))
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": new_id, "sam_account_name": sam}


@app.put("/api/ad/users/{user_id}")
async def ad_update_user(request: Request, user_id: int):
    require_user(request)
    b = await request.json()
    conn = get_db()
    u = conn.execute("SELECT * FROM ad_users WHERE id=?", (user_id,)).fetchone()
    if not u:
        conn.close(); raise HTTPException(404, "User not found")
    fields = []
    vals = []
    for k in ["display_name", "user_principal_name", "department", "title", "email", "phone", "manager",
              "description", "home_drive", "home_directory", "profile_path", "logon_script",
              "enabled", "locked", "password_expired", "password_never_expires", "cannot_change_password", "smartcard_required"]:
        if k in b:
            fields.append(f"{k}=?")
            vals.append(int(b[k]) if k in ("enabled", "locked", "password_expired", "password_never_expires", "cannot_change_password", "smartcard_required") else b[k])
    if "password" in b:
        fields.append("password=?"); vals.append(b["password"])
        fields.append("password_last_set=?"); vals.append(_now())
        fields.append("password_expired=0")
    if "ou_id" in b:
        fields.append("ou_id=?"); vals.append(b["ou_id"])
        new_dn = f"CN={u['display_name']},{_ou_dn(conn, b['ou_id'])}"
        fields.append("dn=?"); vals.append(new_dn)
    if fields:
        vals.append(user_id)
        conn.execute(f"UPDATE ad_users SET {','.join(fields)} WHERE id=?", vals)
        conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/ad/users/{user_id}")
async def ad_delete_user(request: Request, user_id: int):
    require_user(request)
    conn = get_db()
    u = conn.execute("SELECT * FROM ad_users WHERE id=?", (user_id,)).fetchone()
    if not u:
        conn.close(); raise HTTPException(404, "User not found")
    if u["sam_account_name"] == "Administrator":
        conn.close(); raise HTTPException(400, "Cannot delete built-in Administrator account")
    conn.execute("DELETE FROM ad_group_members WHERE member_id=? AND member_type='user'", (user_id,))
    conn.execute("DELETE FROM ad_users WHERE id=?", (user_id,))
    conn.commit(); conn.close()
    return {"ok": True}


@app.post("/api/ad/users/{user_id}/unlock")
async def ad_unlock_user(request: Request, user_id: int):
    require_user(request)
    conn = get_db()
    conn.execute("UPDATE ad_users SET locked=0 WHERE id=?", (user_id,))
    conn.commit(); conn.close()
    return {"ok": True}


@app.post("/api/ad/users/{user_id}/reset-password")
async def ad_reset_password(request: Request, user_id: int):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("UPDATE ad_users SET password=?, password_last_set=?, password_expired=0, locked=0 WHERE id=?",
                 (b.get("password", "NewPass#2026"), _now(), user_id))
    conn.commit(); conn.close()
    return {"ok": True}


@app.get("/api/ad/groups")
async def ad_groups(request: Request):
    require_user(request)
    conn = get_db()
    groups = [dict(r) for r in conn.execute("SELECT * FROM ad_groups ORDER BY name").fetchall()]
    for g in groups:
        members = [dict(r) for r in conn.execute(
            "SELECT m.member_id, m.member_type, CASE WHEN m.member_type='user' THEN u.display_name WHEN m.member_type='group' THEN g2.name ELSE c.name END as member_name FROM ad_group_members m LEFT JOIN ad_users u ON m.member_id=u.id AND m.member_type='user' LEFT JOIN ad_groups g2 ON m.member_id=g2.id AND m.member_type='group' LEFT JOIN ad_computers c ON m.member_id=c.id AND m.member_type='computer' WHERE m.group_id=?",
            (g["id"],)
        ).fetchall()]
        g["members"] = [{"id": m["member_id"], "type": m["member_type"], "name": m["member_name"]} for m in members]
    conn.close()
    return groups


@app.post("/api/ad/groups")
async def ad_create_group(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    now = _now()
    name = b.get("name", "")
    if not name:
        conn.close(); raise HTTPException(400, "Group name is required")
    existing = conn.execute("SELECT id FROM ad_groups WHERE name=?", (name,)).fetchone()
    if existing:
        conn.close(); raise HTTPException(409, f"Group {name} already exists")
    ou_id = b.get("ou_id")
    dn = f"CN={name},{_ou_dn(conn, ou_id)}"
    conn.execute("INSERT INTO ad_groups (name, sam_account_name, dn, ou_id, group_type, scope, description, managed_by, created) VALUES (?,?,?,?,?,?,?,?,?)",
                 (name, b.get("sam_account_name", name), dn, ou_id, b.get("group_type", "Security"),
                  b.get("scope", "Global"), b.get("description", ""), b.get("managed_by", ""), now))
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": new_id, "name": name}


@app.put("/api/ad/groups/{group_id}")
async def ad_update_group(request: Request, group_id: int):
    require_user(request)
    b = await request.json()
    conn = get_db()
    fields = []
    vals = []
    for k in ["name", "description", "managed_by", "scope", "group_type"]:
        if k in b:
            fields.append(f"{k}=?"); vals.append(b[k])
    if fields:
        vals.append(group_id)
        conn.execute(f"UPDATE ad_groups SET {','.join(fields)} WHERE id=?", vals)
        conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/ad/groups/{group_id}")
async def ad_delete_group(request: Request, group_id: int):
    require_user(request)
    conn = get_db()
    g = conn.execute("SELECT * FROM ad_groups WHERE id=?", (group_id,)).fetchone()
    if not g:
        conn.close(); raise HTTPException(404, "Group not found")
    if g["name"] in ("Domain Admins", "Domain Users", "Domain Computers", "Enterprise Admins", "Schema Admins"):
        conn.close(); raise HTTPException(400, "Cannot delete built-in group")
    conn.execute("DELETE FROM ad_group_members WHERE group_id=?", (group_id,))
    conn.execute("DELETE FROM ad_group_members WHERE member_id=? AND member_type='group'", (group_id,))
    conn.execute("DELETE FROM ad_groups WHERE id=?", (group_id,))
    conn.commit(); conn.close()
    return {"ok": True}


@app.post("/api/ad/groups/{group_id}/members")
async def ad_add_member(request: Request, group_id: int):
    require_user(request)
    b = await request.json()
    conn = get_db()
    conn.execute("INSERT OR IGNORE INTO ad_group_members (group_id, member_id, member_type) VALUES (?,?,?)",
                 (group_id, b.get("member_id"), b.get("member_type", "user")))
    conn.commit(); conn.close()
    return {"ok": True}


@app.delete("/api/ad/groups/{group_id}/members/{member_id}")
async def ad_remove_member(request: Request, group_id: int, member_id: int, member_type: str = "user"):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM ad_group_members WHERE group_id=? AND member_id=? AND member_type=?",
                 (group_id, member_id, member_type))
    conn.commit(); conn.close()
    return {"ok": True}


@app.get("/api/ad/computers")
async def ad_computers(request: Request):
    require_user(request)
    conn = get_db()
    computers = [dict(r) for r in conn.execute("SELECT * FROM ad_computers ORDER BY name").fetchall()]
    conn.close()
    return computers


@app.post("/api/ad/computers")
async def ad_create_computer(request: Request):
    require_user(request)
    b = await request.json()
    conn = get_db()
    now = _now()
    name = b.get("name", "")
    if not name:
        conn.close(); raise HTTPException(400, "Computer name is required")
    existing = conn.execute("SELECT id FROM ad_computers WHERE name=?", (name,)).fetchone()
    if existing:
        conn.close(); raise HTTPException(409, f"Computer {name} already exists")
    ou_id = b.get("ou_id")
    dn = f"CN={name},{_ou_dn(conn, ou_id)}"
    conn.execute("INSERT INTO ad_computers (name, dn, ou_id, os, os_version, enabled, last_logon, created, ipv4_address, description) VALUES (?,?,?,?,?,?,?,?,?,?)",
                 (name, dn, ou_id, b.get("os", "Windows 11 Pro"), b.get("os_version", "10.0.22631"), 1, "", now, b.get("ipv4_address", ""), b.get("description", "")))
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": new_id, "name": name}


@app.delete("/api/ad/computers/{computer_id}")
async def ad_delete_computer(request: Request, computer_id: int):
    require_user(request)
    conn = get_db()
    conn.execute("DELETE FROM ad_computers WHERE id=?", (computer_id,))
    conn.commit(); conn.close()
    return {"ok": True}


@app.get("/api/ad/dcs")
async def ad_dcs(request: Request):
    require_user(request)
    conn = get_db()
    dcs = [dict(r) for r in conn.execute("SELECT * FROM ad_domain_controllers ORDER BY name").fetchall()]
    conn.close()
    return dcs


@app.get("/api/ad/search")
async def ad_search(request: Request, q: str = ""):
    require_user(request)
    conn = get_db()
    results = []
    if q:
        like = f"%{q}%"
        for r in conn.execute("SELECT id, sam_account_name, display_name, 'user' as type, dn FROM ad_users WHERE sam_account_name LIKE ? OR display_name LIKE ? OR user_principal_name LIKE ?", (like, like, like)).fetchall():
            results.append(dict(r))
        for r in conn.execute("SELECT id, name, name as display_name, 'group' as type, dn FROM ad_groups WHERE name LIKE ?", (like,)).fetchall():
            results.append(dict(r))
        for r in conn.execute("SELECT id, name, name as display_name, 'computer' as type, dn FROM ad_computers WHERE name LIKE ?", (like,)).fetchall():
            results.append(dict(r))
    conn.close()
    return results


def _ou_dn(conn, ou_id):
    if not ou_id: return "CN=Users,DC=lab,DC=local"
    r = conn.execute("SELECT dn FROM ad_ous WHERE id=?", (ou_id,)).fetchone()
    return r["dn"] if r else "CN=Users,DC=lab,DC=local"


@app.on_event("startup")
async def startup():
    init_db()


if __name__ == "__main__":
    import sys
    import os
    import uvicorn
    import threading
    import webbrowser
    import time
    import traceback

    # When bundled with PyInstaller, set the working directory to the exe folder
    # so the SQLite database is created next to the executable, not in a temp dir.
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    def open_browser():
        time.sleep(2)
        webbrowser.open("http://127.0.0.1:8000/")

    try:
        init_db()
        threading.Thread(target=open_browser, daemon=True).start()
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception as e:
        # Log errors to a file so we can debug even in windowed mode
        log_path = os.path.join(os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else '.', 'error.log')
        with open(log_path, 'w') as f:
            f.write(f"Startup error:\n{traceback.format_exc()}\n")
        raise
