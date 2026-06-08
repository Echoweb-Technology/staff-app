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

// This could be fetched from a database table 'app_settings'
// For now, we use a simple config approach which is easy for the admin to update.
$latest_version = [
    "version_code" => 2, 
    "version_name" => "1.0.1",
    "download_url" => "https://vtms.co.in/app/jeplus_v1.0.1.apk",
    "is_mandatory" => true,
    "release_notes" => "Critical bug fixes and performance improvements. Hindi language support added."
];

echo json_encode([
    "status" => 200,
    "data" => $latest_version
]);
?>