MONSTER RUSH: SURVIVAL — PROTOTYPE 0.1

FILES
- index.html: page structure
- style.css: game layout and responsive mobile styling
- game.js: movement, auto-fire, enemies, waves, bosses, coins, and local best-wave save

HOW TO TEST LOCALLY
1. Extract the ZIP.
2. Open the folder in VS Code.
3. If using XAMPP, copy the folder to C:\xampp\htdocs\monster-rush-survival
4. Start Apache in XAMPP.
5. Visit http://localhost/monster-rush-survival/

CONTROLS
- Laptop: WASD or arrow keys to move; P or Esc to pause.
- Phone: drag the on-screen joystick to move.
- Shooting is automatic toward the nearest enemy.

GITHUB PAGES
Upload index.html, style.css, and game.js to the root of a public repository.
Go to Settings > Pages > Deploy from a branch > main > /(root) > Save.
Wait for deployment, then open the URL GitHub Pages displays.

NOTE
This is an early playable prototype. It uses browser localStorage only for the best-wave display. It does not yet have PHP/MySQL accounts, energy, ads, weapon purchases, or persistent server-side coins. Those should be added in a later backend phase.
