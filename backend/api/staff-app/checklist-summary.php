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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

// Check if user is a manager-level role
$isManager = checklistCheckIfManager($con, $empId);
if (!$isManager) {
    checklistJsonResponse(403, 'Access denied. Manager-level access required.');
}

// Fetch summary for all supervisors
$supervisors = checklistFetchSummaryForManager($con, $empId);

// Calculate overall totals
$totalVehicles = 0;
$totalInspected = 0;
$totalPending = 0;
foreach ($supervisors as $sup) {
    $totalVehicles += $sup['total_vehicles'];
    $totalInspected += $sup['inspected_count'];
    $totalPending += $sup['pending_count'];
}

// Get manager info
$nameStmt = $con->prepare("SELECT name FROM staff WHERE emp_id = ? LIMIT 1");
$nameStmt->bind_param('s', $empId);
$nameStmt->execute();
$nameRow = $nameStmt->get_result()->fetch_assoc();

checklistJsonResponse(200, 'Summary fetched', [
    'manager_emp_id' => $empId,
    'manager_name' => $nameRow['name'] ?? $user['user_name'] ?? '',
    'summary' => [
        'total_vehicles' => $totalVehicles,
        'total_inspected' => $totalInspected,
        'total_pending' => $totalPending,
        'completion_percent' => $totalVehicles > 0
            ? round(($totalInspected / $totalVehicles) * 100)
            : 0,
    ],
    'supervisors' => $supervisors,
]);
