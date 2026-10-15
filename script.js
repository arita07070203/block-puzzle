const BOARD_SIZE = 10;

const board = document.getElementById("game-board");
const piecesArea = document.getElementById("pieces");
const scoreDisplay = document.getElementById("score");
const rotateButton = document.getElementById("rotate-button");
const soundToggle = document.getElementById("sound-toggle");

const gameOverScreen =
    document.getElementById("game-over");

const finalScore =
    document.getElementById("final-score");

const restartButton =
    document.getElementById("restart-button");


// =========================
// スコア
// =========================

let score = 0;


// =========================
// ゲーム状態
// =========================

let gameOver = false;


// =========================
// 盤面
// =========================

let boardData = Array.from(
    { length: BOARD_SIZE },
    () => Array(BOARD_SIZE).fill(false)
);

let lastClearedRows = [];
let lastClearedColumns = [];
let lastPlacedCells = [];
let lineEffectToken = 0;
let resolvingLines = false;
let soundContext = null;
let soundEnabled = true;


// =========================
// テトリスの7種類
// =========================

const SHAPES = [

    [[1, 1, 1, 1]],

    [
        [1, 1],
        [1, 1]
    ],

    [
        [0, 1, 0],
        [1, 1, 1]
    ],

    [
        [1, 0],
        [1, 0],
        [1, 1]
    ],

    [
        [0, 1],
        [0, 1],
        [1, 1]
    ],

    [
        [0, 1, 1],
        [1, 1, 0]
    ],

    [
        [1, 1, 0],
        [0, 1, 1]
    ]

];


// =========================
// 現在の3個
// =========================

let currentPieces = [];
let currentPieceRotations = [];


// 選択中のブロック
let selectedPiece = null;

// ドラッグ中の情報
let pendingDrag = null;
let dragPreview = null;
let suppressPieceClick = false;


// =========================
// スコア表示
// =========================

function updateScore(effect = "normal", clearedLines = 0) {

    const previousScore = Number(scoreDisplay.textContent) || 0;
    scoreDisplay.textContent = score;

    if (score > previousScore) {
        scoreDisplay.classList.remove("score-pulse");
        scoreDisplay.classList.remove("score-pulse-line");
        void scoreDisplay.offsetWidth;
        scoreDisplay.style.setProperty(
            "--score-pop-scale",
            effect === "line"
                ? (clearedLines >= 3 ? "1.42" : clearedLines === 2 ? "1.34" : "1.26")
                : "1.18"
        );
        scoreDisplay.classList.add(
            effect === "line" ? "score-pulse-line" : "score-pulse"
        );
    }

}

function playGameSound(clearedLines = 0) {
    if (!soundEnabled) return;

    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;

    try {
        if (!soundContext) soundContext = new AudioContextType();
        if (soundContext.state === "suspended") {
            soundContext.resume().catch(() => {});
        }

        const now = soundContext.currentTime;
        const notes = clearedLines > 0
            ? (clearedLines >= 3 ? [660, 880, 1100] : clearedLines === 2 ? [660, 880] : [740, 988])
            : [520];

        notes.forEach((frequency, index) => {
            const oscillator = soundContext.createOscillator();
            const volume = soundContext.createGain();
            const startAt = now + index * 0.035;
            const peak = clearedLines > 0 ? 0.035 : 0.018;

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, startAt);
            volume.gain.setValueAtTime(0.0001, startAt);
            volume.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
            volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
            oscillator.connect(volume);
            volume.connect(soundContext.destination);
            oscillator.start(startAt);
            oscillator.stop(startAt + 0.13);
        });
    } catch {
        // サウンド非対応の環境ではゲームをそのまま続ける
    }
}

function updateSoundButton() {
    soundToggle.textContent = soundEnabled ? "🔊" : "🔇";
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.setAttribute(
        "aria-label",
        soundEnabled ? "効果音をオフにする" : "効果音をオンにする"
    );
}

function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    updateSoundButton();

    try {
        localStorage.setItem("blockPuzzleSoundEnabled", String(soundEnabled));
    } catch {
        // 保存できない環境でも、現在のページ内では切り替えを有効にする
    }

    if (!soundEnabled && soundContext && soundContext.state === "running") {
        soundContext.suspend().catch(() => {});
    }
}

function initializeSoundToggle() {
    try {
        const savedSetting = localStorage.getItem("blockPuzzleSoundEnabled");
        if (savedSetting === "true" || savedSetting === "false") {
            soundEnabled = savedSetting === "true";
        }
    } catch {
        soundEnabled = true;
    }

    updateSoundButton();
    soundToggle.addEventListener("click", () => {
        setSoundEnabled(!soundEnabled);
    });
}


// =========================
// 新しい3個を作る
// =========================

function generatePieces() {

    currentPieces = [];
    currentPieceRotations = [0, 0, 0];

    for (let i = 0; i < 3; i++) {

        const randomIndex =
            Math.floor(
                Math.random() * SHAPES.length
            );

        currentPieces.push(randomIndex);

    }

    selectedPiece = null;

    drawPieces(true);

}

// =========================
// ブロックの回転
// =========================

function rotateMatrixClockwise(shape) {
    return shape[0].map((_, column) =>
        shape.map(row => row[column]).reverse()
    );
}

function getRotatedShape(shapeIndex, turns) {
    let shape = SHAPES[shapeIndex];

    for (let i = 0; i < turns; i++) {
        shape = rotateMatrixClockwise(shape);
    }

    return shape;
}

function updateRotateButton() {
    rotateButton.disabled =
        gameOver ||
        !currentPieces.some(
            shapeIndex => shapeIndex !== null && shapeIndex !== undefined
        );
}

function rotateAvailablePieces() {
    if (gameOver || resolvingLines) {
        return;
    }

    currentPieces.forEach((shapeIndex, pieceNumber) => {
        if (shapeIndex === null || shapeIndex === undefined) {
            return;
        }

        currentPieceRotations[pieceNumber] =
            (currentPieceRotations[pieceNumber] + 1) % 4;
    });

    drawPieces(false, true);
}


// =========================
// 盤面を描画
// =========================

function drawBoard() {

    const effectToken = ++lineEffectToken;
    board.classList.remove("line-clear-shake");
    board.innerHTML = "";

    for (
        let y = 0;
        y < BOARD_SIZE;
        y++
    ) {

        for (
            let x = 0;
            x < BOARD_SIZE;
            x++
        ) {

            const cell =
                document.createElement("div");

            cell.classList.add("cell");


            if (boardData[y][x]) {

                cell.classList.add("filled");
                cell.classList.add(`piece-color-${boardData[y][x] - 1}`);

            }

            if (
                lastClearedRows.includes(y) ||
                lastClearedColumns.includes(x)
            ) {
                cell.classList.add("line-clear-flash");

                const delaySteps = [];
                if (lastClearedRows.includes(y)) delaySteps.push(x);
                if (lastClearedColumns.includes(x)) delaySteps.push(y);
                cell.style.setProperty(
                    "--line-delay",
                    `${Math.min(...delaySteps) * 9}ms`
                );
            }

            if (
                lastPlacedCells.some(position => position.x === x && position.y === y) &&
                !lastClearedRows.includes(y) &&
                !lastClearedColumns.includes(x)
            ) {
                cell.classList.add("block-pop");
            }


            cell.addEventListener(
                "click",
                () => {

                    if (
                        selectedPiece !== null &&
                        !gameOver && !resolvingLines
                    ) {

                        placePiece(
                            selectedPiece,
                            x,
                            y
                        );

                    }

                }
            );


            board.appendChild(cell);

        }

    }

    lastClearedRows = [];
    lastClearedColumns = [];
    lastPlacedCells = [];

    const lineCount = Number(board.dataset.pendingClearCount || 0);
    delete board.dataset.pendingClearCount;

    if (lineCount > 0) {
        const shakeDistance = Math.min(lineCount, 4);
        board.style.setProperty("--shake-distance", `${shakeDistance}px`);
        board.style.setProperty("--shake-negative", `${-shakeDistance}px`);
        board.style.setProperty("--shake-recoil", `${-shakeDistance * 0.45}px`);
        board.style.setProperty(
            "--burst-scale",
            lineCount >= 3 ? "0.12" : lineCount === 2 ? "0.18" : "0.24"
        );
        board.style.setProperty(
            "--clear-brightness",
            lineCount >= 3 ? "2.1" : lineCount === 2 ? "1.8" : "1.55"
        );
        board.style.setProperty(
            "--clear-opacity",
            lineCount >= 3 ? "1" : lineCount === 2 ? "0.92" : "0.82"
        );
        board.classList.add("line-clear-shake");

        window.setTimeout(() => {
            if (effectToken !== lineEffectToken) return;
            board.querySelectorAll(".line-clear-flash").forEach(cell => {
                cell.classList.remove("line-clear-flash");
            });
            board.classList.remove("line-clear-shake");
        }, 500);
    }

}


// =========================
// ブロックを描画
// =========================

function drawPieces(animateSpawn = false, animateRotation = false) {

    piecesArea.innerHTML = "";

    currentPieces.forEach(
        (shapeIndex, pieceNumber) => {

            if (shapeIndex === null) {

                return;

            }


            const shape = getRotatedShape(
                shapeIndex,
                currentPieceRotations[pieceNumber] || 0
            );


            const piece =
                document.createElement("div");

            piece.classList.add("piece");
            piece.classList.add(`piece-color-${shapeIndex}`);
            piece.dataset.pieceNumber = pieceNumber;

            if (animateSpawn) {
                piece.classList.add("piece-pop-in");
                piece.style.animationDelay = `${pieceNumber * 65}ms`;
            } else if (animateRotation) {
                piece.classList.add("piece-rotate-in");
            }

            if (selectedPiece === pieceNumber) {
                piece.classList.add("selected");
            }

            piece.addEventListener(
                "pointerdown",
                (event) => {
                    if (gameOver || resolvingLines || event.button > 0) {
                        return;
                    }

                    pendingDrag = {
                        pieceNumber,
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        dragging: false
                    };
                }
            );


            piece.style.gridTemplateColumns =
                `repeat(
                    ${shape[0].length},
                    25px
                )`;


            for (
                let y = 0;
                y < shape.length;
                y++
            ) {

                for (
                    let x = 0;
                    x < shape[y].length;
                    x++
                ) {

                    const block =
                        document.createElement("div");


                    if (
                        shape[y][x] === 1
                    ) {

                        block.classList.add("block");

                    }


                    piece.appendChild(block);

                }

            }


            piece.addEventListener(
                "click",
                () => {

                    if (gameOver || resolvingLines) {
                        return;
                    }

                    if (suppressPieceClick) {
                        suppressPieceClick = false;
                        return;
                    }


                    selectedPiece =
                        pieceNumber;


                    document
                        .querySelectorAll(".piece")
                        .forEach(
                            p =>
                                p.classList.remove(
                                    "selected"
                                )
                        );


                    piece.classList.add(
                        "selected"
                    );

                    updateRotateButton();

                }
            );


            piecesArea.appendChild(piece);

        }
    );

    updateRotateButton();

}

// =========================
// ドラッグ操作
// =========================

function getPlacementStartAt(pieceNumber, clientX, clientY) {
    const boardRect = board.getBoundingClientRect();
    if (
        clientX < boardRect.left ||
        clientX > boardRect.right ||
        clientY < boardRect.top ||
        clientY > boardRect.bottom
    ) {
        return null;
    }

    const cells = board.children;
    const first = cells[0]?.getBoundingClientRect();
    const nextColumn = cells[1]?.getBoundingClientRect();
    const nextRow = cells[BOARD_SIZE]?.getBoundingClientRect();

    if (!first || !nextColumn || !nextRow) {
        return null;
    }

    const centerX = first.left + first.width / 2;
    const centerY = first.top + first.height / 2;
    const stepX = nextColumn.left + nextColumn.width / 2 - centerX;
    const stepY = nextRow.top + nextRow.height / 2 - centerY;

    const shape = getRotatedShape(
        currentPieces[pieceNumber],
        currentPieceRotations[pieceNumber] || 0
    );

    return {
        x: Math.round((clientX - centerX) / stepX - (shape[0].length - 1) / 2),
        y: Math.round((clientY - centerY) / stepY - (shape.length - 1) / 2)
    };
}

function clearDragPreview() {
    if (dragPreview) {
        dragPreview.remove();
        dragPreview = null;
    }

    board.querySelectorAll(".drag-target").forEach(cell => {
        cell.classList.remove("drag-target", "drag-invalid");
        Array.from(cell.classList)
            .filter(className => className.startsWith("preview-color-"))
            .forEach(className => cell.classList.remove(className));
    });
}

function updateDragPreview(event) {
    const drag = pendingDrag;
    if (!drag || !drag.dragging) {
        return;
    }

    if (!dragPreview) {
        dragPreview = document.createElement("div");
        dragPreview.className = "drag-piece-preview";
        document.body.appendChild(dragPreview);
    }

    const shapeIndex = currentPieces[drag.pieceNumber];
    const shape = getRotatedShape(
        shapeIndex,
        currentPieceRotations[drag.pieceNumber] || 0
    );
    dragPreview.classList.add(`piece-color-${shapeIndex}`);
    dragPreview.style.gridTemplateColumns = `repeat(${shape[0].length}, 25px)`;
    dragPreview.innerHTML = "";

    shape.forEach(row => row.forEach(value => {
        const block = document.createElement("div");
        if (value === 1) block.className = "block";
        dragPreview.appendChild(block);
    }));

    dragPreview.style.left = `${event.clientX}px`;
    dragPreview.style.top = `${event.clientY}px`;

    board.querySelectorAll(".drag-target").forEach(cell => {
        cell.classList.remove("drag-target", "drag-invalid");
        Array.from(cell.classList)
            .filter(className => className.startsWith("preview-color-"))
            .forEach(className => cell.classList.remove(className));
    });

    const placement = getPlacementStartAt(
        drag.pieceNumber,
        event.clientX,
        event.clientY
    );
    if (!placement) return;

    const { x: startX, y: startY } = placement;
    const valid = canPlacePiece(drag.pieceNumber, startX, startY);

    shape.forEach((row, y) => row.forEach((value, x) => {
        if (value !== 1) return;
        const boardX = startX + x;
        const boardY = startY + y;
        if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) return;

        const target = board.children[boardY * BOARD_SIZE + boardX];
        target.classList.add("drag-target");
        target.classList.add(`preview-color-${shapeIndex}`);
        if (!valid) target.classList.add("drag-invalid");
    }));
}

window.addEventListener("pointermove", event => {
    if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;

    const distance = Math.hypot(
        event.clientX - pendingDrag.startX,
        event.clientY - pendingDrag.startY
    );

    if (!pendingDrag.dragging && distance >= 6) {
        pendingDrag.dragging = true;
        event.preventDefault();
    }

    if (pendingDrag.dragging) {
        event.preventDefault();
        updateDragPreview(event);
    }
}, { passive: false });

window.addEventListener("pointerup", event => {
    if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;

    const drag = pendingDrag;
    pendingDrag = null;

    if (drag.dragging) {
        const placement = getPlacementStartAt(
            drag.pieceNumber,
            event.clientX,
            event.clientY
        );
        clearDragPreview();
        suppressPieceClick = true;

        if (placement && !gameOver && !resolvingLines) {
            placePiece(
                drag.pieceNumber,
                placement.x,
                placement.y
            );
        }

        window.setTimeout(() => {
            suppressPieceClick = false;
        }, 0);
    }
});

window.addEventListener("pointercancel", () => {
    pendingDrag = null;
    clearDragPreview();
});


// =========================
// このブロックを置けるか
// =========================

function canPlacePiece(
    pieceNumber,
    startX,
    startY
) {

    const shapeIndex =
        currentPieces[pieceNumber];


    if (
        shapeIndex === null ||
        shapeIndex === undefined
    ) {

        return false;

    }


    const shape = getRotatedShape(
        shapeIndex,
        currentPieceRotations[pieceNumber] || 0
    );


    for (
        let y = 0;
        y < shape.length;
        y++
    ) {

        for (
            let x = 0;
            x < shape[y].length;
            x++
        ) {

            if (
                shape[y][x] === 0
            ) {

                continue;

            }


            const boardX =
                startX + x;

            const boardY =
                startY + y;


            // 盤面の外

            if (
                boardX < 0 ||
                boardX >= BOARD_SIZE ||
                boardY < 0 ||
                boardY >= BOARD_SIZE
            ) {

                return false;

            }


            // すでにブロックがある

            if (
                boardData[boardY][boardX]
            ) {

                return false;

            }

        }

    }


    return true;

}


// =========================
// ブロックを置く
// =========================

function placePiece(pieceNumber, startX, startY) {

    if (gameOver || resolvingLines) {
        return;
    }


    const shapeIndex =
        currentPieces[pieceNumber];


    if (
        shapeIndex === null ||
        shapeIndex === undefined
    ) {

        return;

    }


    const shape = getRotatedShape(
        shapeIndex,
        currentPieceRotations[pieceNumber] || 0
    );


    // =========================
    // 置けるか確認
    // =========================

    if (
        !canPlacePiece(
            pieceNumber,
            startX,
            startY
        )
    ) {

        return;

    }

    // =========================
    // ブロックを配置
    // =========================

    let placedBlocks = 0;


    for (
        let y = 0;
        y < shape.length;
        y++
    ) {

        for (
            let x = 0;
            x < shape[y].length;
            x++
        ) {

            if (
                shape[y][x] === 1
            ) {

                boardData[
                    startY + y
                ][
                    startX + x
                ] = shapeIndex + 1;

                lastPlacedCells.push({
                    x: startX + x,
                    y: startY + y
                });

                placedBlocks++;

            }

        }

    }


    // =========================
    // スコア
    // =========================

    score +=
        placedBlocks * 10;


    updateScore();


    // 使用済みにする

    currentPieces[pieceNumber] =
        null;

    selectedPiece = null;


    resolvingLines = true;
    resolveLineCascades();

}


// =========================
// ライン消去
// =========================

function findCompletedLines() {
    const rows = [];
    const columns = [];

    for (let y = 0; y < BOARD_SIZE; y++) {
        if (boardData[y].every(Boolean)) rows.push(y);
    }

    for (let x = 0; x < BOARD_SIZE; x++) {
        if (boardData.every(row => Boolean(row[x]))) columns.push(x);
    }

    return { rows, columns };
}

function resolveLineCascades(totalClearedLines = 0) {
    const { rows, columns } = findCompletedLines();
    const linesThisPass = rows.length + columns.length;

    if (linesThisPass === 0) {
        resolvingLines = false;

        if (totalClearedLines > 0) {
            score += totalClearedLines * 100;
            updateScore("line", totalClearedLines);
        }

        playGameSound(totalClearedLines);
        drawBoard();
        drawPieces();

        if (
            currentPieces[0] === null &&
            currentPieces[1] === null &&
            currentPieces[2] === null
        ) {
            generatePieces();
        }

        checkGameOver();
        return;
    }

    // まず該当ラインだけを光らせ、盤面データは演出終了まで残す。
    lastClearedRows = rows;
    lastClearedColumns = columns;
    board.dataset.pendingClearCount = String(linesThisPass);
    drawBoard();

    // 最長のライン演出が終わってから対象だけを消し、列ごとに下詰めする。
    window.setTimeout(() => {
        rows.forEach(y => {
            for (let x = 0; x < BOARD_SIZE; x++) boardData[y][x] = false;
        });
        columns.forEach(x => {
            for (let y = 0; y < BOARD_SIZE; y++) boardData[y][x] = false;
        });

        applyColumnGravity();
        resolveLineCascades(totalClearedLines + linesThisPass);
    }, 430);
}

// ライン消去後だけ、各列のブロックを形状に関係なく下へ詰める。
function applyColumnGravity() {
    for (let x = 0; x < BOARD_SIZE; x++) {
        const blocks = [];

        for (let y = BOARD_SIZE - 1; y >= 0; y--) {
            if (boardData[y][x]) {
                blocks.push(boardData[y][x]);
            }
        }

        for (let y = BOARD_SIZE - 1; y >= 0; y--) {
            boardData[y][x] = blocks[BOARD_SIZE - 1 - y] || false;
        }
    }
}


// =========================
// ゲームオーバー判定
// =========================

function checkGameOver() {

    // 3個のうち1個でも
    // 置ける場所があればゲーム続行

    for (
        let pieceNumber = 0;
        pieceNumber < 3;
        pieceNumber++
    ) {

        if (
            currentPieces[pieceNumber] === null
        ) {

            continue;

        }


        if (
            hasAnyPlaceForPiece(
                pieceNumber
            )
        ) {

            return;

        }

    }


    // どのブロックも置けない
    endGame();

}


// =========================
// 盤面のどこかに置けるか
// =========================

function hasAnyPlaceForPiece(
    pieceNumber
) {

    const shapeIndex =
        currentPieces[pieceNumber];


    if (
        shapeIndex === null ||
        shapeIndex === undefined
    ) {

        return false;

    }


    for (
        let y = 0;
        y < BOARD_SIZE;
        y++
    ) {

        for (
            let x = 0;
            x < BOARD_SIZE;
            x++
        ) {

            if (
                canPlacePiece(
                    pieceNumber,
                    x,
                    y
                )
            ) {

                return true;

            }

        }

    }


    return false;

}


// =========================
// ゲームオーバー
// =========================

function endGame() {

    gameOver = true;

    selectedPiece = null;
    updateRotateButton();


    finalScore.textContent =
        score;


    board.classList.add("game-over-dark");

    window.setTimeout(() => {
        if (!gameOver) return;
        gameOverScreen.classList.remove("hidden");
        gameOverScreen.classList.add("game-over-show");
    }, 90);

}


// =========================
// ゲームを最初からやり直す
// =========================

function restartGame() {

    score = 0;

    gameOver = false;

    selectedPiece = null;
    board.classList.remove("game-over-dark");
    gameOverScreen.classList.remove("game-over-show");


    boardData = Array.from(
        { length: BOARD_SIZE },
        () => Array(BOARD_SIZE).fill(false)
    );


    updateScore();


    gameOverScreen.classList.add(
        "hidden"
    );


    drawBoard();

    generatePieces();

}


// =========================
// リスタートボタン
// =========================

restartButton.addEventListener(
    "click",
    restartGame
);

rotateButton.addEventListener(
    "click",
    rotateAvailablePieces
);


// =========================
// ゲーム開始
// =========================

initializeSoundToggle();
updateScore();

drawBoard();

generatePieces();
