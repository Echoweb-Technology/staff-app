<?php
	
header("Access-Control-Allow-Origin:*");
header("Access-Control-Allow-Credentials:true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type:application/json");
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

// --- GET SEARCH TERM ---
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$searchSql = '';
if (!empty($search)) {
    $search = $con->real_escape_string($search);
    $searchSql = " AND (driver_name LIKE '%$search%' OR driver_code LIKE '%$search%')";
}

// --- QUERY DRIVERS (Temp Drivers + Permanent Drivers) ---
$drivers = [];

// temp_driver
$query_temp = "SELECT driver_id, driver_name, driver_code 
               FROM temp_driver 
               WHERE (assinged_vehicle = '' OR assinged_vehicle IS NULL)
               $searchSql
               ORDER BY driver_id DESC
               LIMIT 20";
$result_temp = $con->query($query_temp);

while ($row = $result_temp->fetch_assoc()) {
    $drivers[] = [
        "driver_id"   => $row["driver_id"],
        "driver_name" => $row["driver_name"],
        "driver_code" => $row["driver_code"],
        "type"        => "Temp"
    ];
}

// driver
$query_driver = "SELECT driver_id, driver_name, driver_code 
                 FROM driver 
                 WHERE driver_status <> 'Inoperative'
                 AND (assinged_vehicle = '' OR assinged_vehicle IS NULL)
                 AND (assinged_vehicle_id = '' OR assinged_vehicle_id IS NULL)
                 $searchSql
                 LIMIT 20";
$result_driver = $con->query($query_driver);

while ($row = $result_driver->fetch_assoc()) {
    $drivers[] = [
        "driver_id"   => $row["driver_id"],
        "driver_name" => $row["driver_name"],
        "driver_code" => $row["driver_code"],
        "type"        => "Permanent"
    ];
}

// --- RESPONSE ---
http_response_code(200);
echo json_encode([
    "msg" => "Success",
    "status" => 200,
    "data" => $drivers
]);

?>
