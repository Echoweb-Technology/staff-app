<?php

/**
 * DB migration SQL for vehicle_checklist table:
 *
 * CREATE TABLE vehicle_checklist (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   supervisor_emp_id VARCHAR(50) NOT NULL,
 *   supervisor_name VARCHAR(100) DEFAULT '',
 *   vehicle_id VARCHAR(50) NOT NULL,
 *   vehicle_reg VARCHAR(50) DEFAULT '',
 *   driver_id VARCHAR(50) DEFAULT '',
 *   driver_name VARCHAR(100) DEFAULT '',
 *   inspection_date DATE NOT NULL,
 *   inspection_image VARCHAR(255) DEFAULT '',
 *
 *   -- 18 checklist items
 *   document_folder ENUM('yes','no') NOT NULL,
 *   car_body_inner ENUM('yes','no') NOT NULL,
 *   car_body_outer ENUM('yes','no') NOT NULL,
 *   driver_behavior ENUM('poor','average','good') NOT NULL,
 *   driver_uniform ENUM('yes','no') NOT NULL,
 *   first_aid_box ENUM('yes','no') NOT NULL,
 *   fire_extinguisher ENUM('yes','no') NOT NULL,
 *   torch ENUM('yes','no') NOT NULL,
 *   umbrella ENUM('yes','no') NOT NULL,
 *   seat_cover ENUM('yes','no') NOT NULL,
 *   gps ENUM('yes','no') NOT NULL,
 *   extra_tyre ENUM('yes','no') NOT NULL,
 *   vehicle_tool_kit ENUM('yes','no') NOT NULL,
 *   dnd_tag ENUM('yes','no') NOT NULL,
 *   head_rest ENUM('yes','no') NOT NULL,
 *   napkin_box ENUM('yes','no') NOT NULL,
 *   car_perfume ENUM('yes','no') NOT NULL,
 *   car_charger ENUM('yes','no') NOT NULL,
 *
 *   remarks JSON DEFAULT NULL,
 *   overall_status ENUM('pass','fail') NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 */

const CHECKLIST_UPLOAD_RELATIVE_PATH = 'staff-app/checklist';

function checklistJsonResponse(int $status, string $msg, $data = null): void
{
    http_response_code($status);
    $payload = ['msg' => $msg, 'status' => $status];
    if ($data !== null) {
        $payload['data'] = $data;
    }
    echo json_encode($payload);
    exit;
}

function checklistGetUserFromJWT(): array
{
    $headers = function_exists('apache_request_headers')
        ? apache_request_headers()
        : getallheaders();
    return validateJWT($headers);
}

function checklistGetCurrentMonthRange(): array
{
    $year = date('Y');
    $month = date('m');
    return [
        'start' => "{$year}-{$month}-01",
        'end' => date('Y-m-t', strtotime("{$year}-{$month}-01")),
    ];
}

function checklistFetchSupervisorVehicles(mysqli $con, string $empId, string $search = ''): array
{
    $range = checklistGetCurrentMonthRange();

    $sql = "SELECT DISTINCT mb.vehicle
         FROM monthly_booking mb
         WHERE mb.supervisor = ?
           AND mb.date_from >= ?
           AND mb.date_from <= ?";

    $params = [$empId, $range['start'], $range['end']];
    $types = 'sss';

    if ($search !== '') {
        $sql .= " AND mb.vehicle LIKE ?";
        $params[] = '%' . $search . '%';
        $types .= 's';
    }

    $sql .= " ORDER BY mb.vehicle ASC LIMIT 30";

    $stmt = $con->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $vehicles = [];
    while ($row = $result->fetch_assoc()) {
        $reg = trim($row['vehicle']);
        if ($reg === '') {
            continue;
        }

        // Look up vehicle_id and driver info from vehicle table
        $vStmt = $con->prepare(
            "SELECT vehicle_id, registration, driver, driver1
             FROM vehicle
             WHERE registration = ?
             LIMIT 1"
        );
        $vStmt->bind_param('s', $reg);
        $vStmt->execute();
        $vRow = $vStmt->get_result()->fetch_assoc();

        $vehicles[] = [
            'vehicle_id' => $vRow['vehicle_id'] ?? '',
            'registration' => $reg,
            'driver_name' => $vRow['driver'] ?? '',
            'driver1_name' => $vRow['driver1'] ?? '',
            'already_inspected' => checklistIsVehicleInspectedThisMonth($con, $empId, $reg),
        ];
    }

    return $vehicles;
}

function checklistIsVehicleInspectedThisMonth(mysqli $con, string $empId, string $reg): bool
{
    $range = checklistGetCurrentMonthRange();
    $stmt = $con->prepare(
        "SELECT COUNT(*) AS cnt
         FROM vehicle_checklist
         WHERE supervisor_emp_id = ?
           AND vehicle_reg = ?
           AND inspection_date >= ?
           AND inspection_date <= ?
         LIMIT 1"
    );
    $stmt->bind_param('ssss', $empId, $reg, $range['start'], $range['end']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return ($row['cnt'] ?? 0) > 0;
}

function checklistFetchMonthInspection(mysqli $con, string $empId, string $reg): ?array
{
    $range = checklistGetCurrentMonthRange();
    $stmt = $con->prepare(
        "SELECT * FROM vehicle_checklist
         WHERE supervisor_emp_id = ?
           AND vehicle_reg = ?
           AND inspection_date >= ?
           AND inspection_date <= ?
         ORDER BY id DESC LIMIT 1"
    );
    $stmt->bind_param('ssss', $empId, $reg, $range['start'], $range['end']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

function checklistFetchVehicleDriver(mysqli $con, string $reg): array
{
    $stmt = $con->prepare(
        "SELECT driver_id, driver, driver1_id, driver1
         FROM vehicle
         WHERE registration = ?
         LIMIT 1"
    );
    $stmt->bind_param('s', $reg);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return [
        'driver_id' => $row['driver_id'] ?? '',
        'driver_name' => $row['driver'] ?? '',
        'driver1_id' => $row['driver1_id'] ?? '',
        'driver1_name' => $row['driver1'] ?? '',
    ];
}

function checklistSaveUploadedImage(): string
{
    if (empty($_FILES['inspection_image']['name'])) {
        return '';
    }

    $file = $_FILES['inspection_image'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return '';
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        return '';
    }

    $baseDir = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/dist/';
    $uploadDir = $baseDir . CHECKLIST_UPLOAD_RELATIVE_PATH . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fileName = 'checklist_' . date('Ymd_His') . '_' . uniqid() . '.' . $ext;
    $destPath = $uploadDir . $fileName;

    if ($file['size'] > 300 * 1024) {
        // Compress
        $img = null;
        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $img = imagecreatefromjpeg($file['tmp_name']);
                break;
            case 'png':
                $img = imagecreatefrompng($file['tmp_name']);
                break;
            case 'webp':
                $img = imagecreatefromwebp($file['tmp_name']);
                break;
        }
        if ($img) {
            [$w, $h] = getimagesize($file['tmp_name']);
            $maxDim = 1600;
            if ($w > $maxDim || $h > $maxDim) {
                $ratio = min($maxDim / $w, $maxDim / $h);
                $nw = (int) ($w * $ratio);
                $nh = (int) ($h * $ratio);
                $thumb = imagecreatetruecolor($nw, $nh);
                imagecopyresampled($thumb, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
                imagedestroy($img);
                $img = $thumb;
            }
            imagejpeg($img, $destPath, 75);
            imagedestroy($img);
        } else {
            move_uploaded_file($file['tmp_name'], $destPath);
        }
    } else {
        move_uploaded_file($file['tmp_name'], $destPath);
    }

    return CHECKLIST_UPLOAD_RELATIVE_PATH . '/' . $fileName;
}

/**
 * Save per-item images from $_FILES.
 * Expects fields named item_image_<item_key> (e.g., item_image_document_folder).
 * Returns JSON object mapping item_key => saved path.
 */
function checklistSaveItemImages(): string
{
    $images = [];

    // All 18 item keys
    $itemKeys = [
        'document_folder', 'car_body_inner', 'car_body_outer', 'driver_behavior',
        'driver_uniform', 'first_aid_box', 'fire_extinguisher', 'torch',
        'umbrella', 'seat_cover', 'gps', 'extra_tyre', 'vehicle_tool_kit',
        'dnd_tag', 'head_rest', 'napkin_box', 'car_perfume', 'car_charger',
    ];

    foreach ($itemKeys as $key) {
        $fieldName = 'item_image_' . $key;
        if (empty($_FILES[$fieldName]['name'])) {
            continue;
        }

        $file = $_FILES[$fieldName];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            continue;
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            continue;
        }

        $baseDir = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/dist/';
        $uploadDir = $baseDir . CHECKLIST_UPLOAD_RELATIVE_PATH . '/items/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $fileName = $key . '_' . date('Ymd_His') . '_' . uniqid() . '.' . $ext;
        $destPath = $uploadDir . $fileName;

        if ($file['size'] > 300 * 1024) {
            $img = null;
            switch ($ext) {
                case 'jpg':
                case 'jpeg':
                    $img = imagecreatefromjpeg($file['tmp_name']);
                    break;
                case 'png':
                    $img = imagecreatefrompng($file['tmp_name']);
                    break;
                case 'webp':
                    $img = imagecreatefromwebp($file['tmp_name']);
                    break;
            }
            if ($img) {
                [$w, $h] = getimagesize($file['tmp_name']);
                $maxDim = 1200;
                if ($w > $maxDim || $h > $maxDim) {
                    $ratio = min($maxDim / $w, $maxDim / $h);
                    $nw = (int) ($w * $ratio);
                    $nh = (int) ($h * $ratio);
                    $thumb = imagecreatetruecolor($nw, $nh);
                    imagecopyresampled($thumb, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
                    imagedestroy($img);
                    $img = $thumb;
                }
                imagejpeg($img, $destPath, 72);
                imagedestroy($img);
            } else {
                move_uploaded_file($file['tmp_name'], $destPath);
            }
        } else {
            move_uploaded_file($file['tmp_name'], $destPath);
        }

        $images[$key] = CHECKLIST_UPLOAD_RELATIVE_PATH . '/items/' . $fileName;
    }

    return json_encode($images);
}

function checklistCheckIfManager(mysqli $con, string $empId): bool
{
    // Check if this emp_id has higher role (MD, Manager) in staff table
    $stmt = $con->prepare(
        "SELECT designation FROM staff WHERE emp_id = ? LIMIT 1"
    );
    $stmt->bind_param('s', $empId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return false;
    }
    $desig = strtolower(trim($row['designation'] ?? ''));
    return in_array($desig, ['md', 'manager', 'admin'], true);
}

function checklistFetchSummaryForManager(mysqli $con, string $empId): array
{
    $range = checklistGetCurrentMonthRange();

    // Get distinct supervisors under this manager (from employee hierarchy)
    // We assume the manager's emp_id maps to a reporting structure
    $supervisorStmt = $con->prepare(
        "SELECT DISTINCT mb.supervisor
         FROM monthly_booking mb
         WHERE mb.date_from >= ? AND mb.date_from <= ?
         ORDER BY mb.supervisor ASC"
    );
    $supervisorStmt->bind_param('ss', $range['start'], $range['end']);
    $supervisorStmt->execute();
    $supResult = $supervisorStmt->get_result();

    $supervisors = [];
    while ($supRow = $supResult->fetch_assoc()) {
        $supEmpId = $supRow['supervisor'];

        // Get supervisor name from staff table
        $nameStmt = $con->prepare("SELECT name FROM staff WHERE emp_id = ? LIMIT 1");
        $nameStmt->bind_param('s', $supEmpId);
        $nameStmt->execute();
        $nameRow = $nameStmt->get_result()->fetch_assoc();
        $supName = $nameRow['name'] ?? $supEmpId;

        // Count total vehicles assigned to this supervisor
        $totalStmt = $con->prepare(
            "SELECT COUNT(DISTINCT vehicle) AS total
             FROM monthly_booking
             WHERE supervisor = ? AND date_from >= ? AND date_from <= ?"
        );
        $totalStmt->bind_param('sss', $supEmpId, $range['start'], $range['end']);
        $totalStmt->execute();
        $totalRow = $totalStmt->get_result()->fetch_assoc();
        $totalVehicles = (int) ($totalRow['total'] ?? 0);

        // Count inspected vehicles this month
        $inspectedStmt = $con->prepare(
            "SELECT COUNT(DISTINCT vehicle_reg) AS inspected
             FROM vehicle_checklist
             WHERE supervisor_emp_id = ? AND inspection_date >= ? AND inspection_date <= ?"
        );
        $inspectedStmt->bind_param('sss', $supEmpId, $range['start'], $range['end']);
        $inspectedStmt->execute();
        $inspectedRow = $inspectedStmt->get_result()->fetch_assoc();
        $inspected = (int) ($inspectedRow['inspected'] ?? 0);

        $listStmt = $con->prepare(
            "SELECT vc.vehicle_reg, vc.overall_status, vc.created_at,
                    COALESCE(v.driver, '') AS driver_name
             FROM vehicle_checklist vc
             LEFT JOIN vehicle v ON vc.vehicle_reg = v.registration
             WHERE vc.supervisor_emp_id = ? AND vc.inspection_date >= ? AND vc.inspection_date <= ?
             ORDER BY vc.created_at DESC"
        );
        $listStmt->bind_param('sss', $supEmpId, $range['start'], $range['end']);
        $listStmt->execute();
        $listResult = $listStmt->get_result();

        $inspectedList = [];
        while ($lRow = $listResult->fetch_assoc()) {
            $inspectedList[] = $lRow;
        }

        $supervisors[] = [
            'emp_id' => $supEmpId,
            'name' => $supName,
            'total_vehicles' => $totalVehicles,
            'inspected_count' => $inspected,
            'pending_count' => $totalVehicles - $inspected,
            'inspected_vehicles' => $inspectedList,
        ];
    }

    return $supervisors;
}
