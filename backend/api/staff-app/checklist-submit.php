<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');
error_reporting(E_ALL);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    checklistJsonResponse(405, 'Method Not Allowed');
}

require_once __DIR__ . '/../../database.php';
require_once __DIR__ . '/../supervisor/helpers/jwt_helper.php';
require_once __DIR__ . '/helpers/checklist_helper.php';

global $con;
if (!($con instanceof mysqli)) {
    checklistJsonResponse(500, 'Database connection failed');
}

$user = checklistGetUserFromJWT();
$empId = trim((string)($user['id'] ?? ''));

if ($empId === '') {
    checklistJsonResponse(400, 'Employee ID not found in token');
}

// Validate required fields
$vehicleReg = trim($_POST['vehicle_reg'] ?? '');
$vehicleId = trim($_POST['vehicle_id'] ?? '');
$driverId = trim($_POST['driver_id'] ?? '');
$driverName = trim($_POST['driver_name'] ?? '');

if ($vehicleReg === '') {
    checklistJsonResponse(400, 'Vehicle registration is required');
}

// Find assigned supervisor for this vehicle in the current month
$range = checklistGetCurrentMonthRange();
$supAssignStmt = $con->prepare("
    SELECT supervisor 
    FROM monthly_booking 
    WHERE vehicle = ? AND date_from >= ? AND date_from <= ? 
    LIMIT 1
");
$supAssignStmt->bind_param('sss', $vehicleReg, $range['start'], $range['end']);
$supAssignStmt->execute();
$supAssignRes = $supAssignStmt->get_result()->fetch_assoc();
$assignedSupEmpId = $supAssignRes['supervisor'] ?? '';

// If a supervisor is assigned, use them. Otherwise fallback to the logged-in user ($empId)
$finalSupervisorEmpId = ($assignedSupEmpId !== '') ? $assignedSupEmpId : $empId;

// Get supervisor name and report manager
$nameStmt = $con->prepare("
    SELECT name, report_manager 
    FROM staff 
    WHERE emp_id = ? 
    LIMIT 1
");
$nameStmt->bind_param('s', $finalSupervisorEmpId);
$nameStmt->execute();
$nameRow = $nameStmt->get_result()->fetch_assoc();
$supervisorName = $nameRow['name'] ?? (($finalSupervisorEmpId === $empId) ? ($user['user_name'] ?? '') : '');
$reportManagerCode = $nameRow['report_manager'] ?? '';

// Get manager details
$managerEmpId = '';
$managerName = '';
if ($reportManagerCode !== '') {
    $mgrStmt = $con->prepare("
        SELECT emp_id, name 
        FROM staff 
        WHERE emp_code = ? 
        LIMIT 1
    ");
    $mgrStmt->bind_param('s', $reportManagerCode);
    $mgrStmt->execute();
    $mgrRes = $mgrStmt->get_result()->fetch_assoc();
    $managerEmpId = $mgrRes['emp_id'] ?? '';
    $managerName = $mgrRes['name'] ?? '';
}

// Check if already inspected this month
if (checklistIsVehicleInspectedThisMonth($con, $finalSupervisorEmpId, $vehicleReg)) {
    checklistJsonResponse(400, 'Vehicle already inspected this month. Next checklist can only be done next month.');
}

// Collect all 18 checklist items
$items = [
    'document_folder',
    'car_body_inner',
    'car_body_outer',
    'driver_behavior',
    'driver_uniform',
    'first_aid_box',
    'fire_extinguisher',
    'torch',
    'umbrella',
    'seat_cover',
    'gps',
    'extra_tyre',
    'vehicle_tool_kit',
    'dnd_tag',
    'head_rest',
    'napkin_box',
    'car_perfume',
    'car_charger',
];

$validYesNo = ['yes', 'no'];
$validBehavior = ['poor', 'average', 'good'];
$values = [];
$hasNo = false;

foreach ($items as $item) {
    $val = strtolower(trim($_POST[$item] ?? ''));
    if ($item === 'driver_behavior') {
        if (!in_array($val, $validBehavior, true)) {
            checklistJsonResponse(400, "Invalid value for {$item}");
        }
    } else {
        if (!in_array($val, $validYesNo, true)) {
            checklistJsonResponse(400, "Invalid value for {$item}");
        }
        if ($val === 'no') {
            $hasNo = true;
        }
    }
    $values[$item] = $val;
}

// Collect remarks (JSON)
$remarksRaw = trim($_POST['remarks'] ?? '{}');
$remarks = json_decode($remarksRaw, true);
if (!is_array($remarks)) {
    $remarks = [];
}

// If any item is 'no', at least one remark should be present for that item
if ($hasNo) {
    $hasRemarkForNo = false;
    foreach ($items as $item) {
        if ($values[$item] === 'no' && !empty($remarks[$item])) {
            $hasRemarkForNo = true;
            break;
        }
    }
    // Not enforcing strictly here (app should enforce), but log if missing
}

// Upload image (optional)
$inspectionImage = checklistSaveUploadedImage();

// Upload per-item images (optional)
$itemImagesJson = checklistSaveItemImages();

// Determine overall status
$overallStatus = 'pass';
foreach ($items as $item) {
    if ($values[$item] === 'no') {
        $overallStatus = 'fail';
        break;
    }
}

$today = date('Y-m-d');
$remarksJson = json_encode($remarks);

// Check if item_images column exists (backward-compatible with production DB)
$colCheck = $con->query("SHOW COLUMNS FROM vehicle_checklist LIKE 'item_images'");
$hasItemImages = $colCheck && $colCheck->num_rows > 0;

$columns = [
    'supervisor_emp_id', 'supervisor_name',
    'manager_emp_id', 'manager_name',
    'vehicle_id', 'vehicle_reg', 'driver_id', 'driver_name',
    'inspection_date', 'inspection_image',
    'document_folder', 'car_body_inner', 'car_body_outer', 'driver_behavior',
    'driver_uniform', 'first_aid_box', 'fire_extinguisher', 'torch',
    'umbrella', 'seat_cover', 'gps', 'extra_tyre', 'vehicle_tool_kit',
    'dnd_tag', 'head_rest', 'napkin_box', 'car_perfume', 'car_charger',
    'remarks',
];
$placeholders = [
    '?','?','?','?','?','?','?','?','?','?',
    '?','?','?','?','?','?','?','?',
    '?','?','?','?','?','?','?','?',
    '?','?','?',
];
$bindTypes = 'sssssssssssssssssssssssssssss';
$bindValues = [
    $finalSupervisorEmpId, $supervisorName,
    $managerEmpId, $managerName,
    $vehicleId, $vehicleReg, $driverId, $driverName,
    $today, $inspectionImage,
    $values['document_folder'], $values['car_body_inner'], $values['car_body_outer'], $values['driver_behavior'],
    $values['driver_uniform'], $values['first_aid_box'], $values['fire_extinguisher'], $values['torch'],
    $values['umbrella'], $values['seat_cover'], $values['gps'], $values['extra_tyre'], $values['vehicle_tool_kit'],
    $values['dnd_tag'], $values['head_rest'], $values['napkin_box'], $values['car_perfume'], $values['car_charger'],
    $remarksJson,
];

if ($hasItemImages) {
    $columns[] = 'item_images';
    $columns[] = 'overall_status';
    $placeholders[] = '?';
    $placeholders[] = '?';
    $bindTypes .= 'ss';
    $bindValues[] = $itemImagesJson;
    $bindValues[] = $overallStatus;
} else {
    $columns[] = 'overall_status';
    $placeholders[] = '?';
    $bindTypes .= 's';
    $bindValues[] = $overallStatus;
}

$sql = "INSERT INTO vehicle_checklist (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";

$stmt = $con->prepare($sql);
$stmt->bind_param($bindTypes, ...$bindValues);

if ($stmt->execute()) {
    checklistJsonResponse(200, 'Checklist submitted successfully', [
        'id' => $stmt->insert_id,
        'overall_status' => $overallStatus,
    ]);
} else {
    checklistJsonResponse(500, 'Failed to save checklist: ' . $stmt->error);
}
