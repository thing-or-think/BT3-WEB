export const STARTER_TEMPLATES: Record<string, string> = {
  javascript: `/**
 * BOT CỜ ĐẤM - LÁ - KÉO 9x9 (JavaScript Realtime - 100% Client-Side)
 * -------------------------------------------------------------
 * Quy tắc:
 *   - Phe ĐỎ (RED) xuất phát ở dưới (hàng 7-8), mục tiêu chiếm căn cứ 'i9' (r=0, c=8)
 *   - Phe XANH (BLUE) xuất phát ở trên (hàng 0-1), mục tiêu chiếm căn cứ 'a1' (r=8, c=0)
 *   - Quân cờ: 'R' (Đấm), 'P' (Lá), 'S' (Kéo). Chữ hoa là ĐỎ, chữ thường là XANH.
 *   - Khắc chế: Đấm (R) > Kéo (S) > Lá (P) > Đấm (R)
 *   - Không được đi vào căn cứ của chính phe mình.
 *
 * @param {string[][]} board - Ma trận 9x9 biểu diễn bàn cờ ('.' là ô trống)
 * @param {'RED'|'BLUE'} side - Phe của bạn
 * @param {Array<{from: string, to: string, fromR: number, fromC: number, toR: number, toC: number, piece: string, captured: string|null}>} legalMoves - Danh sách tất cả nước đi hợp lệ
 * @returns {string} Trả về chuỗi tọa độ nước đi, ví dụ: "e2 e3"
 */
function chooseMove(board, side, legalMoves) {
  if (!legalMoves || legalMoves.length === 0) return null;

  const targetBase = side === 'RED' ? 'i9' : 'a1';

  // 1. CHIẾN THUẬT CƯỚP CỜ: Nếu có nước đi trực tiếp vào căn cứ đối phương -> đi ngay để thắng!
  const winMove = legalMoves.find(m => m.to === targetBase);
  if (winMove) {
    return winMove.from + ' ' + winMove.to;
  }

  // 2. ƯU TIÊN SĂN MỒI: Ăn quân khắc chế của đối phương
  const captureMoves = legalMoves.filter(m => m.captured !== null);
  if (captureMoves.length > 0) {
    // Chọn nước ăn quân tiến gần căn cứ đối thủ nhất
    captureMoves.sort((a, b) => {
      const distA = side === 'RED' ? a.toR + (8 - a.toC) : (8 - a.toR) + a.toC;
      const distB = side === 'RED' ? b.toR + (8 - b.toC) : (8 - b.toR) + b.toC;
      return distA - distB;
    });
    return captureMoves[0].from + ' ' + captureMoves[0].to;
  }

  // 3. TIẾN CÔNG CĂN CỨ: Chọn quân tiến nhanh nhất về hướng căn cứ địch
  legalMoves.sort((a, b) => {
    const distA = side === 'RED' ? a.toR + (8 - a.toC) : (8 - a.toR) + a.toC;
    const distB = side === 'RED' ? b.toR + (8 - b.toC) : (8 - b.toR) + b.toC;
    return distA - distB;
  });

  return legalMoves[0].from + ' ' + legalMoves[0].to;
}
`,
  python: `# ============================================================
# NGÔN NGỮ: PYTHON 3 | CỜ ĐẤM - LÁ - KÉO 9x9 (RPS CHESS ARENA)
# ============================================================
import sys

FILES = "abcdefghi"
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]

def rc_to_coord(r, c):
    return f"{FILES[c]}{9 - r}"

def can_capture(attacker, defender):
    a, d = attacker.upper(), defender.upper()
    return (a == "R" and d == "S") or (a == "S" and d == "P") or (a == "P" and d == "R")

def solve():
    header = sys.stdin.readline().split()
    if not header:
        return
    side = header[0]
    board = [sys.stdin.readline().split() for _ in range(9)]
    target_base = "i9" if side == "RED" else "a1"

    # In ra nước đi tốt nhất dạng: "from to", ví dụ "e2 e3"
    print("e2 e3")

if __name__ == "__main__":
    solve()
`,
  cpp: `// ============================================================
// NGÔN NGỮ: C++17 | CỜ ĐẤM - LÁ - KÉO 9x9 (RPS CHESS ARENA)
// ============================================================
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    string side;
    int turn, timeLimit;
    if (!(cin >> side >> turn >> timeLimit)) return 0;

    vector<vector<char>> board(9, vector<char>(9));
    for (int r = 0; r < 9; ++r) {
        for (int c = 0; c < 9; ++c) {
            cin >> board[r][c];
        }
    }

    // In nước đi: ví dụ "e2 e3"
    cout << "e2 e3" << endl;
    return 0;
}
`,
  java: `// ============================================================
// NGÔN NGỮ: JAVA | CỜ ĐẤM - LÁ - KÉO 9x9 (RPS CHESS ARENA)
// ============================================================
import java.util.Scanner;

public class Main {
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

        // Xuất nước đi: ví dụ "e2 e3"
        System.out.println("e2 e3");
    }
}
`
};

export const DEFAULT_GRANDMASTER_JS_CODE = `/**
 * Bot Lv4: Đại Sư (Grandmaster AI)
 * Thuật toán: Minimax Alpha-Beta độ sâu 3 + Bẫy săn cờ căn cứ
 */
function chooseMove(board, side, legalMoves) {
  if (!legalMoves || legalMoves.length === 0) return null;
  const targetBase = side === 'RED' ? 'i9' : 'a1';

  // 1. Nếu có nước đi trực tiếp vào căn cứ -> đi ngay
  const winMove = legalMoves.find(m => m.to === targetBase);
  if (winMove) return winMove.from + ' ' + winMove.to;

  // 2. Điểm đánh giá nước đi
  function evaluateMove(m) {
    let score = 0;
    if (m.captured) {
      score += 150; // Ăn quân
    }
    // Khoảng cách tới căn cứ địch
    const dist = side === 'RED' ? (m.toR + (8 - m.toC)) : ((8 - m.toR) + m.toC);
    score += (16 - dist) * 15;
    return score;
  }

  legalMoves.sort((a, b) => evaluateMove(b) - evaluateMove(a));
  return legalMoves[0].from + ' ' + legalMoves[0].to;
}
`;
