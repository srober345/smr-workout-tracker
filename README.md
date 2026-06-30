# SMR Workout Tracker

A minimal Python CLI for logging strength training sessions to Google Sheets, with automatic pull-day volume monitoring for elbow safety.

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Create a Google Cloud service account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the **Google Sheets API** and **Google Drive API** for the project.
3. Navigate to **IAM & Admin → Service Accounts** and click **Create Service Account**.
4. Give it a name (e.g. `workout-tracker`), click through the optional role/user steps, then click **Done**.
5. Click the service account you just created → **Keys** tab → **Add Key → Create new key → JSON**.
6. Save the downloaded JSON file somewhere safe (e.g. `C:\Users\smr\OneDrive\ClaudeWork\smr-workout-tracker\smr-workout-tracker-94b18eb7547e.json`).

### 3. Share your Google Sheet with the service account

1. Create a Google Sheet named exactly **`Workout Tracker`**.
2. Open the downloaded credentials JSON and copy the `client_email` value (looks like `workout-tracker@your-project.iam.gserviceaccount.com`).
3. In the Sheet, click **Share**, paste the service account email, and give it **Editor** access.

The `Log` tab and header row are created automatically on first run.

### 4. Credentials path

The credentials path is pre-configured to:

```
C:\Users\smr\OneDrive\ClaudeWork\smr-workout-tracker\smr-workout-tracker-94b18eb7547e.json
```

If you ever need to change it, edit `.config.json` in the project directory:

```json
{
  "credentials_path": "/new/path/to/credentials.json"
}
```

Or call `config.set_credentials_path("/new/path")` from a Python shell.

---

## Usage

### Log a workout

```bash
python log_workout.py
```

- Select your day type from the menu.
- Enter each exercise (name, weight, sets, reps). Type `done` when finished.
- Enter your elbow pain level (0–10) and optional session notes.
- Volume comparison runs automatically at the end.

### Check pull volume only

```bash
python check_volume.py
```

Reads the Sheet and compares this week's Pull-day volume to last week's. Warns if:

- Volume increased more than **20%** week-over-week.
- Elbow pain averaged **3 or higher** this week.

---

## Sheet columns

| Column | Description |
|---|---|
| Date | ISO date (YYYY-MM-DD) |
| Day Type | Lower/Push · Pull · Full Body/Golf · Cardio - Intervals · Cardio - Zone 2 |
| Exercise | Exercise name |
| Weight (lbs) | Load used (0 for bodyweight) |
| Sets | Number of sets |
| Reps | Reps per set |
| Elbow Pain (0-10) | Session pain level |
| Notes | Optional free-text notes |

---

## Files

| File | Purpose |
|---|---|
| `log_workout.py` | Main CLI entry point |
| `check_volume.py` | Volume/pain analysis (also importable) |
| `sheets_client.py` | Google Sheets connection helper |
| `config.py` | Credentials path storage/loading |
| `.config.json` | Local config (gitignored) |
| `requirements.txt` | Python dependencies |
