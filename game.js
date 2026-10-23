(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const ui = {
    coins: $("coins"), wave: $("wave"), healthText: $("healthText"),
    healthBar: $("healthBar"), kills: $("kills"), bestWave: $("bestWave"),
    startOverlay: $("startOverlay"), endOverlay: $("endOverlay"),
    endEyebrow: $("endEyebrow"), endTitle: $("endTitle"), endMessage: $("endMessage"),
    bossBanner: $("bossBanner"), damageFlash: $("damageFlash")
  };

  const WORLD = { w: 960, h: 600 };
  let width = WORLD.w, height = WORLD.h, lastTime = 0, running = false, paused = false;
  let rafId = 0, spawnTimer = 0, waveBreak = 0, bossShown = false;
  let wave = 1, coins = 0, kills = 0, bestWave = Number(localStorage.getItem("mrsBestWave") || 1);
  let player, enemies = [], bullets = [], particles = [], floatingTexts = [];
  let keys = Object.create(null), joystickInput = { x: 0, y: 0 };
  let lastShot = 0, gameTime = 0, waveKills = 0;
  const bossNames = { 5: "THE RIGHT ARM", 10: "MOUNTAIN OVERLORD" };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(canvas.width / WORLD.w, 0, 0, canvas.height / WORLD.h, 0, 0);
    width = WORLD.w; height = WORLD.h;
    if (player) {
      player.x = Math.max(24, Math.min(WORLD.w - 24, player.x));
      player.y = Math.max(24, Math.min(WORLD.h - 24, player.y));
    }
    draw();
  }

  function newPlayer() {
    return { x: WORLD.w / 2, y: WORLD.h / 2, r: 15, hp: 100, maxHp: 100, speed: 225, angle: 0, invuln: 0 };
  }

  function resetGame() {
    wave = 1; kills = 0; coins = 0; waveKills = 0; gameTime = 0; spawnTimer = 0.8; waveBreak = 0;
    bossShown = false; enemies = []; bullets = []; particles = []; floatingTexts = [];
    player = newPlayer(); running = true; paused = false;
    ui.startOverlay.classList.add("hidden"); ui.endOverlay.classList.add("hidden");
    ui.bossBanner.classList.add("hidden");
    $("pauseBtn").textContent = "Ⅱ";
    updateUI();
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function endGame(victory) {
    running = false; paused = false; cancelAnimationFrame(rafId);
    ui.endOverlay.classList.remove("hidden");
    ui.endEyebrow.textContent = victory ? "REGION CLEARED" : "MISSION REPORT";
    ui.endTitle.textContent = victory ? "Outpost secured!" : "Run ended";
    ui.endMessage.textContent = victory
      ? `Mountain Outpost cleared! You eliminated ${kills} monsters and collected ${coins} coins. Next region unlock system is ready for a future update.`
      : `You reached Wave ${wave} and eliminated ${kills} monsters. Keep moving and try another run!`;
    $("restartBtn").textContent = victory ? "PLAY AGAIN" : "TRY AGAIN";
    bestWave = Math.max(bestWave, wave);
    localStorage.setItem("mrsBestWave", String(bestWave));
    updateUI();
  }

  function updateUI() {
    ui.coins.textContent = coins;
    ui.wave.textContent = `${Math.min(wave, 10)} / 10`;
    ui.healthText.textContent = `${Math.max(0, Math.ceil(player?.hp ?? 100))} / 100`;
    ui.healthBar.style.width = `${Math.max(0, (player?.hp ?? 100))}%`;
    ui.kills.textContent = kills;
    ui.bestWave.textContent = bestWave;
  }

  function spawnEnemy(isBoss = false) {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * WORLD.w; y = -22; }
    else if (edge === 1) { x = WORLD.w + 22; y = Math.random() * WORLD.h; }
    else if (edge === 2) { x = Math.random() * WORLD.w; y = WORLD.h + 22; }
    else { x = -22; y = Math.random() * WORLD.h; }

    const boss = isBoss;
    const hp = boss ? (wave === 10 ? 360 : 210) : 22 + wave * 5;
    enemies.push({
      x, y, r: boss ? 29 : 12 + Math.random() * 3, hp, maxHp: hp,
      speed: boss ? 38 + wave * 1.2 : 42 + wave * 4 + Math.random() * 18,
      damage: boss ? 18 : 8 + Math.floor(wave / 3), boss,
      name: bossNames[wave] || "MOUNTAIN MUTANT",
      color: boss ? (wave === 10 ? "#bb493d" : "#8e5d7b") : ["#84a56c", "#a3b77b", "#718f65"][Math.floor(Math.random() * 3)],
      hitFlash: 0, attackTimer: 0
    });
    if (boss) {
      ui.bossBanner.textContent = `⚠ ${bossNames[wave]} • WAVE ${wave}`;
      ui.bossBanner.classList.remove("hidden");
      setTimeout(() => ui.bossBanner.classList.add("hidden"), 2800);
    }
  }

  function nearestEnemy() {
    let target = null, best = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  function shoot(target) {
    if (!target) return;
    const a = Math.atan2(target.y - player.y, target.x - player.x);
    player.angle = a;
    const speed = 570;
    bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4, life: 1.2, damage: 15 });
    for (let i = 0; i < 3; i++) particles.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * (40 + Math.random() * 70) + (Math.random() - .5) * 50, vy: Math.sin(a) * (40 + Math.random() * 70) + (Math.random() - .5) * 50, life: .12 + Math.random() * .12, max: .24, color: "#ffc16e", size: 2 + Math.random() * 2 });
  }

  function addText(x, y, text, color = "#ffe0a0") {
    floatingTexts.push({ x, y, text, color, life: .9 });
  }

  function hitPlayer(amount) {
    if (player.invuln > 0) return;
    player.hp -= amount; player.invuln = .55;
    ui.damageFlash.classList.remove("hit");
    void ui.damageFlash.offsetWidth;
    ui.damageFlash.classList.add("hit");
    addText(player.x, player.y - 22, `-${amount}`, "#ff7c73");
    if (player.hp <= 0) { player.hp = 0; updateUI(); endGame(false); }
  }

  function advanceWave() {
    if (wave >= 10) { endGame(true); return; }
    wave++;
    waveKills = 0; spawnTimer = 1.2; waveBreak = 1.3; bossShown = false;
    addText(WORLD.w / 2, 70, `WAVE ${wave}`, "#ffab57");
    updateUI();
  }

  function update(dt) {
    if (!running || paused) return;
    gameTime += dt;
    if (player.invuln > 0) player.invuln -= dt;

    let mx = joystickInput.x, my = joystickInput.y;
    if (keys.ArrowLeft || keys.a) mx -= 1;
    if (keys.ArrowRight || keys.d) mx += 1;
    if (keys.ArrowUp || keys.w) my -= 1;
    if (keys.ArrowDown || keys.s) my += 1;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    player.x = Math.max(22, Math.min(WORLD.w - 22, player.x + mx * player.speed * dt));
    player.y = Math.max(22, Math.min(WORLD.h - 22, player.y + my * player.speed * dt));

    if (waveBreak > 0) waveBreak -= dt;
    const bossWave = wave === 5 || wave === 10;
    const regularAlive = enemies.some(e => !e.boss);
    if (bossWave && !bossShown && waveBreak <= 0) {
      if (!enemies.some(e => e.boss)) { spawnEnemy(true); bossShown = true; }
    } else if (!bossWave && waveBreak <= 0 && enemies.length < Math.min(5 + wave * 2, 20)) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnEnemy(false); spawnTimer = Math.max(.32, 1.05 - wave * .055); }
    } else if (bossWave && bossShown && !enemies.some(e => e.boss) && enemies.length === 0) {
      // Boss waves clear only after the boss is defeated.
    }

    const target = nearestEnemy();
    lastShot -= dt;
    if (target && lastShot <= 0) { shoot(target); lastShot = .25; }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.max(1, Math.hypot(dx, dy));
      if (d > player.r + e.r + 2) { e.x += dx / d * e.speed * dt; e.y += dy / d * e.speed * dt; }
      else { e.attackTimer -= dt; if (e.attackTimer <= 0) { hitPlayer(e.damage); e.attackTimer = e.boss ? .8 : 1; } }
      if (e.hitFlash > 0) e.hitFlash -= dt;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let remove = b.life <= 0 || b.x < -20 || b.x > WORLD.w + 20 || b.y < -20 || b.y > WORLD.h + 20;
      if (!remove) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            e.hp -= b.damage; e.hitFlash = .08; remove = true;
            particles.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, life: .25, max: .25, color: "#ffbc72", size: 3 });
            if (e.hp <= 0) {
              enemies.splice(j, 1); kills++; waveKills++;
              const reward = e.boss ? 100 : 5 + Math.floor(Math.random() * 6);
              coins += reward; addText(e.x, e.y - 12, `+${reward} COINS`, "#ffce70");
              if (e.boss) {
                addText(e.x, e.y - 40, "BOSS DEFEATED!", "#9cf0b7");
                if (wave === 10) { updateUI(); endGame(true); return; }
              }
              if (!enemies.length && (wave === 5 || wave === 10)) {
                // Continue logic below when all enemies are gone.
              }
            }
            break;
          }
        }
      }
      if (remove) bullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i]; t.y -= 28 * dt; t.life -= dt;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }

    if (enemies.length === 0 && waveBreak <= 0) {
      if (wave === 5 || wave === 10) {
        if (bossShown) { advanceWave(); }
      } else {
        // Brief pause after each cleared wave; wave pacing is based on eliminations.
        if (waveKills >= 4 + wave) advanceWave();
      }
    }
    updateUI();
  }

  function drawBackground() {
    ctx.fillStyle = "#1c3431"; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // Mountain silhouettes
    ctx.fillStyle = "#263f3b";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(110, 70); ctx.lineTo(230, 15); ctx.lineTo(370, 92); ctx.lineTo(500, 28); ctx.lineTo(650, 95); ctx.lineTo(795, 18); ctx.lineTo(960, 85); ctx.lineTo(960, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#304b40";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70, 105); ctx.lineTo(200, 55); ctx.lineTo(335, 125); ctx.lineTo(485, 48); ctx.lineTo(615, 130); ctx.lineTo(780, 45); ctx.lineTo(960, 120); ctx.lineTo(960, 0); ctx.closePath(); ctx.fill();
    // Pixel-ish ground texture
    for (let y = 0; y < WORLD.h; y += 36) {
      for (let x = (y % 72 === 0 ? 0 : 18); x < WORLD.w; x += 36) {
        const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        ctx.fillStyle = n > .3 ? "#45634a22" : "#101f2420";
        ctx.fillRect(x, y, 13, 8);
      }
    }
    // paths
    ctx.strokeStyle = "#9a987244"; ctx.lineWidth = 70; ctx.beginPath(); ctx.moveTo(-30, 490); ctx.bezierCurveTo(210, 410, 220, 230, 470, 280); ctx.bezierCurveTo(700, 335, 770, 150, 1000, 210); ctx.stroke();
    ctx.strokeStyle = "#b7b38a2b"; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.moveTo(-30, 490); ctx.bezierCurveTo(210, 410, 220, 230, 470, 280); ctx.bezierCurveTo(700, 335, 770, 150, 1000, 210); ctx.stroke(); ctx.setLineDash([]);
    // rocks and scrub
    for (let i = 0; i < 32; i++) {
      const x = (i * 173 + 61) % WORLD.w, y = (i * 97 + 53) % WORLD.h;
      ctx.fillStyle = i % 2 ? "#172b2b" : "#3c5545";
      ctx.beginPath(); ctx.ellipse(x, y, 7 + (i % 4) * 2, 4 + (i % 3), -.3, 0, Math.PI * 2); ctx.fill();
      if (i % 3 === 0) { ctx.fillStyle = "#64714a"; ctx.fillRect(x + 5, y - 8, 3, 9); ctx.fillRect(x + 1, y - 5, 8, 3); }
    }
    // subtle grid
    ctx.strokeStyle = "#d9f1d508"; ctx.lineWidth = 1;
    for (let x = 0; x < WORLD.w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
    for (let y = 0; y < WORLD.h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }
  }

  function drawPlayer() {
    ctx.save(); ctx.translate(player.x, player.y);
    if (player.invuln > 0 && Math.floor(gameTime * 18) % 2 === 0) ctx.globalAlpha = .45;
    // shadow
    ctx.fillStyle = "#07101699"; ctx.beginPath(); ctx.ellipse(0, 7, 17, 10, 0, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = "#d5d8c8"; ctx.fillRect(-9, -11, 18, 23);
    ctx.fillStyle = "#556b61"; ctx.fillRect(-7, -7, 14, 15);
    // backpack
    ctx.fillStyle = "#354840"; ctx.fillRect(-13, -6, 5, 12);
    // head/helmet
    ctx.fillStyle = "#e0b38a"; ctx.fillRect(-7, -17, 14, 10);
    ctx.fillStyle = "#405d4f"; ctx.fillRect(-9, -19, 18, 5);
    ctx.fillStyle = "#ff8b36"; ctx.fillRect(-3, -16, 6, 2);
    // weapon pointing to target
    ctx.rotate(player.angle); ctx.fillStyle = "#1a2026"; ctx.fillRect(2, -4, 23, 8); ctx.fillStyle = "#ffb45d"; ctx.fillRect(18, -2, 7, 4);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = "#06100d88"; ctx.beginPath(); ctx.ellipse(0, e.r * .45, e.r * 1.2, e.r * .65, 0, 0, Math.PI * 2); ctx.fill();
    if (e.boss) {
      ctx.fillStyle = e.hitFlash > 0 ? "#fff" : e.color;
      ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
      ctx.fillStyle = "#572e31"; ctx.fillRect(-e.r - 6, -e.r + 6, 8, e.r * 1.2); ctx.fillRect(e.r - 2, -e.r + 6, 8, e.r * 1.2);
      ctx.fillStyle = "#f9d27b"; ctx.fillRect(-13, -10, 7, 5); ctx.fillRect(6, -10, 7, 5);
      ctx.fillStyle = "#341f25"; ctx.fillRect(-8, 5, 16, 5);
      ctx.fillStyle = "#d9d9c4"; ctx.fillRect(-e.r - 2, -e.r - 12, e.r * 2 + 4, 5);
      ctx.fillStyle = "#f45151"; ctx.fillRect(-e.r - 2, -e.r - 12, (e.r * 2 + 4) * Math.max(0, e.hp / e.maxHp), 5);
    } else {
      ctx.fillStyle = e.hitFlash > 0 ? "#fff" : e.color;
      ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
      ctx.fillStyle = "#4c5b3b"; ctx.fillRect(-e.r - 3, -e.r + 2, 5, e.r * 1.4);
      ctx.fillStyle = "#f0e6b5"; ctx.fillRect(-e.r + 3, -3, 4, 4); ctx.fillRect(3, -3, 4, 4);
      ctx.fillStyle = "#252e27"; ctx.fillRect(-4, 5, 9, 3);
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "#16231d"; ctx.fillRect(-e.r, -e.r - 7, e.r * 2, 3);
        ctx.fillStyle = "#e55e55"; ctx.fillRect(-e.r, -e.r - 7, e.r * 2 * Math.max(0, e.hp / e.maxHp), 3);
      }
    }
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.save(); ctx.setTransform(canvas.width / WORLD.w, 0, 0, canvas.height / WORLD.h, 0, 0);
    drawBackground();
    for (const b of bullets) {
      ctx.fillStyle = "#ffd38b"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff9b3c44"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of enemies) drawEnemy(e);
    if (player) drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1;
    }
    for (const t of floatingTexts) {
      ctx.globalAlpha = Math.min(1, t.life * 1.6); ctx.fillStyle = t.color; ctx.font = "bold 15px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); ctx.globalAlpha = 1;
    }
    if (paused && running) {
      ctx.fillStyle = "#071019aa"; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      ctx.fillStyle = "#fff"; ctx.font = "900 40px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText("PAUSED", WORLD.w / 2, WORLD.h / 2);
    }
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, .04);
    lastTime = now;
    update(dt); draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  // Keyboard controls for laptop
  window.addEventListener("keydown", e => {
    keys[e.key] = true; keys[e.key.toLowerCase()] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.key === "Escape" || e.key.toLowerCase() === "p") togglePause();
  });
  window.addEventListener("keyup", e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });

  // Touch/mouse joystick
  const joystick = $("joystick"), knob = $("joystickKnob");
  let joystickActive = false, joyPointer = null;
  function updateJoystick(e) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width * .31, d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joystickInput = { x: dx / max, y: dy / max };
    knob.style.left = `calc(50% + ${dx}px)`; knob.style.top = `calc(50% + ${dy}px)`;
  }
  function resetJoystick() {
    joystickActive = false; joyPointer = null; joystickInput = { x: 0, y: 0 };
    knob.style.left = "50%"; knob.style.top = "50%";
  }
  joystick.addEventListener("pointerdown", e => {
    e.preventDefault(); joystickActive = true; joyPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); updateJoystick(e);
  });
  joystick.addEventListener("pointermove", e => { if (joystickActive && e.pointerId === joyPointer) updateJoystick(e); });
  joystick.addEventListener("pointerup", e => { if (e.pointerId === joyPointer) resetJoystick(); });
  joystick.addEventListener("pointercancel", resetJoystick);
  $("startBtn").addEventListener("click", resetGame);
  $("restartBtn").addEventListener("click", resetGame);
  $("pauseBtn").addEventListener("click", togglePause);

  function togglePause() {
    if (!running) return;
    paused = !paused;
    $("pauseBtn").textContent = paused ? "▶" : "Ⅱ";
    if (paused) {
      draw();
    } else {
      lastTime = performance.now();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }
  }

  // Initial attract screen background
  player = newPlayer();
  resizeCanvas();
  updateUI();
  window.addEventListener("resize", resizeCanvas);
})();
