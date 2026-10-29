# Birla Diwali Prize Management — Royal Gold Edition

Separate project folder. Original project files are not modified.

## Features retained
- Existing prize sequence and selection/save/clear rules
- Employee Master, Coupon Holder Name, Employee Code, SAP Code, Employee Name, Department, Designation, Unit and Photo
- Prize display, result history, Excel import/export and department entry pages
- SQL Server connection to the configured existing database
- Royal Navy/Gold interface, winner reveal animation and local synthesized UI sounds

## Important configuration
This edition uses port **3028** to avoid colliding with the older app. It uses the same SQL Server/database settings as the source project. Confirm `.env` before running. Because both editions connect to the same database, saved changes/results are shared. Back up the database before production use. Keep `.env` private.

## Run on Windows
1. Install Node.js 22 LTS or newer (includes npm).
2. Extract this ZIP to `F:\Diwali\Birla-Diwali-Prize-Royal-Gold`.
3. Open PowerShell in that folder and run:
   ```powershell
   npm install
   npm start
   ```
4. Open `http://localhost:3028`. On other LAN PCs, open `http://SERVER-IP:3028` and allow inbound TCP 3028 in Windows Firewall. Ensure SQL Server connectivity/firewall allows the server PC to reach the configured SQL host on TCP 1433.

## Build Windows installer EXE
1. On the build PC, install Node.js 22 LTS and ensure `node -v` and `npm -v` work.
2. Double-click `BUILD-WINDOWS-EXE.bat`, or run in PowerShell:
   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\Build-New-EXE.ps1
   ```
3. The installer is created in `dist`. Test installation and SQL connectivity on the target PC.

## Validation status
The ZIP structure, required project files and JavaScript syntax were checked during packaging. A live SQL Server login, real prize draw, LAN firewall path and Windows EXE build cannot be verified in this environment; run the checks above on your Windows/SQL Server network before use.
