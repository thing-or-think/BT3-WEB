# RPS Chess 9x9 — Đấu Trường Lập Trình AI (GitHub Pages Serverless CTF & playhtml)

Đấu trường AI thi đấu trên bàn cờ Đấm – Lá – Kéo 9×9. 
Hệ thống được thiết kế theo kiến trúc **Serverless 100% Client-Side** vận hành trực tiếp trên **GitHub Pages**, kết hợp **playhtml** để đồng bộ thời gian thực trạng thái **Vua Giữ Cờ (CTF King of the Hill)** và bảng vàng vinh danh mà **hoàn toàn không cần API server backend**.

---

## Tính Năng Nổi Bật

1. **100% Serverless trên GitHub Pages**:
   - Chạy trực tiếp từ trình duyệt, chi phí 0đ, không lo sập máy chủ.
   - Biên dịch và mô phỏng trận đấu 160 lượt bằng JavaScript Engine nội tại cực nhanh (< 20ms).
2. **Đấu Trường Cướp Cờ CTF (King of the Hill) với `playhtml`**:
   - Vua Giữ Cờ ngự trị đỉnh tháp, phát sóng trực tiếp tới toàn bộ người chơi qua `playhtml`.
   - Người chơi đọc mã nguồn của Vua, viết bot counter và thách đấu cướp cờ.
   - Thắng trận sẽ lập tức **Cướp cờ thành công**, kích hoạt pháo hoa ăn mừng và đưa bot lên ngôi Vua mới!
3. **Chia sẻ Thách Đấu Viral qua URL Hash**:
   - Sử dụng thuật toán nén `LZ-String` để đóng gói mã nguồn bot vào liên kết `#boss=...&code=...`. Gửi link cho bạn bè là họ có thể đấu ngay với bot của bạn.
4. **MIT Battlecode UI**:
   - **Unit Inspector HUD**: Click vào bất kỳ quân cờ nào để xem thông số, hệ khắc chế, khoảng cách tới căn cứ địch và các hướng di chuyển hợp lệ.
   - **Match Telemetry Chart**: Biểu đồ trực quan hóa số lượng quân cờ biến thiên qua từng lượt.
   - **Debug Terminal**: Console mô phỏng dòng sự kiện và phân tích ván đấu theo thời gian thực.
   - **Replay Scrubber & Controller**: Xem lại từng nước đi, tua nhanh/chậm hoặc nhảy trực tiếp tới các pha ăn quân.

---

## 4 Tab Trải Nghiệm Chính

- **Tab 1: 🎮 Đấu Tập & Luật Chơi**: Học luật cờ, chơi trực tiếp bằng tay với bot ở 4 cấp độ (Tập sự → Đại sư).
- **Tab 2: 💻 Bot Studio & Console**: Soạn thảo thuật toán bot (JavaScript), chạy thử đối đầu 4 bot và phân tích hiệu năng.
- **Tab 3: ⚔️ Đấu Trường Cướp Cờ CTF**: Thách đấu Vua Giữ Cờ realtime `playhtml`, xem code của Vua để tìm lỗ hổng, hoặc copy link bot gửi bạn bè.
- **Tab 4: 🏆 Bảng Vàng Hall of Fame**: Bục vinh danh Top 3 và bảng vàng lịch sử cướp cờ được lưu trữ bền vững.

---

## Cách Khởi Chạy & Triển Khai

### 1. Chạy Cục Bộ (Local Development)
```bash
# Cài đặt phụ thuộc
npm ci

# Build client bundle
npm run build:client

# Mở tệp client/index.html trực tiếp trên trình duyệt hoặc chạy HTTP server
npx serve client
```

### 2. Triển Khai Lên GitHub Pages
Dự án đã tích hợp sẵn GitHub Actions workflow tại [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
Mỗi khi push mã nguồn lên nhánh `main`, hệ thống sẽ tự động đóng gói client và xuất bản lên GitHub Pages tĩnh hoàn toàn miễn phí.
