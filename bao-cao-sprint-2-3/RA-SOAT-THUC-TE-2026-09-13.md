# Rà soát Sprint 2 và Sprint 3 — 13/09/2026

## Đính chính bộ báo cáo được tạo trước đó

Các DOCX/PPTX trong thư mục này là bản nháp. Những dòng ghi Hoàn thành/Đạt cho toàn bộ dữ liệu, hồ sơ, lịch sử, liên kết và video chưa có đủ bằng chứng. Không dùng các dòng đó để chuyển hàng loạt Jira sang Done.

- Chưa xác minh đủ 32 đội/128 người chơi trong bản Android. Bài test web đã chạy là **32 người chơi / 8 đội**, không phải 32 đội / 128 người chơi.
- Hồ sơ nhân vật/skill/build không phải hồ sơ tài khoản người chơi/rank/lịch sử.
- Thư viện Divine Cards không chứng minh đầy đủ cơ chế Divine Draw.
- Kịch bản demo đã có bản nháp, chưa có video hoàn chỉnh.
- Các biên bản được soạn từ backlog, không xác nhận một cuộc họp đã thực sự diễn ra hay thành viên đã tham dự.
- DOCX kiểm tra được cấu trúc ZIP, nhưng chưa render kiểm tra từng trang vì runtime Windows thiếu LibreOffice và không có Microsoft Word COM.

## Kết quả có bằng chứng

- Web: tests/solo-team-randomizer.mjs, tests/captain-consistency.mjs và tests/e2e-32-player-tournament.mjs đã chạy PASS.
- Android: :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --offline chạy BUILD SUCCESSFUL với JDK 21, 55 tác vụ.
- Ảnh 15-kiem-thu-he-thong.png là bảng tổng hợp do công cụ tạo từ kết quả thực thi, không phải ảnh chụp terminal.
- Repository web https://github.com/rendezvu219-maker/rendezvuarena được kiểm tra công khai; ảnh 16-github-web-public.png.
- Các ảnh Android cho thấy giao diện offline: giải mẫu, nhánh đấu, phòng trận, đổi vai trò demo, Ban/Pick, cấu hình Randomize, thư viện nhân vật và thẻ.

## Lỗi tài khoản Android

GekishinApp.kt ánh xạ route account sang RoleScreen (Đổi vai trò demo). NavHost không đăng ký AuthScreen hoặc màn hình đăng ký. AuthScreen.kt cũ chỉ gọi onLogin(name, role), không dùng password để xác thực. README 0.9.1 xác nhận online authentication/networking không nằm trong navigation hiện tại.

Cần khôi phục kết nối backend, đăng ký, đăng nhập, đăng xuất và kiểm tra phiên đăng nhập/hồ sơ trước khi xác nhận P2193-35 hoàn thành trên bản hiện tại.

## Jira được đối chiếu

- P2193-86: đã đính kèm ảnh GitHub và chuyển Done.
- P2193-35: mở lại In Progress và ghi nhận hồi quy tài khoản.
- P2193-43 có balanced-draft.png/settings.png; P2193-38 có ba ảnh giải/nhánh/phòng trận, kèm ghi chú giới hạn.
- P2193-46 có subtask P2193-68 chưa hoàn thành.
- P2193-58 có subtask P2193-69 chưa hoàn thành.
- Sprint 3: P2193-72/74/75/77/78/79/81/83/84 chưa có attachment tại lúc rà soát; P2193-82 có 7 ảnh lịch sử tháng 7.

## Điều kiện hoàn tất còn thiếu

Kiểm tra đủ dữ liệu 32 đội/128 người chơi; hồ sơ/rank/lịch sử; chức năng online trên Android; kiểm thử dọc/ngang/nhiều kích thước; xử lý các subtask; xác minh source Android công khai; chỉnh báo cáo theo dữ liệu đã xác nhận; hoàn thiện video.
