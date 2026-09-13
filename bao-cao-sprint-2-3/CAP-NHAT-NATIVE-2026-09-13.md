# Cập nhật Android native — 13/09/2026

## Đã triển khai và kiểm chứng

- Đăng ký/đăng nhập native qua backend; kiểm tra sai mật khẩu, cookie phiên, tải hồ sơ và đăng xuất. Mật khẩu không lưu trên máy; cookie chỉ lưu trong bộ nhớ.
- Bracket offline dạng cây: các vòng nối nhau, cuộn ngang/dọc, tỷ số/trạng thái/đội thắng và nút mở từng trận. Không chuyển lại sang WebView.
- Danh sách người chơi offline có tìm kiếm theo tên/đội; hồ sơ có vai trò, đội trưởng, đồng đội, giải hiện tại, thành tích đội, lịch sử trận và liên kết bracket/phòng trận.
- Tài khoản online có nút tải lịch sử tham gia/tổ chức từ API `/api/profile/history`. Tài khoản mới hiển thị chưa có giải; không tạo thành tích giả.
- Sửa backend: không coi đội thắng bán kết là vô địch khi chung kết chưa hoàn tất.

## Kết quả kiểm thử

- Build APK debug và test APK: đạt.
- Android unit tests: 47 test, 0 lỗi/thất bại; gồm căn giữa nhánh đấu và hạng 1/2/Top 4 sau chung kết.
- Android instrumentation: 3/3 đạt trên emulator-5554, backend thử nghiệm và SQLite riêng. Kiểm tra API tài khoản/lịch sử, màn hình đăng ký/đăng nhập, bracket → phòng trận, tìm người chơi → hồ sơ/lịch sử.
- Android lintDebug: thành công, còn cảnh báo; không tương đương kiểm thử toàn bộ hệ thống.
- Backend `tests/bracket-round-progression.mjs`: đạt, bao gồm không trao vô địch trước chung kết, hạng 1/2 sau duyệt, xác nhận hai bên và mở lại kết quả.
- Bằng chứng gốc: `.wil-report-20260912/native-auth-run-BpsZWT/instrumentation.txt`.
- Ảnh chụp thực tế: `qa-native-login.png`, `qa-native-register.png`, `qa-native-bracket-tree.png`, `qa-native-player-profile.png` trong `.wil-report-20260912/app-evidence`.

## Giới hạn và việc còn lại — chưa đủ điều kiện đóng toàn bộ Sprint 2/3

| Tiêu chí | Tình trạng ở Android native |
| --- | --- |
| Đăng ký / đăng nhập / API | Đã kiểm chứng các luồng nêu trên |
| Bracket | Đã có cây cho giải offline hiện tại; chưa kết nối bracket online |
| Hồ sơ người chơi khác | Có ở dữ liệu mẫu offline; chưa tra cứu hồ sơ tài khoản khác trên máy chủ |
| Lịch sử giải online | Đọc lịch sử tài khoản đang đăng nhập; chưa có điều hướng chi tiết giải online |
| Rank và lịch sử Rank cá nhân | Chưa hoàn thiện; thành tích đội không phải Rank cá nhân |
| Database / CRUD / phân quyền / request-approval | Có các phần ở backend và demo; chưa kiểm chứng đầy đủ các luồng native online |
| Search / filter | Tìm tên người chơi/đội offline; chưa đủ bộ lọc online |
| Notification / upload avatar-logo / realtime | Chưa hoàn thiện tích hợp native online |
| 32 đội / 128 người chơi / nhiều giải | Chưa có bộ kiểm chứng đủ theo task Sprint 3 |
| Thiết bị điện thoại thực tế / dọc-ngang | Lượt này kiểm chứng giả lập ngang; chưa chứng minh đã cài/chạy trên điện thoại người dùng |
| Báo cáo DOCX / slides / video | Các bản trước còn là bản nháp cần đối soát; kịch bản không phải video hoàn thành |

## Cách thử bản mới

APK: `D:/GekishinSquadraWebViewAndroid/app/build/outputs/apk/debug/app-debug.apk`.
Mở menu → Nhánh đấu hoặc Hồ sơ người chơi. Menu → Đăng nhập / Đăng ký để kết nối backend.
Máy tính và điện thoại cùng LAN: dùng IP LAN của máy chạy backend cùng cổng 3000, không dùng localhost của điện thoại. IP đã quan sát ở lượt trước là 192.168.1.241; có thể thay đổi khi đổi mạng. Debug hiện cho phép HTTP tới địa chỉ này; bản release yêu cầu HTTPS. Chưa xác nhận khả năng truy cập từ điện thoại thật.

Tài liệu này là báo cáo tiến độ kỹ thuật, không phải biên bản một cuộc họp đã diễn ra và không thay thế nghiệm thu toàn bộ Sprint.
