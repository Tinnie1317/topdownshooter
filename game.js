// game.js - Top-Down Retro Shooter
// Author: Generated starter — extend as needed

(function(){
  /*** CONFIG ***/
  const BASE_W = 320, BASE_H = 240; // game logical resolution (pixel-art)
  const SCALE = 2;                   // displayed upscale (canvas CSS handles pixelation)
  const MAX_BULLETS = 6;
  const PLAYER_SPEED = 1.8;
  const BULLET_SPEED = 4.5;
  const ENEMY_SPEED = 0.8;
  const TILE = 16;

  /*** UTIL ***/
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rectIntersect(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function dist(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  /*** CANVAS SETUP ***/
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  // scale up to fit CSS size while keeping pixelated look (CSS already sets display size)
  // We'll render at BASE_W x BASE_H
  canvas.width = BASE_W;
  canvas.height = BASE_H;
  ctx.imageSmoothingEnabled = false;

  // init input
  input.init(canvas);

  /*** GAME STATE ***/
  const state = {
    levelIndex: 0,
    levels: [],
    player: null,
    bullets: [],
    enemies: [],
    pickups: [],
    walls: [],
    keysCollected: 0,
    paused: false,
    gameOver: false
  };

  /*** LEVELS: grid-based layout arrays (0 = empty, 1 = wall, 2 = door locked, 3 = key) 
       You can edit or add more levels here. Each tile is TILE pixels (16).
       Levels are small for demo; expand to larger arrays for big maps.
  ***/
  state.levels.push({
    name: "Infiltration: Sector A",
    width: 20, height: 15,
    grid: [
      // 20 cells per row, 15 rows
      // We'll create a simple base layout by rows (0..19)
      // top border
      ...Array(20).fill(1),
      // middle rows with walls and corridors (repeat 13 rows)
      ...Array(13).fill(0).flatMap((_,r)=> {
        // r from 0..12 -> produce 20 cells
        const row = new Array(20).fill(0);
        row[0]=1; row[19]=1; // side walls
        if (r===3 || r===7 || r===10){
          for(let c=2;c<18;c++) row[c]=1; // horizontal wall
          row[9]=0; // gap
        }
        return row;
      }),
      // bottom border
      ...Array(20).fill(1)
    ],
    playerStart: {x: 2*TILE+2, y: 2*TILE+2},
    enemiesDef: [
      {x: 11*TILE, y: 2*TILE, patrol: [{x:11*TILE,y:2*TILE},{x:16*TILE,y:2*TILE}]},
      {x: 16*TILE, y: 9*TILE, patrol: [{x:16*TILE,y:9*TILE},{x:6*TILE,y:9*TILE}]}
    ],
    pickupsDef: [
      {type:'key', x: 17*TILE, y: 12*TILE}
    ],
    doorsDef: [
      {x: 18*TILE, y: 6*TILE, locked:true}
    ]
  });

  // Add a second level that's larger / different layout
  state.levels.push({
    name: "Extraction: Sublevel B",
    width: 24, height: 18,
    grid: (function(){
      const w=24,h=18; const arr=[];
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          if (y===0 || y===h-1 || x===0 || x===w-1) arr.push(1);
          else arr.push(0);
        }
      }
      // add some obstacles
      for(let x=3;x<21;x++){ arr[5*24 + x]=1; arr[11*24 + x]=1; }
      arr[5*24 + 10]=0; arr[11*24 + 14]=0; // gaps
      return arr;
    })(),
    playerStart: {x: 2*TILE+2, y: 2*TILE+2},
    enemiesDef: [{x: 10*TILE, y: 6*TILE, patrol:[{x:10*TILE,y:6*TILE},{x:14*TILE,y:6*TILE}]},{x:18*TILE,y:12*TILE,patrol:[{x:18*TILE,y:12*TILE},{x:6*TILE,y:12*TILE}]}],
    pickupsDef: [{type:'key', x: 20*TILE, y: 3*TILE},{type:'health', x:12*TILE,y:2*TILE}],
    doorsDef: [{x: 22*TILE, y: 9*TILE, locked:true}]
  });

  /*** INITIALIZATION ***/
  function initLevel(index){
    state.bullets = [];
    state.enemies = [];
    state.pickups = [];
    state.walls = [];
    state.keysCollected = 0;
    state.paused = false;
    state.gameOver = false;

    const lvl = state.levels[index];
    state.levelIndex = index;

    // create walls from grid
    for(let y=0;y<lvl.height;y++){
      for(let x=0;x<lvl.width;x++){
        const v = lvl.grid[y*lvl.width + x];
        if (v === 1){
          state.walls.push({x: x*TILE, y: y*TILE, w: TILE, h: TILE});
        }
      }
    }

    // doors
    (lvl.doorsDef || []).forEach(d => {
      state.walls.push({x:d.x,y:d.y,w:TILE,h:TILE, isDoor:true, locked: !!d.locked});
    });

    // pickups
    (lvl.pickupsDef || []).forEach(p => {
      const obj = {type:p.type, x:p.x, y:p.y, w:12, h:12, taken:false};
      state.pickups.push(obj);
    });

    // enemies
    (lvl.enemiesDef || []).forEach(e => {
      state.enemies.push({
        x:e.x, y:e.y, w:14, h:14, patrol:e.patrol || [], pIndex:0, speed: ENEMY_SPEED, alerted:false, lastSeen:-Infinity
      });
    });

    // player
    state.player = {
      x: lvl.playerStart.x, y: lvl.playerStart.y, w:14, h:14,
      speed: PLAYER_SPEED, health: 3, facing:0
    };

    updateHUD();
  }

  /*** RAYCAST for LOS */
  function canSee(enemy, target, maxDist=120){
    const ex = enemy.x + enemy.w/2, ey = enemy.y + enemy.h/2;
    const tx = target.x + target.w/2, ty = target.y + target.h/2;
    const dx = tx - ex, dy = ty - ey;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > maxDist) return false;
    const steps = Math.ceil(d / 4);
    for(let i=1;i<=steps;i++){
      const sx = ex + dx*(i/steps);
      const sy = ey + dy*(i/steps);
      // check collision with walls
      for(const w of state.walls){
        if (sx > w.x && sx < w.x + w.w && sy > w.y && sy < w.y + w.h) return false;
      }
    }
    return true;
  }

  /*** GAME LOOP ***/
  let lastTime = 0;
  function loop(ts){
    if (!lastTime) lastTime = ts;
    const dt = Math.min(40, ts - lastTime) / 16.666; // scaled delta for consistent speed
    lastTime = ts;
    if (!state.paused && !state.gameOver){
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  /*** UPDATE ***/
  function update(dt){
    const i = input.getInputState();

    // Player movement
    let mvx = 0, mvy = 0;
    if (i.left) mvx = -1;
    if (i.right) mvx = +1;
    if (i.up) mvy = -1;
    if (i.down) mvy = +1;
    // normalize
    if (mvx !== 0 && mvy !== 0){ mvx *= Math.SQRT1_2; mvy *= Math.SQRT1_2; }
    state.player.x += mvx * state.player.speed * dt * 60/30;
    state.player.y += mvy * state.player.speed * dt * 60/30;
    if (mvx || mvy) state.player.facing = Math.atan2(mvy, mvx);

    // clamp to map bounds
    const lvl = state.levels[state.levelIndex];
    state.player.x = clamp(state.player.x, TILE, lvl.width*TILE - TILE*2);
    state.player.y = clamp(state.player.y, TILE, lvl.height*TILE - TILE*2);

    // collisions with walls (simple push-back)
    for(const w of state.walls){
      if (rectIntersect(state.player, w)){
        // push player out by minimal overlap
        const overlapX = (state.player.x + state.player.w/2) - (w.x + w.w/2);
        const overlapY = (state.player.y + state.player.h/2) - (w.y + w.h/2);
        const absX = Math.abs(overlapX), absY = Math.abs(overlapY);
        const halfW = (state.player.w + w.w) / 2;
        const halfH = (state.player.h + w.h) / 2;
        if (absX < halfW && absY < halfH){
          if (absX > absY){
            state.player.x += overlapX > 0 ? (halfW - absX) : -(halfW - absX);
          } else {
            state.player.y += overlapY > 0 ? (halfH - absY) : -(halfH - absY);
          }
        }
      }
    }

    // Shooting: basic rate limit
    if (!state._shootCooldown) state._shootCooldown = 0;
    state._shootCooldown = Math.max(0, state._shootCooldown - dt);
    if (i.shoot && state._shootCooldown === 0 && state.bullets.length < MAX_BULLETS){
      shootBullet();
      state._shootCooldown = 8/60; // small cooldown
    }

    // update bullets
    for(let b = state.bullets.length -1; b >= 0; b--){
      const bullet = state.bullets[b];
      bullet.x += bullet.vx * BULLET_SPEED * dt * 60/30;
      bullet.y += bullet.vy * BULLET_SPEED * dt * 60/30;

      // remove if out of bounds or hit wall
      if (bullet.x < 0 || bullet.x > lvl.width*TILE || bullet.y < 0 || bullet.y > lvl.height*TILE){
        state.bullets.splice(b,1);
        continue;
      }
      // collision with walls
      let hitWall = false;
      for(const w of state.walls){
        if (rectIntersect(bullet, w)){
          hitWall = true;
          break;
        }
      }
      if (hitWall){ state.bullets.splice(b,1); continue; }

      // collision with enemies
      for(let e = state.enemies.length-1; e>=0; e--){
        if (rectIntersect(bullet, state.enemies[e])){
          // kill enemy
          state.enemies.splice(e,1);
          state.bullets.splice(b,1);
          break;
        }
      }
    }

    // pickups
    for(const p of state.pickups){
      if (!p.taken && rectIntersect(state.player, p)){
        p.taken = true;
        if (p.type === 'key') state.keysCollected++;
        if (p.type === 'health') state.player.health = Math.min(5, state.player.health + 1);
        updateHUD();
      }
    }

    // door unlock (player collides with door and has key)
    for(const w of state.walls){
      if (w.isDoor && w.locked && rectIntersect(state.player, w) && state.keysCollected > 0){
        w.locked = false; state.keysCollected--; updateHUD();
      }
    }

    // enemy AI: patrol and LOS
    for(const e of state.enemies){
      // patrol movement
      if (e.patrol && e.patrol.length){
        const target = e.patrol[e.pIndex];
        const dx = target.x - e.x, dy = target.y - e.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 2) e.pIndex = (e.pIndex + 1) % e.patrol.length;
        else {
          e.x += (dx / d) * e.speed * dt * 60/30;
          e.y += (dy / d) * e.speed * dt * 60/30;
        }
      }

      // LOS check
      const sees = canSee(e, state.player, 120);
      if (sees){
        // chase
        const dx = (state.player.x - e.x), dy = (state.player.y - e.y);
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        e.x += (dx / d) * e.speed * dt * 90/30;
        e.y += (dy / d) * e.speed * dt * 90/30;
        e.alerted = true;
        e.lastSeen = performance.now();
      } else {
        // cool down alert
        if (e.alerted && performance.now() - e.lastSeen > 2000){
          e.alerted = false;
        }
      }

      // collision enemy <-> player
      if (rectIntersect(e, state.player)){
        // damage player and knock back slightly
        if (!e._damageCooldown) e._damageCooldown = 0;
        if (e._damageCooldown <= 0){
          state.player.health -= 1;
          e._damageCooldown = 1000; // ms
          state.player.x -= (e.x < state.player.x) ? 6 : -6;
          state.player.y -= (e.y < state.player.y) ? 6 : -6;
          updateHUD();
          if (state.player.health <= 0){
            triggerGameOver();
          }
        }
      }
      // reduce damage cooldown
      if (e._damageCooldown) e._damageCooldown = Math.max(0, e._damageCooldown - dt*16.66);
    }

  }

  /*** SHOOTING ***/
  function shootBullet(){
    const p = state.player;
    // direction from facing or last movement
    const angle = p.facing || 0;
    const vx = Math.cos(angle) || 1;
    const vy = Math.sin(angle) || 0;
    const b = {x: p.x + p.w/2 - 2, y: p.y + p.h/2 - 2, w:4, h:4, vx, vy};
    state.bullets.push(b);
  }

  /*** RENDER ***/
  function render(){
    // clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw floor (simple grid)
    drawGrid();

    // draw walls
    for(const w of state.walls){
      if (w.isDoor){
        ctx.fillStyle = w.locked ? "#6b2e8a" : "#4b4b4b";
      } else ctx.fillStyle = "#444";
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }

    // draw pickups
    for(const p of state.pickups){
      if (p.taken) continue;
      if (p.type === 'key'){
        drawKey(p.x, p.y);
      } else if (p.type === 'health'){
        drawHeart(p.x, p.y);
      }
    }

    // draw player
    drawPlayer(state.player.x, state.player.y, state.player.w, state.player.h);

    // draw bullets
    ctx.fillStyle = "#ffea00";
    state.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // draw enemies
    for(const e of state.enemies){
      drawEnemy(e.x, e.y, e.w, e.h, e.alerted);
      // optional: draw LOS cone
      ctx.strokeStyle = e.alerted ? "rgba(255,60,60,.5)" : "rgba(255,255,255,.06)";
      ctx.beginPath();
      ctx.moveTo(e.x+e.w/2, e.y+e.h/2);
      // small fan lines
      for(let a=-0.8; a<=0.8; a+=0.4){
        const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x) + a;
        ctx.lineTo(e.x + e.w/2 + Math.cos(ang)*120, e.y + e.h/2 + Math.sin(ang)*120);
        ctx.moveTo(e.x+e.w/2, e.y+e.h/2);
      }
      ctx.stroke();
    }

    // HUD drawn via DOM so nothing to do here (but we draw level name small)
    ctx.fillStyle = "#ccc";
    ctx.font = "8px monospace";
    ctx.fillText(state.levels[state.levelIndex].name, 6, BASE_H - 6);
  }

  function drawGrid(){
    const lvl = state.levels[state.levelIndex];
    ctx.fillStyle = "#0f0f0f";
    for(let y=0;y<lvl.height;y++){
      for(let x=0;x<lvl.width;x++){
        // subtle floor tiles: alternate slightly
        const shade = ((x+y)%2==0) ? "#0b0b0b" : "#0f0f0f";
        ctx.fillStyle = shade;
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      }
    }
  }

  /*** DRAW FALLBACK SPRITES (procedural) ***/
  function drawPlayer(x,y,w,h){
    // helmet + body in olive green
    ctx.fillStyle = "#2e8b2e"; ctx.fillRect(x,y,w,h);
    ctx.fillStyle = "#1f5e1f"; ctx.fillRect(x+2,y+2,w-4,4); // visor/face
    ctx.fillStyle = "#0b0b0b"; ctx.fillRect(x+4,y+h-5, w-8,2); // boots
  }
  function drawEnemy(x,y,w,h, alerted){
    ctx.fillStyle = alerted ? "#9b1e1e" : "#8b2f2f";
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle = "#2b2b2b"; ctx.fillRect(x+3,y+3,w-6,h-6);
  }
  function drawKey(x,y){
    ctx.fillStyle = "#00d6ff";
    ctx.fillRect(x, y, 10, 6);
    ctx.fillRect(x+8,y-3,3,3);
  }
  function drawHeart(x,y){
    ctx.fillStyle = "#ff4b4b";
    ctx.beginPath();
    ctx.moveTo(x+6,y+8);
    ctx.arc(x+4,y+6,3,0,Math.PI,true);
    ctx.arc(x+8,y+6,3,0,Math.PI,true);
    ctx.fill();
  }

  /*** HUD (DOM) ***/
  function updateHUD(){
    document.getElementById('hud-health').textContent = 'Health: ' + state.player.health;
    document.getElementById('hud-keys').textContent = 'Keys: ' + state.keysCollected;
    document.getElementById('hud-level').textContent = 'Level: ' + (state.levelIndex + 1);
  }

  /*** LEVEL FLOW ***/
  function nextLevel(){
    const next = state.levelIndex + 1;
    if (next < state.levels.length) initLevel(next);
    else {
      // wrap or show victory
      alert("Mission Complete — All levels cleared!");
      initLevel(0);
    }
    updateHUD();
  }

  function triggerGameOver(){
    state.gameOver = true;
    state.paused = true;
    document.getElementById('pauseOverlay').classList.remove('hidden');
    document.getElementById('pauseOverlay').querySelector('h2').textContent = 'Mission Failed';
  }

  /*** PAUSE / UI BINDINGS ***/
  const pauseOverlay = document.getElementById('pauseOverlay');
  document.getElementById('resumeBtn').addEventListener('click', ()=>{ state.paused=false; pauseOverlay.classList.add('hidden'); });
  document.getElementById('restartBtn').addEventListener('click', ()=>{ initLevel(state.levelIndex); pauseOverlay.classList.add('hidden'); });
  document.getElementById('exitBtn').addEventListener('click', ()=>{ initLevel(0); pauseOverlay.classList.add('hidden'); });

  // Start / Select mapping
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter'){ state.paused = !state.paused; pauseOverlay.classList.toggle('hidden'); }
    if (e.code === 'Escape'){ state.paused = true; pauseOverlay.classList.remove('hidden'); }
  });

  // Hook action buttons (A => shoot; B => alt)
  document.getElementById('btnA').addEventListener('click', ()=>{ input.getInputState().shoot = true; setTimeout(()=>{ input.getInputState().shoot = false; }, 80); });

  // Small helper to pick up keys to progress to next level if door unlocked and player reaches exit
  function checkLevelComplete(){
    // define exit area as right-bottom corner tile (example)
    const lvl = state.levels[state.levelIndex];
    const exitBox = {x:(lvl.width-2)*TILE, y:(lvl.height-2)*TILE, w:TILE, h:TILE};
    if (rectIntersect(state.player, exitBox)){
      // only allow if no locked doors remain
      const locked = state.walls.some(w => w.isDoor && w.locked);
      if (!locked) nextLevel();
    }
  }

  // hook interval to check level complete
  setInterval(checkLevelComplete, 500);

  /*** INIT ***/
  initLevel(0);
  lastTime = 0;
  requestAnimationFrame(loop);

  // expose for debugging
  window.__GAME = { state, initLevel, nextLevel };

})();
