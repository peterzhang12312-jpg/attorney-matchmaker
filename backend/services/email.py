"""
Transactional email via Resend.

If RESEND_API_KEY is not set, logs a warning and skips -- never crashes.
All functions are async and safe to fire-and-forget via asyncio.create_task().
"""

from __future__ import annotations

import os

import structlog
import resend

log = structlog.get_logger()

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = os.getenv("EMAIL_FROM", "matches@attorney-matchmaker.com")
APP_URL = os.getenv("APP_URL", "https://attorney-matchmaker.onrender.com")


def _can_send() -> bool:
    """Guard: skip email if Resend is not configured."""
    if not resend.api_key:
        log.warning("email.skipped", reason="RESEND_API_KEY not set")
        return False
    return True


# ---------------------------------------------------------------------------
# Shared HTML scaffolding
# ---------------------------------------------------------------------------

def _wrap_html(body_content: str) -> str:
    """Wrap body content in a branded HTML email template (inline CSS only)."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#FFFEF2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFEF2;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid rgba(25,25,24,0.12);border-radius:10px;">
        <!-- Header -->
        <tr><td style="padding:28px 32px 0;">
          <span style="font-family:monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(25,25,24,0.45);">Attorney Matchmaker</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 32px 32px;color:#191918;font-size:15px;line-height:1.6;">
          {body_content}
        </td></tr>
      </table>
    </td></tr>
    <!-- Footer -->
    <tr><td align="center" style="padding:20px 20px 40px;">
      <span style="font-size:11px;color:rgba(25,25,24,0.45);">
        You received this because you used Attorney Matchmaker.
        <a href="mailto:unsubscribe@attorney-matchmaker.com?subject=unsubscribe"
           style="color:rgba(25,25,24,0.45);">Unsubscribe</a>
      </span>
    </td></tr>
  </table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Email functions
# ---------------------------------------------------------------------------

async def send_case_confirmation(
    to_email: str, case_id: str, practice_area: str, urgency: str
) -> None:
    """Step 1: Client submitted a case."""
    if not to_email or not _can_send():
        return

    area_line = f" in <strong>{practice_area}</strong>" if practice_area else ""
    html = _wrap_html(f"""\
<h2 style="margin:0 0 16px;font-size:20px;color:#191918;">Case Received</h2>
<p>We received your case{area_line} and are finding your best attorney matches.</p>
<p style="margin:16px 0;">
  <strong>Case ID:</strong> <code style="background:#f5f5f0;padding:2px 6px;border-radius:4px;font-size:13px;">{case_id}</code><br>
  <strong>Urgency:</strong> {urgency}
</p>
<p>We will notify you as soon as your matches are ready.</p>""")

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Your case has been received",
            "html": html,
        })
        log.info("email.sent", template="case_confirmation", to=to_email, case_id=case_id)
    except Exception as exc:
        log.error("email.send_failed", template="case_confirmation", error=str(exc))


async def send_matches_ready(
    to_email: str, case_id: str, match_count: int
) -> None:
    """Step 2: Match pipeline complete."""
    if not to_email or not _can_send():
        return

    html = _wrap_html(f"""\
<h2 style="margin:0 0 16px;font-size:20px;color:#191918;">Your Matches Are Ready</h2>
<p>We found <strong>{match_count}</strong> attorney match{"es" if match_count != 1 else ""} for your case.</p>
<p style="margin:24px 0;">
  <a href="{APP_URL}" style="display:inline-block;padding:10px 24px;background-color:#FCAA2D;color:#191918;
     text-decoration:none;border-radius:6px;font-family:monospace;font-size:12px;letter-spacing:1px;
     text-transform:uppercase;font-weight:bold;">View Matches</a>
</p>
<p style="font-size:13px;color:rgba(25,25,24,0.45);">Case ID: {case_id}</p>""")

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": f"{match_count} attorney matches ready for your case",
            "html": html,
        })
        log.info("email.sent", template="matches_ready", to=to_email, case_id=case_id)
    except Exception as exc:
        log.error("email.send_failed", template="matches_ready", error=str(exc))


async def send_lead_to_attorney(
    attorney_email: str,
    attorney_name: str,
    practice_area: str,
    urgency: str,
    jurisdiction: str,
) -> None:
    """Step 3: New lead notification to attorney (no client PII)."""
    if not attorney_email or not _can_send():
        return

    html = _wrap_html(f"""\
<h2 style="margin:0 0 16px;font-size:20px;color:#191918;">New Client Lead</h2>
<p>Hi {attorney_name},</p>
<p>A new client is looking for a <strong>{practice_area}</strong> attorney
   (<strong>{urgency}</strong> urgency) in <strong>{jurisdiction}</strong>.</p>
<p style="margin:24px 0;">
  <a href="{APP_URL}" style="display:inline-block;padding:10px 24px;background-color:#FCAA2D;color:#191918;
     text-decoration:none;border-radius:6px;font-family:monospace;font-size:12px;letter-spacing:1px;
     text-transform:uppercase;font-weight:bold;">View &amp; Accept Lead</a>
</p>
<p style="font-size:13px;color:rgba(25,25,24,0.45);">Log in to view case details and respond.</p>""")

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [attorney_email],
            "subject": f"New {practice_area} lead - {urgency} urgency",
            "html": html,
        })
        log.info("email.sent", template="lead_to_attorney", to=attorney_email)
    except Exception as exc:
        log.error("email.send_failed", template="lead_to_attorney", error=str(exc))


async def send_lead_accepted_to_client(
    client_email: str, attorney_name: str, firm: str
) -> None:
    """Step 4: Attorney accepted -- notify client."""
    if not client_email or not _can_send():
        return

    firm_line = f" at <strong>{firm}</strong>" if firm else ""
    html = _wrap_html(f"""\
<h2 style="margin:0 0 16px;font-size:20px;color:#191918;">An Attorney Wants to Connect</h2>
<p>Good news -- <strong>{attorney_name}</strong>{firm_line} wants to connect with you about your case.</p>
<p style="margin:24px 0;">
  <a href="{APP_URL}" style="display:inline-block;padding:10px 24px;background-color:#FCAA2D;color:#191918;
     text-decoration:none;border-radius:6px;font-family:monospace;font-size:12px;letter-spacing:1px;
     text-transform:uppercase;font-weight:bold;">View Details</a>
</p>
<p style="font-size:13px;color:rgba(25,25,24,0.45);">You will be connected shortly.</p>""")

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [client_email],
            "subject": f"{attorney_name} wants to connect about your case",
            "html": html,
        })
        log.info("email.sent", template="lead_accepted", to=client_email)
    except Exception as exc:
        log.error("email.send_failed", template="lead_accepted", error=str(exc))


async def send_match_followup(
    to_email: str, case_id: str, match_count: int
) -> None:
    """7-day follow-up: case has matches but no attorney hired yet."""
    if not to_email or not _can_send():
        return

    html = _wrap_html(f"""\
<h2 style="margin:0 0 16px;font-size:20px;color:#191918;">Still Looking for an Attorney?</h2>
<p>We found <strong>{match_count}</strong> attorney match{"es" if match_count != 1 else ""} for your case
   a week ago, but it looks like you haven't connected with one yet.</p>
<p>Your matches are still available -- attorneys are waiting to hear from you.</p>
<p style="margin:24px 0;">
  <a href="{APP_URL}" style="display:inline-block;padding:10px 24px;background-color:#FCAA2D;color:#191918;
     text-decoration:none;border-radius:6px;font-family:monospace;font-size:12px;letter-spacing:1px;
     text-transform:uppercase;font-weight:bold;">View Your Matches</a>
</p>
<p style="font-size:13px;color:rgba(25,25,24,0.45);">Case ID: {case_id}</p>""")

    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Your attorney matches are still waiting",
            "html": html,
        })
        log.info("email.sent", template="match_followup", to=to_email, case_id=case_id)
    except Exception as exc:
        log.error("email.send_failed", template="match_followup", error=str(exc))
