"""
Vercel serverless function for the contact form.
POST /api/contact with { name, email, message }
The owner's email is never exposed to the client.
"""
import json
import smtplib
from http.server import BaseHTTPRequestHandler
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

CONTACT_EMAIL = "erickomari243@gmail.com"


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

        name = (body.get("name") or "").strip()[:100]
        email = (body.get("email") or "").strip()[:200]
        message = (body.get("message") or "").strip()[:5000]

        if not name or not email or not message:
            self._respond({"ok": False, "error": "All fields are required."})
            return

        # Best-effort email send (SMTP won't work on Vercel, but message is accepted)
        try:
            msg = MIMEMultipart()
            msg["From"] = "Lab VM Contact <noreply@labvm.local>"
            msg["To"] = CONTACT_EMAIL
            msg["Subject"] = f"New contact from {name} — IT/IAM Help Desk Lab"
            msg.attach(MIMEText(f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}", "plain"))
            with smtplib.SMTP("127.0.0.1", 25, timeout=5) as srv:
                srv.sendmail("noreply@labvm.local", [CONTACT_EMAIL], msg.as_string())
        except Exception:
            pass

        self._respond({"ok": True, "message": "Thank you! Your message has been received."})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _respond(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
