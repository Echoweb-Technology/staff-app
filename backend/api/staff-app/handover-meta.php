<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/helpers/handover_helper.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    staffTransferJsonResponse(405, 'Method Not Allowed');
}

require_once __DIR__ . '/../../database.php';
require_once __DIR__ . '/../supervisor/helpers/jwt_helper.php';

global $con;
if (!($con instanceof mysqli)) {
    staffTransferJsonResponse(500, 'Database connection failed');
}

$headers = function_exists('apache_request_headers')
    ? apache_request_headers()
    : getallheaders();
$user = validateJWT($headers);

$workflow = staffTransferNormalizeWorkflow($_GET['mode'] ?? 'handover');
$assignmentType = staffTransferNormalizeAssignmentType($_GET['assignment_type'] ?? 'primary');
$vehicleId = trim((string) ($_GET['vehicle_id'] ?? ''));
$driverId = trim((string) ($_GET['driver_id'] ?? ''));
$search = trim((string) ($_GET['search'] ?? ''));
$fetch = trim((string) ($_GET['fetch'] ?? ''));

// Entity-specific search mode — returns only the requested entity list
if ($fetch !== '') {
    $data = ['workflow' => $workflow];
    switch ($fetch) {
        case 'vehicles':
            $data['vehicles'] = $workflow === 'handover'
                ? staffTransferFetchVehiclesForHandover($con, $assignmentType, $search)
                : staffTransferFetchVehiclesForTakeover($con, $search);
            break;
        case 'drivers':
            if ($workflow === 'handover') {
                $data['drivers'] = staffTransferFetchAvailableDrivers($con, $assignmentType, $search);
            }
            break;
        case 'supervisors':
            $data['supervisors'] = staffTransferFetchSupervisors($con, $search);
            break;
        case 'clients':
            $data['clients'] = staffTransferFetchClients($con, $search);
            break;
    }
    staffTransferJsonResponse(200, ucfirst($fetch) . ' fetched', $data);
}

$data = [
    'workflow' => $workflow,
    'actor' => [
        'name' => staffTransferFetchActorName($user),
        'user_code' => $user['user_code'] ?? null,
        'type' => $user['type'] ?? null,
    ],
    'supervisors' => staffTransferFetchSupervisors($con, $search),
];

if ($workflow === 'handover') {
    $data['assignment_type'] = $assignmentType;
    $data['clients'] = staffTransferFetchClients($con, $search);
    $data['vehicles'] = staffTransferFetchVehiclesForHandover($con, $assignmentType, $search);
    $data['drivers'] = staffTransferFetchAvailableDrivers($con, $assignmentType, $search);
} else {
    $data['vehicles'] = staffTransferFetchVehiclesForTakeover($con, $search);
}

if ($vehicleId !== '') {
    $data['vehicle_context'] = staffTransferFetchVehicleContext(
        $con,
        $workflow,
        $vehicleId,
        $driverId !== '' ? $driverId : null
    );
}

staffTransferJsonResponse(200, 'Transfer meta fetched', $data);
