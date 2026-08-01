# Deploy RendezVu Arena bằng GitHub + Railway

## 1. Tạo GitHub private repository

Tạo repository trống tên `rendezvu-arena`, chọn **Private**, không tạo sẵn README hoặc `.gitignore`.

Windows:

```bat
PUBLISH_TO_GITHUB_WINDOWS.bat https://github.com/USERNAME/rendezvu-arena.git
```

Linux/macOS:

```bash
chmod +x PUBLISH_TO_GITHUB_LINUX_MAC.sh
./PUBLISH_TO_GITHUB_LINUX_MAC.sh https://github.com/USERNAME/rendezvu-arena.git
```

Nếu GitHub yêu cầu đăng nhập, dùng GitHub Desktop, Git Credential Manager hoặc SSH. Không đặt token vào file trong repo.

## 2. Không dùng GitHub Pages

Web cần Node.js, SQLite, upload storage và Socket.IO nên GitHub Pages không chạy được. GitHub chỉ giữ source và chạy CI.

## 3. Deploy Railway

- New Project → Deploy from GitHub Repo.
- Chọn private repo `rendezvu-arena`.
- Gắn Railway Volume, ví dụ mount `/data`.
- Đặt `RAILWAY_VOLUME_MOUNT_PATH=/data`.
- Dùng Node.js 22.5+ và start command `npm start`.

## 4. Biến môi trường bắt buộc

Sao chép danh sách từ `.env.railway.example`. Tối thiểu phải cấu hình:

- `NODE_ENV=production`
- `APP_ORIGIN=https://ten-mien-cua-ban`
- `AUTH_SECRET`
- `EMAIL_CODE_SECRET`
- `DATABASE_PATH=/data/rendezvu-arena.sqlite`
- `UPLOAD_PATH=/data/uploads`
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `DIVINE_CARD_ADMIN_EMAIL`
- `PUBLIC_CONTACT_EMAIL`
- `RESEND_API_KEY`, `EMAIL_FROM`

Giữ `PUBLIC_SUPPORT_URL` trống ở lần phát hành đầu.

Tạo secret 64 byte:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 5. Domain và HTTPS

Tên khuyến nghị: **RendezVu Arena**. Kiểm tra trực tiếp tại registrar trước khi mua. Sau khi trỏ domain vào Railway:

- cập nhật `APP_ORIGIN`;
- cập nhật callback start.gg/Challonge;
- xác minh domain gửi email;
- kiểm tra cookie Secure và HTTPS;
- không dùng tên miền chứa tên game hoặc tên chủ sở hữu quyền.

## 6. Gate trước khi mở public

Chỉ mở public sau khi `npm run deploy:check` và `npm test` đều pass, email gỡ bỏ hoạt động, thời hạn lưu dữ liệu đã được chốt, và vấn đề quyền sử dụng media đã được giải quyết.
