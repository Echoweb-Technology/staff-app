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

$vehicleReg = trim($_GET['vehicle'] ?? '');

if ($vehicleReg === '') {
    checklistJsonResponse(400, 'Vehicle registration is required');
}

$details = checklistFetchMonthInspection($con, $empId, $vehicleReg);

if (!$details) {
    checklistJsonResponse(404, 'No inspection found for this vehicle in the current month');
}

// Convert remarks from JSON string to array
if (isset($details['remarks']) && is_string($details['remarks'])) {
    $details['remarks'] = json_decode($details['remarks'], true) ?: [];
}

checklistJsonResponse(200, 'Inspection details fetched', $details);
