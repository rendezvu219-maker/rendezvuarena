# Báo cáo sẵn sàng phát hành — RendezVu Arena

Ngày kiểm tra: 01/08/2026

## Trạng thái

- **GitHub private:** Sẵn sàng.
- **Deploy public có kiểm soát trên Railway:** Sẵn sàng sau khi cấu hình biến môi trường, volume, email/OAuth và email gỡ bỏ nội dung.
- **GitHub public:** Code có thể public; repository chứa toàn bộ artwork có rủi ro phân phối asset cao hơn website thông thường. Khuyến nghị giữ asset repo private hoặc tách asset khỏi source public.
- **GitHub Pages:** Không phù hợp vì ứng dụng cần Node.js, SQLite và Socket.IO phía server.

## Phân loại nội dung đã hiệu chỉnh

- Tên nhân vật, tên kỹ năng, vai trò, chỉ số và cơ chế gameplay được dùng làm dữ liệu tương thích/tra cứu và không còn bị liệt kê như một “blocker” bản quyền ngang với artwork.
- Mô tả dài nên được giữ ở mức cần thiết, ưu tiên bản dịch/diễn giải do dự án biên tập và ghi nguồn.
- Rủi ro còn lại chủ yếu nằm ở 408 ảnh nhân vật/kỹ năng, 36 ảnh Divine Card và 3 role icon.
- Hai ảnh chụp trong game dùng để xác minh bản dịch đã bị xóa; số ảnh bằng chứng còn lại là **0**.

## Việc đã làm sạch

- Đổi tên sản phẩm thành **RendezVu Arena** và giữ tên game chỉ trong ngữ cảnh mô tả tương thích/quyền sở hữu.
- Xóa `.env`, database SQLite/WAL/SHM, log, ZIP lồng, dữ liệu upload, tài khoản/demo và liên kết hồ sơ cá nhân.
- Xóa Easter egg và tên người chơi cá nhân khỏi code/test.
- Xóa ảnh bằng chứng dịch và toàn bộ đường dẫn/hash liên quan; chỉ giữ metadata xác nhận các trường text đã được kiểm tra.
- Tắt trang kêu gọi hỗ trợ tài chính cho lần phát hành đầu.
- Bổ sung README, điều khoản, chính sách riêng tư, trang copyright/gỡ bỏ, thông báo bên thứ ba, security policy, hướng dẫn deploy và workflow CI.
- Đặt package ở chế độ `private: true` để tránh vô tình publish lên npm.

## Kiểm thử bản cập nhật

- `npm run check`: **PASS**
- `npm test`: **PASS**
- `npm run deploy:check`: **PASS**
- `npm run i18n:heroes:verify-game`: **PASS** — 2 bản ghi text-only, 0 ảnh bằng chứng
- Secret/personal-data scan: **PASS**

## Việc bắt buộc trước khi mở website

1. `PUBLIC_CONTACT_EMAIL` đã được đặt thành `rendezvous2193@gmail.com`; cần bảo đảm hộp thư này luôn được theo dõi.
2. Tạo secret production mới; không tái sử dụng secret/mật khẩu từ bản ZIP cũ.
3. Gắn persistent volume cho SQLite và upload.
4. Khai báo đúng `PUBLIC_ORIGIN`, `ALLOWED_ORIGINS`, callback OAuth và domain gửi email.
5. Không cung cấp chức năng tải hàng loạt asset hoặc biến repo/site thành kho tải tài nguyên game.
6. Giữ thông báo độc lập, ghi nhận chủ thể quyền, nguồn dữ liệu và cơ chế gỡ bỏ.
7. Kiểm tra tên miền và xung đột nhãn hiệu ngay trước khi mua.
