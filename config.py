import json
import os

CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".config.json")

DEFAULT_CREDENTIALS_PATH = (
    r"C:\Users\smr\OneDrive\ClaudeWork\smr-workout-tracker"
    r"\smr-workout-tracker-94b18eb7547e.json"
)

SPREADSHEET_NAME = "Workout Tracker"
LOG_SHEET_NAME = "Log"

LOG_COLUMNS = [
    "Date",
    "Day Type",
    "Exercise",
    "Weight (lbs)",
    "Sets",
    "Reps",
    "Elbow Pain (0-10)",
    "Notes",
]

DAY_TYPES = [
    "Lower/Push",
    "Pull",
    "Full Body/Golf",
    "Cardio - Intervals",
    "Cardio - Zone 2",
]


def load_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {"credentials_path": DEFAULT_CREDENTIALS_PATH}


def save_config(config: dict) -> None:
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_credentials_path() -> str:
    config = load_config()
    path = config.get("credentials_path", DEFAULT_CREDENTIALS_PATH)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Credentials file not found at: {path}\n"
            "Update the path in .config.json or place the file at the expected location."
        )
    return path


def set_credentials_path(path: str) -> None:
    config = load_config()
    config["credentials_path"] = path
    save_config(config)
    print(f"Credentials path updated to: {path}")
