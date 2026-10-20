// ============================================================
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
