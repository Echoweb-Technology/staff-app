<?php
require_once __DIR__ . '/../../jwt/src/BeforeValidException.php';
require_once __DIR__ . '/../../jwt/src/ExpiredException.php';
require_once __DIR__ . '/../../jwt/src/SignatureInvalidException.php';
require_once __DIR__ . '/../../jwt/src/JWT.php';
require_once __DIR__ . '/../../jwt/src/Key.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Firebase\JWT\BeforeValidException;

function validateJWT($headers) {

    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['msg' => 'No token provided', 'status' => 401]);
        exit;
    }

    $authHeader = $headers['Authorization'];
    list($jwt) = sscanf($authHeader, 'Bearer %s');

    if (!$jwt) {
        http_response_code(401);
        echo json_encode(['msg' => 'Invalid token format', 'status' => 401]);
        exit;
    }

    try {
        $key = 'dootcare';
        $decoded = JWT::decode($jwt, new Key($key, 'HS256'));
        return (array) $decoded;

    } catch (ExpiredException $e) {

        http_response_code(401);
        echo json_encode(['msg' => 'Token expired', 'status' => 401]);
        exit;

    } catch (SignatureInvalidException $e) {

        http_response_code(401);
        echo json_encode(['msg' => 'Invalid signature', 'status' => 401]);
        exit;

    } catch (BeforeValidException $e) {

        http_response_code(401);
        echo json_encode(['msg' => 'Token not yet valid', 'status' => 401]);
        exit;

    } catch (Exception $e) {

        http_response_code(401);
        echo json_encode(['msg' => 'Invalid token', 'status' => 401]);
        exit;
    }
}
?>