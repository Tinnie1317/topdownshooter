const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === GAME STATE ===
let keys = {};
let player = {x: 50, y: 50, w: 16, h: 16, speed: 2, health: 3};
let bullets = [];
let enemies = [{x: 200, y: 50, w: 16, h: 16, dir: 1}];
let hasKey = false;
let lockedDoor = {x: 280, y: 100, w: 16, h: 32, locked: true};
let keyCard = {x: 150, y: 150, w: 10, h: 10, taken: false};

// === INPUT HANDLING ===
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// === GAME LOOP ===
function update() {
  // Player movement
  if (keys["ArrowUp"]) player.y -= player.speed;
  if (keys["ArrowDown"]) player.y += player.speed;
  if (keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["ArrowRight"]) player.x += player.speed;

  // Shooting
  if (keys["Space"]) {
    if (bullets.length < 5) {
      bullets.push({x: player.x+8, y: player.y+8, vx: 3, vy: 0});
    }
  }

  // Update bullets
  bullets.forEach(b => b.x += b.vx);

  // Enemy patrol
  enemies.forEach(e => {
    e.x += e.dir;
    if (e.x > 220 || e.x < 180) e.dir *= -1;
  });

  // Collision with key
  if (!keyCard.taken && checkCollision(player, keyCard)) {
    keyCard.taken = true;
    hasKey = true;
  }

  // Door unlock
  if (hasKey && checkCollision(player, lockedDoor)) {
    lockedDoor.locked = false;
  }

  // Bullet hitting enemy
  bullets.forEach((b, i) => {
    enemies.forEach((e, j) => {
      if (checkCollision(b, e)) {
        enemies.splice(j,1);
        bullets.splice(i,1);
      }
    });
  });
}

function draw() {
  ctx.fillStyle = "black";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Player
  ctx.fillStyle = "lime";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // Bullets
  ctx.fillStyle = "yellow";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 4));

  // Enemies
  ctx.fillStyle = "red";
  enemies.forEach(e => ctx.fillRect(e.x, e.y, e.w, e.h));

  // Key
  if (!keyCard.taken) {
    ctx.fillStyle = "cyan";
    ctx.fillRect(keyCard.x, keyCard.y, keyCard.w, keyCard.h);
  }

  // Door
  ctx.fillStyle = lockedDoor.locked ? "purple" : "gray";
  ctx.fillRect(lockedDoor.x, lockedDoor.y, lockedDoor.w, lockedDoor.h);

  // HUD
  ctx.fillStyle = "white";
  ctx.fillText("Health: " + player.health, 5, 10);
  ctx.fillText("Key: " + (hasKey ? "Yes" : "No"), 5, 25);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function checkCollision(a,b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

gameLoop();
