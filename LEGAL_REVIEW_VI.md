# Đánh giá trước khi công khai — RendezVu Arena

Cập nhật: 01/08/2026

Đây là đánh giá rủi ro kỹ thuật/nội dung, không thay thế tư vấn của luật sư.

## Kết luận

Bản này phù hợp để đưa lên **GitHub private** và tiếp tục deploy thử nghiệm có kiểm soát. Chưa nên gọi là “đã sạch bản quyền” hoặc mở GitHub public, vì repo vẫn chứa ảnh nhân vật, ảnh Divine Card, tên nhân vật và phần mô tả/kỹ năng có nguồn gốc từ game hoặc website chính thức.

Đổi tên miền thành RendezVu Arena giúp giảm nguy cơ người dùng hiểu nhầm đây là website chính thức, nhưng không tạo quyền sử dụng ảnh, video, logo hoặc nội dung của chủ sở hữu.

## Các điểm đã xử lý

- Đổi thương hiệu sản phẩm từ tên game thành **RendezVu Arena**.
- Chỉ giữ tên game ở ngữ cảnh mô tả khả năng tương thích và thông báo quyền.
- Bổ sung tuyên bố không liên kết/không được chứng thực.
- Bổ sung đúng dòng ghi nhận quyền:
  - `©BIRD STUDIO/SHUEISHA, TOEI ANIMATION`
  - `©Bandai Namco Entertainment Inc.`
- Bổ sung quy trình yêu cầu gỡ bỏ nội dung và yêu cầu cấu hình email liên hệ thật.
- Tắt quảng bá donation trong lần phát hành đầu.
- Xóa `.env`, database, tài khoản local, dữ liệu cá nhân, file demo và log khỏi gói GitHub.

## Rủi ro còn lại

### 1. Ảnh và dữ liệu game

Disclaimer và credit chỉ xác định chủ sở hữu; chúng không phải giấy phép. Việc đưa ảnh vào website công khai và đặc biệt là commit chúng vào repo public vẫn là hành vi sao chép/phân phối.

Hướng an toàn nhất là xin xác nhận bằng văn bản. Nếu chưa có, để repo ở chế độ private và chuẩn bị một bản public-source không chứa media/tài liệu chính thức.

### 2. Squadra Creators Guidelines

Guidelines dành cho thành viên chương trình yêu cầu nội dung do creator tự tạo; tài sản được công ty cung cấp không được sửa và việc dùng tài sản đó được giới hạn cho video/stream liên quan đến game. Vì vậy không nên suy luận rằng Guidelines tự động cho phép dùng các tài sản đó trong một web app.

### 3. Tournament Support Program

Điều khoản chương trình ghi rằng tài sản do chương trình cung cấp chỉ được dùng cho giải đã được hỗ trợ và không được sửa đổi. Tài liệu cũng có điều khoản cấm tạo/phân phối nội dung kết hợp game với dịch vụ bên thứ ba trong phạm vi chương trình. Nếu một giải được chương trình hỗ trợ, cần hỏi Tournament Office xem RendezVu Arena có được phép dùng trong quy trình đó hay không.

Một giải được duyệt không đồng nghĩa toàn bộ website được duyệt.

### 4. Video do bạn bè quay

Sự đồng ý của streamer giải quyết quyền giữa bạn và người quay, nhưng không tự động giải quyết quyền của nhà phát hành đối với hình ảnh/âm thanh trong game. Video vẫn phải tuân thủ video policy hiện hành và sự đồng ý của người tham gia nếu giải có ghi hình/stream.

### 5. Donation

Donation đang bị tắt trong bản đầu. Chỉ bật lại sau khi xác nhận:

- không phải phí tham dự hoặc phí xem;
- không liên quan đến seed, kết quả, giải thưởng hay ưu tiên hỗ trợ;
- không đặt trên trang của giải đang xin/nhận Tournament Support nếu điều khoản cấm tài trợ;
- đã xử lý yêu cầu thuế, thanh toán và quyền nội dung.

## Điều kiện tối thiểu trước khi mở public

- Có email liên hệ/gỡ bỏ được theo dõi thường xuyên.
- Có văn bản cho phép hoặc thay toàn bộ media chưa được cấp phép.
- Chốt thời hạn lưu chat, evidence, security log và quy trình xóa tài khoản.
- Xác minh domain gửi email, OAuth callback và HTTPS.
- Không dùng logo/tên miền dễ khiến người dùng hiểu đây là website chính thức.
- Không tuyên bố “supported”, “official partner” hoặc “approved” ngoài đúng giải và đúng câu chữ được cấp.

## Nguồn chính đã đối chiếu

- Squadra Creators Guidelines: `https://dbg-squadra.bn-ent.net/en-us/pdf/creators_guideline.pdf`
- Tournament Support Program Terms and Conditions: `https://dbg-squadra.bn-ent.net/en-us/pdf/support_rules.pdf`
- Bandai Namco Entertainment Terms of Service: `https://www.bandainamcoent.com/legal/terms`
- GitHub Pages documentation: `https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site`
