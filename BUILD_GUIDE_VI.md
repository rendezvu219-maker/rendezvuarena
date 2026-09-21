# Build Guide: dữ liệu tĩnh và Admin local

## Kết quả

Trang `heroes.html` hiển thị Cách Build theo ID nhân vật, giữ cấu trúc Admin có sẵn: nhiều preset, 3 lá chính và tối đa 6 lá tình huống, vị trí, ảnh, tên, ghi chú và gán preset cho nhân vật. Nhân vật chưa có preset được gán sẽ hiện thông báo an toàn.

Nguồn công khai duy nhất của tính năng này là `data/character-builds.json`. GitHub Pages tải trực tiếp JSON và ảnh; không cần Node, SQLite hoặc Firebase cho Build Guide. Node vẫn dùng cục bộ để đăng nhập Admin và ghi file.

Danh sách nhân vật bắt đầu bằng 0041, 0001, 0002…0040. Chỉ 0041 giữ nhãn mới; 0038, 0039 và 0040 trở về thứ tự số.

## Khảo sát và chuyển dữ liệu

Đã kiểm tra trang nhân vật, dữ liệu roster, Admin, API, dịch vụ SQLite, catalog, bản dịch và cấu hình triển khai trước khi sửa. Tái sử dụng biểu mẫu/API và schema slot hiện có thay vì tạo một hệ thống Admin khác.

Đã xuất database hiện có `data/rendezvu-arena.sqlite` bằng kết nối chỉ đọc. Không xóa hoặc ghi lại database. JSON chứa đầy đủ:

| Loại dữ liệu | Số lượng |
| --- | ---: |
| Divine Cards | 18 |
| Bản dịch card | 108 |
| Preset build | 46 |
| Bản dịch preset | 256 |
| Lá chính trong preset | 138 |
| Lá tình huống | 90 |
| Liên kết preset–nhân vật | 42 |

Đã đối chiếu từng preset, lá chính, lá tình huống, ghi chú, thứ tự và liên kết với database gốc. JSON không xuất tài khoản, email, mật khẩu, phiên đăng nhập hay ID người quản trị. Thứ tự card mặc định chưa được Admin chỉnh được đồng bộ với catalog ảnh; thứ tự lá trong build không bị đổi.

Bốn preset vốn chưa được gán trong database đã được gán theo tên vào JSON theo yêu cầu tiếp theo của người dùng:

- ID 45: Majin Buu (Good) Recommended Build - with Bubbles (Bulla GT) → 0007
- ID 46: Frieza (First Form) Recommended Build - Set 2 → 0011
- ID 47: Super Saiyan Son Goku Recommended Build - Set 2 → 0001
- ID 48: Super Gogeta Recommended Build → 0041

JSON hiện có 46 liên kết (42 liên kết gốc và 4 liên kết bổ sung), không còn preset chưa gán. Giữ nguyên các build mặc định đang có; preset 48 là build mặc định đầu tiên của Gogeta. Các ID 0038–0040 vẫn chưa có build. Không thay đổi database gốc hoặc nội dung/các lá trong preset.

Script xuất: `npm run builds:export`. Vì file đích đã tồn tại, lệnh mặc định sẽ từ chối ghi đè để bảo vệ những lần chỉnh mới. Khi cần so sánh lại, chạy `node scripts/export-character-builds.mjs data/rendezvu-arena.sqlite data/character-builds-review.json` với một tên file mới. Không dùng các script nhập SQLite cũ để cập nhật nguồn build công khai nữa.

## Chỉnh bằng Admin và lưu

1. Chạy `npm start`, mở trang nhân vật trên localhost và đăng nhập bằng tài khoản Admin hiện có.
2. Mở quản lý Divine Cards/Build, chọn preset và ngôn ngữ, sửa rồi Save. Tạo preset mới thì dùng Assign to Heroes để gán đúng ID.
3. API giữ xác thực và CSRF hiện có, đọc JSON mới nhất và chỉ cập nhật mục được chọn. Những preset khác và các bản dịch khác được giữ nguyên.
4. Ghi qua file tạm rồi đổi tên, có khóa chống hai lần ghi đồng thời và bản sao lần lưu trước `data/character-builds.json.bak`. File thiếu hoặc hỏng gây lỗi rõ ràng, không bị thay bằng dữ liệu rỗng.
5. Refresh hoặc khởi động lại Node vẫn đọc dữ liệu đã lưu. Việc lưu trên máy chưa tự cập nhật GitHub Pages.

Preset dùng chung sẽ ảnh hưởng tất cả nhân vật được gán preset đó, đúng mô hình cũ. Nếu cần hai build độc lập, tạo hai preset riêng.

## Hiển thị và đường dẫn

`js/character-builds.js` xác định URL JSON dựa trên URL module bằng `new URL('../data/character-builds.json', import.meta.url)`. Ảnh cũng được giải theo thư mục gốc của website. Vì vậy vẫn hoạt động dưới tiền tố repository, không gọi sai `/data/...` ở gốc domain.

Trang lọc bằng `heroId`, ưu tiên preset mặc định, hiển thị ảnh/tên/ghi chú. Khi tải file thất bại hoặc chưa có build, trang đưa thông báo riêng thay vì lỗi trắng trang. Trang công khai không gọi API build để lấy dữ liệu.

## Các file thêm/sửa trong đợt chuyển sang JSON

| File | Thay đổi |
| --- | --- |
| `data/character-builds.json` | Toàn bộ dữ liệu build đã chuyển, nguồn tĩnh chính |
| `js/character-builds.js` | Kiểm tra schema, bản dịch, ánh xạ ID, tải JSON và giải URL |
| `server/character-build-store.mjs` | CRUD JSON, ghi an toàn, backup, giữ dữ liệu khác |
| `scripts/export-character-builds.mjs` | Xuất SQLite chỉ đọc, từ chối ghi đè |
| `server.js` | API Admin dùng JSON, bỏ seed build khi khởi động, chỉ phục vụ đúng file công khai |
| `js/heroes-page.js` | Mở lại Build Guide, tải nguồn tĩnh, tên/ảnh/ghi chú và trạng thái rỗng |
| `heroes.html` | Lối vào Admin local, hướng dẫn Save và phiên bản tài nguyên |
| `css/content.css` | Hiển thị tên lá, định dạng ghi chú/hướng dẫn |
| `js/heroes.js` | Thứ tự và nhãn mới của 0038–0041 |
| `data/locales/ui-pages.json` | Thông báo Build Guide cho 6 ngôn ngữ |
| `js/i18n-ui-pages.js` | Bản dịch đã biên dịch từ nguồn |
| `tests/character-builds-static.mjs` | Kiểm thử lưu, giữ dữ liệu, khởi động lại, base path và API Admin |
| `tests/heroes-data.mjs` | Kiểm tra thứ tự và nhãn mới roster |
| `.gitignore` | Không đưa backup, lock và file tạm vào Git |
| `package.json` | Thêm lệnh export/test và tích hợp kiểm thử mới |
| `STATIC_DEPLOYMENT.md` | Bổ sung hướng dẫn Build Guide trên GitHub Pages |
| `BUILD_GUIDE_VI.md` | Báo cáo và hướng dẫn này |

Các thay đổi catalog, bản dịch card và 12 ảnh card mới từ phần công việc trước cũng cần đi cùng khi triển khai. Không khôi phục hoặc gom các file báo cáo đã bị xóa ngoài phạm vi yêu cầu.

## Kiểm thử

`npm run test:builds` kiểm tra: lưu build Goku không đổi Vegeta và mọi preset khác; nhân vật chưa có build; dữ liệu giữ nguyên khi mở lại store và chạy tiến trình Node mới; lỗi dữ liệu/khóa không làm mất file; tạo/gán/bỏ gán/xóa preset; API Admin có xác thực; URL JSON và toàn bộ 18 ảnh dưới `/rendezvu-test/` trên máy chủ chỉ phục vụ tĩnh.

Đã kiểm tra trình duyệt với Goku, Vegeta và Beerus trên tiền tố này: hai nhân vật đầu hiện đúng preset riêng, Beerus hiện trạng thái chưa có hướng dẫn. `npm run check` và toàn bộ `npm test` đã chạy thành công, bao gồm bài kiểm thử mới. `git diff --check` không phát hiện lỗi khoảng trắng.

## Đưa lên GitHub Pages

1. Khởi động lại Node local để dùng dịch vụ lưu JSON mới.
2. Chỉnh và Save trong Admin nếu cần, kiểm tra đúng nhân vật/ngôn ngữ.
3. Chạy `npm run check` và `npm test`, xem diff trước khi commit.
4. Lần triển khai đầu: commit những thay đổi mã nguồn trong bảng trên, JSON, catalog/bản dịch card và 12 ảnh mới liên quan. Những lần chỉ chỉnh build sau đó thường chỉ cần JSON; thêm ảnh mới nếu đã upload card.
5. Không commit `.env`, SQLite, file `.bak`, `.lock`, file tạm hoặc dữ liệu tài khoản.
6. Push lên nhánh GitHub Pages đang dùng và đợi workflow/Pages hoàn tất. Kiểm tra trang nhân vật tại URL có tiền tố repository, tải lại nếu đang giữ cache cũ.

Chưa tự tạo commit, push hoặc triển khai. Các phần thi đấu dùng Firebase vẫn giữ cấu hình riêng như hướng dẫn `STATIC_DEPLOYMENT.md`; thay đổi này chỉ loại bỏ phụ thuộc backend của Build Guide.
