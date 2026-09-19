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

## ⚙️ Data Source & Moneta Cloud

Moneta Wealth is **local-first**: your ledger lives in an embedded SQLite database on this machine, and the app is fully functional with no network connection. Click the **Connection Status** badge in the bottom-left of the sidebar to configure it.

```
+-------------------------------------------------------------------------+
|                  DATA SOURCE SELECTOR                                   |
|                                                                         |
|  [●] My Ledger  —  Local SQLite (the default)                           |
|      - Embedded sql.js WebAssembly engine                               |
|      - Automatically saved to IndexedDB                                 |
|      - Zero network activity, microsecond query performance             |
|                                                                         |
|  [○] Demo Sandbox                                                       |
|      - Pre-seeded with Singapore financial assets                       |
|      - DBS Checking, OCBC Savings, IBKR Brokerage, CPF OA/SA/MA         |
|      - Explores the app without touching real data; never syncs         |
+-------------------------------------------------------------------------+

  Moneta Cloud (optional)  —  a sync target, not a data source
      - REST / JSON-RPC (/api/v1/mobile/*) via Bearer PAT
      - Populates a new local database, and syncs across devices
```

**Moneta Cloud is not a data source.** The app always reads and writes the local database; the cloud is an optional *replication target*. That distinction is what makes it work fully offline — an unreachable server degrades sync, never the app. If you launch with Moneta Cloud configured but unreachable, you get your local ledger and a connection warning, not an empty screen.

---

## 🔄 1-Click Migration (Moneta Cloud $\rightarrow$ Local)

If you already use the **Odoo 18 `moneta_wealth`** module, Moneta Wealth includes an automated migration that copies your records into the local database:

1. Click the **Connection Status** badge in the bottom-left sidebar.
2. Ensure the data source is **My Ledger**.
3. Enter your server URL:
   ```
   https://weeseng.dev8.ansis.com.sg
   ```
4. Enter your Odoo **Personal Access Token (PAT)**:
   - In Odoo, navigate to **User Profile $\rightarrow$ Account Security $\rightarrow$ Developer API Keys**.
   - Generate a new key and copy the token string.
5. Click **Test Connection** to verify authorization.
6. Under the migration banner, click **Migrate Moneta Cloud Data to Local**.
7. Moneta Wealth will:
   - Query all accounts from Moneta Cloud.
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
