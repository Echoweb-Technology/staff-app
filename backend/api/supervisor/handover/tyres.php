<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");
header('Access-Control-Allow-Headers: Origin, Content-Type, Authorization, X-Auth-Token');

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

require "../../jwt/src/BeforeValidException.php";
require "../../jwt/src/ExpiredException.php";
require "../../jwt/src/SignatureInvalidException.php";
require "../../jwt/src/JWT.php";
require "../../jwt/src/JWK.php";
require "../../jwt/src/Key.php";
require "../../jwt/src/CachedKeySet.php";
require_once "../../../database.php"; 

// --- CHECK METHOD ---
$method = $_SERVER["REQUEST_METHOD"];
if ($method !== "GET") {
    http_response_code(405);
    echo json_encode(["msg" => "Method Not Allowed", "status" => 405]);
    exit;
}

// --- CHECK AUTH HEADER ---
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(["msg" => "Authorization header missing", "status" => 401]);
    exit;
}

list($jwt) = sscanf($headers['Authorization'], 'Bearer %s');
if (!$jwt) {
    http_response_code(401);
    echo json_encode(["msg" => "Invalid Authorization format", "status" => 401]);
    exit;
}

// --- VERIFY JWT ---
try {
    $decoded = JWT::decode($jwt, new Key('dootcare', 'HS256'));
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(["msg" => "Invalid or expired token", "status" => 401]);
    exit;
}

// --- CHECK REQUIRED PARAM ---
if (!isset($_GET['tyre']) || empty(trim($_GET['tyre']))) {
    http_response_code(400);
    echo json_encode(["msg" => "Missing or invalid tyre parameter", "status" => 400]);
    exit;
}

$vehicleId = trim($_GET['tyre']);

// --- FETCH VEHICLE REGISTRATION ---
$stmt = $con->prepare("SELECT registration FROM vehicle WHERE vehicle_id = ?");
$stmt->bind_param("s", $vehicleId);
$stmt->execute();
$resVehicle = $stmt->get_result();

if ($resVehicle->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["msg" => "Vehicle not found", "status" => 404]);
    exit;
}

$vehicle = $resVehicle->fetch_assoc();
$registration = $vehicle['registration'];

// --- FETCH TYRE INFO ---
$stmt2 = $con->prepare("SELECT tyre1_sno, tyre1_brand, tyre1_condition,
                               tyre2_sno, tyre2_brand, tyre2_condition,
                               tyre3_sno, tyre3_brand, tyre3_condition,
                               tyre4_sno, tyre4_brand, tyre4_condition,
                               tyre5_sno, tyre5_brand, tyre5_condition
                        FROM tyre_manage 
                        WHERE registration = ?");
$stmt2->bind_param("s", $registration);
$stmt2->execute();
$resTyre = $stmt2->get_result();

if ($resTyre->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["msg" => "Tyre information not found", "status" => 404]);
    exit;
}

$tyreData = $resTyre->fetch_assoc();

// --- RESPONSE ---
http_response_code(200);
echo json_encode([
    "msg" => "Success",
    "status" => 200,
    "data" => $tyreData
]);
