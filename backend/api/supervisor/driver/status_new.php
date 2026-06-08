<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
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
$jwtUser = validateJWT($headers);   // Renamed to avoid conflict

if ($jwtUser['type'] !== 'Driver') {
    http_response_code(403);
    echo json_encode(['msg' => 'Forbidden', 'status' => 403]);
    exit;
}

$driver_id = $jwtUser['id'];
$driver_code = $jwtUser['user_code'];
$today = date('Y-m-d');
$startOfMonth = date('Y-m-01');
$endOfMonth = date('Y-m-t');

/* =====================================================
   1. CHECK VEHICLE ASSIGNED
===================================================== */
$vehicle_details = null;
$hasVehicle = false;
$driver_type = 'Primary';   // default

$vehicleQuery = $con->prepare("
    SELECT * FROM driver 
    WHERE driver_code = ? 
    AND assinged_vehicle IS NOT NULL 
    AND assinged_vehicle != ''
");
$vehicleQuery->bind_param("s", $driver_code);
$vehicleQuery->execute();
$vehicleResult = $vehicleQuery->get_result();

if ($vehicleResult->num_rows > 0) {
    $hasVehicle = true;
    $driver = $vehicleResult->fetch_assoc();
    $regNo = $driver['assinged_vehicle'];
    $driverId = $driver['driver_id'];

    // Determine if driver is primary or secondary
    $checkPrimary = $con->prepare("SELECT * FROM vehicle WHERE driver1_id = ?");
    $checkPrimary->bind_param("i", $driverId);
    $checkPrimary->execute();
    $driver_type = ($checkPrimary->get_result()->num_rows > 0) ? 'Secondary' : 'Primary';

    $vehicleInfo = $con->prepare("SELECT * FROM vehicle WHERE registration = ?");
    $vehicleInfo->bind_param("s", $regNo);
    $vehicleInfo->execute();
    $vehicle = $vehicleInfo->get_result()->fetch_assoc();

    if ($vehicle) {
        $vehicle_details = [
            'registration' => $vehicle['registration'],
            'fleet_category' => $vehicle['fleet_category']
        ];
    }
}

/* =====================================================
   2. CHECK DUTY STATUS (LIVE DUTY)
===================================================== */
$onDutyQuery = $con->prepare("
    SELECT * FROM driver_duty_record 
    WHERE driver_id = ? AND status = 'on_duty' 
    ORDER BY id DESC LIMIT 1
");
$onDutyQuery->bind_param("i", $driver_id);
$onDutyQuery->execute();
$onDutyResult = $onDutyQuery->get_result();
$onDuty = $onDutyResult->fetch_assoc();

$dutyStatus = $onDuty ? 'on_duty' : 'off_duty';
$duration = 0;
if ($onDuty && !empty($onDuty['start_duty_time'])) {
    $duration = time() - strtotime($onDuty['start_duty_time']);
}

/* =====================================================
   3. MONTHLY BOOKING (DRIVER BASED)
===================================================== */
$monthly_booking = null;

if ($driver_type == 'Primary') {
    $monthlyQuery = $con->prepare("
        SELECT * FROM monthly_bookings_driver 
        WHERE date = ? AND driver = ? AND is_duty_done_by_driver IS NULL
    ");
    $monthlyQuery->bind_param("si", $today, $driver_id);
    $monthlyQuery->execute();
    $monthlyResult = $monthlyQuery->get_result();

    if ($monthlyResult->num_rows > 0) {
        $m_booking = $monthlyResult->fetch_assoc();
        $booking_id_full = $m_booking['booking_id'];
        $subId = substr($booking_id_full, -5);

        $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
        $userQuery->bind_param("s", $subId);
        $userQuery->execute();
        $monthlyUser = $userQuery->get_result()->fetch_assoc();

        // Get vehicle for this booking on today's date
        $vehicleQuery = $con->prepare("
            SELECT vehicle FROM monthly_bookings_vehicle 
            WHERE date = ? AND booking_id = ? AND status = 'Running'
        ");
        $vehicleQuery->bind_param("ss", $today, $booking_id_full);
        $vehicleQuery->execute();
        $vehicleRow = $vehicleQuery->get_result()->fetch_assoc();

        $monthly_booking = [
            'booking_id' => $booking_id_full,
            'user_name' => $monthlyUser['user'] ?? null,
            'vehicle' => $vehicleRow['vehicle'] ?? null,
            'user_phone' => $monthlyUser['user_mobile'] ?? null
        ];
    }
} else {
    // Secondary driver: get assigned vehicle first
    $assignedVehicleQuery = $con->prepare("SELECT registration FROM vehicle WHERE driver1_id = ?");
    $assignedVehicleQuery->bind_param("i", $driver_id);
    $assignedVehicleQuery->execute();
    $assignedVehicleRow = $assignedVehicleQuery->get_result()->fetch_assoc();
    $assigned_vehicle = $assignedVehicleRow['registration'] ?? null;

    if ($assigned_vehicle) {
        $monthlyQuery = $con->prepare("
            SELECT * FROM monthly_bookings_vehicle 
            WHERE date = ? AND vehicle = ?
        ");
        $monthlyQuery->bind_param("ss", $today, $assigned_vehicle);
        $monthlyQuery->execute();
        $monthlyResult = $monthlyQuery->get_result();

        if ($monthlyResult->num_rows > 0) {
            $m_booking = $monthlyResult->fetch_assoc();
            $booking_id_full = $m_booking['booking_id'];
            $subId = substr($booking_id_full, -5);

            $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
            $userQuery->bind_param("s", $subId);
            $userQuery->execute();
            $monthlyUser = $userQuery->get_result()->fetch_assoc();

            $monthly_booking = [
                'booking_id' => $booking_id_full,
                'user_name' => $monthlyUser['user'] ?? null,
                'vehicle' => $assigned_vehicle,
                'user_phone' => $monthlyUser['user_mobile'] ?? null
            ];
        }
    }
}

/* =====================================================
   4. CASUAL BOOKING (DRIVER / CO-DRIVER)
===================================================== */
$casual_booking = null;

$casualQuery = $con->prepare("
    SELECT * FROM booking 
    WHERE (driver_id = ? OR co_driver_id = ?) 
    AND ? BETWEEN DATE(date_from) AND DATE(date_to)
    AND is_duty_done_by_driver IS NULL
    ORDER BY booking_id_no DESC
    LIMIT 1
");
$casualQuery->bind_param("iis", $driver_id, $driver_id, $today);
$casualQuery->execute();
$casualResult = $casualQuery->get_result();

if ($casualResult->num_rows > 0) {
    $booking = $casualResult->fetch_assoc();
    $casual_booking = [
        'booking_id' => 'C' . sprintf("%06d", $booking['booking_id_no']),
        'user_name' => $booking['user'] ?? null,
        'vehicle' => $booking['vehicle_no'] ?? null,
        'user_phone' => $booking['user_phone_no'] ?? null
    ];
}

/* =====================================================
   5. UPCOMING MONTHLY BOOKINGS (this month only)
===================================================== */
$upcoming_monthly = [];

$monthlyUpcomingQuery = $con->prepare("
    SELECT * FROM monthly_bookings_driver 
    WHERE driver = ? AND date >= ? AND date BETWEEN ? AND ?
    AND is_duty_done_by_driver IS NULL
    ORDER BY date ASC LIMIT 4
");
$monthlyUpcomingQuery->bind_param("isss", $driver_id, $today, $startOfMonth, $endOfMonth);
$monthlyUpcomingQuery->execute();
$result = $monthlyUpcomingQuery->get_result();

while ($row = $result->fetch_assoc()) {
    $booking_id_full = $row['booking_id'];
    $subId = substr($booking_id_full, -5);

    $userQuery = $con->prepare("SELECT * FROM monthly_booking WHERE booking_id = ?");
    $userQuery->bind_param("s", $subId);
    $userQuery->execute();
    $userData = $userQuery->get_result()->fetch_assoc();

    $vehicleQuery = $con->prepare("
        SELECT vehicle FROM monthly_bookings_vehicle 
        WHERE date = ? AND booking_id = ?
    ");
    $vehicleQuery->bind_param("ss", $row['date'], $booking_id_full);
    $vehicleQuery->execute();
    $vehicleRow = $vehicleQuery->get_result()->fetch_assoc();

    $upcoming_monthly[] = [
        'date' => $row['date'],
        'booking_id' => $booking_id_full,
        'user_name' => $userData['user'] ?? null,
        'vehicle' => $vehicleRow['vehicle'] ?? null,
        'user_phone' => $userData['user_mobile'] ?? null
    ];
}

/* =====================================================
   6. UPCOMING CASUAL BOOKINGS (this month only)
===================================================== */
$upcoming_casual = [];

$casualUpcomingQuery = $con->prepare("
    SELECT * FROM booking 
    WHERE (driver_id = ? OR co_driver_id = ?)
    AND DATE(date_from) >= ?
    AND date_from BETWEEN ? AND ?
    AND is_duty_done_by_driver IS NULL
    ORDER BY date_from ASC
");
$casualUpcomingQuery->bind_param("iisss", $driver_id, $driver_id, $today, $startOfMonth, $endOfMonth);
$casualUpcomingQuery->execute();
$result = $casualUpcomingQuery->get_result();

while ($row = $result->fetch_assoc()) {
    $upcoming_casual[] = [
        'date_from' => $row['date_from'],
        'date_to' => $row['date_to'],
        'booking_id' => 'C' . sprintf("%06d", $row['booking_id_no']),
        'user_name' => $row['user'] ?? null,
        'vehicle' => $row['vehicle_no'] ?? null,
        'user_phone' => $row['user_phone_no'] ?? null
    ];
}

/* =====================================================
   7. FINAL RESPONSE
===================================================== */
$response = [
    'status' => 200,
    'data' => [
        'duty_status' => $dutyStatus,
        'duration' => $duration,
        'has_vehicle' => $hasVehicle,
        'vehicle_details' => $vehicle_details,
        'driver_type' => $driver_type,
        'monthly_booking' => $monthly_booking,
        'casual_booking' => $casual_booking,
        'upcoming_monthly_booking' => $upcoming_monthly,
        'upcoming_casual_booking' => $upcoming_casual
    ]
];

http_response_code(200);
echo json_encode($response);
?>