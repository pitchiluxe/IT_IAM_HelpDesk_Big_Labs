"""
build_exe.py — Build a standalone Windows application for the IT/IAM Help Desk Lab.

Usage:
    python build_exe.py

This uses PyInstaller to bundle the FastAPI app, database, and static files
into a single distributable folder. The resulting executable:
  1. Starts the FastAPI server on localhost:8000 (behind the scenes)
  2. Opens a native desktop window (pywebview / Edge WebView2) — NOT a browser
  3. Shows a system tray icon with Open/Exit menu
  4. No console window — runs as a proper Windows application

Prerequisites:
    pip install pyinstaller
    pip install -r requirements-dev.txt
"""
import os
import sys
import subprocess
import shutil

APP_NAME = "IT_IAM_HelpDesk_Lab"
MAIN_SCRIPT = "labvm_server.py"
ICON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app.ico")

def check_pyinstaller():
    try:
        import PyInstaller
        print(f"[OK] PyInstaller {PyInstaller.__version__} found")
    except ImportError:
        print("[ERR] PyInstaller not installed. Run: pip install pyinstaller")
        sys.exit(1)

def build():
    check_pyinstaller()

    # Clean previous builds
    for d in ["build", "dist"]:
        if os.path.isdir(d):
            shutil.rmtree(d)
            print(f"[CLEAN] Removed {d}/")

    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--windowed",                    # no console window — proper Windows app
        "--name", APP_NAME,
        "--add-data", "../static;static",   # bundle static files (from parent dir)
        "--add-data", "database.py;.",       # bundle database module (same dir)
        "--hidden-import", "httpx",
        "--hidden-import", "uvicorn",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        "--hidden-import", "starlette.staticfiles",
        "--hidden-import", "starlette.responses",
        "--hidden-import", "ctypes._layout",  # Python 3.14 internal module
        "--hidden-import", "click",
        # System tray icon
        "--hidden-import", "pystray",
        "--hidden-import", "pystray._win32",
        "--hidden-import", "PIL",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageDraw",
        # Native window (pywebview uses Edge WebView2 on Windows)
        "--hidden-import", "webview",
        "--hidden-import", "webview.platforms.edgechromium",
        "--hidden-import", "clr_loader",
        "--hidden-import", "pythonnet",
        "--collect-data", "fastapi",
        "--collect-data", "starlette",
        "--collect-data", "webview",
        "--exclude-module", "tkinter",   # not needed, causes Tcl data errors
        "--exclude-module", "_tkinter",
        "--exclude-module", "matplotlib",
        "--exclude-module", "PyQt5",
        "--exclude-module", "PySide6",
        "--exclude-module", "pytest",
        "--exclude-module", "pkg_resources",  # setuptools vendored, causes file errors
        "--exclude-module", "setuptools",
        MAIN_SCRIPT,
    ]

    # Add icon if it exists
    if os.path.isfile(ICON_PATH):
        cmd.extend(["--icon", ICON_PATH])
        print(f"[OK] Using icon: {ICON_PATH}")
    else:
        print(f"[WARN] Icon not found: {ICON_PATH}")

    print(f"[BUILD] Running PyInstaller...")
    print(f"  {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        print("[ERR] Build failed!")
        sys.exit(1)

    output_dir = os.path.join("dist", APP_NAME)
    print(f"\n[DONE] Build complete!")
    print(f"  Output: {output_dir}")
    print(f"  Executable: {os.path.join(output_dir, APP_NAME + '.exe')}")
    print(f"\n  To distribute: zip the '{output_dir}' folder and upload to GitHub Releases.")

if __name__ == "__main__":
    build()
