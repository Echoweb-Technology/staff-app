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

$search = trim($_GET['search'] ?? '');

$vehicles = checklistFetchSupervisorVehicles($con, $empId, $search);

// Get supervisor name
$nameStmt = $con->prepare("SELECT name FROM staff WHERE emp_id = ? LIMIT 1");
$nameStmt->bind_param('s', $empId);
$nameStmt->execute();
$nameRow = $nameStmt->get_result()->fetch_assoc();
$supervisorName = $nameRow['name'] ?? $user['user_name'] ?? '';

checklistJsonResponse(200, 'Vehicles fetched', [
    'supervisor_emp_id' => $empId,
    'supervisor_name' => $supervisorName,
    'vehicles' => $vehicles,
]);
