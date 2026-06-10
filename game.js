const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayHint = document.getElementById("overlayHint");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const difficultyEl = document.getElementById("difficulty");
const shareButton = document.getElementById("shareButton");
const shareStatus = document.getElementById("shareStatus");

const grid = 24;
const cell = canvas.width / grid;
const difficulties = {
  easy: { tick: 135, speed: "0.8x" },
  normal: { tick: 105, speed: "1x" },
  hard: { tick: 75, speed: "1.4x" },
};

let snake;
let food;
let direction;
let nextDirection;
let score;
let best = Number(localStorage.getItem("snakeBest") || 0);
let running = false;
let paused = false;
let gameOver = false;
let gameTimer = null;
let touchStart = null;

function newGame() {
  snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  paused = false;
  gameOver = false;
  placeFood();
  syncHud();
  draw();
  showOverlay("准备开始", "按空格或点击开始");
}

function startGame() {
  if (gameOver) {
    newGame();
  }
  if (running && !paused) return;
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  startButton.textContent = "继续";
  pauseButton.textContent = "暂停";
  clearInterval(gameTimer);
  gameTimer = setInterval(tick, difficulties[difficultyEl.value].tick);
}

function pauseGame() {
  if (!running) return;
  paused = !paused;
  pauseButton.textContent = paused ? "继续" : "暂停";
  if (paused) {
    clearInterval(gameTimer);
    showOverlay("已暂停", "按空格继续");
  } else {
    overlay.classList.add("hidden");
    gameTimer = setInterval(tick, difficulties[difficultyEl.value].tick);
  }
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(gameTimer);
  best = Math.max(best, score);
  localStorage.setItem("snakeBest", String(best));
  syncHud();
  showOverlay("游戏结束", "按重开或空格再来一局");
}

function tick() {
  direction = nextDirection;
  const head = snake[0];
  const next = { x: head.x + direction.x, y: head.y + direction.y };

  const willEat = next.x === food.x && next.y === food.y;
  const bodyToCheck = willEat ? snake : snake.slice(0, -1);

  if (
    next.x < 0 ||
    next.y < 0 ||
    next.x >= grid ||
    next.y >= grid ||
    bodyToCheck.some((part) => part.x === next.x && part.y === next.y)
  ) {
    endGame();
    return;
  }

  snake.unshift(next);
  if (willEat) {
    score += 10;
    best = Math.max(best, score);
    placeFood();
  } else {
    snake.pop();
  }
  syncHud();
  draw();
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid),
    };
  } while (snake?.some((part) => part.x === food.x && part.y === food.y));
}

function setDirection(x, y) {
  if (nextDirection.x + x === 0 && nextDirection.y + y === 0) return;
  nextDirection = { x, y };
  if (!running) startGame();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawFood();
  drawSnake();
}

function drawBoard() {
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let i = 1; i < grid; i += 1) {
    const pos = i * cell;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((part, index) => {
    const inset = index === 0 ? 2 : 3;
    ctx.fillStyle = index === 0 ? "#58d8ff" : "#48e58f";
    roundRect(part.x * cell + inset, part.y * cell + inset, cell - inset * 2, cell - inset * 2, 7);
    ctx.fill();
  });
}

function drawFood() {
  const cx = food.x * cell + cell / 2;
  const cy = food.y * cell + cell / 2;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 209, 102, 0.35)";
  ctx.lineWidth = 5;
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function syncHud() {
  scoreEl.textContent = score;
  bestEl.textContent = Math.max(best, score);
  speedEl.textContent = difficulties[difficultyEl.value].speed;
}

function showOverlay(title, hint) {
  overlayTitle.textContent = title;
  overlayHint.textContent = hint;
  overlay.classList.remove("hidden");
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url);
  shareStatus.textContent = "当前链接已复制。发布到公网后，把公网链接发给朋友就能玩。";
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "w"].includes(key)) setDirection(0, -1);
  if (["arrowdown", "s"].includes(key)) setDirection(0, 1);
  if (["arrowleft", "a"].includes(key)) setDirection(-1, 0);
  if (["arrowright", "d"].includes(key)) setDirection(1, 0);
  if (key === " ") {
    event.preventDefault();
    if (!running) startGame();
    else pauseGame();
  }
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => {
    const dir = button.dataset.dir;
    if (dir === "up") setDirection(0, -1);
    if (dir === "down") setDirection(0, 1);
    if (dir === "left") setDirection(-1, 0);
    if (dir === "right") setDirection(1, 0);
  });
});

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: false });

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
  else setDirection(0, dy > 0 ? 1 : -1);
}, { passive: false });

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
resetButton.addEventListener("click", () => {
  clearInterval(gameTimer);
  running = false;
  gameOver = false;
  newGame();
});
difficultyEl.addEventListener("change", () => {
  syncHud();
  if (running && !paused) {
    clearInterval(gameTimer);
    gameTimer = setInterval(tick, difficulties[difficultyEl.value].tick);
  }
});
shareButton.addEventListener("click", handleShare);

newGame();
