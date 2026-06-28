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
    http_response_code(405);
    echo json_encode(['msg' => 'Method Not Allowed', 'status' => 405]);
    exit;
}

require_once __DIR__ . '/../../database.php';
require_once __DIR__ . '/../supervisor/helpers/jwt_helper.php';
require_once __DIR__ . '/helpers/attendance_helper.php';

global $con;
if (!($con instanceof mysqli)) {
    http_response_code(500);
    echo json_encode(['msg' => 'Database connection failed', 'status' => 500]);
    exit;
}

$headers = function_exists('apache_request_headers')
    ? apache_request_headers()
    : getallheaders();
$user = validateJWT($headers);

ensureStaffAttendanceSchema($con);

$employeeId = staffAttResolveEmployeeId(
    $con,
    $user['type'],
    $user['user_code'],
    (int) $user['id']
);

$attendanceDate = $_GET['date'] ?? date('Y-m-d');
$record = staffAttFetchTodayRecord($con, $employeeId, $attendanceDate);

staffAttJsonResponse(200, 'Attendance status fetched', staffAttBuildStatusPayload($record, $attendanceDate));
