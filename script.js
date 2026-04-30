const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

context.scale(20, 20);
nextContext.scale(20, 20);

// ФОН МАТРИЦА
const symbols = "01アイウエオカキクケコサシスセソタチツテト".split("");
const drops = Array(12).fill(0);

function drawMatrixBG() {
    context.font = "1px monospace";
    drops.forEach((y, x) => {
        const text = symbols[Math.floor(Math.random() * symbols.length)];
        context.fillStyle = "rgba(0, 40, 0, 0.2)";
        context.fillText(text, x, y);
        if (y > 20 && Math.random() > 0.98) drops[x] = 0;
        else drops[x] += 0.4;
    });
}

function createPiece(type) {
    if (type === 'T') return [[0,0,0],[1,1,1],[0,1,0]];
    if (type === 'O') return [[2,2],[2,2]];
    if (type === 'L') return [[0,3,0],[0,3,0],[0,3,3]];
    if (type === 'J') return [[0,4,0],[0,4,0],[4,4,0]];
    if (type === 'I') return [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]];
    if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === 'Z') return [[7,7,0],[0,7,7],[0,0,0]];
}

function drawMatrix(matrix, offset, ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = '#00ff41';
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 0.05;
                ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

const arena = Array.from({length: 20}, () => Array(12).fill(0));

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    next: null,
    score: 0,
    speed: 0,
    highscore: localStorage.getItem('matrix_hi') || 0
};

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

function rotate(matrix) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    matrix.forEach(row => row.reverse());
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix); // вращаем назад
            player.pos.x = pos;
            return;
        }
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        player.score += 10;
        playerReset();
        arenaSweep();
        updateUI();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

let progress = 0;
function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        if (arena[y].every(value => value !== 0)) {
            const row = arena.splice(y, 1).fill(0);
            arena.unshift(row);
            ++y;
            rowCount++;
        }
    }
    if (rowCount > 0) {
        const bonus =;
        player.score += bonus[rowCount];
        progress += rowCount * 25;
        if (progress >= 100) {
            progress = 0;
            if (player.speed < 10) player.speed++;
        }
        updateUI();
    }
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[Math.floor(Math.random() * 7)]);
    player.matrix = player.next;
    player.next = createPiece(pieces[Math.floor(Math.random() * 7)]);
    player.pos.y = 0;
    player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
    if (collide(arena, player)) {
        if (player.score > player.highscore) {
            player.highscore = player.score;
            localStorage.setItem('matrix_hi', player.highscore);
        }
        arena.forEach(row => row.fill(0));
        player.score = 0;
        progress = 0;
        updateUI();
    }
}

function updateUI() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('highscore').innerText = player.highscore;
    document.getElementById('speed-val').innerText = player.speed;
    document.getElementById('speed-bar').style.height = progress + '%';
}

let dropCounter = 0;
let lastTime = 0;
let isPaused = false;

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrixBG();
    
    // Сетка
    context.strokeStyle = "rgba(0, 255, 65, 0.05)";
    context.lineWidth = 0.02;
    for(let i=0; i<12; i++) context.strokeRect(i, 0, 1, 20);

    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);

    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    drawMatrix(player.next, {x: 1, y: 1}, nextContext);
}

function update(time = 0) {
    if (isPaused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    const interval = Math.max(150, 1000 - (player.speed * 85));
    if (dropCounter > interval) {
        playerDrop();
    }
    draw();
    requestAnimationFrame(update);
}

// УПРАВЛЕНИЕ ЗАЖАТИЕМ
let timer;
function startAuto(action) {
    action();
    timer = setInterval(action, 120);
}

document.getElementById('left').addEventListener('touchstart', e => { e.preventDefault(); startAuto(() => playerMove(-1)); });
document.getElementById('right').addEventListener('touchstart', e => { e.preventDefault(); startAuto(() => playerMove(1)); });
document.getElementById('down').addEventListener('touchstart', e => { e.preventDefault(); startAuto(() => playerDrop()); });
document.addEventListener('touchend', () => clearInterval(timer));

document.getElementById('rotate').addEventListener('touchstart', e => {
    e.preventDefault();
    playerRotate();
});

document.getElementById('start-btn').addEventListener('click', () => {
    player.speed = parseInt(document.getElementById('speed-input').value) || 0;
    document.getElementById('menu').style.display = 'none';
    playerReset();
    updateUI();
    update();
});

document.getElementById('pause').addEventListener('click', () => isPaused = !isPaused);
document.getElementById('reset').addEventListener('click', () => location.reload());

updateUI();

