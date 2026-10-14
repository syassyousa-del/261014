# Famicom Wars Clone

This project can run as a local Electron desktop app without using `server.js`.

## Run locally as an app

1. Open a terminal in the project folder.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the app:
   ```powershell
   npm start
   ```

You can also launch directly on Windows using:
```powershell
start_electron.bat
```

## Package as a Windows EXE

Run:
```powershell
npm run pack
```

This creates a packaged app under `dist/FamicomWarsClone-win32-x64`.

## Notes

- The app runs from local files in Electron, so you do not need `server.js`.
- Save and resume will work using local save files and JSON downloads.
- If you want native desktop save support, further Electron IPC integration can be added.
