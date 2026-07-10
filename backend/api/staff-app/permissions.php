<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');
error_reporting(E_ALL);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../database.php';
require_once __DIR__ . '/../supervisor/helpers/jwt_helper.php';
require_once __DIR__ . '/helpers/checklist_helper.php';

global $con;

function permissionsJsonResponse($status, $message, $data = []) {
    http_response_code($status);
    echo json_encode(['status' => $status, 'msg' => $message, 'message' => $message] + $data);
    exit();
}

if (!($con instanceof mysqli)) {
    permissionsJsonResponse(500, 'Database connection failed');
}

// Ensure the table exists
$sql = "
CREATE TABLE IF NOT EXISTS `app_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `emp_id` varchar(50) NOT NULL,
  `module_name` varchar(50) NOT NULL,
  `can_access` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emp_module` (`emp_id`, `module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";
$con->query($sql);

$user = checklistGetUserFromJWT();
$empId = trim((string)($user['id'] ?? ''));

if ($empId === '') {
    permissionsJsonResponse(400, 'Employee ID not found in token');
}

// Default fallback permissions
$permissions = [
    'attendance' => true,
    'checklist' => false,
    'handover' => false
];

// Determine if the user is a manager or supervisor (fallback logic)
$stmt = $con->prepare("
    SELECT designation, emp_code 
    FROM staff 
    WHERE emp_id = ? 
    LIMIT 1
");
$stmt->bind_param('s', $empId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();

if ($row) {
    $designation = strtolower($row['designation'] ?? '');
    $empCode = $row['emp_code'] ?? '';
    
    // Check if someone reports to them
    $reportStmt = $con->prepare("SELECT COUNT(*) as cnt FROM staff WHERE report_manager = ?");
    $reportStmt->bind_param('s', $empCode);
    $reportStmt->execute();
    $reportRow = $reportStmt->get_result()->fetch_assoc();
    $hasReports = ($reportRow['cnt'] ?? 0) > 0;

    $isManagerOrSup = strpos($designation, 'manager') !== false || 
                      strpos($designation, 'supervisor') !== false || 
                      $hasReports;
                      
    if ($isManagerOrSup) {
        $permissions['checklist'] = true;
        $permissions['handover'] = true;
    }
}

// Override with explicit permissions from app_permissions table if any
$permStmt = $con->prepare("
    SELECT module_name, can_access 
    FROM app_permissions 
    WHERE emp_id = ?
");
if ($permStmt) {
    $permStmt->bind_param('s', $empId);
    $permStmt->execute();
    $permRes = $permStmt->get_result();
    
    while ($p = $permRes->fetch_assoc()) {
        $module = strtolower($p['module_name']);
        $permissions[$module] = (bool)$p['can_access'];
    }
}

permissionsJsonResponse(200, 'Permissions fetched', ['permissions' => $permissions]);
