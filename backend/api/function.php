<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header("Access-Control-Allow-Headers: X-Requested-With");
date_default_timezone_set("Asia/Kolkata");
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;
use Firebase\JWT\JWK;

require "jwt/src/BeforeValidException.php";
require "jwt/src/ExpiredException.php";
require "jwt/src/SignatureInvalidException.php";
require "jwt/src/JWT.php";
require "jwt/src/JWK.php";
require "jwt/src/Key.php";
require "jwt/src/CachedKeySet.php";

if(!isset($_SESSION)) 
{ 
    session_start();
}
	
	require_once "db.php";
	$setting = $con->query("select trip_cancel_access_key,gps_url,trip_create_before,trip_creation_api_key from setting where company='106'")->fetch_assoc();
	$url = $setting['gps_url'];	

function token_validation($token)
{
	try
	{
		$decodes = JWT::decode($token,new Key('dootcare','HS256'));
		$now = new DateTimeImmutable();
		if($decodes->nbf > $now->getTimestamp() or $decodes->exp < $now->getTimestamp())
		{
			http_response_code(401);
			$arr = ["msg" => "Expired Token", "status" => 400,"data"=>'token expired'];
			exit;			
		}
		
		http_response_code(200);
		$arr = ["msg" => "Valid Token", "status" => 200,"data"=>$decodes];	
	}
	catch(Exception $e)
	{
		http_response_code(400);
		$arr = ["msg" => "Invalid Token", "status" => 400,"data"=>$e->getMessage()];		
	}
	return json_encode($arr);
}

function trip_cancellation($duty_id){
	
	global $con,$setting,$url;

	
	$trip_data = $con->query("select gps_trip_id as tripIds from duty_trips where (trip_name<>'Rest' and trip_name<>'Lunch') and main_duty_code='$duty_id'");
	//$trips = str_replace(",",",\n",$trips);
	$trips = "";
	
	while($st = $trip_data->fetch_assoc()){
		$trips .= '"'.$st['tripIds'].'",';
	}
	
	$trips = rtrim($trips,',');
	$data = '{"tripId":['.$trips.']}';

	$curl = curl_init();
	curl_setopt_array($curl, array(
	  CURLOPT_URL => $url.'/gps/public/v1/trip/edit?accessKey='.$setting['trip_cancel_access_key'].'',
	  CURLOPT_RETURNTRANSFER => true,
	  CURLOPT_ENCODING => '',
	  CURLOPT_MAXREDIRS => 10,
	  CURLOPT_TIMEOUT => 0,
	  CURLOPT_FOLLOWLOCATION => true,
	  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
	  CURLOPT_CUSTOMREQUEST => 'POST',
	  CURLOPT_POSTFIELDS =>$data,
	  CURLOPT_HTTPHEADER => array(
		'Content-Type: application/json'
	  ),
	));

	$res = json_decode(curl_exec($curl));
	return $res;
}


function create_gps_duty($duty_id,$bus){
	global $con,$setting,$url;
	
	
	$get_trip = $con->query("select * from duty_trips where (trip_name<>'Rest' and trip_name<>'Lunch') and main_duty_code ='$duty_id' order by id");
	
	if($get_trip->num_rows != 0){
		
	$data = '[';
	while($trip = $get_trip->fetch_assoc()){	
		$mr = $con->query("select tour_gps_id,stoppages from mapped_route where refer_id='".$trip['route_id']."'")->fetch_assoc();
		$tour_gps_id = $mr['tour_gps_id'];
		
		//$get_stop = $con->query("select * from duty_trips_stoppage where duty_trips_id='".$trip['duty_id']."' and route_id='".$trip['route_id']."' order by seq ");
		
		$get_stop = $con->query("select * from mapped_route_stoppage where route_id='".$trip['route_id']."' order by sequance");
		
		$stop = "";
		$trave_time = 0;
		while($stoppage = $get_stop->fetch_assoc()){
			$trave_time = $trave_time + (int)$stoppage['travel_time'];	
					
			if($stoppage['sequance']!="1" and $mr['stoppages']!=$stoppage['sequance']){
				$stop .= '{ "haltId":"'.$stoppage['gps_id'].'", "haltscheduleArrival":"'.date("d/m/Y H:i",strtotime("+$trave_time minutes ",strtotime($trip['start_time']))).'","scheduleHaltTime":"'.$stoppage['travel_time'].'" },';
			}
		}

	$stop = rtrim($stop, ",");
	$data .= '{
		"tourId": "'.$tour_gps_id.'",
		"tripName": "'.$trip['trip_name'].' '.$trip['seq'].'",
		"vehicleNo": "'.$bus.'",
		"scheduledDeparture": "'.date("d/m/Y H:i",strtotime($trip['start_time'])).'",
		"scheduledArrival":"'.date("d/m/Y H:i",strtotime($trip['end_time'])).'",
		"halts":[ '.$stop.' ]
	},';
	
	}
	

	$data = rtrim($data, ',');
	$data .= ']';
	
	//echo "<pre>";
	//print_r($data);

	$get_trip = $con->query("select * from duty_trips where (trip_name<>'Rest' and trip_name<>'Lunch') and main_duty_code ='$duty_id' order by id");
	$rows = [];
	while($row = $get_trip->fetch_assoc())
	{
		$rows[] = $row;
	}



	$curl = curl_init();
	curl_setopt_array($curl, array(
	  CURLOPT_URL => $url.'/gps/public/v1/tourtrip/add?accessKey='.$setting['trip_creation_api_key'].'',
	  CURLOPT_RETURNTRANSFER => true,
	  CURLOPT_ENCODING => '',
	  CURLOPT_MAXREDIRS => 10,
	  CURLOPT_TIMEOUT => 0,
	  CURLOPT_FOLLOWLOCATION => true,
	  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
	  CURLOPT_CUSTOMREQUEST => 'POST',
	  CURLOPT_POSTFIELDS =>$data,
	  CURLOPT_HTTPHEADER => array(
		'Content-Type: application/json'
	  ),
	));

	$response = json_decode(curl_exec($curl));
	//print_r($response);
	$i=0;
	$query = "";
	$trips = "";
	foreach($response->data as $res){	
		$query .= "update duty_trips set bus='$bus',gps_trip_id='".$res->tripId."' where id='".$rows[$i]['id']."' ;";
		$i++;
		$trips .= '"'.$res->tripId.'",';
	}
	
	
	$trips = rtrim($trips,',');
	$data = '{"tripId":['.$trips.']}';

	//$stoppages = rtrim($stoppages, ',');
	$query .= "update duties set bus='$bus',gps_build_status='Yes',vehicle_change_counter=vehicle_change_counter+1 where duty_id='$duty_id';";
	
		if ($response->code == 200) {
			if ($con->multi_query($query)) {
				//$con->query("INSERT INTO gps_log (duty_id, added_dt, status, code, message, trip_name, trip_id) VALUES ('$duty_id', '" . date("Y-m-d H:i:s") . "', '".$response->status."', '".$response->code."', '".$response->message."', '" . $response->tripName . "', '" . $response->tripId . "')");
				$arr = ["msg" => "Tour Updated","data"=> json_decode($data), "status" => http_response_code(200)];
			
			} else {
				//$con->query("INSERT INTO gps_log (duty_id, added_dt, status, code, message) VALUES ('$duty_id', '" . date("Y-m-d H:i:s") . "', '".$response->status."', '".$response->code."', '".$response->message."')");
				$arr = ["msg" => "Error try again", "status" => http_response_code(400)];
			}
			
			return json_encode($arr);
		} else {
				$arr = ["msg" => $response->message, "status" => http_response_code(400)];
				return json_encode($arr);
		}	
	
	} else {
		$arr = ["msg" => "All trip already created", "status" => http_response_code(400)];
		return json_encode($arr);
	}

}

function handle_error()
{
    http_response_code(405);
    $arr = ["msg" => "Method Not Allowed", "status" => 405];
    echo json_encode($arr);
}
?>
