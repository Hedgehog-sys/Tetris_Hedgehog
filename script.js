const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
context.scale(20, 20);
nextContext.scale(20, 20);

let dropCounter = 0;
let lastTime = 0;
let isPaused = false;
let progress = 0;

const player = { 
    pos: {x: 0, y: 0}, matrix: null, next: null, 
    score: 0, speed: 0,
    highscore: localStorage.getItem('matrix_tetris_hi') || 0 
};

const arena = Array.from({length: 20}, () => Array(12).fill(0));
const symbols = "01アイウエオ".split("");
const drops = Array(12).fill(0);

function drawMatrixBG() {
    context.font = "1px monospace";
    drops.forEach((y, x) => {
        const text = symbols[Math.floor(Math.random() * symbols.length)];
        context.fillStyle = "rgba(0, 35, 0, 0.25)";
        context.fillText(text, x, y);
        if (y > 20 && Math.random() > 0.98) drops[x] = 0;
        else drops[x] += 0.45;
    });
}

function createPiece(type) {
    if (type === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    if (type === 'L') return [[0,2,0],[0,2,0],[0,2,2]];
    if (type === 'J') return [[0,3,0],[0,3,0],[3,3,0]];
    if (type === 'O') return [[4,4],[4,4]];
    if (type === 'Z') return [[5,5,0],[0,5,5],[0,0,0]];
    if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === 'T') return [[0,7,0],[7,7,7],[0,0,0]];
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrixBG();
    context.strokeStyle = "rgba(0, 255, 65, 0.05)";
    context.lineWidth = 0.01;
    for(let i=0; i<12; i++) context.strokeRect(i, 0, 1, 20);
    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if(player.next) drawMatrix(player.next, {x: 1, y: 1}, nextContext);
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

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        player.score += 10;
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
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
        const scores = [0, 100, 300, 700, 1500];
        player.score += scores[rowCount];
        updateProgress(rowCount);
    }
}

function updateProgress(lines) {
    progress += lines * 25;
    if (progress >= 100) {
        progress = 0;
        if (player.speed < 10) player.speed++;
        updateSpeedDisplay();
    }
    document.getElementById('speed-bar').style.height = progress + '%';
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

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[pieces[pieces.length * Math.random() | 0]]);
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        if (player.score > player.highscore) {
            player.highscore = player.score;
            localStorage.setItem('matrix_tetris_hi', player.highscore);
        }
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
}

function updateSpeedDisplay() { document.getElementById('speed-val').innerText = player.speed; }
function updateScore() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('highscore').innerText = player.highscore;
}

function update(time = 0) {
    if (!isPaused) {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        const currentInterval = Math.max(150, 1000 - (player.speed * 85));
        if (dropCounter > currentInterval) playerDrop();
        draw();
    }
    requestAnimationFrame(update);
}

let mTimer;
function startM(d) {
    if(d==='L') playerMove(-1); if(d==='R') playerMove(1); if(d==='D') playerDrop();
    mTimer = setInterval(() => { if(d==='L') playerMove(-1); if(d==='R') playerMove(1); if(d==='D') playerDrop(); }, 120);
}
document.getElementById('left').addEventListener('touchstart', e => { e.preventDefault(); startM('L'); });
document.getElementById('right').addEventListener('touchstart', e => { e.preventDefault(); startM('R'); });
document.getElementById('down').addEventListener('touchstart', e => { e.preventDefault(); startM('D'); });
document.addEventListener('touchend', () => clearInterval(mTimer));
document.getElementById('rotate').addEventListener('touchstart', e => { e.preventDefault(); playerRotate(); });
document.getElementById('start-btn').addEventListener('click', () => {
    player.speed = parseInt(document.getElementById('speed-input').value) || 0;
    updateSpeedDisplay();
    document.getElementById('menu').style.display = 'none';
    playerReset();
    updateScore();
    update();
});
document.getElementById('reset').addEventListener('click', () => location.reload());
document.getElementById('pause').addEventListener('click', () => isPaused = !isPaused);
updateScore();
