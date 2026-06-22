# Sheet import data

CSV exports from Google Sheets, used by `npm run import:schedule` and **Admin → Tools → Import June schedule**.

| File | Source sheet |
|------|----------------|
| `june-schedule.csv` | June Actions Schedule |
| `action-types.csv` | Type Of Actions |
| `gangs.csv` | Gang List |

Refresh from the live sheet:

```bash
# From repo root (Actions Spreadsheet)
python export/export_sheets.py
cp "Sheets/main/Actions Spreadsheeet - June Actions Schedule.csv" web/import-data/june-schedule.csv
# … copy types + gangs similarly
```

Import into production (Railway Console):

```bash
npm run import:schedule -- import-data/june-schedule.csv --month June --set-active
```

Or use **Admin → Tools** on the live site (aux+).
