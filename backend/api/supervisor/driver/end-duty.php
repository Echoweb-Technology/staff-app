<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");
header("Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'msg' => 'Method Not Allowed',
        'status' => 405
    ]);
    exit;
}

require_once "../../../database.php";
require_once '../helpers/jwt_helper.php';

$headers = apache_request_headers();
$user = validateJWT($headers);

if (!$user || $user['type'] !== 'Driver') {
    http_response_code(403);
    echo json_encode([
        'msg' => 'Forbidden',
        'status' => 403
    ]);
    exit;
}

$driver_id = $user['id'];

/* ---------------------------------------------------
   1️⃣ Check if driver is currently on duty
--------------------------------------------------- */

$check = $con->prepare("
    SELECT * 
    FROM driver_duty_record 
    WHERE driver_id = ? 
    AND status = 'on_duty'
    ORDER BY id DESC
    LIMIT 1
");

$check->bind_param("i", $driver_id);
$check->execute();

$onDuty = $check->get_result()->fetch_assoc();

if (!$onDuty) {
    http_response_code(400);
    echo json_encode([
        'msg' => 'Not on duty',
        'status' => 400
    ]);
    exit;
}

$duty_id = $onDuty['id'];
$booking_id = $onDuty['booking_id'] ?? '';

$table = '';
$update_coln = '';

$extraWhere = "";
$bindTypes = "s";
$bindValues = [];

/* ---------------------------------------------------
   2️⃣ Booking Logic
--------------------------------------------------- */

if (!empty($booking_id)) {

    $firstChar = strtolower($booking_id[0]);

    if ($firstChar == 'm') {

        $table = "monthly_bookings_driver";
        $update_coln = "booking_id";

        $extraWhere = " AND date = ?";

        $bindTypes = "ss";

        $bindValues[] = $booking_id;
        $bindValues[] = date('Y-m-d');

    } elseif ($firstChar == 'c') {

        $booking_id = substr($booking_id, 2);

        $table = "booking";
        $update_coln = "booking_id_no";

        $bindTypes = "s";

        $bindValues[] = $booking_id;
    }
}

/* ---------------------------------------------------
   3️⃣ Get POST Fields
--------------------------------------------------- */

$end_latitude = $_POST['end_latitude'] ?? '';
$end_longitude = $_POST['end_longitude'] ?? '';
$odo_reading = $_POST['odo_reading'] ?? null;

if (!$end_latitude || !$end_longitude) {
    http_response_code(422);
    echo json_encode([
        'msg' => 'Missing required fields (location)',
        'status' => 422
    ]);
    exit;
}

/* ---------------------------------------------------
   4️⃣ Handle File Upload
--------------------------------------------------- */

$file_path = null;

if (isset($_FILES['end_odometer_photo'])) {

    $file = $_FILES['end_odometer_photo'];

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

/* ---------------------------------------------------
   5️⃣ Update Duty Record
--------------------------------------------------- */

$update = $con->prepare("
    UPDATE driver_duty_record SET 
        end_duty_time = NOW(),
        status = 'off_duty',
        end_duty_odo_reading = ?,
        end_duty_latitude = ?,
        end_duty_longitude = ?,
        end_duty_odo_file = ?
    WHERE id = ?
");

$update->bind_param(
    "ssssi",
    $odo_reading,
    $end_latitude,
    $end_longitude,
    $file_path,
    $duty_id
);

if ($update->execute()) {

    /* ---------------------------------------------------
       6️⃣ Update Booking Table
    --------------------------------------------------- */

    if (!empty($table) && !empty($update_coln)) {

        $allowedTables = ['monthly_bookings_driver', 'booking'];

        if (in_array($table, $allowedTables)) {

            // Fix: If driver type is secondary then no need to update booking status
            $driver_type = 'Primary';
            $checkType = $con->prepare("SELECT id FROM vehicle WHERE driver1_id = ?");
            $checkType->bind_param("i", $driver_id);
            $checkType->execute();
            if ($checkType->get_result()->num_rows > 0) {
                $driver_type = 'Secondary';
            }

            if ($driver_type === 'Primary') {
                $stmt = $con->prepare("
                    UPDATE $table 
                    SET is_duty_done_by_driver = 'Yes'
                    WHERE $update_coln = ? $extraWhere
                ");

                $stmt->bind_param($bindTypes, ...$bindValues);

                $stmt->execute();
            }
        }
    }

    http_response_code(200);

    echo json_encode([
        'msg' => 'Duty ended successfully',
        'status' => 200,
        'data' => [
            'file_url' => $file_path
                ? "https://vtms.co.in/dist/" . $file_path
                : null
        ]
    ]);

} else {

    http_response_code(500);

    echo json_encode([
        'msg' => 'Database error',
        'status' => 500
    ]);
}
?>