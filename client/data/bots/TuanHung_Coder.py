import sys
FILES = "abcdefghi"
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
def can_cap(a, d):
    A, D = a.upper(), d.upper()
    return (A=='R' and D=='S') or (A=='S' and D=='P') or (A=='P' and D=='R')
header = sys.stdin.readline().split()
if header:
    side = header[0]
    board = [sys.stdin.readline().split() for _ in range(9)]
    own = (8, 0) if side == "RED" else (0, 8)
    goal = (0, 8) if side == "RED" else (8, 0)
    best, best_s = None, -999999
    for r in range(9):
        for c in range(9):
            ch = board[r][c]
            if not ((side == "RED" and ch in "RPS") or (side == "BLUE" and ch in "rps")):
                continue
            for dr, dc in DIRS:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < 9 and 0 <= nc < 9) or (nr, nc) == own:
                    continue
                t = board[nr][nc]
                if t != "." and not (((side=="RED" and t in "rps") or (side=="BLUE" and t in "RPS")) and can_cap(ch, t)):
                    continue
                s = (abs(r - goal[0]) + abs(c - goal[1])) - (abs(nr - goal[0]) + abs(nc - goal[1]))
                s = s * 15 + (40 if t != "." else 0)
                if s > best_s:
                    best_s = s
                    best = f"{FILES[c]}{9-r} {FILES[nc]}{9-nr}"
    if best:
        print(best, flush=True)
