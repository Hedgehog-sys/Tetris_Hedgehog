
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

    const REWARDS = { 1: 40, 2: 100, 3: 300, 4: 1200 };
    let arena = Array.from({length: 20}, () => Array(10).fill(0));
    let player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0, lines: 0, level: 0 };
    let paused = false, dropCounter = 0, lastTime = 0;
    
    let animatingLines = [];
    let animationTimer = 0;
    const ANIM_TIME = 500; 

    let highScore = localStorage.getItem('matrixHighScore') || 0;
    updateUI();

    function drawMatrix(matrix, offset, ctx) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = '#0f0';
                    ctx.fillRect(x + offset.x, y + offset.y, 0.9, 0.9);
                }
            });
        });
    }

    function draw() {
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        arena.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    if (animatingLines.includes(y)) {
                        context.fillStyle = (Math.floor(Date.now() / 80) % 2 === 0) ? '#fff' : '#0f0';
                    } else {
                        context.fillStyle = '#0f0';
                    }
                    context.fillRect(x, y, 0.9, 0.9);
                }
            });
        });

        if (animatingLines.length === 0 && player.matrix) {
            drawMatrix(player.matrix, player.pos, context);
        }
        
        nextCtx.fillStyle = '#000';
        nextCtx.fillRect(0, 0, 4, 4);
        if (player.next) {
            const offX = player.next.length === 4 ? 0 : 0.5;
            drawMatrix(player.next, {x: offX, y: 0.5}, nextCtx);
        }
    }

    function collide(fArena, fPlayer) {
        const [m, o] = [fPlayer.matrix, fPlayer.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (fArena[y + o.y] && fArena[y + o.y][x + o.x]) !== 0) return true;
            }
        }
        return false;
    }

    function arenaSweep() {
        let rows = [];
        outer: for (let y = arena.length - 1; y >= 0; y--) {
            for (let x = 0; x < arena[y].length; x++) if (arena[y][x] === 0) continue outer;
            rows.push(y);
        }
        if (rows.length > 0) {
            animatingLines = rows;
            animationTimer = ANIM_TIME;
            return true;
        }
        return false;
    }

    function finishSweep() {
        animatingLines.sort((a,b) => a-b);
        animatingLines.forEach(y => {
            arena.splice(y, 1);
            arena.unshift(new Array(10).fill(0));
        });
        player.score += REWARDS[animatingLines.length] * (player.level + 1);
        player.lines += animatingLines.length;
        player.level = Math.floor(player.lines / 10);
        animatingLines = [];
        updateUI();
        playerReset();
    }

    function playerDrop() {
        if (paused || animatingLines.length > 0) return;
        player.pos.y++;
        if (collide(arena, player)) {
            player.pos.y--;
            player.matrix.forEach((row, y) => {
                row.forEach((val, x) => {
                    if (val !== 0) arena[y + player.pos.y][x + player.pos.x] = val;
                });
            });
            if (!arenaSweep()) playerReset();
        }
        dropCounter = 0;
    }

    function playerHardDrop() {
        if (paused || animatingLines.length > 0) return;
        while (!collide(arena, player)) player.pos.y++;
        player.pos.y--;
        player.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) arena[y + player.pos.y][x + player.pos.x] = val;
            });
        });
        if (!arenaSweep()) playerReset();
        dropCounter = 0;
    }

    function playerMove(dx) {
        if (paused || animatingLines.length > 0) return;
        player.pos.x += dx;
        if (collide(arena, player)) player.pos.x -= dx;
    }

    function playerRotate() {
        if (paused || animatingLines.length > 0) return;
        const m = player.matrix;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < y; ++x) [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
        }
        m.forEach(row => row.reverse());
        if (collide(arena, player)) {
            player.pos.x += player.pos.x < 5 ? 1 : -1;
            if (collide(arena, player)) {
                m.forEach(row => row.reverse());
                for (let y = 0; y < m.length; ++y) {
                    for (let x = 0; x < y; ++x) [m[x][y], m[y][x]] = [m[x][y], m[x][y]];
                }
                player.pos.x -= player.pos.x < 5 ? 1 : -1;
            }
        }
    }

    function playerReset() {
        const p = 'ILJOTSZ';
        if (!player.next) player.next = PIECES[p[p.length * Math.random() | 0]];
        player.matrix = JSON.parse(JSON.stringify(player.next));
        player.next = PIECES[p[p.length * Math.random() | 0]];
        player.pos.y = 0;
        player.pos.x = 3;
        if (collide(arena, player)) {
            if (player.score > highScore) {
                highScore = player.score;
                localStorage.setItem('matrixHighScore', highScore);
            }
            alert("MATRIX OVER. SCORE: " + player.score);
            arena.forEach(row => row.fill(0));
            document.getElementById('overlay').style.display = 'flex';
            updateUI();
        }
    }

    function update(time = 0) {
        const dt = time - lastTime;
        lastTime = time;
        if (!paused) {
            if (animatingLines.length > 0) {
                animationTimer -= dt;
                if (animationTimer <= 0) finishSweep();
            } else {
                dropCounter += dt;
                if (dropCounter > Math.max(80, 1000 - (player.level * 90))) playerDrop();
            }
            draw();
        }
        requestAnimationFrame(update);
    }

    function togglePause() { 
        paused = !paused; 
        document.getElementById('pauseLabel').style.display = paused ? 'block' : 'none';
    }

    function updateUI() {
        document.getElementById('score').innerText = player.score;
        document.getElementById('level').innerText = player.level;
        document.getElementById('highscore').innerText = highScore;
        document.getElementById('highscore_overlay').innerText = highScore;
    }

    function startGame() {
        player.level = parseInt(document.getElementById('startLevel').value) || 0;
        player.score = 0; player.lines = player.level * 10;
        arena.forEach(row => row.fill(0));
        document.getElementById('overlay').style.display = 'none';
        paused = false; playerReset(); update();
    }

    // MATRIX BG
    const bg = document.getElementById('matrix-bg');
    const bctx = bg.getContext('2d');
    function res() { bg.width = window.innerWidth; bg.height = window.innerHeight; }
    window.onresize = res; res();
    const drops = new Array(Math.floor(bg.width / 20)).fill(1);
    function drawBG() {
        bctx.fillStyle = 'rgba(0,0,0,0.1)';
        bctx.fillRect(0,0,bg.width,bg.height);
        bctx.fillStyle = '#0f0';
        for(let i=0; i<drops.length; i++) {
            bctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i*20, drops[i]*20);
            if(drops[i]*20 > bg.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    setInterval(drawBG, 60);

    document.addEventListener('keydown', e => {
        if(e.keyCode===37) playerMove(-1);
        if(e.keyCode===39) playerMove(1);
        if(e.keyCode===40) playerDrop();
        if(e.keyCode===38) playerHardDrop();
        if(e.keyCode===32) playerRotate();
        if(e.keyCode===80) togglePause();
    });
