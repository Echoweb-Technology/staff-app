<?php

class Token{
	static function Sign($payload,$key,$expire = null){
		
		//Header
		$header = ['alog'=>'HS256','type'=>'HWT'];
		
		if($expire){
			$header['expire'] = time() + $expire;
		}
		
		$header_encoded = base64_encode(json_encode($header));
		
		//Payload
		$payload_encoded = base64_encode(json_encode($payload));
		
		//Signature
		$signature = hash_hmac('SHA256',$header_encoded.$payload_encoded,$key);
		$signature_encoded = base64_encode($signature);
		
		return $header_encoded  . '.' . $payload_encoded . '.' . $signature_encoded;
	}
	
	static function Verify($token,$key){
		$token_parts = explode('.',$token);
		$signature = base64_encode(hash_hmac('SHA256',$token_parts[0].$token_parts[1],$key));
		
		if($signature != $token_parts[2]){
			echo 'invalid token';
			return false;
		}
		
		$header = json_decode(base64_decode($token_parts[0]),true);
		if(isset($header['expire'])){
			if($header['expire'] < time()){
			echo "Token Expire";
			return false;
			}
		}
		
		$payload = json_decode(base64_decode($token_parts[1]),true);
		return $payload;
	}
}