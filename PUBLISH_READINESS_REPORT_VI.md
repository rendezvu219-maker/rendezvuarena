# Báo cáo sẵn sàng phát hành — RendezVu Arena

Ngày kiểm tra: 01/08/2026

## Trạng thái

- **GitHub private:** Sẵn sàng.
- **Deploy thử nghiệm có kiểm soát trên Railway:** Sẵn sàng sau khi cấu hình biến môi trường, volume và email/OAuth.
- **GitHub public hoặc website public:** Chưa được xác nhận sạch bản quyền; cần giấy phép hoặc thay/gỡ media và dữ liệu bên thứ ba được liệt kê trong `ASSET_RIGHTS_INVENTORY.md`.
- **GitHub Pages:** Không phù hợp vì ứng dụng cần Node.js, SQLite và Socket.IO phía server.

## Việc đã làm sạch

- Đổi tên sản phẩm thành **RendezVu Arena** và giữ tên game chỉ trong ngữ cảnh mô tả tương thích/quyền sở hữu.
- Xóa `.env`, database SQLite/WAL/SHM, log, ZIP lồng, dữ liệu upload, tài khoản/demo và liên kết hồ sơ cá nhân.
- Xóa Easter egg và tên người chơi cá nhân khỏi code/test.
- Tắt trang kêu gọi hỗ trợ tài chính cho lần phát hành đầu.
- Bổ sung README, điều khoản, chính sách riêng tư, trang copyright/gỡ bỏ, thông báo bên thứ ba, security policy, hướng dẫn deploy và workflow CI.
- Đặt package ở chế độ `private: true` để tránh vô tình publish lên npm.

## Kiểm thử đã chạy

- `npm run check`: **PASS**
- `npm test`: **PASS**
- `npm run deploy:check`: **PASS**
- Railway deployment regression: **PASS**
- i18n source audit: **PASS**
- Security regression suite: **PASS**
- Secret/personal-data scan: không phát hiện secret thực hoặc handle cá nhân đã biết trong gói cuối.

`npm audit` không chạy được trong môi trường kiểm tra vì endpoint audit của registry nội bộ trả lỗi 404. GitHub Dependabot và GitHub Actions đã được cấu hình để tiếp tục kiểm tra dependency trên GitHub.

## Việc bắt buộc trước khi mở website

1. Đặt `PUBLIC_CONTACT_EMAIL` thành email thật được theo dõi.
2. Tạo secret production mới; không tái sử dụng secret/mật khẩu từ bản ZIP cũ.
3. Gắn persistent volume cho SQLite và upload.
4. Khai báo đúng `PUBLIC_ORIGIN`, `ALLOWED_ORIGINS`, callback OAuth và domain gửi email.
5. Giữ repo private cho đến khi có quyền dùng asset hoặc đã thay/gỡ toàn bộ asset chưa được cấp phép.
6. Kiểm tra tên miền và xung đột nhãn hiệu ngay trước khi mua.
