# Deploy RendezVu Arena bằng GitHub + Railway

## 1. Tạo GitHub repository

Tạo repository riêng tư, không đặt token hoặc mật khẩu vào source code. Có thể dùng các script publish có sẵn trong repository hoặc GitHub Desktop để push mã nguồn.

## 2. Không dùng GitHub Pages

Web cần Node.js, SQLite, upload storage và Socket.IO nên GitHub Pages không chạy được. GitHub chỉ giữ source và chạy CI.

## 3. Deploy Railway

- Chọn **New Project → Deploy from GitHub Repo**.
- Chọn repository của RendezVu Arena.
- Gắn Railway Volume tại `/data`.
- Đặt `RAILWAY_VOLUME_MOUNT_PATH=/data`.
- Dùng Node.js 22.5+ và start command `npm start`.

## 4. Biến môi trường bắt buộc

Sao chép danh sách từ `.env.railway.example`. Tối thiểu phải cấu hình:

- `NODE_ENV=production`
- `APP_ORIGIN=https://ten-mien-cua-ban`
- `AUTH_SECRET`
- `DATABASE_PATH=/data/rendezvu-arena.sqlite`
- `UPLOAD_PATH=/data/uploads`
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `DIVINE_CARD_ADMIN_EMAIL`
- `PUBLIC_CONTACT_EMAIL=rendezvous2193@gmail.com`

Tài khoản thử nghiệm công khai không dùng email xác minh, Resend hoặc OAuth. Người dùng chỉ dán đường dẫn hồ sơ công khai của start.gg, Tonamel và Challonge.

Giữ `PUBLIC_SUPPORT_URL` trống nếu chưa có trang hỗ trợ chính thức.

Tạo secret 64 byte:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 5. Domain và HTTPS

Sau khi trỏ domain vào Railway:

- cập nhật `APP_ORIGIN`;
- kiểm tra cookie Secure và HTTPS;
- không dùng tên miền chứa tên game hoặc tên chủ sở hữu quyền nếu chưa được cho phép.

## 6. Kiểm tra trước khi public

Chỉ mở public sau khi `npm run deploy:check` và `npm test` đều pass. Không dùng mật khẩu quan trọng trên website thử nghiệm này. Kiểm tra thời hạn lưu dữ liệu, quyền sử dụng media và backup Railway Volume trước khi thay đổi production.
