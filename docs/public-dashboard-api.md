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
    "monthlyAttendance": {
      "month": "2026-05",
      "from": "2026-05-01",
      "to": "2026-05-22",
      "lateEmployeeCount": 8,
      "earlyLeaveEmployeeCount": 4,
      "totalLateMinutes": 390,
      "totalEarlyLeaveMinutes": 125,
      "totalEarlyLateMinutes": 515,
      "totalLateHours": 6.5,
      "totalEarlyLeaveHours": 2.08,
      "totalEarlyLateHours": 8.58
    },
    "lateEmployees": [
      {
        "employeeId": "643c1abe-b6a8-45ef-8870-ec5918e947e3",
        "employeeCode": "10",
        "fullName": "Ngô Hoàng Phúc",
        "avatarUrl": "/storage/employee-avatars/avatar.jpg",
        "departmentName": "Kho và đóng gói",
        "positionName": "Trưởng phòng",
        "lateMinutes": 14,
        "checkInAt": "07:36",
        "lateShifts": [
          {
            "key": "morning",
            "label": "Ca sáng",
            "plannedStart": "07:30",
            "checkInAt": "07:36",
            "lateMinutes": 6
          },
          {
            "key": "afternoon",
            "label": "Ca chiều",
            "plannedStart": "13:30",
            "checkInAt": "13:38",
            "lateMinutes": 8
          }
        ],
        "monthlyLateMinutes": 72,
        "monthlyEarlyLeaveMinutes": 30,
        "monthlyEarlyLateMinutes": 102,
        "monthlyLateHours": 1.2,
        "monthlyEarlyLeaveHours": 0.5,
        "monthlyEarlyLateHours": 1.7
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
| `lateEmployeeCount` | number | Số nhân viên có ít nhất một ca đi muộn trong ngày `date`. |
| `monthlyAttendance` | object | Thống kê đi muộn/về sớm của tháng hiện tại, tính từ ngày đầu tháng đến `date`. |
| `monthlyAttendance.month` | string | Tháng thống kê, dạng `YYYY-MM`. |
| `monthlyAttendance.from` | string | Ngày bắt đầu khoảng thống kê tháng, dạng `YYYY-MM-DD`. |
| `monthlyAttendance.to` | string | Ngày kết thúc khoảng thống kê tháng, bằng `date`. |
| `monthlyAttendance.lateEmployeeCount` | number | Số nhân viên có ít nhất một lần đi muộn trong tháng. |
| `monthlyAttendance.earlyLeaveEmployeeCount` | number | Số nhân viên có ít nhất một lần về sớm trong tháng. |
| `monthlyAttendance.totalLateMinutes` | number | Tổng số phút đi muộn của toàn bộ nhân viên trong tháng. |
| `monthlyAttendance.totalEarlyLeaveMinutes` | number | Tổng số phút về sớm của toàn bộ nhân viên trong tháng. |
| `monthlyAttendance.totalEarlyLateMinutes` | number | Tổng số phút đi muộn + về sớm của toàn bộ nhân viên trong tháng. |
| `monthlyAttendance.totalLateHours` | number | Tổng giờ đi muộn của toàn bộ nhân viên trong tháng, làm tròn 2 chữ số thập phân. |
| `monthlyAttendance.totalEarlyLeaveHours` | number | Tổng giờ về sớm của toàn bộ nhân viên trong tháng, làm tròn 2 chữ số thập phân. |
| `monthlyAttendance.totalEarlyLateHours` | number | Tổng giờ đi muộn + về sớm của toàn bộ nhân viên trong tháng, làm tròn 2 chữ số thập phân. |
| `lateEmployees` | array | Danh sách nhân viên đi muộn ở bất kỳ ca nào trong ngày, sắp xếp theo số phút muộn giảm dần. |
| `lateEmployees[].checkInAt` | string | Giờ chấm vào của ca bị trễ đầu tiên trong ngày, đã format theo giờ Việt Nam. Giữ lại để tương thích với tích hợp cũ. |
| `lateEmployees[].lateMinutes` | number | Tổng số phút đi muộn trong ngày. |
| `lateEmployees[].lateShifts` | array | Danh sách các ca bị trễ trong ngày. Có thể có ca sáng, ca chiều và ca 3. |
| `lateEmployees[].lateShifts[].key` | string | Mã ca: `morning`, `afternoon`, hoặc `night`. |
| `lateEmployees[].lateShifts[].label` | string | Tên ca hiển thị. |
| `lateEmployees[].lateShifts[].plannedStart` | string | Giờ bắt đầu ca theo cài đặt chấm công. |
| `lateEmployees[].lateShifts[].checkInAt` | string | Giờ chấm vào thực tế của ca bị trễ. |
| `lateEmployees[].lateShifts[].lateMinutes` | number | Số phút trễ của riêng ca này, tính từ `plannedStart` đến `checkInAt`. |
| `lateEmployees[].monthlyLateMinutes` | number | Tổng số phút đi muộn của nhân viên này trong tháng hiện tại. |
| `lateEmployees[].monthlyEarlyLeaveMinutes` | number | Tổng số phút về sớm của nhân viên này trong tháng hiện tại. |
| `lateEmployees[].monthlyEarlyLateMinutes` | number | Tổng số phút đi muộn + về sớm của nhân viên này trong tháng hiện tại. |
| `lateEmployees[].monthlyLateHours` | number | Tổng giờ đi muộn của nhân viên này trong tháng hiện tại, làm tròn 2 chữ số thập phân. |
| `lateEmployees[].monthlyEarlyLeaveHours` | number | Tổng giờ về sớm của nhân viên này trong tháng hiện tại, làm tròn 2 chữ số thập phân. |
| `lateEmployees[].monthlyEarlyLateHours` | number | Tổng giờ đi muộn + về sớm của nhân viên này trong tháng hiện tại, làm tròn 2 chữ số thập phân. |

## Cách ghép API lên màn hình

### Chỉ số tổng quan

| Nội dung hiển thị | Field nên dùng | Ghi chú |
| --- | --- | --- |
| Ngày dữ liệu | `data.date` | Ngày theo giờ Việt Nam. |
| Nhân viên đang làm việc | `data.workingEmployeeCount` | Đếm nhân viên active. |
| Nhân viên đi trễ hôm nay | `data.lateEmployeeCount` | Đếm nhân viên có ít nhất một ca đi trễ trong ngày. |
| Tổng phút đi trễ tháng | `data.monthlyAttendance.totalLateMinutes` | Tính từ đầu tháng đến `data.date`. |
| Tổng phút về sớm tháng | `data.monthlyAttendance.totalEarlyLeaveMinutes` | Tính từ đầu tháng đến `data.date`. |
| Tổng giờ sớm, muộn tháng | `data.monthlyAttendance.totalEarlyLateHours` | Nên dùng cho card tổng hợp theo giờ. |

### Bảng nhân viên đi trễ hôm nay

| Cột hiển thị | Field nên dùng | Ghi chú |
| --- | --- | --- |
| Mã nhân viên | `lateEmployees[].employeeCode` |  |
| Họ tên | `lateEmployees[].fullName` |  |
| Ảnh | `lateEmployees[].avatarUrl` | Nếu là path tương đối, ghép với domain API backend. |
| Bộ phận | `lateEmployees[].departmentName` |  |
| Chức vụ | `lateEmployees[].positionName` |  |
| Tổng phút trễ hôm nay | `lateEmployees[].lateMinutes` | Tổng theo ngày. |
| Các ca đi trễ hôm nay | `lateEmployees[].lateShifts[]` | Lặp array này để hiển thị đủ ca sáng, ca chiều, ca 3. Không chỉ đọc `checkInAt`. |
| Tổng giờ sớm, muộn trong tháng | `lateEmployees[].monthlyEarlyLateHours` | Cột này là tổng đi muộn + về sớm trong tháng của từng nhân viên. |

Ví dụ render cột `Các ca đi trễ hôm nay`:

```ts
const lateShiftText = employee.lateShifts
  .map((shift) => `${shift.label}: ${shift.checkInAt} (${shift.lateMinutes} phút)`)
  .join(", ");
```

Nếu chỉ cần hiển thị một giờ check-in ngắn gọn, có thể dùng `lateEmployees[].checkInAt`, nhưng field này chỉ là ca trễ đầu tiên để tương thích phiên bản cũ. Muốn hiển thị đủ ca chiều 13:30 hoặc ca 3 thì phải đọc `lateShifts[]`.

### TypeScript type gợi ý

```ts
type PublicDashboardSummary = {
  date: string;
  timezone: "Asia/Ho_Chi_Minh";
  generatedAt: string;
  workingEmployeeCount: number;
  lateEmployeeCount: number;
  monthlyAttendance: {
    month: string;
    from: string;
    to: string;
    lateEmployeeCount: number;
    earlyLeaveEmployeeCount: number;
    totalLateMinutes: number;
    totalEarlyLeaveMinutes: number;
    totalEarlyLateMinutes: number;
    totalLateHours: number;
    totalEarlyLeaveHours: number;
    totalEarlyLateHours: number;
  };
  lateEmployees: Array<{
    employeeId: string;
    employeeCode: string;
    fullName: string;
    avatarUrl: string | null;
    departmentName: string;
    positionName: string;
    lateMinutes: number;
    checkInAt: string | null;
    lateShifts: Array<{
      key: "morning" | "afternoon" | "night";
      label: string;
      plannedStart: string;
      checkInAt: string;
      lateMinutes: number;
    }>;
    monthlyLateMinutes: number;
    monthlyEarlyLeaveMinutes: number;
    monthlyEarlyLateMinutes: number;
    monthlyLateHours: number;
    monthlyEarlyLeaveHours: number;
    monthlyEarlyLateHours: number;
  }>;
};
```

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
