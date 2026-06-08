<?php
header("Access-Control-Allow-Origin:*");
header("Access-Control-Allow-Credentials:true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Method:GET,POST,PUT,DELETE");
header("Content-Type:application/json");
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token');

error_reporting(E_ALL);
ini_set('display_errors', 1);

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;
use Firebase\JWT\JWK;

require "../jwt/src/BeforeValidException.php";
require "../jwt/src/ExpiredException.php";
require "../jwt/src/SignatureInvalidException.php";
require "../jwt/src/JWT.php";
require "../jwt/src/JWK.php";
require "../jwt/src/Key.php";
require "../jwt/src/CachedKeySet.php";

require_once "../../database.php";

$method = $_SERVER["REQUEST_METHOD"];
$input = json_decode(file_get_contents("php://input"), true);

if ($method !== "POST") {
    http_response_code(405);
    echo json_encode(["msg" => "Method Not Allowed", "status" => 405]);
    exit;
}

$phone = preg_replace('/\D/', '', $input['phone'] ?? '');
$otp   = trim($input['otp'] ?? '');

if (!$phone || !$otp) {
    http_response_code(422);
    echo json_encode(["msg" => "Phone and OTP required", "status" => 422]);
    exit;
}

// Get latest OTP for this phone
$stmt = $con->prepare("SELECT * FROM driver_login_log WHERE otp = ? AND mobile_no = ? ORDER BY id DESC LIMIT 1");
$stmt->bind_param("ss", $otp, $phone);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    http_response_code(401);
    echo json_encode(["msg" => "Invalid OTP", "status" => 401]);
    exit;
}

$row = $res->fetch_assoc();

// Check expiry
if (date('Y-m-d H:i:s') > $row['otp_expiry']) {
    http_response_code(400);
    echo json_encode(["msg" => "OTP expired", "status" => 400]);
    exit;
}

// Identify user type & load data
$type = $row['type'];
$user_data = null;
$idField = '';
$codeField = '';
$nameField = '';
$photoField = '';

switch ($type) {
    case 'Supervisor':
        $query = $con->prepare("SELECT emp_id, emp_code, name, photo_file, mobile, alt_mob FROM staff WHERE emp_code = ?");
        $query->bind_param("s", $row['dr_code']);
        $query->execute();
        $user_data = $query->get_result()->fetch_assoc();
        $idField = 'emp_id';
        $codeField = 'emp_code';
        $nameField = 'name';
        $photoField = 'photo_file';
        break;

    case 'Driver':
        $query = $con->prepare("SELECT driver_id, driver_code, driver_name, photo_file, driver_mobile, alt_mob FROM driver WHERE driver_code = ?");
        $query->bind_param("s", $row['dr_code']);
        $query->execute();
        $user_data = $query->get_result()->fetch_assoc();
        $idField = 'driver_id';
        $codeField = 'driver_code';
        $nameField = 'driver_name';
        $photoField = 'photo_file';
        break;

    case 'Supporting Staff':
        $query = $con->prepare("SELECT id, ss_code, name, photo_file, mobile, alt_mob FROM supporting_staff WHERE staff_code = ?");
        $query->bind_param("s", $row['dr_code']);
        $query->execute();
        $user_data = $query->get_result()->fetch_assoc();
        $idField = 'id';
        $codeField = 'ss_code';
        $nameField = 'name';
        $photoField = 'photo_file';
        break;
}

if (!$user_data) {
    http_response_code(404);
    echo json_encode(["msg" => "User not found", "status" => 404]);
    exit;
}

// ---- JWT ACCESS TOKEN ----
$nbf = new DateTimeImmutable();
$payload = [
    "user_name" => $user_data[$nameField],
    "id"        => $user_data[$idField],
    "user_code" => $user_data[$codeField],
    "type"      => $type,
    "nbf"       => $nbf->getTimestamp(),
    "exp"       => $nbf->modify('+30 days')->getTimestamp()
];

$jwt = JWT::encode($payload, 'dootcare', 'HS256');

// ---- REFRESH TOKEN ----
$refreshRaw  = bin2hex(random_bytes(32));
$refreshHash = password_hash($refreshRaw, PASSWORD_DEFAULT);
$refreshExp  = (new DateTime('+30 days'))->format('Y-m-d H:i:s');

$userId = $user_data[$idField];

$insert_refresh = $con->prepare("
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at, type) 
    VALUES (?, ?, ?, ?)
");
$insert_refresh->bind_param("isss", $userId, $refreshHash, $refreshExp, $type);
$insert_refresh->execute();

// Update login log with refresh token for reference
$update_log = $con->prepare("UPDATE driver_login_log SET token=? WHERE id=?");
$update_log->bind_param("si", $refreshRaw, $row['id']);
$update_log->execute();

// ---- RESPONSE ----
http_response_code(200);
echo json_encode([
    "msg"    => "Login successful",
    "status" => 200,
    "data"   => [
        "jwt"           => $jwt,
        "refresh_token" => $refreshRaw,
        "user"          => [
            "id"         => $user_data[$idField],
            "code"       => $user_data[$codeField],
            "name"       => $user_data[$nameField],
            "image"      => $user_data[$photoField],
            "type"       => $type,
            "mobile_no"  => $row['mobile_no']
        ]
    ]
]);
?>
