const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let keys = {};
let bullets = [];
let enemies = [];
let walls = [];
let keyItem = {};
let exitZone = {};
let hasKey = false;
let currentLevel = 0;
let gameState = "playing"; // playing, win, lose

// Player object
let player = {
  x: 50, y: 50, size: 20,
  speed: 2,
  dirX: 1, dirY: 0,
  health: 3
};

// Levels
const levels = [
  {
    walls: [{x:100,y:100,w:200,h:20},{x:300,y:200,w:20,h:200}],
    key: {x:400,y:100},
    exit: {x: 550, y: 250, w: 30, h: 50},
    enemies: [
      {x:150,y:150,size:20,dirX:1,dirY:0,health:1,speed:1}
    ]
  },
  {
    walls: [{x:200,y:200,w:200,h:20},{x:150,y:300,w:20,h:200}],
    key: {x:250,y:100},
    exit: {x: 100, y: 400, w: 30, h: 50},
    enemies: [
      {x:200,y:250,size:20,dirX:0,dirY:1,health:1,speed:1},
      {x:350,y:350,size:20,dirX:-1,dirY:0,health:1,speed:1}
    ]
  },
  {
    walls: [{x:50,y:150,w:300,h:20},{x:400,y:100,w:20,h:300}],
    key: {x:500,y:150},
    exit: {x: 600, y: 400, w: 30, h: 50},
    enemies: [
      {x:200,y:200,size:20,dirX:1,dirY:0,health:1,speed:2},
      {x:450,y:250,size:20,dirX:0,dirY:1,health:1,speed:1}
    ]
  },
  {
    walls: [{x:100,y:100,w:400,h:20},{x:100,y:200,w:20,h:200}],
    key: {x:120,y:350},
    exit: {x: 580, y: 50, w: 30, h: 50},
    enemies: [
      {x:300,y:150,size:20,dirX:-1,dirY:0,health:1,speed:2},
      {x:500,y:300,size:20,dirX:0,dirY:-1,health:1,speed:1},
      {x:250,y:400,size:20,dirX:1,dirY:0,health:1,speed:1}
    ]
  }
];

function loadLevel(index) {
  let lvl = levels[index];
  walls = lvl.walls;
  keyItem = {...lvl.key};
  exitZone = {...lvl.exit};
  enemies = lvl.enemies.map(e => ({...e}));
  hasKey = false;
  player.x = 50; player.y = 50;
}

loadLevel(currentLevel);

// Input
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

document.getElementById("up").ontouchstart = () => keys["ArrowUp"] = true;
document.getElementById("up").ontouchend = () => keys["ArrowUp"] = false;
document.getElementById("down").ontouchstart = () => keys["ArrowDown"] = true;
document.getElementById("down").ontouchend = () => keys["ArrowDown"] = false;
document.getElementById("left").ontouchstart = () => keys["ArrowLeft"] = true;
document.getElementById("left").ontouchend = () => keys["ArrowLeft"] = false;
document.getElementById("right").ontouchstart = () => keys["ArrowRight"] = true;
document.getElementById("right").ontouchend = () => keys["ArrowRight"] = false;
document.getElementById("shoot").ontouchstart = () => shootBullet();
document.getElementById("start").ontouchstart = () => {
  if (gameState !== "playing") {
    currentLevel = 0;
    player.health = 3;
    gameState = "playing";
    loadLevel(currentLevel);
  }
};

// Shooting
function shootBullet() {
  bullets.push({
    x: player.x+player.size/2,
    y: player.y+player.size/2,
    dx: player.dirX*4,
    dy: player.dirY*4
  });
}

document.addEventListener("keydown", e => {
  if (e.key === " " && gameState === "playing") shootBullet();
});

// Update
function update() {
  if (gameState !== "playing") return;

  let dx = 0, dy = 0;
  if (keys["ArrowUp"] || keys["w"]) dy = -1;
  if (keys["ArrowDown"] || keys["s"]) dy = 1;
  if (keys["ArrowLeft"] || keys["a"]) dx = -1;
  if (keys["ArrowRight"] || keys["d"]) dx = 1;

  if (dx !== 0 || dy !== 0) {
    player.dirX = dx;
    player.dirY = dy;
    player.x += dx*player.speed;
    player.y += dy*player.speed;
  }

  // Bullets
  bullets.forEach(b => { b.x += b.dx; b.y += b.dy; });

  // Collisions
  if (!hasKey &&
      player.x < keyItem.x+15 && player.x+player.size > keyItem.x &&
      player.y < keyItem.y+15 && player.y+player.size > keyItem.y) {
    hasKey = true;
  }

  if (hasKey &&
      player.x < exitZone.x+exitZone.w && player.x+player.size > exitZone.x &&
      player.y < exitZone.y+exitZone.h && player.y+player.size > exitZone.y) {
    currentLevel++;
    if (currentLevel < levels.length) {
      loadLevel(currentLevel);
    } else {
      gameState = "win";
    }
  }

  // Enemies
  enemies.forEach(e => {
    e.x += e.dirX*e.speed;
    e.y += e.dirY*e.speed;
    if (Math.random() < 0.01) { // change direction randomly
      let dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      let d = dirs[Math.floor(Math.random()*dirs.length)];
      e.dirX = d[0]; e.dirY = d[1];
    }

    // Contact damage
    if (player.x < e.x+e.size && player.x+player.size > e.x &&
        player.y < e.y+e.size && player.y+player.size > e.y) {
      player.health -= 1;
      if (player.health <= 0) gameState = "lose";
    }
  });

  // Bullet hits
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (b.x < e.x+e.size && b.x > e.x && b.y < e.y+e.size && b.y > e.y) {
        e.health--;
        bullets.splice(bi,1);
        if (e.health <= 0) enemies.splice(ei,1);
      }
    });
  });
}

// Draw entities
function drawEntity(entity, color, dirX, dirY) {
  ctx.fillStyle = color;
  ctx.fillRect(entity.x, entity.y, entity.size, entity.size);
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(entity.x+entity.size/2, entity.y+entity.size/2);
  ctx.lineTo(entity.x+entity.size/2 + dirX*10, entity.y+entity.size/2 + dirY*10);
  ctx.stroke();
}

// Draw
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (gameState === "win") {
    ctx.fillStyle = "lime";
    ctx.font = "30px monospace";
    ctx.fillText("YOU WIN!", 250, 200);
    ctx.fillText("Press Start", 250, 250);
    return;
  }
  if (gameState === "lose") {
    ctx.fillStyle = "red";
    ctx.font = "30px monospace";
    ctx.fillText("GAME OVER", 240, 200);
    ctx.fillText("Press Start", 240, 250);
    return;
  }

  // Walls
  ctx.fillStyle = "#555";
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // Exit
  ctx.fillStyle = hasKey ? "green" : "red";
  ctx.fillRect(exitZone.x, exitZone.y, exitZone.w, exitZone.h);

  // Key
  if (!hasKey) {
    ctx.fillStyle = "yellow";
    ctx.fillRect(keyItem.x, keyItem.y, 15, 15);
  }

  // Player
  drawEntity(player, "blue", player.dirX, player.dirY);

  // Enemies
  enemies.forEach(e => drawEntity(e, "red", e.dirX, e.dirY));

  // Bullets
  ctx.fillStyle = "orange";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 5, 5));

  // HUD
  ctx.fillStyle = "white";
  ctx.font = "16px monospace";
  ctx.fillText("Health: " + player.health, 10, 20);
  ctx.fillText("Keys: " + (hasKey ? "1/1" : "0/1"), 10, 40);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();
