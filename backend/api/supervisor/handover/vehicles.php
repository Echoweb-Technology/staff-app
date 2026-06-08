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

function logMessage($message) {
    $logFile = __DIR__ . "/api_log.txt"; // same folder as this script
    $time = date("Y-m-d H:i:s");
   // file_put_contents($logFile, "[$time] $message" . PHP_EOL, FILE_APPEND);
}


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
// Log request headers
logMessage("Headers: " . json_encode(getallheaders()));

// Log query params
logMessage("Query Params: " . json_encode($_GET));

// Log JWT payload
try {
    $decoded = JWT::decode($jwt, new Key('dootcare', 'HS256'));
    logMessage("JWT decoded: " . json_encode($decoded));
} catch (Exception $e) {
    logMessage("JWT error: " . $e->getMessage());
    http_response_code(401);
    echo json_encode(["msg" => "Invalid or expired token", "status" => 401]);
    exit;
}



// --- GET SEARCH PARAM ---
$search = isset($_GET['search']) ? trim($_GET['search']) : "";

$handover_type =  isset($_GET['handover_type']) ? trim($_GET['handover_type']) : "";

$condition = ($handover_type === "primary") ? "driver_id='0'" : "(driver_id='0' OR driver1_id='0')";

// --- BUILD QUERY ---
if (!empty($search)) {
    // Use prepared statements to prevent SQL injection
    $stmt = $con->prepare("SELECT registration, vehicle_id 
                           FROM vehicle  WHERE $condition  AND registration LIKE CONCAT('%', ?, '%')  LIMIT 10");
    $stmt->bind_param("s", $search);
    $stmt->execute();
    $result = $stmt->get_result();
	logMessage("qry: " . "SELECT registration, vehicle_id 
                           FROM vehicle  WHERE $condition  AND registration LIKE CONCAT('%', $search, '%')  LIMIT 10");
} else {
    $query = "SELECT registration, vehicle_id 
              FROM vehicle 
              WHERE $condition  
              LIMIT 10";
    $result = $con->query($query);
	logMessage("qryyyyyyyyyyyyyyy: " . "SELECT registration, vehicle_id 
              FROM vehicle 
              WHERE $condition  
              LIMIT 10");
}

// --- FETCH DATA ---
$vehicles = [];
while ($row = $result->fetch_assoc()) {
    $vehicles[] = $row;
}
logMessage("Vehicles fetched: " . json_encode($vehicles));

// --- RESPONSE ---
http_response_code(200);
echo json_encode([
    "msg" => "Success",
    "status" => 200,
    "data" => $vehicles
]);
