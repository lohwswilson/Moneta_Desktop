# Getting Started with Moneta Wealth

This guide covers installing, launching, and configuring **Moneta Wealth** on macOS, Windows, and Linux.

---

## ⚡ Prerequisites

- **Node.js**: `v20+` or `v26+`
- **npm**: `v10+`
- **Rust Toolchain (Optional - only required for native Tauri compilation)**:
  - macOS: `brew install rust` or `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  - Linux: `sudo apt install build-essential libwebkit2gtk-4.1-dev curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - Windows: Visual Studio C++ Build Tools + Rustup

---

## 🚀 Running the Application

### Option A: Standard Fast Development Mode (Browser / Windowed)

To run the application immediately with instant Vite Hot Module Reloading (HMR):

```bash
# 1. Clone the repository
git clone https://github.com/lohwswilson/Moneta_Wealth.git
cd Moneta_Wealth

# 2. Install dependencies
npm install

# 3. Launch the desktop app
npm start
```

This runs Vite on `http://127.0.0.1:5173/` and opens a lightweight standalone browser window.

---

### Option B: Native Tauri v2 Desktop Build

To compile and run Moneta Wealth as a native binary (macOS `.app` / `.dmg`, Windows `.exe` / `.msi`, Linux `.AppImage`):

```bash
# Run in native Tauri developer mode (launches native OS window)
npm run desktop:dev

# Build production binaries
npm run desktop:build
```

The compiled native executable will be located in `src-tauri/target/release/bundle/`.

---

## ⚙️ Connection Modes

Moneta Wealth features a pluggable data architecture supporting three distinct operational modes, accessible by clicking the **Connection Status** badge in the bottom-left of the sidebar:

```
+-------------------------------------------------------------------------+
|                  CONNECTION MODE SELECTOR                               |
|                                                                         |
|  [●] Local SQLite Database (100% Offline)                               |
|      - Embedded sql.js WebAssembly engine                               |
|      - Automatically saved to IndexedDB                                 |
|      - Zero network activity, microsecond query performance             |
|                                                                         |
|  [○] Live Odoo 18 Server (moneta_finance)                               |
|      - REST / JSON-RPC API connection (/api/v1/mobile/*)                |
|      - Authenticated via Odoo Personal Access Token (Bearer PAT)        |
|      - Multi-device central database synchronization                    |
|                                                                         |
|  [○] Demo Sandbox Mode                                                  |
|      - Pre-seeded with Singapore financial assets                       |
|      - DBS Checking, OCBC Savings, IBKR Brokerage, CPF OA/SA/MA         |
|      - Safe sandbox to explore without touching real data               |
+-------------------------------------------------------------------------+
```

---

## 🔄 1-Click Odoo Migration (Odoo $\rightarrow$ SQLite)

If you currently use the **Odoo 18 `moneta_finance`** module, Moneta Wealth includes an automated migration tool to transition your financial records into standalone local SQLite:

1. Click the **Connection Status** badge in the bottom-left sidebar.
2. Select **Live Odoo 18 Server**.
3. Enter your server URL:
   ```
   https://weeseng.dev8.ansis.com.sg
   ```
4. Enter your Odoo **Personal Access Token (PAT)**:
   - In Odoo, navigate to **User Profile $\rightarrow$ Account Security $\rightarrow$ Developer API Keys**.
   - Generate a new key and copy the token string.
5. Click **Test Connection** to verify authorization.
6. Under the migration banner, click **Migrate Odoo Data to SQLite**.
7. Moneta Wealth will:
   - Query all accounts from Odoo.
   - Fetch historical transaction registers.
   - Insert all records into local SQLite tables with running balances.
   - Switch your active mode to **Local SQLite**.
   - Persist everything to your machine's IndexedDB.

---

## 💾 Exporting & Backing Up Your Database

To create an offline binary backup of your financial data:

1. Click the **Connection Status** badge in the sidebar.
2. Scroll to the **Local SQLite Database** card.
3. Click **Download .sqlite Backup**.
4. Moneta Wealth will export a binary file named:
   ```
   moneta-backup-YYYY-MM-DD.sqlite
   ```
5. This file is standard SQLite 3 and can be opened in DB Browser for SQLite, DBeaver, or command-line `sqlite3`.
