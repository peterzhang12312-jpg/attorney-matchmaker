---
status: APPROVED
date: 2026-03-29
scope: Approach B (T1 + T4 only)
---

# LinkedIn Bot Phase 2 Design

## Scope

Approach B: T1 (CAPTCHA recovery) + T4 (--verbose tests) + standalone GitHub repo.
T2 (warm path detection) and T3 (response rate tracker) deferred — T2 is large scope,
T3 is premature without 20+ data points.

---

## T1 — CAPTCHA Recovery

### Problem
Current behavior: `_check_for_captcha_or_redirect()` raises `LinkedInCaptchaError`
immediately, the CLI prints an error and exits. Since the browser is non-headless
(visible), the user can solve the CAPTCHA manually — but the bot gives them no chance to.

### Solution
Add a retry wrapper in `scraper.py`. When a CAPTCHA URL is detected:

1. Print: `"LinkedIn CAPTCHA detected — solve it in the browser window, then press Enter to retry..."`
2. Block on `input()` (waits for user to press Enter)
3. Re-check URL via `_check_for_captcha_or_redirect()`
4. If clear: continue scraping normally
5. If still CAPTCHA: raise `LinkedInCaptchaError` (CLI exits with existing message)

Max 1 retry. The existing CLI error handler (`except LinkedInCaptchaError`) is unchanged
and fires on the final failure.

### Affected files
- `linkedin_bot/scraper.py` — add `_wait_for_captcha_resolution()` helper + call it from
  `_check_for_captcha_or_redirect()` instead of raising immediately
- `tests/test_scraper.py` — two new tests: CAPTCHA resolved on retry, CAPTCHA persists on retry

---

## T4 — `--verbose` Flag Tests

### Status
Flag is already implemented in `cli.py`. Prints raw profile dict and post count when set.

### Tests to add (`tests/test_cli.py`)
- `test_run_verbose_prints_profile`: assert scraped profile dict line appears in stdout
- `test_run_no_verbose_omits_debug`: assert debug lines absent without `--verbose`

---

## Standalone GitHub Repo

### Goal
Your friend in Paris clones one repo, fills in two files, runs one setup command, and
the bot works.

### New repo structure (root = contents of current `linkedin-bot/`)
```
README.md
cli.py
linkedin_bot/
  __init__.py
  scraper.py
  context.py
  generator.py
  scanner.py
  history.py
  personas.py
personas/
  default.json
  founder.json
  developer.json
prompts/
  generate_angles.txt
tests/
drafts/
requirements.txt
.env.example
.gitignore
```

### README sections
1. Prerequisites (Python 3.11+, Git)
2. Install (`git clone`, `pip install -r requirements.txt`, `playwright install chromium`)
3. LinkedIn session setup (`python -m playwright codegen linkedin.com` → log in → close)
4. API key (copy `.env.example` to `.env`, add `GEMINI_API_KEY`)
5. Persona setup (edit `personas/default.json` with your bio)
6. Usage examples (`run`, `personas list`, `history list`)
7. Troubleshooting (CAPTCHA, session expired, DOM changed)

### Delivery
- New GitHub repo: `linkedin-bot` (separate from `attorney-matchmaker`)
- Clean initial commit — no attorney-matchmaker history
- Push `main` branch, set repo visibility to public or private per user preference

---

## Out of Scope
- T2: Warm path detection (mutual connections scraping) — Phase 3
- T3: Response rate tracker with weighted angle selection — Phase 3 (need 20+ data points)
- `replied` field in history schema — add alongside T3
- Warm path / fingerprint spoofing — Phase 3
