# LinkedIn Bot Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CAPTCHA recovery (wait + retry), add missing --verbose test, then extract the bot into a standalone public GitHub repo your friend in Paris can clone and run.

**Architecture:** Three self-contained tasks. T1 modifies `scraper.py` to pause on CAPTCHA and let the user solve it in the visible browser before retrying once. T2 adds one missing test to `test_cli.py`. T3 creates a new GitHub repo from the `linkedin-bot/` directory and writes a friend-friendly README.

**Tech Stack:** Python 3.11+, Playwright (sync API), Typer CLI, Gemini API (`google-genai`), pytest, GitHub CLI (`gh`)

---

## Task 1: CAPTCHA Recovery — modify scraper.py

**Files:**
- Modify: `linkedin-bot/linkedin_bot/scraper.py`

CAPTCHA is already detected. What's missing: instead of raising immediately, pause, wait for the user to solve it in the visible browser, then re-check once. We use a `_input_fn` class attribute (defaults to `builtins.input`) so tests can override it without patching builtins.

**Step 1: Add `_input_fn` class attribute to `LinkedInScraper`**

In `scraper.py`, inside the `LinkedInScraper` class definition (after the docstring, before `__init__`), add one line:

```python
_input_fn = staticmethod(input)  # overridable in tests without patching builtins
```

**Step 2: Replace `_check_for_captcha_or_redirect` with the recovery version**

Replace the existing method (lines 396–406) with:

```python
def _check_for_captcha_or_redirect(self, page) -> None:
    """Check current URL for CAPTCHA or login redirect.

    On CAPTCHA: pauses and prompts the user to solve it in the visible
    browser window, then re-checks once.  Raises LinkedInCaptchaError
    only if the CAPTCHA persists after the retry.
    """
    url = page.url
    if "/checkpoint/" in url or "/challenge/" in url:
        self._input_fn(
            "LinkedIn CAPTCHA detected — solve it in the browser window, "
            "then press Enter to retry..."
        )
        url = page.url  # re-read after user intervention
        if "/checkpoint/" in url or "/challenge/" in url:
            raise LinkedInCaptchaError(
                f"CAPTCHA still present after retry. URL: {url}"
            )
        return  # CAPTCHA cleared — continue normally
    if "/login" in url or "/authwall" in url or "/uas/login" in url:
        raise LinkedInSessionExpiredError(
            f"LinkedIn session expired — browser was redirected to login. URL: {url}"
        )
```

**Step 3: Verify existing tests still pass**

Run from `linkedin-bot/`:
```bash
pytest tests/test_scraper.py -v
```

The existing CAPTCHA detection tests (`test_captcha_detection_raises_error`, `test_challenge_url_raises_captcha_error`) will now **hang** waiting for `input()` — they need to be updated in Task 2.

---

## Task 2: Fix + extend CAPTCHA tests, add --verbose test

**Files:**
- Modify: `linkedin-bot/tests/test_scraper.py`
- Modify: `linkedin-bot/tests/test_cli.py`

### Part A — Fix existing CAPTCHA detection tests

The two existing tests (`test_captcha_detection_raises_error`, `test_challenge_url_raises_captcha_error`) call `_check_for_captcha_or_redirect` with a mock page whose URL is a checkpoint URL. After our change, they now call `_input_fn` before raising. We need to stub `_input_fn` and keep the URL at the checkpoint value on second read.

**Step 1: Update `test_captcha_detection_raises_error`**

Replace the existing test (around line 196) with:

```python
def test_captcha_detection_raises_error():
    """
    _check_for_captcha_or_redirect raises LinkedInCaptchaError when
    /checkpoint/ persists after the user presses Enter.
    """
    from linkedin_bot.scraper import LinkedInScraper, LinkedInCaptchaError

    scraper = object.__new__(LinkedInScraper)
    scraper._input_fn = lambda prompt="": None  # skip the wait

    mock_page = MagicMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/abc123"

    with pytest.raises(LinkedInCaptchaError):
        scraper._check_for_captcha_or_redirect(mock_page)
```

**Step 2: Update `test_challenge_url_raises_captcha_error`**

Replace with:

```python
def test_challenge_url_raises_captcha_error():
    """URL containing /challenge/ should also trigger LinkedInCaptchaError."""
    from linkedin_bot.scraper import LinkedInScraper, LinkedInCaptchaError

    scraper = object.__new__(LinkedInScraper)
    scraper._input_fn = lambda prompt="": None

    mock_page = MagicMock()
    mock_page.url = "https://www.linkedin.com/challenge/solve?type=something"

    with pytest.raises(LinkedInCaptchaError):
        scraper._check_for_captcha_or_redirect(mock_page)
```

### Part B — Add two new CAPTCHA recovery tests

Add these two tests at the end of `test_scraper.py`:

```python
# ---------------------------------------------------------------------------
# CAPTCHA recovery — cleared on retry
# ---------------------------------------------------------------------------

def test_captcha_clears_after_user_resolves():
    """
    If the user solves the CAPTCHA before pressing Enter, the URL changes
    to a normal profile URL — no exception should be raised.
    """
    from linkedin_bot.scraper import LinkedInScraper

    scraper = object.__new__(LinkedInScraper)
    scraper._input_fn = lambda prompt="": None  # simulate instant Enter

    mock_page = MagicMock()
    # First read: checkpoint URL; second read (after input): normal URL
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/abc123"

    call_count = 0

    @property
    def url_prop(self):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return "https://www.linkedin.com/checkpoint/challenge/abc123"
        return "https://www.linkedin.com/in/sarah-chen/"

    type(mock_page).url = url_prop

    # Should not raise
    scraper._check_for_captcha_or_redirect(mock_page)


# ---------------------------------------------------------------------------
# CAPTCHA recovery — persists after retry
# ---------------------------------------------------------------------------

def test_captcha_persists_after_retry_raises_error():
    """
    If the CAPTCHA URL is still present after the user presses Enter,
    LinkedInCaptchaError must be raised.
    """
    from linkedin_bot.scraper import LinkedInScraper, LinkedInCaptchaError

    scraper = object.__new__(LinkedInScraper)
    scraper._input_fn = lambda prompt="": None

    mock_page = MagicMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge/abc123"

    with pytest.raises(LinkedInCaptchaError):
        scraper._check_for_captcha_or_redirect(mock_page)
```

### Part C — Add missing --verbose test to test_cli.py

Add this test after `test_run_verbose_shows_profile_data` (end of file):

```python
# ---------------------------------------------------------------------------
# run without --verbose does NOT print debug output
# ---------------------------------------------------------------------------

def test_run_no_verbose_omits_debug_output():
    mock_scraper = _make_scraper_mock()

    with patch("linkedin_bot.personas.load", return_value=SAMPLE_PERSONA), \
         patch("linkedin_bot.history.get_recent_for_url", return_value=[]), \
         patch("cli.LinkedInScraper", return_value=mock_scraper), \
         patch("cli.build_context", return_value={}), \
         patch("cli.MessageGenerator") as MockGenerator, \
         patch("pyperclip.copy"), \
         patch("linkedin_bot.history.append_entry"):

        mock_gen_instance = MagicMock()
        mock_gen_instance.generate.return_value = CLEAN_ANGLES
        MockGenerator.return_value = mock_gen_instance

        result = runner.invoke(
            app,
            ["run", "--url", "https://www.linkedin.com/in/sarahchen", "--dry-run"],
            input="1\n",
        )

    assert result.exit_code == 0, result.output
    assert "Scraped profile:" not in result.output
    assert "Posts scraped:" not in result.output
```

**Step 3: Run all tests and verify green**

```bash
cd linkedin-bot && pytest tests/ -v
```

Expected: all 126 tests pass (124 existing + 2 new scraper + 1 new cli — but `test_run_verbose_shows_profile_data` was already there so net new = 3 tests → 127 total).

**Step 4: Commit**

```bash
cd ..
git add linkedin-bot/linkedin_bot/scraper.py linkedin-bot/tests/test_scraper.py linkedin-bot/tests/test_cli.py
git commit -m "feat(linkedin-bot): CAPTCHA recovery with retry + verbose test coverage"
```

---

## Task 3: Standalone GitHub Repo

**Goal:** Create a new GitHub repo `linkedin-bot`, push the contents of `linkedin-bot/` as root, write a beginner-friendly README.

### Step 1: Write README.md

Create `linkedin-bot/README.md`:

```markdown
# LinkedIn Bot

A personal LinkedIn networking tool. Scrapes a profile, generates 3 personalized
message drafts using AI, and opens the LinkedIn compose window — you paste and send.

**Human-in-the-loop:** the bot never sends anything automatically.

---

## Prerequisites

- Python 3.11 or newer — check with `python --version`
- Git — check with `git --version`
- A [Google AI Studio](https://aistudio.google.com/) account (free) for the Gemini API key
- A LinkedIn account

---

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-bot.git
cd linkedin-bot
pip install -r requirements.txt
playwright install chromium
```

---

## LinkedIn Session Setup (one-time)

The bot uses a persistent browser profile so LinkedIn sees your real session.

```bash
python -m playwright codegen linkedin.com --save-storage=linkedin_session.json
```

A browser window opens. Log in to LinkedIn normally. Once logged in, close the browser.
This saves your session — you won't need to log in again unless LinkedIn expires it.

Set the profile directory in your `.env` file (see next step).

---

## API Key Setup

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Open `.env` and set:

```
GEMINI_API_KEY=your_key_here
LI_PROFILE_DIR=./li_profile
```

Get your Gemini API key free at [aistudio.google.com](https://aistudio.google.com/) →
click "Get API key".

---

## Persona Setup

A persona tells the bot who you are so it can write messages in your voice.

Open `personas/default.json` and replace the placeholder values:

```json
{
  "name": "Default",
  "USER_NAME": "YOUR_NAME_HERE",
  "USER_BIO": "YOUR_BIO_HERE — e.g. 'Startup founder building AI tools for legal teams'",
  "USER_GOAL": "YOUR_GOAL_HERE — e.g. 'Connect with ML engineers and AI researchers'",
  "USER_TONE": "concise and direct",
  "preferred_angles": ["recent_post", "career_transition", "shared_interest"]
}
```

You can create additional personas (e.g. `recruiter`, `investor`) with:

```bash
python cli.py personas new my-persona
```

---

## Usage

```bash
# Generate drafts for a LinkedIn profile
python cli.py run --url https://www.linkedin.com/in/someone

# Use a specific persona
python cli.py run --url https://www.linkedin.com/in/someone --persona founder

# Dry run — generate drafts without opening LinkedIn compose window
python cli.py run --url https://www.linkedin.com/in/someone --dry-run

# See what you've sent before
python cli.py history list

# List available personas
python cli.py personas list
```

---

## Workflow

1. Bot scrapes the profile and recent posts
2. Bot shows 3 draft messages (under 280 characters each)
3. You pick one (or ask for a regeneration)
4. Bot opens the LinkedIn compose window
5. You paste the message and click Send
6. CLI asks "Did you send it?" — updates your history

---

## Troubleshooting

**CAPTCHA detected**
LinkedIn showed a CAPTCHA. Solve it in the browser window that opened, then press Enter.

**Session expired — re-login required**
Your LinkedIn session expired. Run:
```bash
python -m playwright codegen linkedin.com --save-storage=linkedin_session.json
```
Log in again and close the browser.

**LinkedIn DOM changed — selectors need updating**
LinkedIn changed their HTML. Open an issue or update the selectors in
`linkedin_bot/scraper.py`.

**GEMINI_API_KEY not set**
Make sure you copied `.env.example` to `.env` and filled in your key.
```

### Step 2: Create the GitHub repo and push

```bash
# From the linkedin-bot/ directory
cd linkedin-bot

# Initialize a fresh git repo (separate from attorney-matchmaker)
git init
git add .
git commit -m "feat: initial release — LinkedIn networking bot with AI draft generation"

# Create and push to new GitHub repo (adjust --public/--private as preferred)
gh repo create linkedin-bot --public --source=. --remote=origin --push
```

### Step 3: Verify

Open the repo URL printed by `gh repo create` in a browser. Confirm:
- README renders correctly
- `requirements.txt`, `.env.example`, `personas/` are present
- `.env` is NOT present (gitignored)
- `drafts/` folder is present (with `.gitkeep`)

### Step 4: Share with your friend

Send the GitHub URL. They follow the README from top to bottom — nothing else needed.
```

---

## Quick reference

| Task | File | Change |
|------|------|--------|
| T1 | `linkedin_bot/scraper.py` | Add `_input_fn`, update `_check_for_captcha_or_redirect` |
| T2 | `tests/test_scraper.py` | Fix 2 existing tests, add 2 new recovery tests |
| T2 | `tests/test_cli.py` | Add `test_run_no_verbose_omits_debug_output` |
| T3 | `README.md` | Create from scratch |
| T3 | GitHub | New repo, initial commit, push |
