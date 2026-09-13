# Android native online — 14/09/2026

## Đã bổ sung

- Trang chủ có lối vào “Giải đấu & hồ sơ online”. Đăng nhập ở menu “Đăng nhập / Đăng ký”, sau đó tải danh sách giải.
- Danh sách giải công khai lấy từ backend, phân trang 60 giải/lần; lọc tên hoặc trạng thái trong danh sách đã tải.
- Chọn giải để tải bracket online dạng cây. Card có BO, tỷ số, trạng thái và đội thắng; chạm Mở trận để xem chi tiết công khai. Trận vòng bảng hiển thị riêng dạng danh sách.
- Tra cứu hồ sơ bằng username, xem tên hiển thị, gamer tag, bio, đội/vai trò qua lịch sử tham gia giải công khai và thành tích đội; bấm lịch sử để mở bracket giải đó.
- Backend mở rộng hồ sơ công khai bằng lịch sử giải đã công khai. Hồ sơ riêng tư vẫn chặn người không có quyền; không trả lịch sử của giải chưa công khai.
- Tất cả dữ liệu online chỉ là màn hình đọc từ API; không ghi đè giải offline và không biến vai trò demo thành quyền online.

## Kiểm chứng

- Build APK và test APK thành công; 47 unit test không lỗi.
- Bộ Android instrumentation gồm 4 test: API tài khoản/cookie/lịch sử, UI đăng nhập/đăng ký, bracket/hồ sơ offline, và luồng online với giải 4 đội tạo trong SQLite thử nghiệm riêng.
- Luồng online đã kiểm chứng tải danh sách → chọn giải → bracket, tra username → hồ sơ → lịch sử công khai.
- Backend regression `tests/bracket-round-progression.mjs` đạt: tiến vòng, xác nhận kết quả, mở lại trận, hạng 1/2 sau chung kết; không phong vô địch khi mới xong bán kết; không lộ giải chưa công khai; hồ sơ riêng tư trả 403 mà không chứa lịch sử.
- Bộ dữ liệu thử nghiệm này chỉ có 4 đội. Không coi đây là bằng chứng task 32 đội/128 người chơi.

## Phần chưa nghiệm thu

- Rank cá nhân/lịch sử điểm Rank, CRUD và request-approval native online toàn diện, thông báo, avatar/logo upload, realtime vẫn chưa hoàn thiện.
- Hồ sơ online tra bằng username chính xác; bộ lọc giải áp dụng trên trang đã tải. Chưa có tìm người chơi online theo tên hiển thị.
- Màn hình chi tiết trận online hiện chỉ đọc; chưa thay toàn bộ phòng điều hành/draft online.
- Chưa triển khai backend mới lên máy chủ online, chưa cài APK vào điện thoại người dùng. Máy chủ cũ chưa cập nhật sẽ chưa có trường lịch sử công khai mới.
- Chưa đủ để đóng toàn bộ Sprint 2–3; báo cáo DOCX/PPTX/video trước đó vẫn cần hoàn thiện riêng.

## Tệp bàn giao

- APK: `D:/GekishinSquadraWebViewAndroid/app/build/outputs/apk/debug/app-debug.apk`.
- Nguồn native: `feature/offline/OnlineBrowseScreen.kt`, route `online`.
- Backend: `server/account-settings-service.js`, `server/profile-service.js`.
- Ảnh thật từ giả lập: `qa-online-bracket.png`, `qa-online-profile.png` trong `.wil-report-20260912/app-evidence`.

Khi chạy backend từ thư mục dự án trên máy tính, điện thoại cùng mạng dùng địa chỉ IP LAN của máy tính và cổng backend, không dùng localhost của điện thoại. Bản debug hỗ trợ HTTP cho các host thử nghiệm đã cấu hình; bản release yêu cầu HTTPS.
