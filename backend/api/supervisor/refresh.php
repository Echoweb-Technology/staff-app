<?php
	use Firebase\JWT\JWT;
	require 'vendor/autoload.php'; require 'db.php'; require 'config.php';
	$input = json_decode(file_get_contents('php://input'), true);
	$refresh = $input['refresh_token'] ?? '';
	if (!$refresh) { http_response_code(400); echo json_encode(['error'=>'missing refresh token']); exit; }
	
	$stmt = $db->prepare("SELECT * FROM refresh_tokens WHERE expires_at > NOW()");
	$stmt->execute();
	$found = null;
	while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
		if (password_verify($refresh, $row['token_hash'])) { $found = $row; break; }
	}
	if (!$found) { http_response_code(401); echo json_encode(['error'=>'invalid refresh']); exit; }
	
	$user = $db->query("SELECT * FROM users WHERE id={$found['user_id']}")->fetch(PDO::FETCH_ASSOC);
	$now = time();
	$access = JWT::encode([
	'iss'=>$config['jwt_issuer'],'sub'=>(string)$user['id'],'role'=>$user['role'],'iat'=>$now,'exp'=>$now+900
	], $config['jwt_secret'], 'HS256');
	
	echo json_encode(['access_token'=>$access]);
