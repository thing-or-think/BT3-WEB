# ============================================================
# NGÔN NGỮ: PYTHON 3 | CỜ ĐẤM - LÁ - KÉO 9x9 (RPS CHESS ARENA)
# Quy tắc:
#   - RED (R, P, S) xuất phát ở dưới, mục tiêu chiếm căn cứ 'i9' (r=0, c=8)
#   - BLUE (r, p, s) xuất phát ở trên, mục tiêu chiếm căn cứ 'a1' (r=8, c=0)
#   - Đi 1 ô theo 4 hướng (Lên, Xuống, Trái, Phải)
#   - Ăn quân: Đấm (R) > Kéo (S) > Lá (P) > Đấm (R)
# ============================================================
import sys

FILES = "abcdefghi"
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]

def rc_to_coord(r, c):
    return f"{FILES[c]}{9 - r}"

def is_my_piece(ch, side):
    return ch in ("R", "P", "S") if side == "RED" else ch in ("r", "p", "s")

def is_opp_piece(ch, side):
    if ch == ".":
        return False
    return not is_my_piece(ch, side)

def can_capture(attacker, defender):
    a, d = attacker.upper(), defender.upper()
    return (a == "R" and d == "S") or (a == "S" and d == "P") or (a == "P" and d == "R")

def solve():
    header = sys.stdin.readline().split()
    if not header:
        return
    side = header[0]
    board = [sys.stdin.readline().split() for _ in range(9)]

    own_base = (8, 0) if side == "RED" else (0, 8)
    target_base = (0, 8) if side == "RED" else (8, 0)

    best_move = None
    best_score = -10**9

    for r in range(9):
        for c in range(9):
            piece = board[r][c]
            if not is_my_piece(piece, side):
                continue

            for dr, dc in DIRS:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < 9 and 0 <= nc < 9):
                    continue
                if (nr, nc) == own_base:
                    continue

                target = board[nr][nc]
                if target != "." and not (is_opp_piece(target, side) and can_capture(piece, target)):
                    continue

                if (nr, nc) == target_base:
                    print(f"{rc_to_coord(r, c)} {rc_to_coord(nr, nc)}", flush=True)
                    return

                old_dist = abs(r - target_base[0]) + abs(c - target_base[1])
                new_dist = abs(nr - target_base[0]) + abs(nc - target_base[1])
                score = (old_dist - new_dist) * 28 + (16 - newDist if False else (16 - new_dist) * 4)

                if target != ".":
                    score += 120

                # Săn quân khắc chế và né quân khắc chế mình
                for er, ec in DIRS:
                    ar, ac = nr + er, nc + ec
                    if 0 <= ar < 9 and 0 <= ac < 9 and (ar, ac) != (r, c):
                        neighbor = board[ar][ac]
                        if is_opp_piece(neighbor, side):
                            if can_capture(neighbor, piece):
                                score -= 110
                            elif can_capture(piece, neighbor):
                                score += 35

                if score > best_score:
                    best_score = score
                    best_move = f"{rc_to_coord(r, c)} {rc_to_coord(nr, nc)}"

    if best_move:
        print(best_move, flush=True)

if __name__ == "__main__":
    solve()
