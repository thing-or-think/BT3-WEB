# RPS Chess 9x9 — Đấu trường lập trình AI

Trang web thi đấu AI trên bàn cờ Đấm – Lá – Kéo 9×9. Người chơi viết bot bằng Python, Java hoặc C++, chạy thử chiến thuật và nộp code để thi đấu xếp hạng.

## Cách khởi chạy

### Chuẩn bị

- Cài Node.js 20 trở lên và npm.
- Cài môi trường cho ngôn ngữ muốn dùng: Python 3, Java JDK hoặc G++ hỗ trợ C++17.
- Đảm bảo các lệnh tương ứng (`python`, `java`, `javac`, `g++`) có thể chạy trong terminal.

### Chạy trang web

Mở terminal tại thư mục dự án và chạy:

```bash
npm ci
npm start
```

Truy cập **http://localhost:3000** trên trình duyệt.

Những lần sau chỉ cần chạy `npm start`. Để dừng trang web, nhấn `Ctrl + C` trong terminal.

## Nội dung trang web

- **Đăng ký, đăng nhập:** tạo tài khoản để tham gia thi đấu và lưu lịch sử bài nộp.
- **Đấu tập và luật chơi:** tìm hiểu luật cờ, chơi trực tiếp với bot ở 4 cấp độ.
- **Phòng Lab Code:** chọn Python, Java hoặc C++, chỉnh sửa code mẫu và chạy thử với bot trước khi thi đấu.
- **Đấu xếp hạng:** nộp bot để đấu với các đối thủ từ cuối bảng lên trên; thắng thì tiếp tục leo hạng, thua thì dừng dưới đối thủ.
- **Bảng xếp hạng:** xem thứ hạng, điểm và kết quả của người chơi.
- **Lịch sử bài nộp:** xem lại các lần nộp code, kết quả thi đấu và lỗi biên dịch.
- **Replay và log:** xem lại từng nước đi, điều chỉnh tốc độ phát và tải log trận đấu dạng JSON.

## Bắt đầu thi đấu

1. Đăng ký tài khoản và đăng nhập.
2. Vào **Phòng Lab Code**, chọn ngôn ngữ và viết bot.
3. Nhấn **Chạy thử bot** để kiểm tra chiến thuật.
4. Chuyển sang **Đấu xếp hạng** và nhấn **Nộp bot đấu xếp hạng**.
5. Xem kết quả, bảng xếp hạng và replay để cải thiện bot cho lần thi đấu tiếp theo.
