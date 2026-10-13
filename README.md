# Đấu Trường AI Cờ Đấm - Lá - Kéo 9x9 (TypeScript Hexagonal Architecture + DDD)

Hệ thống Web cho phép người dùng nộp code **Python 3, C++ (G++17), Java**, tự động biên dịch và thi đấu đối kháng trên bàn cờ **9x9 Đấm - Lá - Kéo** với **4 cấp độ Bot AI chuẩn** để tính điểm và xếp hạng.

Dự án được thiết kế theo chuẩn **Hexagonal Architecture (Ports & Adapters)** kết hợp **Domain-Driven Design (DDD)** bằng **TypeScript (`.ts`)** cho cả `server/` và `client/`.

---

## 1. Hướng Dẫn Chạy Nhanh

```bash
# 1. Cài đặt thư viện
npm install

# 2. Kiểm tra kiểu TypeScript (Server & Client)
npm run typecheck

# 3. Biên dịch TypeScript và chạy kiểm thử tự động (Python, C++, Java)
npm test

# 4. Khởi động Web Server (http://localhost:3000)
npm start
```

---

## 2. Cấu Trúc Thư Mục (TypeScript Hexagonal + DDD)

```text
BTL-WEB-03/
├── package.json                                  # Scripts: build, typecheck, test, start
├── tsconfig.base.json                            # Cấu hình TypeScript dùng chung
├── Dockerfile.sandbox                            # Docker image cô lập thực thi đa ngôn ngữ
├── server/                                       # BACKEND (TypeScript Hexagonal + DDD)
│   ├── tsconfig.json
│   └── src/
│       ├── domain/                               # 1. TẦNG DOMAIN (Pure TypeScript, 0 thư viện ngoài)
│       │   ├── game/
│       │   │   ├── types/GameTypes.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── Coordinate.ts             # Tọa độ a1..i9, quy đổi (row, col)
│       │   │   │   ├── Piece.ts                  # Quân cờ (R/P/S) & quy tắc Đấm > Kéo > Lá > Đấm
│       │   │   │   └── Move.ts                   # Nước đi bất biến
│       │   │   ├── entities/
│       │   │   │   ├── Board.ts                  # Luật bàn cờ 9x9, sinh nước đi, validate stdout
│       │   │   │   └── Match.ts                  # Aggregate Root ván đấu, lịch sử & điều kiện thắng
│       │   │   └── services/
│       │   │       ├── BotDecisionDomainService.ts # Chiến thuật AI của 4 Bot (Rookie -> Grandmaster)
│       │   │       └── StarterTemplates.ts       # Code mẫu AI Python, C++, Java
│       │   ├── evaluation/
│       │   │   ├── value-objects/ExecutionMetrics.ts
│       │   │   └── entities/Submission.ts        # Aggregate Root bài nộp code
│       │   └── ranking/
│       │       ├── entities/Competitor.ts        # Thực thể Người chơi / Mốc Bot trên BXH
│       │       └── services/ScoringPolicy.ts     # Công thức tính điểm Gauntlet & hệ số Elo
│       │
│       ├── application/                          # 2. TẦNG APPLICATION (Use Cases, Ports & DTOs)
│       │   ├── dto/                              # SubmitCodeDto, MatchResultDto, LeaderboardEntryDto
│       │   ├── ports/
│       │   │   ├── inbound/                      # Driving Ports (Interfaces)
│       │   │   │   ├── ISubmitCodeGauntletUseCase.ts
│       │   │   │   ├── IRunTestMatchUseCase.ts
│       │   │   │   ├── IPlayManualMoveUseCase.ts
│       │   │   │   └── IGetLeaderboardQuery.ts
│       │   │   └── outbound/                     # Driven Ports (Interfaces - SPI)
│       │   │       ├── ICodeSandboxPort.ts
│       │   │       ├── ISubmissionRepositoryPort.ts
│       │   │       └── ILeaderboardRepositoryPort.ts
│       │   └── use-cases/                        # Thực thi các Inbound Ports
│       │       ├── SubmitCodeGauntletUseCase.ts
│       │       ├── RunTestMatchUseCase.ts
│       │       ├── PlayManualMoveUseCase.ts
│       │       └── GetLeaderboardService.ts
│       │
│       ├── adapters/                             # 3. TẦNG ADAPTERS (Giao tiếp thế giới bên ngoài)
│       │   ├── inbound/                          # Primary / Driving Adapters
│       │   │   ├── http/
│       │   │   │   ├── controllers/
│       │   │   │   │   ├── SubmissionController.ts
│       │   │   │   │   ├── MatchController.ts
│       │   │   │   │   └── LeaderboardController.ts
│       │   │   │   └── routes.ts
│       │   │   └── cli/
│       │   │       └── ArenaCliRunner.ts
│       │   └── outbound/                         # Secondary / Driven Adapters
│       │       ├── sandbox/
│       │       │   ├── LocalProcessSandboxAdapter.ts
│       │       │   └── DockerSandboxAdapter.ts
│       │       └── persistence/
│       │           ├── JsonLeaderboardRepository.ts
│       │           └── PostgresRepository.ts
│       │
│       └── main.ts                               # Composition Root (Dependency Injection)
│
└── client/                                       # FRONTEND (TypeScript Modular Architecture)
    ├── index.html
    ├── tsconfig.json
    ├── styles/
    │   └── main.css
    └── src/
        ├── domain/
        │   ├── types.ts
        │   └── boardModel.ts
        ├── application/
        │   ├── arenaStore.ts
        │   └── replayController.ts
        ├── adapters/
        │   └── arenaApiClient.ts
        ├── presentation/
        │   ├── boardView.ts
        │   ├── editorView.ts
        │   └── leaderboardView.ts
        └── index.ts
```
