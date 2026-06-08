<?php
// auth-middleware.php
use Firebase\JWT\JWT; use Firebase\JWT\Key;
function require_auth() {
  global $config;
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!preg_match('/Bearer\s+(\S+)/', $hdr, $m)) { http_response_code(401); exit; }
  try {
    $payload = JWT::decode($m[1], new Key($config['jwt_secret'],'HS256'));
    return $payload; // ->sub, ->role
  } catch(Exception $e) { http_response_code(401); exit; }
}
