# Public Dashboard API

API này dành cho hệ thống ngoài đọc nhanh dữ liệu dashboard. Route này không dùng JWT, chỉ cho phép gọi nếu header `Origin` nằm trong danh sách `PUBLIC_DASHBOARD_ALLOWED_ORIGINS`.

## Cấu hình

```env
PUBLIC_DASHBOARD_ALLOWED_ORIGINS=https://domain-duoc-phep.com,https://man-hinh-tv.example.com
```

Domain phải khớp chính xác với header `Origin`, bao gồm protocol `http` hoặc `https`.

## Lấy tổng quan dashboard

```http
GET /api/public/dashboard/summary
Origin: https://domain-duoc-phep.com
Accept: application/json
```

Không cần body và không cần Authorization token.

### Response 200

```json
{
  "success": true,
  "data": {
    "date": "2026-05-22",
    "timezone": "Asia/Ho_Chi_Minh",
    "generatedAt": "2026-05-22T10:30:00+07:00",
    "workingEmployeeCount": 22,
    "lateEmployeeCount": 3,
    "lateEmployees": [
      {
        "employeeId": "643c1abe-b6a8-45ef-8870-ec5918e947e3",
        "employeeCode": "10",
        "fullName": "Ngô Hoàng Phúc",
        "avatarUrl": "/storage/employee-avatars/avatar.jpg",
        "departmentName": "Kho và đóng gói",
        "positionName": "Trưởng phòng",
        "lateMinutes": 6,
        "checkInAt": "07:36"
      }
    ]
  }
}
```

### Ý nghĩa field

| Field | Kiểu dữ liệu | Ý nghĩa |
| --- | --- | --- |
| `date` | string | Ngày dashboard theo múi giờ `Asia/Ho_Chi_Minh`, dạng `YYYY-MM-DD`. |
| `timezone` | string | Múi giờ hệ thống dùng để tính dashboard. |
| `generatedAt` | string | Thời điểm backend tạo response, ISO string theo `+07:00`. |
| `workingEmployeeCount` | number | Số nhân viên đang làm việc, tính theo nhân viên có trạng thái active. |
| `lateEmployeeCount` | number | Số nhân viên đi muộn trong ngày `date`. |
| `lateEmployees` | array | Danh sách nhân viên đi muộn, sắp xếp theo số phút muộn giảm dần. |
| `lateEmployees[].checkInAt` | string | Giờ chấm vào đầu tiên dùng để tính đi muộn, đã format theo giờ Việt Nam. |
| `lateEmployees[].lateMinutes` | number | Tổng số phút đi muộn trong ngày. |

### Curl mẫu

```bash
curl 'https://api-hr.delaembroidery.net/api/public/dashboard/summary' \
  -H 'Origin: https://domain-duoc-phep.com' \
  -H 'Accept: application/json'
```

## Lỗi thường gặp

### Chưa cấu hình domain public

```json
{
  "success": false,
  "error": {
    "code": "PUBLIC_DASHBOARD_CORS_NOT_CONFIGURED",
    "message": "Chưa cấu hình domain được phép gọi public dashboard"
  }
}
```

### Domain không được phép gọi

```json
{
  "success": false,
  "error": {
    "code": "PUBLIC_DASHBOARD_ORIGIN_DENIED",
    "message": "Domain không được phép gọi public dashboard"
  }
}
```
