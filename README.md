<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6a53ed27-9306-4b47-b52a-34c5dad38f73

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `3000,24678 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 4 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinuel`

2. Install packages inside this inner folder
(Wait for each command to finish before running the next one.)
Powershell
    npm install --legacy-peer-deps
Powershell
    npm install @supabase/supabase-js ws --legacy-peer-deps
Powershell
    npm install @rolldown/binding-win32-x64-msvc --no-save --legacy-peer-deps

3. Run the app:
   `npm run dev`

4. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
