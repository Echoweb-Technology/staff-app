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

/* ---------------------------------------------------
   1️⃣ Validate Required Fields
--------------------------------------------------- */
$vehicle_no          = $_POST['vehicle_no'] ?? '';
$txn_dt              = $_POST['txn_dt'] ?? '';
$qty                 = (float) ($_POST['qty'] ?? 0);
$current_odo         = (float) ($_POST['current_odo_reading'] ?? 0);
$fuel_type           = strtolower($_POST['fuel_type'] ?? '');
$booking_id          = $_POST['booking_id'] ?? null;

/* ---------------------------------------------------
   🔎 Fetch Previous Odometer Reading
--------------------------------------------------- */

$prev_odo = 0;

$prevQuery = $con->prepare("
    SELECT current_reading 
    FROM vehicle_expense 
    WHERE vehicle = ?
      AND expense_type = 'Fuel'
      AND transaction_date <= ?
    ORDER BY transaction_date DESC, expense_id DESC
    LIMIT 1
");

$prevQuery->bind_param("ss", $vehicle_no, $txn_dt);
$prevQuery->execute();
$prevResult = $prevQuery->get_result();

if ($prevResult->num_rows > 0) {
    $prevRow = $prevResult->fetch_assoc();
    $prev_odo = (float)$prevRow['current_reading'];
}

if (!$vehicle_no || !$txn_dt || !$qty || !$current_odo || !$prev_odo || !$fuel_type) {
    http_response_code(422);
    echo json_encode(['msg' => 'Missing required fields', 'status' => 422]);
    exit;
}

if ($qty > 350) {
    http_response_code(400);
    echo json_encode(['msg' => 'Fuel quantity exceeds limit', 'status' => 400]);
    exit;
}

if ($current_odo < $prev_odo) {
    http_response_code(400);
    echo json_encode(['msg' => 'Invalid odometer reading', 'status' => 400]);
    exit;
}

/* ---------------------------------------------------
   2️⃣ Calculate Average
--------------------------------------------------- */
$avg_achived = ($current_odo - $prev_odo) / $qty;
$avg_achived = number_format((float)$avg_achived, 2, '.', '');

/* ---------------------------------------------------
   3️⃣ Get Fuel Rate
--------------------------------------------------- */
$allowed_fuels = ['diesel', 'petrol', 'cng'];

if (!in_array($fuel_type, $allowed_fuels)) {
    http_response_code(400);
    echo json_encode(['msg' => 'Invalid fuel type', 'status' => 400]);
    exit;
}

$sql = "SELECT `$fuel_type` FROM fuel_price_daily ORDER BY id DESC LIMIT 1";
$result = $con->query($sql);

if (!$result || $result->num_rows == 0) {
    http_response_code(500);
    echo json_encode(['msg' => 'Fuel price not found', 'status' => 500]);
    exit;
}

$rate = (float)$result->fetch_assoc()[$fuel_type];
$amount = $rate * $qty;

/* ---------------------------------------------------
   4️⃣ Upload Images
--------------------------------------------------- */
function uploadFuelImage($fileInputName) {
    if (!isset($_FILES[$fileInputName])) {
        return null;
    }

    $file = $_FILES[$fileInputName];
    if ($file['error'] !== 0) {
        return null;
    }

    $allowed = ['jpg','jpeg','png','webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($ext, $allowed)) {
        return null;
    }

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . "/dist/fuel/upload/";
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fileName = time() . "_" . uniqid() . "." . $ext;
    $target = $uploadDir . $fileName;

    if (move_uploaded_file($file['tmp_name'], $target)) {
        return "upload/" . $fileName;
    }

    return null;
}

$meter_photo      = uploadFuelImage('meter_photo');
$dispenser_photo  = uploadFuelImage('dispenser_photo');
$slip_photo       = uploadFuelImage('slip_photo');

/* ---------------------------------------------------
   5️⃣ Insert Record (Prepared Statement)
--------------------------------------------------- */
$insert = $con->prepare("
    INSERT INTO vehicle_expense 
    (vehicle, transaction_date, expense_type, expense_desc, quantity,
     current_reading, pre_reading, avg_achived, driver_exp, driver_id,
     average_achieved, added_dt, added_by, booking_id,
     odo_meter_file, dispenser_photo_file, slip_photo_file,
     added_by_apk, rate, amount)
    VALUES (?, ?, 'Fuel', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 1, ?, ?)
");

$insert->bind_param(
    "sssddddsissssssdd",
    $vehicle_no,
    $txn_dt,
    $fuel_type,
    $qty,
    $current_odo,
    $prev_odo,
    $avg_achived,
    $driver_name,
    $driver_id,
    $avg_achived,
    $driver_code,
    $booking_id,
    $meter_photo,
    $dispenser_photo,
    $slip_photo,
    $rate,
    $amount
);

if ($insert->execute()) {
    http_response_code(200);
    echo json_encode([
        'msg' => 'Fuel added successfully',
        'status' => 200,
        'data' => [
            'average' => $avg_achived,
            'rate' => $rate,
            'amount' => $amount
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['msg' => 'Database error', 'status' => 500]);
}
?>