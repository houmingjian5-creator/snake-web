const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const rankEl = document.getElementById("rank");
const currentPlayerEl = document.getElementById("currentPlayer");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayHint = document.getElementById("overlayHint");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const difficultyEl = document.getElementById("difficulty");
const shareButton = document.getElementById("shareButton");
const shareStatus = document.getElementById("shareStatus");
const authForm = document.getElementById("authForm");
const accountInput = document.getElementById("accountInput");
const passwordInput = document.getElementById("passwordInput");
const nicknameInput = document.getElementById("nicknameInput");
const nicknameField = document.getElementById("nicknameField");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const logoutButton = document.getElementById("logoutButton");
const leaderboardEl = document.getElementById("leaderboard");

const grid = 24;
const cell = canvas.width / grid;
const accountKey = "snakeAccountsV1";
const sessionKey = "snakeCurrentAccountV1";
const difficulties = {
  easy: { tick: 135, speed: "0.8x" },
  normal: { tick: 105, speed: "1x" },
  hard: { tick: 75, speed: "1.4x" },
};

let snake;
let food;
let direction;
let nextDirection;
let score = 0;
let running = false;
let paused = false;
let gameOver = false;
let gameTimer = null;
let touchStart = null;
let authMode = "login";
let currentAccount = null;

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(accountKey) || "{}");
  } catch {
    return {};
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(accountKey, JSON.stringify(accounts));
}

async function hashPassword(account, password) {
  const text = `${account.trim().toLowerCase()}::${password}`;
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getPlayer() {
  if (!currentAccount) return null;
  return loadAccounts()[currentAccount] || null;
}

function getPlayerBest() {
  return getPlayer()?.best || 0;
}

function setAuthMode(mode) {
  authMode = mode;
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  nicknameField.classList.toggle("hidden", mode !== "register");
  authSubmit.textContent = mode === "login" ? "登录" : "注册并进入";
  authMessage.textContent = "";
}

async function handleAuth(event) {
  event.preventDefault();
  const account = accountInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const nickname = nicknameInput.value.trim() || account;
  const accounts = loadAccounts();

  if (!/^[a-z0-9_-]{3,18}$/.test(account)) {
    authMessage.textContent = "账号只能使用 3-18 位字母、数字、下划线或短横线。";
    return;
  }

  if (authMode === "register") {
    if (accounts[account]) {
      authMessage.textContent = "这个账号已经存在，请直接登录。";
      return;
    }
    accounts[account] = {
      nickname,
      passwordHash: await hashPassword(account, password),
      best: 0,
      games: 0,
      createdAt: Date.now(),
    };
    saveAccounts(accounts);
  } else {
    const player = accounts[account];
    if (!player || player.passwordHash !== (await hashPassword(account, password))) {
      authMessage.textContent = "账号或密码不正确。";
      return;
    }
  }

  currentAccount = account;
  localStorage.setItem(sessionKey, account);
  authForm.reset();
  authMessage.textContent = "已进入游戏。";
  newGame();
  updateAuthState();
}

function updateAuthState() {
  const player = getPlayer();
  const isLoggedIn = Boolean(player);
  currentPlayerEl.textContent = player?.nickname || "未登录";
  startButton.disabled = !isLoggedIn;
  pauseButton.disabled = !isLoggedIn;
  resetButton.disabled = !isLoggedIn;
  logoutButton.disabled = !isLoggedIn;
  authForm.classList.toggle("hidden", isLoggedIn);

  if (!isLoggedIn) {
    currentAccount = null;
    localStorage.removeItem(sessionKey);
    clearInterval(gameTimer);
    running = false;
    showOverlay("请先登录", "创建玩家后即可开始");
  }

  syncHud();
  renderLeaderboard();
}

function logout() {
  currentAccount = null;
  localStorage.removeItem(sessionKey);
  newGame();
  updateAuthState();
}

function restoreSession() {
  const account = localStorage.getItem(sessionKey);
  if (account && loadAccounts()[account]) {
    currentAccount = account;
  }
}

function saveScore() {
  if (!currentAccount) return;
  const accounts = loadAccounts();
  const player = accounts[currentAccount];
  if (!player) return;
  player.best = Math.max(player.best || 0, score);
  player.games = (player.games || 0) + 1;
  player.updatedAt = Date.now();
  saveAccounts(accounts);
}

function getRank() {
  if (!currentAccount) return "-";
  const rows = Object.entries(loadAccounts()).sort((a, b) => (b[1].best || 0) - (a[1].best || 0));
  const index = rows.findIndex(([account]) => account === currentAccount);
  return index === -1 ? "-" : `#${index + 1}`;
}

function renderLeaderboard() {
  const rows = Object.entries(loadAccounts())
    .sort((a, b) => (b[1].best || 0) - (a[1].best || 0))
    .slice(0, 10);

  leaderboardEl.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.innerHTML = "<span>-</span><div>暂无玩家<small>注册后开始计分</small></div><strong>0</strong>";
    leaderboardEl.append(empty);
    return;
  }

  rows.forEach(([account, player], index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${index + 1}</span>
      <div>${escapeHtml(player.nickname || account)}<small>${escapeHtml(account)}</small></div>
      <strong>${player.best || 0}</strong>
    `;
    leaderboardEl.append(item);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

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

  if (getPlayer()) {
    showOverlay("准备开始", "按开始或滑动方向键");
  } else {
    showOverlay("请先登录", "创建玩家后即可开始");
  }
}

function startGame() {
  if (!getPlayer()) {
    updateAuthState();
    return;
  }
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
    showOverlay("已暂停", "按继续回到游戏");
  } else {
    overlay.classList.add("hidden");
    gameTimer = setInterval(tick, difficulties[difficultyEl.value].tick);
  }
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(gameTimer);
  saveScore();
  syncHud();
  renderLeaderboard();
  showOverlay("游戏结束", "按重开或开始再来一局");
}

function tick() {
  direction = nextDirection;
  const head = snake[0];
  const next = {
    x: (head.x + direction.x + grid) % grid,
    y: (head.y + direction.y + grid) % grid,
  };
  const willEat = next.x === food.x && next.y === food.y;
  const bodyToCheck = willEat ? snake : snake.slice(0, -1);

  if (bodyToCheck.some((part) => part.x === next.x && part.y === next.y)) {
    endGame();
    return;
  }

  snake.unshift(next);
  if (willEat) {
    score += 10;
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
  if (!getPlayer()) return;
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
  bestEl.textContent = Math.max(getPlayerBest(), score);
  speedEl.textContent = difficulties[difficultyEl.value].speed;
  rankEl.textContent = getRank();
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
  shareStatus.textContent = "当前链接已复制，可以直接发给朋友。";
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
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
  else setDirection(0, dy > 0 ? 1 : -1);
}, { passive: false });

loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));
authForm.addEventListener("submit", handleAuth);
logoutButton.addEventListener("click", logout);
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

setAuthMode("login");
restoreSession();
newGame();
updateAuthState();
