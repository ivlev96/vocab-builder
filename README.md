# Vocab Builder

A premium English vocabulary learning application connected to a SQLite database.

## Prerequisites
- **Node.js**: You must have Node.js installed to run this application. Download from [nodejs.org](https://nodejs.org/).

## Setup & Run

### 1. Backend (Server)
Open a terminal in the root folder (`C:\source\vocab-builder`):

```powershell
# Install dependencies
npm install

# Start the server (runs on port 3000)
npm start
```

### 2. Frontend (UI)
Open a **new** terminal window in the `frontend` folder (`C:\source\vocab-builder\frontend`):

```powershell
# Install dependencies
npm install

# Start the development server
npm run dev
```

### 3. Usage
- Open your browser at the Local URL shown in the frontend terminal (usually `http://localhost:5173`).
- **Register** a new account.
- **Login**.
- **Upload** the provided `sample_unit.csv` file using the Dashboard.
- Click **Start Session** to begin learning.

## Mobile Access
To access from a phone on the same WiFi:
1. Ensure your PC firewall allows Node.js connections.
2. Find your PC's local IP (e.g., `192.168.1.5`).
3. Open `http://192.168.1.5:5173` on your phone browser.

## Troubleshooting

### PowerShell: "Script execution disabled" / "PSSecurityException"
If you see an error saying `npm.ps1` cannot be loaded:
1.  **Option A (Recommended)**: Allow local scripts by running this command in PowerShell:
    ```powershell
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    ```
2.  **Option B**: Run the commands in **Command Prompt (cmd.exe)** instead of PowerShell.
