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

// --- SEARCH PARAM ---
$search = isset($_GET['q']) ? trim($_GET['q']) : '';

// --- QUERY SUPERVISORS ---
$sql = "SELECT name 
        FROM staff 
        WHERE working_status = 'Active'";

if (!empty($search)) {
    $sql .= " AND name LIKE ?";
}

$sql .= " ORDER BY emp_id DESC";

$stmt = $con->prepare($sql);

if (!empty($search)) {
    $searchParam = "%{$search}%";
    $stmt->bind_param("s", $searchParam);
}

$stmt->execute();
$result = $stmt->get_result();

$supervisors = [];
while ($row = $result->fetch_assoc()) {
    $supervisors[] = [
        "name" => $row["name"]
    ];
}

// --- RESPONSE ---
http_response_code(200);
echo json_encode([
    "msg" => "Success",
    "status" => 200,
    "data" => $supervisors
]);

?>
