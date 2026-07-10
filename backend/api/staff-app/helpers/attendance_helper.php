<?php

require_once __DIR__ . '/schema.php';

const STAFF_ATT_MOBILE_DEVICE = 'MOBILE';
const STAFF_ATT_SOURCE_ESSL = 'ESSL';
const STAFF_ATT_SOURCE_MOBILE = 'MOBILE';

function staffAttJsonResponse(int $status, string $msg, array $data = []): void
{
    http_response_code($status);
    echo json_encode([
        'msg' => $msg,
        'status' => $status,
        'data' => $data,
    ]);
    exit;
}

function staffAttNormalizeDateTime($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if ($value instanceof DateTimeInterface) {
        $formatted = $value->format('Y-m-d H:i:s');
    } else {
        $formatted = trim((string) $value);
    }

    if ($formatted === '' || str_starts_with($formatted, '1900-01-01')) {
        return null;
    }

    return $formatted;
}

function staffAttNormalizeDate($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format('Y-m-d');
    }

    $formatted = trim((string) $value);
    return $formatted !== '' ? $formatted : null;
}

function staffAttIsMobileDevice(?string $deviceId): bool
{
    return strtoupper(trim((string) $deviceId)) === STAFF_ATT_MOBILE_DEVICE;
}

function staffAttComputeDurationMinutes(?string $inTime, ?string $outTime): ?int
{
    if (!$inTime || !$outTime) {
        return null;
    }

    $seconds = strtotime($outTime) - strtotime($inTime);
    if ($seconds < 0) {
        return null;
    }

    return (int) round($seconds / 60);
}

function staffAttAppendPunchRecord(?string $existing, string $timeLabel, string $direction, string $deviceId): string
{
    $entry = sprintf('%s:%s(%s),', $timeLabel, strtolower($direction), $deviceId);
    $existing = trim((string) $existing);

    if ($existing === '') {
        return $entry;
    }

    if (str_contains($existing, $entry)) {
        return $existing;
    }

    return rtrim($existing, ',') . ',' . $entry;
}

function staffAttResolveEmployeeId(mysqli $con, string $userType, string $userCode, int $userId): string
{
    $tables = [
        'Supervisor' => ['table' => 'staff', 'id' => 'emp_id', 'code' => 'emp_code', 'essl' => 'essl_employee_id'],
        'Driver' => ['table' => 'driver', 'id' => 'driver_id', 'code' => 'driver_code', 'essl' => 'essl_employee_id'],
        'Supporting Staff' => ['table' => 'supporting_staff', 'id' => 'id', 'code' => 'ss_code', 'essl' => 'essl_employee_id'],
    ];

    if (!isset($tables[$userType])) {
        return $userCode;
    }

    $meta = $tables[$userType];
    $esslColumn = $meta['essl'];

    $columnCheck = $con->query("SHOW COLUMNS FROM {$meta['table']} LIKE '{$esslColumn}'");
    $selectEssl = ($columnCheck && $columnCheck->num_rows > 0)
        ? ", {$esslColumn} AS essl_employee_id"
        : ", NULL AS essl_employee_id";

    $stmt = $con->prepare("SELECT {$meta['code']} AS user_code {$selectEssl} FROM {$meta['table']} WHERE {$meta['id']} = ? LIMIT 1");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if (!$row) {
        return $userCode;
    }

    $esslId = trim((string) ($row['essl_employee_id'] ?? ''));
    if ($esslId !== '') {
        return $esslId;
    }

    return trim((string) ($row['user_code'] ?? $userCode));
}

function staffAttFetchTodayRecord(mysqli $con, string $employeeId, ?string $attendanceDate = null): ?array
{
    $attendanceDate = $attendanceDate ?: date('Y-m-d');

    $stmt = $con->prepare(
        "SELECT * FROM staff_attendance
         WHERE EmployeeId = ? AND AttendanceDate = ?
         ORDER BY id DESC
         LIMIT 1"
    );
    $stmt->bind_param('ss', $employeeId, $attendanceDate);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    return $row ?: null;
}

function staffAttBuildStatusPayload(?array $record, string $attendanceDate): array
{
    $checkedIn = !empty($record['InTime']);
    $checkedOut = !empty($record['OutTime']);

    return [
        'attendance_date' => $attendanceDate,
        'record_id' => $record['id'] ?? null,
        'checked_in' => $checkedIn,
        'checked_out' => $checkedOut,
        'in_time' => $record['InTime'] ?? null,
        'out_time' => $record['OutTime'] ?? null,
        'in_source' => $record['InSource'] ?? null,
        'out_source' => $record['OutSource'] ?? null,
        'in_device' => $record['InDeviceId'] ?? null,
        'out_device' => $record['OutDeviceId'] ?? null,
        'in_latitude' => isset($record['InLatitude']) ? (float) $record['InLatitude'] : null,
        'in_longitude' => isset($record['InLongitude']) ? (float) $record['InLongitude'] : null,
        'out_latitude' => isset($record['OutLatitude']) ? (float) $record['OutLatitude'] : null,
        'out_longitude' => isset($record['OutLongitude']) ? (float) $record['OutLongitude'] : null,
        'duration_minutes' => isset($record['Duration']) ? (int) $record['Duration'] : null,
        'status' => $record['Status'] ?? null,
        'can_punch_in' => !$checkedIn,
        'can_punch_out' => $checkedIn && !$checkedOut,
    ];
}

function staffAttSavePhoto(?array $file, string $prefix): ?string
{
    if (!$file || !isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($extension, $allowed, true)) {
        return null;
    }

    $uploadDir = __DIR__ . '/../attendance/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fileName = $prefix . '_' . time() . '_' . uniqid('', true) . '.' . $extension;
    $targetPath = $uploadDir . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        return null;
    }

    return 'staff-app/attendance/' . $fileName;
}

function staffAttMobilePunchIn(
    mysqli $con,
    array $user,
    string $employeeId,
    float $latitude,
    float $longitude,
    ?string $photoPath
): array {
    $attendanceDate = date('Y-m-d');
    $now = date('Y-m-d H:i:s');
    $timeLabel = date('H:i');
    $record = staffAttFetchTodayRecord($con, $employeeId, $attendanceDate);

    if ($record && !empty($record['InTime'])) {
        return [
            'ok' => false,
            'status' => 400,
            'msg' => 'Already checked in for today',
            'data' => staffAttBuildStatusPayload($record, $attendanceDate),
        ];
    }

    $mobileDevice = STAFF_ATT_MOBILE_DEVICE;
    $mobileSource = STAFF_ATT_SOURCE_MOBILE;
    $punchRecords = staffAttAppendPunchRecord(null, $timeLabel, 'in', $mobileDevice);
    $userType = $user['type'];
    $userCode = $user['user_code'];

    if ($record) {
        $stmt = $con->prepare(
            "UPDATE staff_attendance SET
                InTime = ?, InDeviceId = ?, InLatitude = ?, InLongitude = ?,
                InSource = ?, InPhoto = COALESCE(?, InPhoto),
                PunchRecords = ?, Present = 1, Absent = 0, Status = 'Present',
                StatusCode = 'P', UserType = ?, UserCode = ?, UpdatedAt = NOW()
             WHERE id = ?"
        );
        $stmt->bind_param(
            'ssddsssssi',
            $now,
            $mobileDevice,
            $latitude,
            $longitude,
            $mobileSource,
            $photoPath,
            $punchRecords,
            $userType,
            $userCode,
            $record['id']
        );
        $stmt->execute();
        $recordId = (int) $record['id'];
    } else {
        $stmt = $con->prepare(
            "INSERT INTO staff_attendance (
                AttendanceDate, EmployeeId, InTime, InDeviceId, InLatitude, InLongitude,
                InSource, InPhoto, PunchRecords, Present, Absent, Status, StatusCode,
                UserType, UserCode, UpdatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'Present', 'P', ?, ?, NOW())"
        );
        $stmt->bind_param(
            'ssssddsssss',
            $attendanceDate,
            $employeeId,
            $now,
            $mobileDevice,
            $latitude,
            $longitude,
            $mobileSource,
            $photoPath,
            $punchRecords,
            $userType,
            $userCode
        );
        $stmt->execute();
        $recordId = (int) $con->insert_id;
    }

    $updated = staffAttFetchTodayRecord($con, $employeeId, $attendanceDate);

    return [
        'ok' => true,
        'status' => 200,
        'msg' => 'Check-in recorded successfully',
        'data' => staffAttBuildStatusPayload($updated, $attendanceDate),
        'record_id' => $recordId,
    ];
}

function staffAttMobilePunchOut(
    mysqli $con,
    array $user,
    string $employeeId,
    float $latitude,
    float $longitude,
    ?string $photoPath
): array {
    $attendanceDate = date('Y-m-d');
    $now = date('Y-m-d H:i:s');
    $timeLabel = date('H:i');
    $record = staffAttFetchTodayRecord($con, $employeeId, $attendanceDate);

    if (!$record || empty($record['InTime'])) {
        return [
            'ok' => false,
            'status' => 400,
            'msg' => 'You are not checked in for today',
            'data' => staffAttBuildStatusPayload($record, $attendanceDate),
        ];
    }

    if (!empty($record['OutTime'])) {
        return [
            'ok' => false,
            'status' => 400,
            'msg' => 'Already checked out for today',
            'data' => staffAttBuildStatusPayload($record, $attendanceDate),
        ];
    }

    $duration = staffAttComputeDurationMinutes($record['InTime'], $now);
    $mobileDevice = STAFF_ATT_MOBILE_DEVICE;
    $mobileSource = STAFF_ATT_SOURCE_MOBILE;
    $punchRecords = staffAttAppendPunchRecord(
        $record['PunchRecords'] ?? '',
        $timeLabel,
        'out',
        $mobileDevice
    );

    $stmt = $con->prepare(
        "UPDATE staff_attendance SET
            OutTime = ?, OutDeviceId = ?, OutLatitude = ?, OutLongitude = ?,
            OutSource = ?, OutPhoto = COALESCE(?, OutPhoto),
            Duration = ?, PunchRecords = ?, UpdatedAt = NOW()
         WHERE id = ?"
    );
    $stmt->bind_param(
        'ssddssisi',
        $now,
        $mobileDevice,
        $latitude,
        $longitude,
        $mobileSource,
        $photoPath,
        $duration,
        $punchRecords,
        $record['id']
    );
    $stmt->execute();

    $updated = staffAttFetchTodayRecord($con, $employeeId, $attendanceDate);

    return [
        'ok' => true,
        'status' => 200,
        'msg' => 'Check-out recorded successfully',
        'data' => staffAttBuildStatusPayload($updated, $attendanceDate),
        'record_id' => (int) $record['id'],
    ];
}

function staffAttNormalizeEsslRow(array $row): array
{
    return [
        'AttendanceLogId' => (int) ($row['AttendanceLogId'] ?? 0),
        'AttendanceDate' => staffAttNormalizeDate($row['AttendanceDate'] ?? null),
        'EmployeeId' => trim((string) ($row['EmployeeId'] ?? '')),
        'InTime' => staffAttNormalizeDateTime($row['InTime'] ?? null),
        'InDeviceId' => trim((string) ($row['InDeviceId'] ?? '')),
        'OutTime' => staffAttNormalizeDateTime($row['OutTime'] ?? null),
        'OutDeviceId' => trim((string) ($row['OutDeviceId'] ?? '')),
        'Duration' => (int) ($row['Duration'] ?? 0),
        'LateBy' => (int) ($row['LateBy'] ?? 0),
        'EarlyBy' => (int) ($row['EarlyBy'] ?? 0),
        'IsOnLeave' => (int) ($row['IsOnLeave'] ?? 0),
        'LeaveType' => trim((string) ($row['LeaveType'] ?? '')),
        'LeaveDuration' => (int) ($row['LeaveDuration'] ?? 0),
        'WeeklyOff' => (int) ($row['WeeklyOff'] ?? 0),
        'Holiday' => (int) ($row['Holiday'] ?? 0),
        'LeaveRemarks' => trim((string) ($row['LeaveRemarks'] ?? '')),
        'PunchRecords' => trim((string) ($row['PunchRecords'] ?? '')),
        'ShiftId' => (int) ($row['ShiftId'] ?? 0),
        'Present' => (int) ($row['Present'] ?? 0),
        'Absent' => (int) ($row['Absent'] ?? 0),
        'Status' => trim((string) ($row['Status'] ?? '')),
        'StatusCode' => trim((string) ($row['StatusCode'] ?? '')),
        'P1Status' => trim((string) ($row['P1Status'] ?? '')),
        'P2Status' => trim((string) ($row['P2Status'] ?? '')),
        'P3Status' => trim((string) ($row['P3Status'] ?? '')),
        'IsonSpecialOff' => (int) ($row['IsonSpecialOff'] ?? 0),
        'SpecialOffType' => trim((string) ($row['SpecialOffType'] ?? '')),
        'SpecialOffRemark' => trim((string) ($row['SpecialOffRemark'] ?? '')),
        'SpecialOffDuration' => (int) ($row['SpecialOffDuration'] ?? 0),
        'OverTime' => (int) ($row['OverTime'] ?? 0),
        'OverTimeE' => (int) ($row['OverTimeE'] ?? 0),
        'MissedOutPunch' => (int) ($row['MissedOutPunch'] ?? 0),
        'Remarks' => trim((string) ($row['Remarks'] ?? '')),
        'MissedInPunch' => (int) ($row['MissedInPunch'] ?? 0),
        'LeaveTypeId' => (int) ($row['LeaveTypeId'] ?? 0),
        'LossOfHours' => (int) ($row['LossOfHours'] ?? 0),
    ];
}

function staffAttMergeTimesForEssl(array $existing, array $essl): array
{
    $existingIn = staffAttNormalizeDateTime($existing['InTime'] ?? null);
    $existingOut = staffAttNormalizeDateTime($existing['OutTime'] ?? null);
    $esslIn = $essl['InTime'];
    $esslOut = $essl['OutTime'];

    $finalIn = $existingIn ?: $esslIn;
    $finalOut = $esslOut ?: $existingOut;

    $finalInDevice = $existingIn
        ? ($existing['InDeviceId'] ?: ($essl['InDeviceId'] ?: STAFF_ATT_MOBILE_DEVICE))
        : ($essl['InDeviceId'] ?: STAFF_ATT_MOBILE_DEVICE);

    $finalOutDevice = $esslOut
        ? ($essl['OutDeviceId'] ?: STAFF_ATT_MOBILE_DEVICE)
        : ($existingOut ? ($existing['OutDeviceId'] ?: STAFF_ATT_MOBILE_DEVICE) : null);

    $finalInSource = !empty($existing['InSource'])
        ? $existing['InSource']
        : ($esslIn && !staffAttIsMobileDevice($essl['InDeviceId']) ? STAFF_ATT_SOURCE_ESSL : null);

    if (!$finalInSource && $finalIn) {
        $finalInSource = staffAttIsMobileDevice($finalInDevice)
            ? STAFF_ATT_SOURCE_MOBILE
            : STAFF_ATT_SOURCE_ESSL;
    }

    $finalOutSource = $esslOut && !staffAttIsMobileDevice($essl['OutDeviceId'])
        ? STAFF_ATT_SOURCE_ESSL
        : ($existingOut ? ($existing['OutSource'] ?: STAFF_ATT_SOURCE_MOBILE) : null);

    $duration = staffAttComputeDurationMinutes($finalIn, $finalOut);
    if ($duration === null && !empty($essl['Duration'])) {
        $duration = (int) $essl['Duration'];
    }

    $punchRecords = $essl['PunchRecords'] ?: ($existing['PunchRecords'] ?? '');
    if ($existingOut && staffAttIsMobileDevice($existing['OutDeviceId'] ?? '') && !str_contains($punchRecords, 'out(MOBILE)')) {
        $punchRecords = staffAttAppendPunchRecord(
            $punchRecords,
            date('H:i', strtotime($existingOut)),
            'out',
            STAFF_ATT_MOBILE_DEVICE
        );
    }

    return [
        'InTime' => $finalIn,
        'InDeviceId' => $finalInDevice,
        'OutTime' => $finalOut,
        'OutDeviceId' => $finalOutDevice,
        'InSource' => $finalInSource,
        'OutSource' => $finalOutSource,
        'Duration' => $duration,
        'PunchRecords' => $punchRecords,
    ];
}

function staffAttUpsertEsslRow(mysqli $con, array $rawEsslRow): array
{
    ensureStaffAttendanceSchema($con);

    $essl = staffAttNormalizeEsslRow($rawEsslRow);
    if ($essl['AttendanceLogId'] <= 0 || $essl['EmployeeId'] === '') {
        return ['action' => 'skipped', 'reason' => 'invalid_row'];
    }

    $attendanceDate = $essl['AttendanceDate'] ?: ($essl['InTime'] ? date('Y-m-d', strtotime($essl['InTime'])) : null);
    if (!$attendanceDate) {
        return ['action' => 'skipped', 'reason' => 'missing_date'];
    }
    $essl['AttendanceDate'] = $attendanceDate;

    $byLogStmt = $con->prepare('SELECT * FROM staff_attendance WHERE AttendanceLogId = ? LIMIT 1');
    $byLogStmt->bind_param('i', $essl['AttendanceLogId']);
    $byLogStmt->execute();
    $existing = $byLogStmt->get_result()->fetch_assoc();

    if (!$existing) {
        $byDayStmt = $con->prepare(
            "SELECT * FROM staff_attendance
             WHERE EmployeeId = ? AND AttendanceDate = ?
               AND (AttendanceLogId IS NULL OR AttendanceLogId = 0)
             ORDER BY id DESC
             LIMIT 1"
        );
        $byDayStmt->bind_param('ss', $essl['EmployeeId'], $attendanceDate);
        $byDayStmt->execute();
        $existing = $byDayStmt->get_result()->fetch_assoc();
    }

    $merged = staffAttMergeTimesForEssl($existing ?: [], $essl);

    if ($existing) {
        $stmt = $con->prepare(
            "UPDATE staff_attendance SET
                AttendanceLogId = ?, AttendanceDate = ?, EmployeeId = ?,
                InTime = ?, InDeviceId = ?, OutTime = ?, OutDeviceId = ?,
                Duration = ?, LateBy = ?, EarlyBy = ?, IsOnLeave = ?, LeaveType = ?,
                LeaveDuration = ?, WeeklyOff = ?, Holiday = ?, LeaveRemarks = ?,
                PunchRecords = ?, ShiftId = ?, Present = ?, Absent = ?, Status = ?,
                StatusCode = ?, P1Status = ?, P2Status = ?, P3Status = ?,
                IsonSpecialOff = ?, SpecialOffType = ?, SpecialOffRemark = ?,
                SpecialOffDuration = ?, OverTime = ?, OverTimeE = ?, MissedOutPunch = ?,
                Remarks = ?, MissedInPunch = ?, LeaveTypeId = ?, LossOfHours = ?,
                InSource = COALESCE(?, InSource), OutSource = COALESCE(?, OutSource),
                UpdatedAt = NOW()
             WHERE id = ?"
        );
        $stmt->bind_param(
            'issssssiiiisiiissiisssssisssiiiiissi',
            $essl['AttendanceLogId'],
            $essl['AttendanceDate'],
            $essl['EmployeeId'],
            $merged['InTime'],
            $merged['InDeviceId'],
            $merged['OutTime'],
            $merged['OutDeviceId'],
            $merged['Duration'],
            $essl['LateBy'],
            $essl['EarlyBy'],
            $essl['IsOnLeave'],
            $essl['LeaveType'],
            $essl['LeaveDuration'],
            $essl['WeeklyOff'],
            $essl['Holiday'],
            $essl['LeaveRemarks'],
            $merged['PunchRecords'],
            $essl['ShiftId'],
            $essl['Present'],
            $essl['Absent'],
            $essl['Status'],
            $essl['StatusCode'],
            $essl['P1Status'],
            $essl['P2Status'],
            $essl['P3Status'],
            $essl['IsonSpecialOff'],
            $essl['SpecialOffType'],
            $essl['SpecialOffRemark'],
            $essl['SpecialOffDuration'],
            $essl['OverTime'],
            $essl['OverTimeE'],
            $essl['MissedOutPunch'],
            $essl['Remarks'],
            $essl['MissedInPunch'],
            $essl['LeaveTypeId'],
            $essl['LossOfHours'],
            $merged['InSource'],
            $merged['OutSource'],
            $existing['id']
        );
        $stmt->execute();

        return ['action' => 'updated', 'id' => (int) $existing['id'], 'AttendanceLogId' => $essl['AttendanceLogId']];
    }

    $stmt = $con->prepare(
        "INSERT INTO staff_attendance (
            AttendanceLogId, AttendanceDate, EmployeeId, InTime, InDeviceId, OutTime, OutDeviceId,
            Duration, LateBy, EarlyBy, IsOnLeave, LeaveType, LeaveDuration, WeeklyOff, Holiday,
            LeaveRemarks, PunchRecords, ShiftId, Present, Absent, Status, StatusCode, P1Status,
            P2Status, P3Status, IsonSpecialOff, SpecialOffType, SpecialOffRemark, SpecialOffDuration,
            OverTime, OverTimeE, MissedOutPunch, Remarks, MissedInPunch, LeaveTypeId, LossOfHours,
            InSource, OutSource, UpdatedAt
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, NOW()
        )"
    );

    $inSource = $essl['InTime'] && !staffAttIsMobileDevice($essl['InDeviceId']) ? STAFF_ATT_SOURCE_ESSL : null;
    $outSource = $essl['OutTime'] && !staffAttIsMobileDevice($essl['OutDeviceId']) ? STAFF_ATT_SOURCE_ESSL : null;
    $duration = staffAttComputeDurationMinutes($essl['InTime'], $essl['OutTime']) ?? $essl['Duration'];

    $stmt->bind_param(
        'issssssiiiisiiissiisssssisssiiiiiss',
        $essl['AttendanceLogId'],
        $essl['AttendanceDate'],
        $essl['EmployeeId'],
        $essl['InTime'],
        $essl['InDeviceId'],
        $essl['OutTime'],
        $essl['OutDeviceId'],
        $duration,
        $essl['LateBy'],
        $essl['EarlyBy'],
        $essl['IsOnLeave'],
        $essl['LeaveType'],
        $essl['LeaveDuration'],
        $essl['WeeklyOff'],
        $essl['Holiday'],
        $essl['LeaveRemarks'],
        $essl['PunchRecords'],
        $essl['ShiftId'],
        $essl['Present'],
        $essl['Absent'],
        $essl['Status'],
        $essl['StatusCode'],
        $essl['P1Status'],
        $essl['P2Status'],
        $essl['P3Status'],
        $essl['IsonSpecialOff'],
        $essl['SpecialOffType'],
        $essl['SpecialOffRemark'],
        $essl['SpecialOffDuration'],
        $essl['OverTime'],
        $essl['OverTimeE'],
        $essl['MissedOutPunch'],
        $essl['Remarks'],
        $essl['MissedInPunch'],
        $essl['LeaveTypeId'],
        $essl['LossOfHours'],
        $inSource,
        $outSource
    );
    $stmt->execute();

    return ['action' => 'inserted', 'id' => (int) $con->insert_id, 'AttendanceLogId' => $essl['AttendanceLogId']];
}
