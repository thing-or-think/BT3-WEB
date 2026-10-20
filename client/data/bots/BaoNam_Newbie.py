import sys
FILES = "abcdefghi"
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
header = sys.stdin.readline().split()
if header:
    side = header[0]
    board = [sys.stdin.readline().split() for _ in range(9)]
    own_base = (8, 0) if side == "RED" else (0, 8)
    for r in range(8, -1, -1):
        for c in range(9):
            ch = board[r][c]
            if (side == "RED" and ch in "RPS") or (side == "BLUE" and ch in "rps"):
                for dr, dc in DIRS:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < 9 and 0 <= nc < 9 and (nr, nc) != own_base and board[nr][nc] == ".":
                        print(f"{FILES[c]}{9-r} {FILES[nc]}{9-nr}", flush=True)
                        sys.exit(0)
