import gspread
from google.oauth2.service_account import Credentials

from config import (
    LOG_COLUMNS,
    LOG_SHEET_NAME,
    SPREADSHEET_NAME,
    get_credentials_path,
)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_client() -> gspread.Client:
    creds_path = get_credentials_path()
    creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    return gspread.authorize(creds)


def get_log_sheet() -> gspread.Worksheet:
    client = get_client()
    try:
        spreadsheet = client.open(SPREADSHEET_NAME)
    except gspread.exceptions.SpreadsheetNotFound:
        raise SystemExit(
            f'Spreadsheet "{SPREADSHEET_NAME}" not found.\n'
            "Make sure you:\n"
            "  1. Created a Google Sheet named exactly 'Workout Tracker'\n"
            "  2. Shared it with the service account email in your credentials JSON\n"
            "     (look for the 'client_email' field)\n"
            "  3. Gave the service account Editor access"
        )
    except gspread.exceptions.APIError as e:
        _handle_api_error(e)

    try:
        sheet = spreadsheet.worksheet(LOG_SHEET_NAME)
    except gspread.exceptions.WorksheetNotFound:
        sheet = spreadsheet.add_worksheet(title=LOG_SHEET_NAME, rows=1000, cols=len(LOG_COLUMNS))
        sheet.append_row(LOG_COLUMNS)

    # Ensure header row exists
    existing = sheet.row_values(1)
    if not existing:
        sheet.append_row(LOG_COLUMNS)

    return sheet


def append_rows(rows: list[list]) -> None:
    sheet = get_log_sheet()
    try:
        sheet.append_rows(rows, value_input_option="USER_ENTERED")
    except gspread.exceptions.APIError as e:
        _handle_api_error(e)


def get_all_records() -> list[dict]:
    sheet = get_log_sheet()
    try:
        return sheet.get_all_records()
    except gspread.exceptions.APIError as e:
        _handle_api_error(e)


def _handle_api_error(e: gspread.exceptions.APIError) -> None:
    status = getattr(e.response, "status_code", None)
    if status == 403:
        raise SystemExit(
            "Permission denied accessing the Google Sheet.\n"
            "Make sure you shared 'Workout Tracker' with the service account email\n"
            "found in the 'client_email' field of your credentials JSON, with Editor access."
        )
    elif status == 404:
        raise SystemExit(
            "Google Sheet not found. Check that the sheet name is exactly 'Workout Tracker'."
        )
    else:
        raise SystemExit(f"Google Sheets API error: {e}")
