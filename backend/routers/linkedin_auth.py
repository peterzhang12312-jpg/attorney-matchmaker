"""LinkedIn OAuth2 callback handler — exchanges auth code for access token."""
import json
import os
import urllib.parse
import urllib.request
import urllib.error

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

log = structlog.get_logger()
router = APIRouter()

LINKEDIN_CLIENT_ID = os.environ.get("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.environ.get("LINKEDIN_CLIENT_SECRET", "")
REDIRECT_URI = "https://attorney-matchmaker.onrender.com/api/linkedin/callback"


@router.get("/api/linkedin/callback", response_class=HTMLResponse, include_in_schema=False)
async def linkedin_callback(request: Request):
    code = request.query_params.get("code")
    error = request.query_params.get("error")

    if error:
        desc = request.query_params.get("error_description", error)
        log.warning("linkedin_oauth_error", error=desc)
        return HTMLResponse(_page("LinkedIn Auth Error", f"<p style='color:red'>{desc}</p>"))

    if not code:
        return HTMLResponse(_page("LinkedIn Auth Error", "<p style='color:red'>No code received.</p>"))

    # Exchange code for token
    try:
        data = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET,
        }).encode()
        req = urllib.request.Request(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            tok = json.loads(r.read())
    except Exception as e:
        log.error("linkedin_token_exchange_failed", error=str(e))
        return HTMLResponse(_page("Token Exchange Failed", f"<p style='color:red'>{e}</p>"))

    access_token = tok.get("access_token", "")
    expires_in = tok.get("expires_in", "?")

    # Fetch profile to confirm
    profile_name = "unknown"
    profile_email = ""
    try:
        req2 = urllib.request.Request(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(req2, timeout=10) as r2:
            profile = json.loads(r2.read())
        profile_name = profile.get("name", "unknown")
        profile_email = profile.get("email", "")
    except Exception:
        pass

    log.info("linkedin_auth_success", name=profile_name)

    return HTMLResponse(_page(
        "LinkedIn Connected!",
        f"""
        <p style='color:#2d7a2d;font-size:1.2rem'>Connected as <strong>{profile_name}</strong> ({profile_email})</p>
        <p>Token expires in: {expires_in} seconds (~{int(int(expires_in)/86400) if str(expires_in).isdigit() else '?'} days)</p>
        <hr style='margin:20px 0'>
        <p><strong>Copy your access token below and save it:</strong></p>
        <textarea rows='4' style='width:100%;font-family:monospace;font-size:0.8rem;padding:8px'>{access_token}</textarea>
        <p style='margin-top:16px;color:#666;font-size:0.85rem'>
          Run this on your local machine to activate the LinkedIn OpenClaw skill:<br>
          <code style='background:#f5f5f5;padding:4px 8px;display:block;margin-top:8px'>
            python3 ~/.openclaw/agents/main/skills/linkedin/linkedin_cli.py profile
          </code>
        </p>
        """,
    ))


def _page(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    body {{ font-family: 'Geist', system-ui, sans-serif; background: #FFFEF2;
           max-width: 600px; margin: 80px auto; padding: 0 24px; color: #191918; }}
    h1 {{ color: #191918; border-bottom: 2px solid #FCAA2D; padding-bottom: 12px; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  {body}
</body>
</html>"""
