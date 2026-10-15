const BOARD_SIZE = 10;

const board = document.getElementById("game-board");
const piecesArea = document.getElementById("pieces");
const scoreDisplay = document.getElementById("score");

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


// 選択中のブロック
let selectedPiece = null;

// ドラッグ中の情報
let pendingDrag = null;
let dragPreview = null;
let suppressPieceClick = false;


// =========================
// スコア表示
// =========================

function updateScore() {

    scoreDisplay.textContent = score;

}


// =========================
// 新しい3個を作る
// =========================

function generatePieces() {

    currentPieces = [];

    for (let i = 0; i < 3; i++) {

        const randomIndex =
            Math.floor(
                Math.random() * SHAPES.length
            );

        currentPieces.push(randomIndex);

    }

    selectedPiece = null;

    drawPieces();

}


// =========================
// 盤面を描画
// =========================

function drawBoard() {

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

            }


            cell.addEventListener(
                "click",
                () => {

                    if (
                        selectedPiece !== null &&
                        !gameOver
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

}


// =========================
// ブロックを描画
// =========================

function drawPieces() {

    piecesArea.innerHTML = "";

    currentPieces.forEach(
        (shapeIndex, pieceNumber) => {

            if (shapeIndex === null) {

                return;

            }


            const shape =
                SHAPES[shapeIndex];


            const piece =
                document.createElement("div");

            piece.classList.add("piece");

            piece.addEventListener(
                "pointerdown",
                (event) => {
                    if (gameOver || event.button > 0) {
                        return;
                    }

                    const cellIndex =
                        Array.from(piece.children).indexOf(event.target);

                    pendingDrag = {
                        pieceNumber,
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        offsetX: cellIndex >= 0
                            ? cellIndex % shape[0].length
                            : 0,
                        offsetY: cellIndex >= 0
                            ? Math.floor(cellIndex / shape[0].length)
                            : 0,
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

                    if (gameOver) {
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

                }
            );


            piecesArea.appendChild(piece);

        }
    );

}

// =========================
// ドラッグ操作
// =========================

function getBoardCellAt(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element && element.closest
        ? element.closest("#game-board .cell")
        : null;

    if (!cell) {
        return null;
    }

    const index = Array.from(board.children).indexOf(cell);
    if (index < 0) {
        return null;
    }

    return {
        x: index % BOARD_SIZE,
        y: Math.floor(index / BOARD_SIZE)
    };
}

function clearDragPreview() {
    if (dragPreview) {
        dragPreview.remove();
        dragPreview = null;
    }

    board.querySelectorAll(".drag-target").forEach(cell => {
        cell.classList.remove("drag-target", "drag-invalid");
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

    const shape = SHAPES[currentPieces[drag.pieceNumber]];
    dragPreview.style.gridTemplateColumns = `repeat(${shape[0].length}, 25px)`;
    dragPreview.innerHTML = "";

    shape.forEach(row => row.forEach(value => {
        const block = document.createElement("div");
        if (value === 1) block.className = "block";
        dragPreview.appendChild(block);
    }));

    dragPreview.style.left = `${event.clientX + 12}px`;
    dragPreview.style.top = `${event.clientY - 60}px`;

    board.querySelectorAll(".drag-target").forEach(cell => {
        cell.classList.remove("drag-target", "drag-invalid");
    });

    const cell = getBoardCellAt(event.clientX, event.clientY);
    if (!cell) return;

    const startX = cell.x - drag.offsetX;
    const startY = cell.y - drag.offsetY;
    const valid = canPlacePiece(drag.pieceNumber, startX, startY);

    shape.forEach((row, y) => row.forEach((value, x) => {
        if (value !== 1) return;
        const boardX = startX + x;
        const boardY = startY + y;
        if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) return;

        const target = board.children[boardY * BOARD_SIZE + boardX];
        target.classList.add("drag-target");
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
        const cell = getBoardCellAt(event.clientX, event.clientY);
        clearDragPreview();
        suppressPieceClick = true;

        if (cell && !gameOver) {
            placePiece(
                drag.pieceNumber,
                cell.x - drag.offsetX,
                cell.y - drag.offsetY
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


    const shape =
        SHAPES[shapeIndex];


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

function placePiece(
    pieceNumber,
    startX,
    startY
) {

    if (gameOver) {
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


    const shape =
        SHAPES[shapeIndex];


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
                ] = true;


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


    // =========================
    // ライン消去
    // =========================

    const clearedLines =
        clearCompletedLines();


    if (clearedLines > 0) {

        score +=
            clearedLines * 100;

        updateScore();

    }


    // =========================
    // 画面更新
    // =========================

    drawBoard();

    drawPieces();


    // =========================
    // 3個全部使った
    // =========================

    if (
        currentPieces[0] === null &&
        currentPieces[1] === null &&
        currentPieces[2] === null
    ) {

        generatePieces();

    }


    // =========================
    // ゲームオーバー確認
    // =========================

    checkGameOver();

}


// =========================
// ライン消去
// =========================

function clearCompletedLines() {

    const rowsToClear = [];

    const columnsToClear = [];


    // 横

    for (
        let y = 0;
        y < BOARD_SIZE;
        y++
    ) {

        let complete = true;


        for (
            let x = 0;
            x < BOARD_SIZE;
            x++
        ) {

            if (
                !boardData[y][x]
            ) {

                complete = false;

                break;

            }

        }


        if (complete) {

            rowsToClear.push(y);

        }

    }


    // 縦

    for (
        let x = 0;
        x < BOARD_SIZE;
        x++
    ) {

        let complete = true;


        for (
            let y = 0;
            y < BOARD_SIZE;
            y++
        ) {

            if (
                !boardData[y][x]
            ) {

                complete = false;

                break;

            }

        }


        if (complete) {

            columnsToClear.push(x);

        }

    }


    // 横を消す

    for (
        const y of rowsToClear
    ) {

        for (
            let x = 0;
            x < BOARD_SIZE;
            x++
        ) {

            boardData[y][x] =
                false;

        }

    }


    // 縦を消す

    for (
        const x of columnsToClear
    ) {

        for (
            let y = 0;
            y < BOARD_SIZE;
            y++
        ) {

            boardData[y][x] =
                false;

        }

    }


    return (
        rowsToClear.length +
        columnsToClear.length
    );

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


    finalScore.textContent =
        score;


    gameOverScreen.classList.remove(
        "hidden"
    );

}


// =========================
// ゲームを最初からやり直す
// =========================

function restartGame() {

    score = 0;

    gameOver = false;

    selectedPiece = null;


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


// =========================
// ゲーム開始
// =========================

updateScore();

drawBoard();

generatePieces();
