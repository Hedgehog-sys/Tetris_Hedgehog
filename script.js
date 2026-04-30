const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
context.scale(20, 20);
nextCtx.scale(20, 20);

const PIECES = {
    'I': [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    'L': [[0,1,0],[0,1,0],[0,1,1]],
    'J': [[0,1,0],[0,1,0],[1,1,0]],
    'O': [[1,1],[1,1]],
    'Z': [[1,1,0],[0,1,1],[0,0,0]],
    'S': [[0,1,1],[1,1,0],[0,0,0]],
    'T': [[0,1,0],[1,1,1],[0,0,0]]
};

const REWARDS = { 1: 100, 2: 300, 3: 700, 4: 1500 };
let arena = Array.from({length: 20}, () => Array(10).fill(0));
let player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0, lines: 0, level: 0 };
let paused = false, dropCounter = 0, lastTime = 0, progress = 0;

let highScore = localStorage.getItem('matrixHighScore') || 0;

// Фон Матрицы
const symbols = "01".split("");
const drops = Array(10).fill(0);

function drawMatrixBG() {
    context.font = "1px monospace";
    drops.forEach((y, x) => {
        context.fillStyle = "rgba(0, 50, 0, 0.15)";
        context.fillText(symbols[Math.floor(Math.random()*2)], x, y);
        if (y > 20 && Math.random() > 0.98) drops[x] = 0; else drops[x] += 0.4;
    });
}

function drawMatrix(matrix, offset, ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = '#0f0';
                ctx.fillRect(x + offset.x, y + offset.y, 0.9, 0.9);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 0.05;
                ctx.strokeRect(x + offset.x, y + offset.y, 0.9, 0.9);
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrixBG();
    
    // Сетка
    context.strokeStyle = "rgba(0, 255, 0, 0.05)";
    context.lineWidth = 0.02;
    for(let i=0; i<10; i++) context.strokeRect(i, 0, 1, 20);

    drawMatrix(arena, {x: 0, y: 0}, context);
    if (player.matrix) drawMatrix(player.matrix, player.pos, context);
    
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, 4, 4);
    if (player.next) drawMatrix(player.next, {x: 0.5, y: 0.5}, nextCtx);
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        player.score += 10;
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(arena, player)) { player.pos.y++; }
    player.pos.y--;
    merge(arena, player);
    player.score += 20;
    playerReset();
    arenaSweep();
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    const matrix = player.matrix;
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) { [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]]; }
    }
    matrix.forEach(row => row.reverse());
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > matrix.length) { player.pos.x = pos; return; }
    }
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        if (arena[y].every(value => value !== 0)) {
            const row = arena.splice(y, 1).fill(0);
            arena.unshift(row);
            ++y; rowCount++;
        }
    }
    if (rowCount > 0) {
        player.score += REWARDS[rowCount];
        progress += rowCount * 25;
        if (progress >= 100) { progress = 0; player.level++; }
    }
    updateUI();
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = PIECES[pieces[Math.random() * 7 | 0]];
    player.matrix = player.next;
    player.next = PIECES[pieces[Math.random() * 7 | 0]];
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        if (player.score > highScore) {
            highScore = player.score;
            localStorage.setItem('matrixHighScore', highScore);
        }
        arena.forEach(row => row.fill(0));
        player.score = 0;
        player.level = parseInt(document.getElementById('startLevel').value) || 0;
        progress = 0;
        document.getElementById('overlay').style.display = 'flex';
    }
}

function updateUI() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('highscore').innerText = highScore;
    document.getElementById('highscore_overlay').innerText = highScore;
    document.getElementById('level').innerText = player.level;
    document.getElementById('speed-bar').style.height = progress + '%';
}

function update(time = 0) {
    if (!paused) {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        const interval = Math.max(150, 1000 - (player.level * 85));
        if (dropCounter > interval) playerDrop();
        draw();
    }
    requestAnimationFrame(update);
}

function startGame() {
    player.level = parseInt(document.getElementById('startLevel').value) || 0;
    document.getElementById('overlay').style.display = 'none';
    arena.forEach(row => row.fill(0));
    player.score = 0;
    progress = 0;
    playerReset();
    updateUI();
    update();
}

function togglePause() {
    paused = !paused;
    document.getElementById('pauseLabel').style.display = paused ? 'block' : 'none';
}

// Удержание кнопок
let mTimer;
function startM(action) { action(); mTimer = setInterval(action, 120); }
document.getElementById('btn-left').onmousedown = () => startM(() => playerMove(-1));
document.getElementById('btn-right').onmousedown = () => startM(() => playerMove(1));
document.getElementById('btn-down').onmousedown = () => startM(() => playerDrop());
document.getElementById('btn-rotate').onmousedown = () => playerRotate();

document.getElementById('btn-left').ontouchstart = (e) => { e.preventDefault(); startM(() => playerMove(-1)); };
document.getElementById('btn-right').ontouchstart = (e) => { e.preventDefault(); startM(() => playerMove(1)); };
document.getElementById('btn-down').ontouchstart = (e) => { e.preventDefault(); startM(() => playerDrop()); };
document.getElementById('btn-rotate').ontouchstart = (e) => { e.preventDefault(); playerRotate(); };

window.onmouseup = window.ontouchend = () => clearInterval(mTimer);

updateUI();

