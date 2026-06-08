<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization");
error_reporting(E_ALL);
ini_set('display_errors', 1);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['msg' => 'Method Not Allowed', 'status' => 405]);
    exit;
}

require_once "../../../database.php";
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

/* ---------------------------------------------------
   1️⃣ Check if already on duty
--------------------------------------------------- */
$check = $con->prepare("SELECT id FROM driver_duty_record WHERE driver_id = ? AND status = 'on_duty'");
$check->bind_param("i", $driver_id);
$check->execute();
if ($check->get_result()->num_rows > 0) {
    http_response_code(400);
    echo json_encode(['msg' => 'Already on duty', 'status' => 400]);
    exit;
}

/* ---------------------------------------------------
   2️⃣ Check assigned vehicle (MANDATORY)
--------------------------------------------------- */
$vehicleCheck = $con->prepare("SELECT assinged_vehicle FROM driver WHERE driver_code = ? AND assinged_vehicle IS NOT NULL AND assinged_vehicle != ''");
$vehicleCheck->bind_param("s", $driver_code);
$vehicleCheck->execute();
$vehicleResult = $vehicleCheck->get_result();

if ($vehicleResult->num_rows === 0) {
    http_response_code(400);
    echo json_encode(['msg' => 'No vehicle assigned', 'status' => 400]);
    exit;
}

$vehicleRow = $vehicleResult->fetch_assoc();
$assigned_vehicle = $vehicleRow['assinged_vehicle'];

/* ---------------------------------------------------
   3️⃣ Get POST Fields
--------------------------------------------------- */
$booking_id      = $_POST['booking_id'] ?? null;  // Optional
$user_name       = $_POST['user_name'] ?? null;
$user_phone_no   = $_POST['user_phone_no'] ?? null;
$start_latitude  = $_POST['start_latitude'] ?? '';
$start_longitude = $_POST['start_longitude'] ?? '';
$odo_reading     = $_POST['odo_reading'] ?? null;

if (!$start_latitude || !$start_longitude) {
    http_response_code(422);
    echo json_encode(['msg' => 'Missing required fields (location)', 'status' => 422]);
    exit;
}

/* ---------------------------------------------------
   4️⃣ Handle File Upload (Odometer Photo)
--------------------------------------------------- */
$file_path = null;
if (isset($_FILES['odometer_photo'])) {
    $file = $_FILES['odometer_photo'];
    if ($file['error'] === 0) {
        $allowed_extensions = ['jpg', 'jpeg', 'png', 'webp'];
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (in_array($extension, $allowed_extensions)) {
            $uploadDir = $_SERVER['DOCUMENT_ROOT'] . "/dist/fuel/upload/odometer/";
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            $fileName = time() . "_" . uniqid() . "." . $extension;
            $targetPath = $uploadDir . $fileName;
            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $file_path = "fuel/upload/odometer/" . $fileName;
            }
        }
    }
}

/* 
if (!$file_path) {
    http_response_code(422);
    echo json_encode(['msg' => 'Odometer photo required', 'status' => 422]);
    exit;
}
*/

/* ---------------------------------------------------
   5️⃣ Determine Duty Type
--------------------------------------------------- */
$duty_type = $booking_id ? 'booked' : 'manual';

/* ---------------------------------------------------
   6️⃣ Insert Duty Record
--------------------------------------------------- */
$date_today = date('Y-m-d');

$insert = $con->prepare("
    INSERT INTO driver_duty_record 
    (driver_id, driver_name, driver_code, date, 
     start_duty_time, start_duty_odo_reading, start_duty_odo_file,
     start_duty_latitude, start_duty_longitude, 
     user_name, user_no, booking_id, status) 
    VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 'on_duty')
");

$insert->bind_param(
    "issssssssss",
    $driver_id,
    $driver_name,
    $driver_code,
    $date_today,
    $odo_reading,
    $file_path,
    $start_latitude,
    $start_longitude,
    $user_name,
    $user_phone_no,
    $booking_id
);

if ($insert->execute()) {
    http_response_code(200);
    echo json_encode([
        'msg' => 'Duty started successfully',
        'status' => 200,
        'data' => [
            'duty_type' => $duty_type,
            'file_url' => "https://vtms.co.in/dist/" . $file_path
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['msg' => 'Database error', 'status' => 500]);
}
?>
