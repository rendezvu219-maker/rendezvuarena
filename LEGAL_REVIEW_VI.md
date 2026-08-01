# Đánh giá trước khi công khai — RendezVu Arena

Cập nhật: 01/08/2026

Đây là đánh giá rủi ro kỹ thuật/nội dung, không thay thế tư vấn của luật sư.

## Kết luận đã hiệu chỉnh

Báo cáo trước đã xếp tên nhân vật, tên kỹ năng và dữ liệu cơ chế vào cùng nhóm rủi ro với artwork. Cách diễn đạt đó quá rộng.

- **Tên nhân vật, tên kỹ năng, chỉ số, vai trò và cơ chế gameplay** chủ yếu là định danh ngắn hoặc dữ kiện dùng để nhận diện và vận hành giải đấu. Đây không phải trọng tâm rủi ro bản quyền của dự án. Tuy vậy, tên/logo vẫn có thể liên quan đến nhãn hiệu và website phải tránh gây hiểu nhầm là sản phẩm chính thức.
- **Mô tả kỹ năng dài sao chép nguyên văn** có thể chứa cách diễn đạt sáng tạo. Nên ưu tiên mô tả ngắn, bản dịch/diễn giải do dự án biên tập, ghi nguồn và chỉ trích dẫn đúng phần cần thiết.
- **Ảnh nhân vật, icon kỹ năng, Divine Card và role icon** là phần rủi ro rõ nhất vì đây là tác phẩm hình ảnh được sao chép vào repo và phục vụ trực tiếp trên website.

Hai ảnh chụp trong game từng dùng để xác minh bản dịch đã được xóa hoàn toàn. Dự án chỉ giữ lại các trường đã được chép và kiểm tra; không còn đường dẫn, hash hay file ảnh bằng chứng trong gói public.

## Điểm pháp lý quan trọng

### Dữ kiện và tên gọi

WIPO nêu rằng quyền tác giả bảo hộ **cách thể hiện**, không bảo hộ ý tưởng, thủ tục, phương pháp hoặc khái niệm; tên, tiêu đề và khẩu hiệu có được bảo hộ hay không phụ thuộc mức độ sáng tạo. U.S. Copyright Office cũng nêu rõ tên, tiêu đề và cụm từ ngắn không thuộc đối tượng quyền tác giả tại Hoa Kỳ. Đây là cơ sở hợp lý để đánh giá tên nhân vật/kỹ năng và dữ kiện gameplay có rủi ro bản quyền thấp hơn artwork.

Mục đích wiki, bình luận, giới thiệu và tổ chức giải đấu là yếu tố hỗ trợ tính chính đáng của việc tham chiếu. Luật Sở hữu trí tuệ Việt Nam có ngoại lệ cho việc trích dẫn hợp lý để bình luận, giới thiệu hoặc minh họa, nhưng ngoại lệ này vẫn phụ thuộc phạm vi, mục đích, nguồn ghi nhận và việc sử dụng có ảnh hưởng bất hợp lý đến quyền của chủ sở hữu hay không.

### Hình ảnh công khai trên website chính thức

Việc một hình ảnh được công khai để mọi người xem hoặc tương tác **không làm hình ảnh trở thành public domain và không tự tạo giấy phép sao chép/phân phối**. Vì repo chứa bản sao cục bộ của các file hình, rủi ro này khác với việc chỉ đặt liên kết đến trang chính thức.

Điều đó không có nghĩa website chắc chắn vi phạm. Việc sử dụng giới hạn, có mục đích nhận diện/bình luận, không thay thế game hay kho asset, có ghi nguồn và cơ chế gỡ bỏ có thể giúp lập luận của dự án tốt hơn. Tuy nhiên, không thể kết luận “không thể có bản quyền” chỉ vì asset đã được đăng công khai.

## Trạng thái phát hành

- **GitHub private:** sẵn sàng.
- **Website cộng đồng public:** có thể triển khai về mặt kỹ thuật, với thông báo độc lập, ghi nguồn và quy trình gỡ bỏ; rủi ro pháp lý còn tập trung ở visual assets.
- **GitHub public chứa toàn bộ asset:** rủi ro cao hơn website vận hành vì GitHub cho phép tải và phân phối trực tiếp toàn bộ file gốc. Nên cân nhắc repo code public nhưng asset private/được tải khi deploy, hoặc giữ repo private trong giai đoạn đầu.

## Các biện pháp đã có

- Thương hiệu độc lập **RendezVu Arena**; không dùng tên game làm tên sản phẩm hoặc tên miền.
- Chỉ dùng tên game để mô tả khả năng tương thích và nguồn dữ liệu.
- Tuyên bố không liên kết/không được chứng thực và ghi nhận đúng chủ thể quyền.
- Không cung cấp giao diện tải xuống hàng loạt hoặc biến website thành kho asset.
- Có trang yêu cầu gỡ bỏ/sửa nguồn và yêu cầu email liên hệ thật trước khi launch.
- Donation bị tắt trong lần phát hành đầu.
- Đã xóa `.env`, database, dữ liệu cá nhân, file demo, log và ảnh bằng chứng dịch.

## Creator/Tournament Program

Squadra Creators Guidelines áp dụng cho thành viên chương trình và giới hạn asset **do Công ty cung cấp trong chương trình** vào video/stream liên quan đến game. Vì vậy tài liệu này không phải giấy phép chung cho web app, nhưng cũng không nên suy diễn rằng mọi ảnh công khai trên website chính thức đều thuộc đúng nhóm “provided assets” của chương trình.

Tournament Support Program yêu cầu giải được hỗ trợ phải phi lợi nhuận, cấm phí tham dự/phí xem và tài trợ bên thứ ba, đồng thời có quy định riêng đối với asset được cung cấp cho giải. Một giải được duyệt không đồng nghĩa toàn bộ nền tảng được duyệt.

## Khuyến nghị thực tế

1. Public website trước, nhưng giữ repository chứa asset ở chế độ private trong giai đoạn đầu.
2. Chỉ hiển thị ảnh ở kích thước/phạm vi cần cho chức năng chọn tướng, draft và tra cứu; không mở endpoint tải nguyên bộ.
3. Với mô tả kỹ năng, ưu tiên dữ kiện ngắn và diễn giải do dự án biên tập thay vì sao chép nguyên đoạn marketing.
4. Luôn ghi nguồn chính thức, dòng quyền và email gỡ bỏ hoạt động.
5. Nếu nhận phản đối từ chủ thể quyền, gỡ asset được nêu trước rồi mới tranh luận phạm vi ngoại lệ.

## Nguồn đã đối chiếu

- WIPO — Copyright protection and expression: `https://www.wipo.int/en/web/copyright/protection`
- U.S. Copyright Office — names, titles and short phrases: `https://www.copyright.gov/help/faq/faq-protect.html`
- Luật số 07/2022/QH15 sửa đổi Luật Sở hữu trí tuệ, hiệu lực từ 01/01/2023: `https://www.wipo.int/wipolex/en/legislation/details/21740`
- Squadra Creators Guidelines: `https://dbg-squadra.bn-ent.net/en-us/pdf/creators_guideline.pdf`
- Tournament Support Program Terms: `https://dbg-squadra.bn-ent.net/en-us/pdf/support_rules.pdf`
