# CRM Domestic Sale

Static single-page web app for GitHub Pages. Google Sheets is the database. No Apps Script, Firebase, Cloud Functions, or server-side secrets.

## Current build status

The current build provides Google OAuth and Sheets access, a dashboard, two-step team and Sale targets, Actual Sales import/export, master-data CRUD/import/export, and Sales Action table/Kanban/calendar views. Sales Action supports weekly Contact/Spot plans for existing customers, Excel import/export for weekly plans, a paginated vertical daily view, a product summary comparing Contact/Spot Plan, production forecast and Actual in MT, and a separate Contact Order entry flow with editable receipt dates and multiple extra receipt events. The system creates `T_CONTACT_ORDER` automatically for Contact receipt records. It also supports automatic Sale defaults from Customer Master with per-week overrides, copying the prior week's plans, and multi-row follow-up batches for existing customers or Prospects. Plan quantities convert through Item Master UOM factors; plan records retain Product Type/PART/SUB-PART and Actual Sales roll up from Item to category.

The repository includes `tests/smoke-test.js` for the two planning flows, category matching, UOM conversions, target allocation matching, and item-to-category reporting. These are source-level tests; verify Google OAuth, Sheet permissions, and live imports with a non-production copy of the workbook before rollout. Direct browser-to-Sheets access has no server-side role enforcement.

## Setup

1. Enable Google Sheets API in a Google Cloud project.
2. Create an OAuth 2.0 Client ID (Web application); add your GitHub Pages origin to Authorized JavaScript origins.
3. Put the OAuth Client ID in `CONFIG.oauthClientId` in `index.html`. This is a public client identifier, not a secret. Never place a client secret or service-account key in this repository.
4. Share the CRM DOMESTIC spreadsheet with each user's Google account as Editor.
5. Enable GitHub Pages from repository Settings → Pages → Deploy from branch → `main` / `/ (root)`.
6. Visit the Pages URL, connect with Google, and test on a copy of the spreadsheet first.

## Security and data notes

- This repository is public; source code and all commit history are publicly visible. Do not commit customer data, OAuth client secrets, access tokens, or private keys.
- Sheet data remains private only when Google Drive sharing is restricted. Each user authorizes Google Sheets API directly and must have edit permission on the workbook.
- Direct browser-to-Sheets access has no server-side role enforcement. UI-level manager fields are not an authorization boundary. For production permissions/audit-grade security, a trusted backend is required.
- The CRM DOMESTIC sheet contains the planning and sales tabs. The app creates the Contact Order ledger tab `T_CONTACT_ORDER` automatically on first connection if it does not exist. Existing rows and other sheet data are preserved.

## Sheet tabs expected

`M_CHANNEL`, `M_PRODUCT_GROUP`, `M_ITEM`, `M_ITEM_UOM`, `M_CUSTOMER`, `M_CUSTOMER_PRODUCT`, `M_PROSPECT`, `M_SALE`, `T_TEAM_TARGET`, `T_MONTHLY_TARGET`, `T_WEEKLY_CUSTOMER_PLAN`, `T_CONTACT_ORDER` (auto-created by the app), `T_SALES_ACTION`, `T_SALES_ACTION_HISTORY`, `T_SALES_ACTUAL`, `T_IMPORT_LOG`.

The app expects headers consistent with the workbook snapshot `01-CRM-DOMESTIC.xlsx`.
