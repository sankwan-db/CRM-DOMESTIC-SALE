# CRM Domestic Sale

Static single-page web app for GitHub Pages. Google Sheets is the database. No Apps Script, Firebase, Cloud Functions, or server-side secrets.

## Current build status

The current build provides Google OAuth and Sheets access, a dashboard, two-step team and Sale targets, Actual Sales import/export, master-data CRUD/import/export, and Sales Action table/Kanban/calendar views. Sales Action supports weekly Contact/Spot plans for existing customers (including copying the prior week's plan) and multi-row follow-up batches for existing customers or Prospects. Plan quantities convert through Item Master UOM factors; plan records retain Product Type/PART/SUB-PART and Actual Sales roll up from Item to category.

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
- The CRM DOMESTIC sheet already contained the required tabs and headers. To support the requested next-step due date, one header `Next_Action_Date` was added at the end of `T_SALES_ACTION` (column AI); existing rows and other sheet data were preserved.

## Sheet tabs expected

`M_CHANNEL`, `M_PRODUCT_GROUP`, `M_ITEM`, `M_ITEM_UOM`, `M_CUSTOMER`, `M_CUSTOMER_PRODUCT`, `M_PROSPECT`, `M_SALE`, `T_TEAM_TARGET`, `T_MONTHLY_TARGET`, `T_WEEKLY_CUSTOMER_PLAN`, `T_SALES_ACTION`, `T_SALES_ACTION_HISTORY`, `T_SALES_ACTUAL`, `T_IMPORT_LOG`.

The app expects headers consistent with the workbook snapshot `01-CRM-DOMESTIC.xlsx`.
