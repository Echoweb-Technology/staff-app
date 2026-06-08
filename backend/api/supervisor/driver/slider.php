<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../../database.php';
require_once '../helpers/jwt_helper.php';

$headers = apache_request_headers();
$user = validateJWT($headers);

if (!$user || $user['type'] !== 'Driver') {
    http_response_code(403);
    echo json_encode(['msg' => 'Forbidden', 'status' => 403]);
    exit;
}

$driver_id   = $user['id'];
$driver_code = $user['user_code'];
$driver_name = $user['user_name'];

/* ---------------------------------------
   1️⃣ Fetch Driver Details
--------------------------------------- */
$driverQuery = $con->prepare("
    SELECT photo_file, assinged_vehicle, driver_status 
    FROM driver 
    WHERE driver_id = ?
");
$driverQuery->bind_param("i", $driver_id);
$driverQuery->execute();
$driverData = $driverQuery->get_result()->fetch_assoc();

$driver_image = $driverData['photo_file'] ?? null;
$assigned_vehicle = $driverData['assinged_vehicle'] ?? null;
$driver_status = $driverData['driver_status'] ?? 'Inactive';

/* ---------------------------------------
   2️⃣ Fetch Vehicle Fuel Type
--------------------------------------- */
$fuel_type = null;

if ($assigned_vehicle) {
    $vehicleQuery = $con->prepare("
        SELECT vehicle_fuel_type 
        FROM vehicle 
        WHERE registration = ?
    ");
    $vehicleQuery->bind_param("s", $assigned_vehicle);
    $vehicleQuery->execute();
    $vehicleData = $vehicleQuery->get_result()->fetch_assoc();

    $fuel_type = $vehicleData['vehicle_fuel_type'] ?? null;
}

/* ---------------------------------------
   3️⃣ Fetch Latest Handover Image
--------------------------------------- */
$handoverQuery = $con->prepare("
    SELECT front_side 
    FROM handover 
    WHERE driver_id = ? 
    ORDER BY handover_id DESC 
    LIMIT 1
");
$handoverQuery->bind_param("i", $driver_id);
$handoverQuery->execute();
$handoverResult = $handoverQuery->get_result()->fetch_assoc();

$handover_image = $handoverResult['front_side'] ?? null;

/* ---------------------------------------
   4️⃣ Build Full URLs
--------------------------------------- */
$base_url = "https://vtms.co.in/";

$driver_image_url = $driver_image ? $base_url . $driver_image : null;
$handover_image_url = $handover_image ? $base_url . "vms/" . $handover_image : null;

/* ---------------------------------------
   5️⃣ Final Response
--------------------------------------- */
http_response_code(200);
echo json_encode([
    'status' => 200,
    'data' => [
        'driver' => [
            'driver_id' => $driver_id,
            'driver_name' => $driver_name,
            'driver_code' => $driver_code,
            'driver_image' => $driver_image_url,
            'assigned_vehicle' => $assigned_vehicle,
            'fuel_type' => $fuel_type,
            'status' => $driver_status
        ],
        'handover' => [
            'front_image' => $handover_image_url
        ]
    ]
]);
?>