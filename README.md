# Sổ tiền (monney)

Sổ quản lý tiền cá nhân: ngân sách về 0, mức tiêu mỗi ngày, hũ tiết kiệm, lịch trả nợ, hành trình thoát nợ và huy hiệu.
Dữ liệu lưu trong Postgres. Cả trang lẫn API đều được khoá bằng một mật khẩu.

```
public/index.html      giao diện (một file, không cần build)
api/                   API cho Vercel
middleware.js          khoá mật khẩu trên Vercel
lib/                   code dùng chung: kết nối Postgres, xử lý API
server.js              chạy ngoài Vercel (máy riêng, Docker)
```

Bảng dữ liệu `so_tien_docs` được tạo tự động ở lần chạy đầu.

## Biến môi trường

| Tên | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối Postgres, ví dụ `postgres://app:MAT_KHAU@103.165.144.177:32001/monney` |
| `APP_PASSWORD` | Mật khẩu để mở sổ. Tên đăng nhập gõ gì cũng được |
| `PGSSL` | Đặt `true` nếu database yêu cầu SSL |

Không bao giờ đưa mật khẩu thật vào code hay lên GitHub.

## Deploy lên Vercel

1. Vào vercel.com → **Add New → Project** → chọn repo `lupca/monney` → **Import**.
2. **Framework Preset:** Other. Để trống Build Command và Output Directory.
3. **Environment Variables:** thêm `DATABASE_URL` (dùng địa chỉ public `103.165.144.177:32001`) và `APP_PASSWORD`.
4. Bấm **Deploy**. Mở link, nhập mật khẩu.
5. Lần đầu: vào tab **Ghi chép → Sao lưu → Nhập từ file**, chọn file sao lưu để đưa dữ liệu cũ vào.

Hàm API chạy ở vùng Singapore (`sin1`) cho gần database.

## Chạy trên máy

```bash
cp .env.example .env    # sửa lại DATABASE_URL và APP_PASSWORD
npm install
node --env-file=.env server.js
# mở http://localhost:3000
```

## Docker / Kubernetes

```bash
docker build -t monney .
docker run -p 3000:3000 -e DATABASE_URL=... -e APP_PASSWORD=... monney
```

Trong cluster có thể dùng địa chỉ nội bộ `monney-rw.monney.svc.cluster.local:5432`. Kiểm tra sống: `GET /healthz`.

## Sao lưu

Tab **Ghi chép → Sao lưu → Tải bản sao lưu** tải toàn bộ sổ về dạng JSON. Nên tải mỗi tháng một lần.
File sao lưu chứa số liệu tài chính cá nhân, đừng đưa lên GitHub.
