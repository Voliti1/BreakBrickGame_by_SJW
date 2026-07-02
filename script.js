// ==========================================
// 1. 게임 실행을 위한 기본 캔버스 및 DOM 객체 가져오기
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 신규 메인 메뉴 및 일시정지 오버레이 엘리먼트
const mainMenuOverlay = document.getElementById('mainMenuOverlay');
const pauseMenuOverlay = document.getElementById('pauseMenuOverlay');
const gameEndOverlay = document.getElementById('gameEndOverlay');
const settingsMenuOverlay = document.getElementById('settingsMenuOverlay');
const btnStart = document.getElementById('btnStart');
const btnSettings = document.getElementById('btnSettings');
const btnBackToMenu = document.getElementById('btnBackToMenu');
const btnContinue = document.getElementById('btnContinue');
const btnRestart = document.getElementById('btnRestart');
const btnEndToMenu = document.getElementById('btnEndToMenu');
const btnSettingsToMenu = document.getElementById('btnSettingsToMenu');
const volumeSlider = document.getElementById('volumeSlider');
const gameContainer = document.getElementById('gameContainer');

// 볼륨 기본값 (0.0 ~ 1.0)
let masterVolume = 0.5;

// 모바일 여부 감지 (터치 기기 또는 좁은 화면)
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;

// ==========================================
// 반응형 스케일 조정 함수
// .container(820px wide, ~750px tall 기준)를 뷰포트에 맞게 비율 축소/확대
// ==========================================
const CONTAINER_W = 820; // container의 고정 논리 너비
const CONTAINER_H = 750; // container의 고정 논리 높이 (캔버스 600 + h1 + bottom-area 등 포함)

function applyScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 너비와 높이 비율 중 더 작은 쪽으로 맞춤 (가로 세로 동시에 들어오도록)
    const scaleX = vw / CONTAINER_W;
    const scaleY = vh / CONTAINER_H;
    const scale = Math.min(scaleX, scaleY, 1); // 1 이상으로는 확대하지 않음 (데스크탑 원본 유지)

    gameContainer.style.transform = `scale(${scale})`;
    gameContainer.style.transformOrigin = 'top center';

    if (scale >= 1) {
        // PC: 스케일 없이 원본 크기 → 상단 소량 여백만 부여
        gameContainer.style.marginTop = '8px';
    } else {
        // 모바일: 스케일 적용 → 스케일된 높이 기준으로 수직 중앙 정렬
        const scaledH = CONTAINER_H * scale;
        const topOffset = Math.max(0, (vh - scaledH) / 2);
        gameContainer.style.marginTop = `${topOffset}px`;
    }
}


// 초기 실행 및 창 크기 변경 시 재실행
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', () => {
    // orientationchange 후 실제 크기가 업데이트되는 데 약간의 지연이 있음
    setTimeout(applyScale, 200);
});
applyScale();

// ==========================================
// 2. 스테이지별 스펙(난이도 및 환경) 설정 데이터
// ==========================================
const stages = {
    1: { rows: 5, cols: 10, speed: 5.65, unbreakableRatio: 0.00, itemRatio: 0.15, scorePerBrick: 10 },
    2: { rows: 6, cols: 10, speed: 7.65, unbreakableRatio: 0.00, itemRatio: 0.15, scorePerBrick: 15 },
    3: { rows: 6, cols: 10, speed: 7.65, unbreakableRatio: 0.10, itemRatio: 0.15, scorePerBrick: 20 },
    4: { rows: 6, cols: 10, speed: 9.65, unbreakableRatio: 0.20, itemRatio: 0.15, scorePerBrick: 25 },
    5: { rows: 6, cols: 10, speed: 9.65, unbreakableRatio: 0.30, itemRatio: 0.15, scorePerBrick: 30 }
};

// ==========================================
// 3. 게임 사물 데이터 모델 설정
// ==========================================

// [패들(Paddle) 설정]
const paddle = {
    width: 100,
    height: 12,
    x: (800 - 100) / 2,
    y: 560,
    color: '#E8A33D',
    speed: 8
};

// [공(Ball) 설정]
const ball = {
    radius: 8,
    x: 0,
    y: 0,
    dx: 4,
    dy: -4,
    color: '#FFFFFF'
};

// [벽돌(Bricks) 공통 규격]
const brickWidth = 68;
const brickHeight = 22;
const brickPadding = 4;
const brickOffsetTop = 60;

const brickColors = [
    '#E05A4E', // 빨강
    '#E8A33D', // 주황
    '#FFD966', // 노랑
    '#2E9E5B', // 초록
    '#00AEEF'  // 파랑
];

let bricks = [];
let items = [];

// ==========================================
// 4. 사운드(효과음) 재생용 Web Audio API 설정
// ==========================================
let audioCtx = null;

function playBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.12 * masterVolume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
        console.error(e);
    }
}

function playPowerUpSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.18);
        gainNode.gain.setValueAtTime(0.15 * masterVolume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {
        console.error(e);
    }
}

function playStageClearSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const now = audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);
            gainNode.gain.setValueAtTime(0.1 * masterVolume, now + idx * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.15);
        });
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 5. 게임 상태 관리 변수
// ==========================================
let score = 0;
let lives = 3;
let currentStage = 1;

// [로컬 저장소에서 최고기록 불러오기]
let highScore = parseInt(localStorage.getItem('brick_breaker_highscore')) || 0;

// [게임 진행 상태(gameState) 변수]
// - 'menu': 초기 대기 메뉴 화면
// - 'playing': 실시간 벽돌 게임 화면
// - 'settings': 간단한 환경 설정 화면
let gameState = 'menu';

let gameStarted = false;
let gameOver = false;
let gameWin = false;
let isPausedForReset = false;
let isStageClearing = false;

// 일시 정지 및 카운트다운 관리 변수
let isPaused = false;
let isCountingDown = false;
let countdownVal = 3;
let countdownInterval = null;

// 패들 버프 지속시간 타이머 (60프레임 = 1초)
let paddleTimerTicks = 0;

let leftPressed = false;
let rightPressed = false;

// ==========================================
// 6. 불사신(회색) 벽돌 배치 알고리즘 헬퍼 함수
// ==========================================
function countAdjacentUnbreakable(bricksArr, r, c) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let count = 0;
    const numRows = bricksArr.length;
    const numCols = bricksArr[0].length;
    
    for (let d = 0; d < dirs.length; d++) {
        const nr = r + dirs[d][0];
        const nc = c + dirs[d][1];
        if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
            if (bricksArr[nr][nc] && bricksArr[nr][nc].type === 'unbreakable') {
                count++;
            }
        }
    }
    return count;
}

function isPlacementValid(bricksArr, testR, testC) {
    const numRows = bricksArr.length;
    const numCols = bricksArr[0].length;
    
    const originalType = bricksArr[testR][testC].type;
    bricksArr[testR][testC].type = 'unbreakable';
    
    let valid = true;
    
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            if (bricksArr[r][c].type !== 'unbreakable') {
                if (countAdjacentUnbreakable(bricksArr, r, c) > 2) {
                    valid = false;
                    break;
                }
            }
        }
        if (!valid) break;
    }
    
    bricksArr[testR][testC].type = originalType;
    return valid;
}

// ==========================================
// 7. 초기화 및 리셋 로직
// ==========================================

// [스테이지별 벽돌 데이터 생성 함수]
function initBricks(stageNum) {
    const spec = stages[stageNum];
    bricks = [];
    items = [];
    
    const rows = spec.rows;
    const cols = spec.cols;
    
    const totalRowWidth = cols * brickWidth + (cols - 1) * brickPadding;
    const offsetLeft = (canvas.width - totalRowWidth) / 2;
    
    let placementSuccessful = false;
    let attempts = 0;
    
    const unbreakableCount = Math.round(rows * cols * spec.unbreakableRatio);
    const itemCount = Math.round(rows * cols * spec.itemRatio);
    
    while (!placementSuccessful && attempts < 1000) {
        attempts++;
        
        const tempBricks = [];
        for (let r = 0; r < rows; r++) {
            tempBricks[r] = [];
            for (let c = 0; c < cols; c++) {
                tempBricks[r][c] = {
                    x: c * (brickWidth + brickPadding) + offsetLeft,
                    y: r * (brickHeight + brickPadding) + brickOffsetTop,
                    status: 1,
                    type: 'normal',
                    color: brickColors[r % brickColors.length]
                };
            }
        }
        
        let placedUnbreakable = 0;
        let placeAttempts = 0;
        
        while (placedUnbreakable < unbreakableCount && placeAttempts < 500) {
            placeAttempts++;
            const randR = Math.floor(Math.random() * rows);
            const randC = Math.floor(Math.random() * cols);
            
            if (tempBricks[randR][randC].type === 'normal') {
                if (isPlacementValid(tempBricks, randR, randC)) {
                    tempBricks[randR][randC].type = 'unbreakable';
                    tempBricks[randR][randC].color = '#7F8C8D';
                    placedUnbreakable++;
                }
            }
        }
        
        if (placedUnbreakable === unbreakableCount) {
            let placedItem = 0;
            let itemAttempts = 0;
            
            while (placedItem < itemCount && itemAttempts < 500) {
                itemAttempts++;
                const randR = Math.floor(Math.random() * rows);
                const randC = Math.floor(Math.random() * cols);
                
                if (tempBricks[randR][randC].type === 'normal') {
                    tempBricks[randR][randC].type = 'item';
                    placedItem++;
                }
            }
            
            if (placedItem === itemCount) {
                bricks = tempBricks;
                placementSuccessful = true;
            }
        }
    }
}

// [공의 위치 및 속도 벡터 초기화]
function initBall() {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius;
    
    const spec = stages[currentStage];
    const startAngle = Math.PI / 4;
    // 모바일에서는 속도를 1 감소시켜 조작 편의성 향상
    const mobileSpeedOffset = isMobile ? -1 : 0;
    const actualSpeed = Math.max(1, spec.speed + mobileSpeedOffset);
    ball.dx = actualSpeed * Math.cos(startAngle);
    ball.dy = -actualSpeed * Math.sin(startAngle);
}

// 공이 죽었을 때 1초 딜레이 타이머
function triggerResetPause() {
    isPausedForReset = true;
    setTimeout(() => {
        isPausedForReset = false;
    }, 1000);
}

// [전체 게임 처음부터 리셋]
function resetGame() {
    score = 0;
    lives = 3;
    currentStage = 1;
    gameOver = false;
    gameWin = false;
    gameStarted = true;
    gameState = 'playing';
    isPaused = false;
    isCountingDown = false;
    paddleTimerTicks = 0;
    paddle.width = 100;
    
    mainMenuOverlay.style.display = 'none';
    pauseMenuOverlay.style.display = 'none';
    gameEndOverlay.style.display = 'none';
    settingsMenuOverlay.style.display = 'none';
    
    initBricks(1);
    initBall();
    triggerResetPause();
}

// [일시정지 복귀 카운트다운 함수 (3, 2, 1)]
function startCountdown() {
    isCountingDown = true;
    isPaused = true;
    countdownVal = 3;
    
    pauseMenuOverlay.style.display = 'none';
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        countdownVal--;
        if (countdownVal <= 0) {
            clearInterval(countdownInterval);
            isCountingDown = false;
            isPaused = false;
            pauseMenuOverlay.style.display = 'none';
        }
    }, 1000);
}

// [일시정지 토글 처리 함수]
function togglePause() {
    if (gameOver || gameWin || isStageClearing || isPausedForReset || !gameStarted) return;
    
    if (isPaused) {
        startCountdown();
    } else {
        isPaused = true;
        pauseMenuOverlay.style.display = 'block';
    }
}

// 초기 로드 시 대기 메뉴 가동
initBricks(1);
initBall();

// ==========================================
// 8. 메인 메뉴 버튼들 이벤트 리스너 바인딩
// ==========================================

// 1) [시작하기] 버튼 클릭 시 플레이 개시
btnStart.addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    resetGame();
});

// 2) [설정] 버튼 클릭 시 설정 화면으로 진입
btnSettings.addEventListener('click', () => {
    mainMenuOverlay.style.display = 'none';
    gameState = 'settings';
    settingsMenuOverlay.style.display = 'flex';
});

// 3) 일시정지 중 [메인 메뉴] 복귀 버튼 클릭 시
btnBackToMenu.addEventListener('click', () => {
    isPaused = false;
    isCountingDown = false;
    if (countdownInterval) clearInterval(countdownInterval);
    
    gameState = 'menu';
    gameStarted = false;
    
    pauseMenuOverlay.style.display = 'none';
    mainMenuOverlay.style.display = 'flex';
});

// 4) 일시정지 중 [계속하기] 버튼 클릭 시
btnContinue.addEventListener('click', () => {
    if (isPaused && !isCountingDown) {
        startCountdown();
    }
});

// 5) 게임 종료 후 [재시작] 버튼 클릭 시
btnRestart.addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    gameEndOverlay.style.display = 'none';
    resetGame();
});

// 6) 게임 종료 후 [메인 메뉴] 버튼 클릭 시
btnEndToMenu.addEventListener('click', () => {
    gameEndOverlay.style.display = 'none';
    gameState = 'menu';
    gameStarted = false;
    gameOver = false;
    gameWin = false;
    mainMenuOverlay.style.display = 'flex';
});

// 7) 설정 화면에서 [메인 메뉴] 버튼 클릭 시
btnSettingsToMenu.addEventListener('click', () => {
    settingsMenuOverlay.style.display = 'none';
    gameState = 'menu';
    mainMenuOverlay.style.display = 'flex';
});

// 8) 볼륨 슬라이더 입력 처리
volumeSlider.addEventListener('input', () => {
    masterVolume = parseFloat(volumeSlider.value);
});

// ==========================================
// 모바일 터치 지원: 터치 X 좌표로 패들 제어
// ==========================================
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState !== 'playing' || isPaused || isCountingDown || gameOver || gameWin) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, touchX - paddle.width / 2));
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState !== 'playing' || isPaused || isCountingDown || gameOver || gameWin) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, touchX - paddle.width / 2));
}, { passive: false });

// ==========================================
// 9. 키보드 감지 핸들러
// ==========================================
document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);

function keyDownHandler(e) {
    if (e.key === 'Escape' || e.code === 'Escape') {
        if (gameState === 'playing') {
            togglePause();
        }
        // 설정 화면에서 ESC는 무시 (메인메뉴 버튼 사용)
        e.preventDefault();
        return;
    }

    if (e.key === 'Right' || e.key === 'ArrowRight') {
        rightPressed = true;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        leftPressed = true;
    } else if (e.key === ' ' || e.code === 'Space') {
        if (gameState === 'menu') {
            // 메인메뉴에서 스페이스바로 시작
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            resetGame();
        }
        // 일시정지/게임종료는 버튼으로만 조작
        e.preventDefault();
    }
}

function keyUpHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight') {
        rightPressed = false;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        leftPressed = false;
    }
}

// 캔버스 마우스 클릭 감지 (생명 표시 우측 일시정지 사각형 버튼 클릭 처리)
canvas.addEventListener('click', (e) => {
    if (gameState !== 'playing') return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 일시정지 사각형 버튼 영역: x: 230 ~ 254, y: 8 ~ 32 (가로24, 세로24)
    if (mouseX >= 230 && mouseX <= 254 && mouseY >= 8 && mouseY <= 32) {
        togglePause();
    }
});

// ==========================================
// 10. 물리 연산 및 업데이트 로직 (Update)
// ==========================================

function collisionDetection() {
    for (let r = 0; r < bricks.length; r++) {
        for (let c = 0; c < bricks[r].length; c++) {
            const b = bricks[r][c];
            if (b.status === 1) {
                if (ball.x + ball.radius >= b.x &&
                    ball.x - ball.radius <= b.x + brickWidth &&
                    ball.y + ball.radius >= b.y &&
                    ball.y - ball.radius <= b.y + brickHeight) {
                    
                    if (b.type === 'unbreakable') {
                        playBeep();
                    } else {
                        b.status = 0;
                        score += stages[currentStage].scorePerBrick;
                        
                        // 최고점수 실시간 경신 체크 및 로컬 저장
                        if (score > highScore) {
                            highScore = score;
                            localStorage.setItem('brick_breaker_highscore', highScore);
                        }
                        
                        if (b.type === 'item') {
                            items.push({
                                x: b.x + brickWidth / 2,
                                y: b.y + brickHeight,
                                radius: 8,
                                speed: 3.5,
                                active: true
                            });
                        }
                        
                        playBeep();
                    }

                    const overlapX = Math.min(ball.x + ball.radius - b.x, b.x + brickWidth - (ball.x - ball.radius));
                    const overlapY = Math.min(ball.y + ball.radius - b.y, b.y + brickHeight - (ball.y - ball.radius));

                    if (overlapX < overlapY) {
                        ball.dx = -ball.dx;
                        if (ball.dx > 0) {
                            ball.x = b.x + brickWidth + ball.radius;
                        } else {
                            ball.x = b.x - ball.radius;
                        }
                    } else {
                        ball.dy = -ball.dy;
                        if (ball.dy > 0) {
                            ball.y = b.y + brickHeight + ball.radius;
                        } else {
                            ball.y = b.y - ball.radius;
                        }
                    }
                    return;
                }
            }
        }
    }
}

function checkWinCondition() {
    if (isStageClearing) return;
    
    let activeBreakableBricks = 0;
    for (let r = 0; r < bricks.length; r++) {
        for (let c = 0; c < bricks[r].length; c++) {
            const b = bricks[r][c];
            if (b.type !== 'unbreakable' && b.status === 1) {
                activeBreakableBricks++;
            }
        }
    }
    
    if (activeBreakableBricks === 0) {
        isStageClearing = true;
        playStageClearSound();
        
        setTimeout(() => {
            currentStage++;
            if (currentStage > 5) {
                gameWin = true;
            } else {
                initBricks(currentStage);
                initBall();
                isStageClearing = false;
                triggerResetPause();
            }
        }, 1500);
    }
}

function update() {
    if (gameState !== 'playing' || isPaused || isCountingDown) return;
    
    if (gameOver || gameWin || isPausedForReset || isStageClearing) return;

    if (paddleTimerTicks > 0) {
        paddleTimerTicks--;
        if (paddleTimerTicks === 0) {
            paddle.width = 100;
            if (paddle.x + paddle.width > canvas.width) {
                paddle.x = canvas.width - paddle.width;
            }
        }
    }

    if (leftPressed) {
        paddle.x -= paddle.speed;
        if (paddle.x < 0) {
            paddle.x = 0;
        }
    }
    if (rightPressed) {
        paddle.x += paddle.speed;
        if (paddle.x + paddle.width > canvas.width) {
            paddle.x = canvas.width - paddle.width;
        }
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.active) {
            item.y += item.speed;
            
            if (item.y + item.radius >= paddle.y &&
                item.y - item.radius <= paddle.y + paddle.height &&
                item.x >= paddle.x &&
                item.x <= paddle.x + paddle.width) {
                
                item.active = false;
                paddle.width = 120;
                paddleTimerTicks = 600; 
                playPowerUpSound();
            }
            
            if (item.y - item.radius > canvas.height) {
                item.active = false;
            }
        }
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x - ball.radius <= 0) {
        ball.dx = Math.abs(ball.dx);
        ball.x = ball.radius;
    }
    if (ball.x + ball.radius >= canvas.width) {
        ball.dx = -Math.abs(ball.dx);
        ball.x = canvas.width - ball.radius;
    }
    if (ball.y - ball.radius <= 0) {
        ball.dy = Math.abs(ball.dy);
        ball.y = ball.radius;
    }

    if (ball.dy > 0 &&
        ball.y + ball.radius >= paddle.y && 
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x && 
        ball.x <= paddle.x + paddle.width) {
        
        const paddleCenterX = paddle.x + paddle.width / 2;
        const relativeX = ball.x - paddleCenterX;
        const normalizedRelativeX = relativeX / (paddle.width / 2);
        
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        
        const maxAngle = Math.PI / 3;
        const hitAngle = normalizedRelativeX * maxAngle;
        
        ball.dx = speed * Math.sin(hitAngle);
        ball.dy = -speed * Math.cos(hitAngle);
        
        ball.y = paddle.y - ball.radius;
    }

    collisionDetection();
    checkWinCondition();

    if (ball.y - ball.radius > canvas.height) {
        lives--;
        if (lives <= 0) {
            gameOver = true;
            // 최고기록을 갱신했을 수 있으므로 게임 종료 시 재검증 저장
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('brick_breaker_highscore', highScore);
            }
        } else {
            paddle.x = (canvas.width - paddle.width) / 2;
            initBall();
            triggerResetPause();
        }
    }
}

// ==========================================
// 11. 그래픽 드로잉 렌더링 로직 (Draw)
// ==========================================

function drawBricks() {
    for (let r = 0; r < bricks.length; r++) {
        for (let c = 0; c < bricks[r].length; c++) {
            const b = bricks[r][c];
            if (b.status === 1) {
                const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + brickHeight);
                grad.addColorStop(0, b.color);
                grad.addColorStop(1, darkenColor(b.color, 25));
                ctx.fillStyle = grad;

                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(b.x, b.y, brickWidth, brickHeight, 4);
                } else {
                    ctx.rect(b.x, b.y, brickWidth, brickHeight);
                }
                ctx.fill();

                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.stroke();

                ctx.closePath();
            }
        }
    }
}

function darkenColor(hex, percent) {
    let num = parseInt(hex.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R<0?0:R>255?255:R)*0x10000 + (G<0?0:G>255?255:G)*0x100 + (B<0?0:B>255?255:B)).toString(16).slice(1);
}

function drawItems() {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.active) {
            ctx.fillStyle = '#FF3366';
            ctx.shadowColor = 'rgba(255, 51, 102, 0.8)';
            ctx.shadowBlur = 12;
            
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
            
            ctx.shadowBlur = 0;
        }
    }
}

// [점수판 수정: 점수 바로 밑에 최고기록 출력]
function drawScore() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top'; // top 기준으로 텍스트 높이 배치
    
    // 점수 : XX (y = 12)
    ctx.fillText('점수 : ' + score, 10, 12);
    
    // 최고기록 : XX (y = 34, 점수 밑에 표시)
    ctx.fillText('최고기록 : ' + highScore, 10, 34);
}

function drawStage() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Outfit", "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 4;
    ctx.fillText('STAGE ' + currentStage, canvas.width / 2, 25);
    ctx.shadowBlur = 0;
}

// [생명판 및 일시정지 사각형 버튼 위치 보정]
function drawLivesAndPauseButton() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // 생명 텍스트 드로잉 (x = 150, y = 12로 정렬 일치)
    ctx.fillText('생명 : ' + lives, 150, 12);
    
    // 일시정지 조종 버튼 사각형 드로잉 (x = 230, y = 8 ~ 32)
    ctx.fillStyle = '#1f1f2e';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(230, 8, 24, 24); 
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
    
    // 버튼 내 기호 렌더링
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const symbol = (isPaused && !isCountingDown) ? '||' : '▶';
    ctx.fillText(symbol, 242, 20); // y = 20 정중앙
}

function drawBuffTimer() {
    if (paddleTimerTicks > 0) {
        const secondsLeft = (paddleTimerTicks / 60).toFixed(1);
        ctx.fillStyle = '#FF9933';
        ctx.font = 'bold 14px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('패들 확장 버프 : ' + secondsLeft + '초', paddle.x + paddle.width / 2, paddle.y + 25);
    }
}

function drawSettingsScreen() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Outfit", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME SETTINGS', canvas.width / 2, 120);
    
    ctx.font = '18px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillStyle = '#8f8fbf';
    ctx.fillText('기본 환경 설정이 완비되었습니다.', canvas.width / 2, 220);
    ctx.fillText('스피드 밸런스: 단계별 가속 적용', canvas.width / 2, 265);
    ctx.fillText('패들 팽창률: 아이템 버프 1.2배 제한', canvas.width / 2, 310);
    
    // 볼륨 표시
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Malgun Gothic", "맑은 고딕", sans-serif';
    ctx.fillText('소리 크기 : ' + Math.round(masterVolume * 100) + '%', canvas.width / 2, 375);
}

function draw() {
    if (gameState === 'settings') {
        drawSettingsScreen();
        settingsMenuOverlay.style.display = 'flex';
        return;
    } else {
        settingsMenuOverlay.style.display = 'none';
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#7F7F7F';
    ctx.font = 'bold 56px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(127, 127, 127, 0.3)';
    ctx.shadowBlur = 15;
    ctx.fillText('Brick Breaker by SJW', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;

    drawScore();
    drawStage();
    drawLivesAndPauseButton(); 
    drawBuffTimer();

    drawBricks();
    drawItems();

    // 패들
    ctx.fillStyle = paddle.color;
    ctx.shadowColor = 'rgba(232, 163, 61, 0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 4);
    } else {
        ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // 공
    ctx.fillStyle = ball.color;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;

    if (!gameStarted && gameState !== 'menu') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#7F7F7F';
        ctx.font = 'bold 56px "Outfit", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(127, 127, 127, 0.3)';
        ctx.shadowBlur = 15;
        ctx.fillText('Brick Breaker by SJW', canvas.width / 2, canvas.height / 2 - 50);
        ctx.shadowBlur = 0;

        const isBlinking = Math.floor(Date.now() / 500) % 2 === 0;
        if (isBlinking) {
            ctx.fillStyle = '#FFFFFF';
        } else {
            ctx.fillStyle = '#8f8fbf';
        }
        ctx.font = 'bold 24px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.fillText('PRESS SPACE TO START', canvas.width / 2, canvas.height / 2 + 30);
    }

    if (isStageClearing) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#2E9E5B';
        ctx.font = 'bold 48px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(46, 158, 91, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText('STAGE ' + currentStage + ' CLEAR!', canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }

    if (gameStarted && !isStageClearing && (gameOver || gameWin)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (gameOver) {
            ctx.fillStyle = '#FF3366';
            ctx.font = 'bold 48px "Malgun Gothic", "맑은 고딕", sans-serif';
            ctx.shadowColor = 'rgba(255, 51, 102, 0.5)';
            ctx.shadowBlur = 15;
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 80);
        } else {
            ctx.fillStyle = '#2E9E5B';
            ctx.font = 'bold 48px "Malgun Gothic", "맑은 고딕", sans-serif';
            ctx.shadowColor = 'rgba(46, 158, 91, 0.5)';
            ctx.shadowBlur = 15;
            ctx.fillText('YOU WIN (ALL CLEAR)', canvas.width / 2, canvas.height / 2 - 80);
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.fillText('최종 점수 : ' + score, canvas.width / 2, canvas.height / 2 - 20);

        // 게임 종료 버튼 오버레이 표시
        gameEndOverlay.style.display = 'flex';
    } else if (!gameOver && !gameWin) {
        gameEndOverlay.style.display = 'none';
    }

    if (isPaused && !isCountingDown && gameState === 'playing') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#FF3366';
        ctx.font = 'bold 48px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.shadowColor = 'rgba(255, 51, 102, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText('PAUSE', canvas.width / 2, canvas.height / 2 - 90);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px "Malgun Gothic", "맑은 고딕", sans-serif';
        ctx.fillText('현재 점수 : ' + score, canvas.width / 2, canvas.height / 2 - 35);
        
        pauseMenuOverlay.style.display = 'flex';
    } else if (!isPaused) {
        pauseMenuOverlay.style.display = 'none';
    }

    if (isCountingDown && gameState === 'playing') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#FF9933';
        ctx.font = 'bold 80px "Outfit", "Segoe UI", sans-serif';
        ctx.shadowColor = 'rgba(255, 153, 51, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText(countdownVal, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }
}

// ==========================================
// 12. 게임 루프 및 치트 버튼 바인딩
// ==========================================
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 게임 루프 즉시 기동
requestAnimationFrame(gameLoop);

// 일시정지 버튼 바인딩
document.getElementById('pauseBtn').addEventListener('click', () => {
    togglePause();
});
