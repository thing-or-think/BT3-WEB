import { SupportedLanguage } from '../types/GameTypes';

export const STARTER_TEMPLATES: Record<SupportedLanguage, string> = {
  python: `# ============================================================
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
`,

  cpp: `// ============================================================
// NGÔN NGỮ: C++ (G++ 17/20) | CỜ ĐẤM - LÁ - KÉO 9x9
// ============================================================
#include <iostream>
#include <vector>
#include <string>
#include <cmath>
#include <cctype>
using namespace std;

const int DR[4] = {-1, 1, 0, 0};
const int DC[4] = {0, 0, -1, 1};

bool isMyPiece(char ch, const string& side) {
    if (ch == '.') return false;
    return side == "RED" ? isupper(ch) : islower(ch);
}

bool isOppPiece(char ch, const string& side) {
    if (ch == '.') return false;
    return !isMyPiece(ch, side);
}

bool canCapture(char a, char d) {
    char A = toupper(a), D = toupper(d);
    return (A == 'R' && D == 'S') || (A == 'S' && D == 'P') || (A == 'P' && D == 'R');
}

string toCoord(int r, int c) {
    string s = "";
    s += char('a' + c);
    s += char('0' + (9 - r));
    return s;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string side;
    int turn, timeLimit;
    if (!(cin >> side >> turn >> timeLimit)) return 0;

    char board[9][9];
    for (int r = 0; r < 9; ++r)
        for (int c = 0; c < 9; ++c)
            cin >> board[r][c];

    int ownBaseR = (side == "RED") ? 8 : 0;
    int ownBaseC = (side == "RED") ? 0 : 8;
    int targetR  = (side == "RED") ? 0 : 8;
    int targetC  = (side == "RED") ? 8 : 0;

    string bestMove = "";
    int bestScore = -1e9;

    for (int r = 0; r < 9; ++r) {
        for (int c = 0; c < 9; ++c) {
            char p = board[r][c];
            if (!isMyPiece(p, side)) continue;

            for (int d = 0; d < 4; ++d) {
                int nr = r + DR[d], nc = c + DC[d];
                if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
                if (nr == ownBaseR && nc == ownBaseC) continue;

                char target = board[nr][nc];
                if (target != '.' && !(isOppPiece(target, side) && canCapture(p, target)))
                    continue;

                if (nr == targetR && nc == targetC) {
                    cout << toCoord(r, c) << " " << toCoord(nr, nc) << endl;
                    return 0;
                }

                int oldDist = abs(r - targetR) + abs(c - targetC);
                int newDist = abs(nr - targetR) + abs(nc - targetC);
                int score = (oldDist - newDist) * 28 + (16 - newDist) * 4;

                if (target != '.') score += 120;

                for (int ed = 0; ed < 4; ++ed) {
                    int ar = nr + DR[ed], ac = nc + DC[ed];
                    if (ar >= 0 && ar < 9 && ac >= 0 && ac < 9 && !(ar == r && ac == c)) {
                        char nb = board[ar][ac];
                        if (isOppPiece(nb, side)) {
                            if (canCapture(nb, p)) score -= 110;
                            else if (canCapture(p, nb)) score += 35;
                        }
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = toCoord(r, c) + " " + toCoord(nr, nc);
                }
            }
        }
    }

    if (!bestMove.empty()) {
        cout << bestMove << endl;
    }
    return 0;
}
`,

  java: `// ============================================================
// NGÔN NGỮ: JAVA (OpenJDK 17+) | CỜ ĐẤM - LÁ - KÉO 9x9
// ============================================================
import java.util.Scanner;

public class Main {
    static final int[] DR = {-1, 1, 0, 0};
    static final int[] DC = {0, 0, -1, 1};

    static boolean isMyPiece(char ch, String side) {
        if (ch == '.') return false;
        return side.equals("RED") ? Character.isUpperCase(ch) : Character.isLowerCase(ch);
    }

    static boolean isOppPiece(char ch, String side) {
        if (ch == '.') return false;
        return !isMyPiece(ch, side);
    }

    static boolean canCapture(char a, char d) {
        char A = Character.toUpperCase(a);
        char D = Character.toUpperCase(d);
        return (A == 'R' && D == 'S') || (A == 'S' && D == 'P') || (A == 'P' && D == 'R');
    }

    static String toCoord(int r, int c) {
        return "" + (char)('a' + c) + (9 - r);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNext()) return;
        String side = sc.next();
        int turn = sc.nextInt();
        int timeLimit = sc.nextInt();

        char[][] board = new char[9][9];
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                board[r][c] = sc.next().charAt(0);
            }
        }

        int ownBaseR = side.equals("RED") ? 8 : 0;
        int ownBaseC = side.equals("RED") ? 0 : 8;
        int targetR  = side.equals("RED") ? 0 : 8;
        int targetC  = side.equals("RED") ? 8 : 0;

        String bestMove = "";
        int bestScore = -1000000000;

        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                char p = board[r][c];
                if (!isMyPiece(p, side)) continue;

                for (int d = 0; d < 4; d++) {
                    int nr = r + DR[d], nc = c + DC[d];
                    if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
                    if (nr == ownBaseR && nc == ownBaseC) continue;

                    char target = board[nr][nc];
                    if (target != '.' && !(isOppPiece(target, side) && canCapture(p, target)))
                        continue;

                    if (nr == targetR && nc == targetC) {
                        System.out.println(toCoord(r, c) + " " + toCoord(nr, nc));
                        return;
                    }

                    int oldDist = Math.abs(r - targetR) + Math.abs(c - targetC);
                    int newDist = Math.abs(nr - targetR) + Math.abs(nc - targetC);
                    int score = (oldDist - newDist) * 28 + (16 - newDist) * 4;

                    if (target != '.') score += 120;

                    for (int ed = 0; ed < 4; ed++) {
                        int ar = nr + DR[ed], ac = nc + DC[ed];
                        if (ar >= 0 && ar < 9 && ac >= 0 && ac < 9 && !(ar == r && ac == c)) {
                            char nb = board[ar][ac];
                            if (isOppPiece(nb, side)) {
                                if (canCapture(nb, p)) score -= 110;
                                else if (canCapture(p, nb)) score += 35;
                            }
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = toCoord(r, c) + " " + toCoord(nr, nc);
                    }
                }
            }
        }

        if (!bestMove.isEmpty()) {
            System.out.println(bestMove);
        }
    }
}
`
};

/**
 * Code thực tế của 4 người chơi đang giữ hạng trên BXH Server (từ Hạng #1 xuống Hạng #4)
 * để khi người chơi mới Push Code lên sẽ đấu thực tế từ dưới lên (#4 -> #3 -> #2 -> #1)
 */
export const SEED_PLAYERS_CODE = {
  // Hạng #4 (Dễ vượt qua nhất): Chỉ tìm nước đi hợp lệ đầu tiên tiến lên
  rank4_passive_py: `import sys
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
`,

  // Hạng #3 (Trung bình): Đi tiến về căn cứ nhưng không biết né thiên địch
  rank3_rusher_py: `import sys
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
`,

  // Hạng #2 (Khá): Chiến thuật thận trọng, ưu tiên thủ nhà nên tiến chậm hơn
  rank2_defender_py: `import sys
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
                is_opp = (side=="RED" and t in "rps") or (side=="BLUE" and t in "RPS")
                if t != "." and not (is_opp and can_cap(ch, t)):
                    continue
                old_d = abs(r - goal[0]) + abs(c - goal[1])
                new_d = abs(nr - goal[0]) + abs(nc - goal[1])
                s = (old_d - new_d) * 20 + (90 if t != "." else 0)
                for er, ec in DIRS:
                    ar, ac = nr + er, nc + ec
                    if 0 <= ar < 9 and 0 <= ac < 9 and (ar, ac) != (r, c):
                        nb = board[ar][ac]
                        if ((side=="RED" and nb in "rps") or (side=="BLUE" and nb in "RPS")) and can_cap(nb, ch):
                            s -= 140
                if s > best_s:
                    best_s = s
                    best = f"{FILES[c]}{9-r} {FILES[nc]}{9-nr}"
    if best:
        print(best, flush=True)
`,

  // Hạng #1 (Cao thủ giữ Top 1): Tấn công + săn mồi cực gắt
  rank1_champion_py: STARTER_TEMPLATES.python
};
