<?php
	/*
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../../database.php';
require_once '../helpers/jwt_helper.php';

$headers = apache_request_headers();
$user = validateJWT($headers); // returns ['id', 'user_code', 'user_name', 'type']

// Ensure user is a driver
if ($user['type'] !== 'Driver') {
    http_response_code(403);
    echo json_encode(['msg' => 'Forbidden', 'status' => 403]);
    exit;
}

$driver_id = $user['id'];
$driver_code = $user['user_code'];

// Check if driver is currently on duty
$onDutyQuery = $con->prepare("SELECT * FROM driver_duty_record WHERE driver_id = ? AND status = 'on_duty'");
$onDutyQuery->bind_param("i", $driver_id);
$onDutyQuery->execute();
$onDutyResult = $onDutyQuery->get_result();
$onDuty = $onDutyResult->fetch_assoc();

$dutyStatus = $onDuty ? 'on_duty' : 'off_duty';
$startDutyTime = $onDuty ? $onDuty['start_duty_time'] : null;
$duration = 0;
if ($startDutyTime) {
    $duration = time() - strtotime($startDutyTime);
}

// Check assigned vehicle
$vehicleQuery = $con->prepare("SELECT * FROM driver WHERE driver_code = ? AND assinged_vehicle IS NOT NULL AND assinged_vehicle != ''");
$vehicleQuery->bind_param("s", $driver_code);
$vehicleQuery->execute();
$hasVehicle = $vehicleQuery->get_result()->num_rows > 0;

$booking_id = null;
$user_info = null;
$vehicle_details = null;

if ($hasVehicle) {
    // Fetch driver's assigned vehicle
    $driverInfo = $con->prepare("SELECT * FROM driver WHERE driver_code = ?");
    $driverInfo->bind_param("s", $driver_code);
    $driverInfo->execute();
    $driver = $driverInfo->get_result()->fetch_assoc();
    $regNo = $driver['assinged_vehicle'];

    $vehicleInfo = $con->prepare("SELECT * FROM vehicle WHERE registration = ?");
    $vehicleInfo->bind_param("s", $regNo);
    $vehicleInfo->execute();
    $vehicle_details = $vehicleInfo->get_result()->fetch_assoc();

    $today = date('Y-m-d');

    if ($vehicle_details['fleet_category'] === 'Casual') {
        // Try booking from booking table
        $bookingQuery = $con->prepare("SELECT booking_id_no, * FROM booking WHERE vehicle_no = ? AND (booking_status = 'UNASSIGNED' OR booking_status = 'ASSIGNED' OR booking_status = 'closed') AND ? BETWEEN DATE(date_from) AND DATE(date_to) ORDER BY booking_id_no DESC LIMIT 1");
        $bookingQuery->bind_param("ss", $regNo, $today);
        $bookingQuery->execute();
        $bookingResult = $bookingQuery->get_result();

        if ($bookingResult->num_rows > 0) {
            $booking = $bookingResult->fetch_assoc();
            $booking_id = 'C' . sprintf("%06d", $booking['booking_id_no']);
            $user_info = $booking; // contains user, user_phone_no etc.
        } else {
            // Try monthly_bookings_vehicle
            $monthlyQuery = $con->prepare("SELECT booking_id FROM monthly_bookings_vehicle WHERE vehicle = ? AND date = ? AND status = 'Running' ORDER BY sub_booking_id DESC LIMIT 1");
            $monthlyQuery->bind_param("ss", $regNo, $today);
            $monthlyQuery->execute();
            $monthlyResult = $monthlyQuery->get_result();
            if ($monthlyResult->num_rows > 0) {
                $monthly = $monthlyResult->fetch_assoc();
                $booking_id = $monthly['booking_id'];
                // Fetch user info from monthly_booking using last 5 digits of booking_id
                $subId = substr($booking_id, -5);
                $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
                $userQuery->bind_param("s", $subId);
                $userQuery->execute();
                $user_info = $userQuery->get_result()->fetch_assoc();
            }
        }
    } else {
        // Non-casual: fetch from monthly_bookings_vehicle
        $monthlyQuery = $con->prepare("SELECT booking_id FROM monthly_bookings_vehicle WHERE vehicle = ? AND date = ? AND status = 'Running' ORDER BY sub_booking_id DESC LIMIT 1");
        $monthlyQuery->bind_param("ss", $regNo, $today);
        $monthlyQuery->execute();
        $monthlyResult = $monthlyQuery->get_result();
        if ($monthlyResult->num_rows > 0) {
            $monthly = $monthlyResult->fetch_assoc();
            $booking_id = $monthly['booking_id'];
            $subId = substr($booking_id, -5);
            $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
            $userQuery->bind_param("s", $subId);
            $userQuery->execute();
            $user_info = $userQuery->get_result()->fetch_assoc();
        }
    }
}

// Build response
$response = [
    'status' => 200,
    'data' => [
        'duty_status' => $dutyStatus,
        'duration' => $duration,
        'has_vehicle' => $hasVehicle,
        'vehicle_details' => $vehicle_details ? [
            'registration' => $vehicle_details['registration'],
            'fleet_category' => $vehicle_details['fleet_category']
        ] : null,
        'booking' => $booking_id ? [
            'booking_id' => $booking_id,
            'user_name' => $user_info['user'] ?? $user_info['user_name'] ?? null,
            'user_phone' => (strpos($booking_id, 'M') !== false) ? ($user_info['user_mobile'] ?? null) : ($user_info['user_phone_no'] ?? null)
        ] : null
    ]
];

http_response_code(200);
echo json_encode($response);
*/
?>
<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once "../../../database.php";
require_once '../helpers/jwt_helper.php';

$headers = apache_request_headers();
$user = validateJWT($headers); // returns ['id', 'user_code', 'user_name', 'type']

// Ensure user is a driver
if ($user['type'] !== 'Driver') {
    http_response_code(403);
    echo json_encode(['msg' => 'Forbidden', 'status' => 403]);
    exit;
}

$driver_id = $user['id'];
$driver_code = $user['user_code'];

// Check if driver is currently on duty
$onDutyQuery = $con->prepare("SELECT * FROM driver_duty_record WHERE driver_id = ? AND status = 'on_duty' order by id desc limit 1");
$onDutyQuery->bind_param("i", $driver_id);
$onDutyQuery->execute();
$onDutyResult = $onDutyQuery->get_result();
$onDuty = $onDutyResult->fetch_assoc();

$dutyStatus = $onDuty ? 'on_duty' : 'off_duty';
$startDutyTime = $onDuty ? $onDuty['start_duty_time'] : null;
$duration = 0;
if ($startDutyTime) {
    $duration = time() - strtotime($startDutyTime);
}

$booking_id = null;
$user_info = null;
$vehicle_details = null;

if ($onDuty) {
    $booking_id = $onDuty['booking_id'];
    $user_info = [
        'user_name' => $onDuty['user_name'],
        'user_phone_no' => $onDuty['user_no']
    ];
}

// Check assigned vehicle
$vehicleQuery = $con->prepare("SELECT * FROM driver WHERE driver_code = ? AND assinged_vehicle IS NOT NULL AND assinged_vehicle != ''");
$vehicleQuery->bind_param("s", $driver_code);
$vehicleQuery->execute();
$hasVehicle = $vehicleQuery->get_result()->num_rows > 0;


if ($hasVehicle) {
    // Fetch driver's assigned vehicle
    $driverInfo = $con->prepare("SELECT * FROM driver WHERE driver_code = ?");
    $driverInfo->bind_param("s", $driver_code);
    $driverInfo->execute();
    $driver = $driverInfo->get_result()->fetch_assoc();
    $regNo = $driver['assinged_vehicle'];

    $vehicleInfo = $con->prepare("SELECT * FROM vehicle WHERE registration = ?");
    $vehicleInfo->bind_param("s", $regNo);
    $vehicleInfo->execute();
    $vehicle_details = $vehicleInfo->get_result()->fetch_assoc();

    $today = date('Y-m-d');

    if (!$onDuty && $vehicle_details['fleet_category'] === 'Casual') {
        // Try booking from booking table
        $bookingQuery = $con->prepare("SELECT * FROM booking WHERE vehicle_no = ? AND (booking_status = 'UNASSIGNED' OR booking_status = 'ASSIGNED' OR booking_status = 'closed') AND ? BETWEEN DATE(date_from) AND DATE(date_to) ORDER BY booking_id_no DESC LIMIT 1");
        $bookingQuery->bind_param("ss", $regNo, $today);
        $bookingQuery->execute();
        $bookingResult = $bookingQuery->get_result();

        if ($bookingResult->num_rows > 0) {
            $booking = $bookingResult->fetch_assoc();
            $booking_id = 'C' . sprintf("%06d", $booking['booking_id_no']);
            $user_info = $booking; // contains user, user_phone_no etc.
        } else {
            // Try monthly_bookings_vehicle
            $monthlyQuery = $con->prepare("SELECT booking_id FROM monthly_bookings_vehicle WHERE vehicle = ? AND date = ?  ORDER BY sub_booking_id DESC LIMIT 1");
            $monthlyQuery->bind_param("ss", $regNo, $today);
            $monthlyQuery->execute();
            $monthlyResult = $monthlyQuery->get_result();
            if ($monthlyResult->num_rows > 0) {
                $monthly = $monthlyResult->fetch_assoc();
                $booking_id = $monthly['booking_id'];
                // Fetch user info from monthly_booking using last 5 digits of booking_id
                $subId = substr($booking_id, -5);
                $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
                $userQuery->bind_param("s", $subId);
                $userQuery->execute();
                $user_info = $userQuery->get_result()->fetch_assoc();
            }
        }
    } else if (!$onDuty) {
        // Non-casual: fetch from monthly_bookings_vehicle
        $monthlyQuery = $con->prepare("SELECT booking_id FROM monthly_bookings_vehicle WHERE vehicle = ? AND date = ?  ORDER BY sub_booking_id DESC LIMIT 1");
        $monthlyQuery->bind_param("ss", $regNo, $today);
        $monthlyQuery->execute();
        $monthlyResult = $monthlyQuery->get_result();
        if ($monthlyResult->num_rows > 0) {
            $monthly = $monthlyResult->fetch_assoc();
            $booking_id = $monthly['booking_id'];
            $subId = substr($booking_id, -5);
            $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
            $userQuery->bind_param("s", $subId);
            $userQuery->execute();
            $user_info = $userQuery->get_result()->fetch_assoc();
        }
    }
}

// Build response
$response = [
    'status' => 200,
    'data' => [
        'duty_status' => $dutyStatus,
        'duration' => $duration,
        'has_vehicle' => $hasVehicle,
        'vehicle_details' => $vehicle_details ? [
            'registration' => $vehicle_details['registration'],
            'fleet_category' => $vehicle_details['fleet_category']
        ] : null,
        'booking' => $booking_id ? [
            'booking_id' => $booking_id,
            'user_name' => $user_info['user'] ?? $user_info['user_name'] ?? null,
            'user_phone' => $user_info['user_phone_no'] ?? $user_info['user_mobile'] ?? $user_info['user_no'] ?? null
        ] : null
    ]
];

http_response_code(200);
echo json_encode($response);
?>
