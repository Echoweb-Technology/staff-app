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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$action = strtolower(trim($input['action'] ?? $_POST['action'] ?? ''));
$latitude = $input['latitude'] ?? $_POST['latitude'] ?? null;
$longitude = $input['longitude'] ?? $_POST['longitude'] ?? null;

if (!in_array($action, ['in', 'out'], true)) {
    staffAttJsonResponse(422, 'Invalid action. Use in or out.');
}

if ($latitude === null || $longitude === null || $latitude === '' || $longitude === '') {
    staffAttJsonResponse(422, 'Latitude and longitude are required.');
}

$latitude = (float) $latitude;
$longitude = (float) $longitude;

$employeeId = staffAttResolveEmployeeId(
    $con,
    $user['type'],
    $user['user_code'],
    (int) $user['id']
);

$photoField = isset($_FILES['out_photo']) ? 'out_photo' : 'photo';
$photoPath = staffAttSavePhoto($_FILES[$photoField] ?? null, 'att_' . $action);

if ($action === 'in') {
    $result = staffAttMobilePunchIn($con, $user, $employeeId, $latitude, $longitude, $photoPath);
} else {
    $result = staffAttMobilePunchOut($con, $user, $employeeId, $latitude, $longitude, $photoPath);
}

if (!$result['ok']) {
    staffAttJsonResponse($result['status'], $result['msg'], $result['data']);
}

$responseData = $result['data'];
if ($photoPath) {
    $responseData['photo_url'] = 'https://vtms.co.in/api/staff-app/' . $photoPath;
}

staffAttJsonResponse($result['status'], $result['msg'], $responseData);
