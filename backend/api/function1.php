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
session_start();

	
function generate_otp($phone){ 
	require_once "../config/database.php";
	$otp = rand(1000,9999);
	$otp = "1234";
    if($con->query("select * from users where phone='$phone'")->num_rows == 0) {
        $insert =  "insert into users(phone,added_date) values('$phone','".date("Y-m-d H:i:s")."')";
		$insert_otp =  "insert into otp(otp,mobile,use_for,valid_till) values('$otp','$phone','User Login','".date("Y-m-d H:i:s",strtotime("+2 min"))."')";
        if ($con->query($insert) and $con->query($insert_otp)) {
			
			/*
			$curl = curl_init();
			curl_setopt_array($curl, array(
			  CURLOPT_URL => 'http://125.16.147.178/VoicenSMS/webresources/CreateSMSCampaignGet?ukey=VmSUKQOPmoAcpxF6AngXJXS0z&msisdn='.$phone.'&language=0&credittype=2&senderid=GOMRKT&templateid=0&message=Dear%20Customer%20your%20complaint%20is%20registered.%20Complaint%20No%20is%20%3C'.$otp.'%3E.Team%20Go2Market&filetype=2',
			  CURLOPT_RETURNTRANSFER => true,
			  CURLOPT_ENCODING => '',
			  CURLOPT_MAXREDIRS => 10,
			  CURLOPT_TIMEOUT => 0,
			  CURLOPT_FOLLOWLOCATION => true,
			  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
			  CURLOPT_CUSTOMREQUEST => 'GET',
			));

			$response = curl_exec($curl);
			curl_close($curl);
			//echo $response;
			*/
            http_response_code(200);
            $arr = [
                "msg" => "OTP Generated successfully",
                "status" => 200,
            ];
        } else {
            http_response_code(400);
            $arr = [
                "msg" => "Error try again later",
                "status" => 400,
            ];
        }
    } else {
		$insert_otp =  "insert into otp(otp,mobile,use_for,valid_till) values('$otp','$phone','User Login','".date("Y-m-d H:i:s",strtotime("+2 min"))."')";
        if ($con->query($insert_otp)) {
			/*
			$curl = curl_init();
			curl_setopt_array($curl, array(
			  CURLOPT_URL => 'http://125.16.147.178/VoicenSMS/webresources/CreateSMSCampaignGet?ukey=VmSUKQOPmoAcpxF6AngXJXS0z&msisdn='.$phone.'&language=0&credittype=2&senderid=GOMRKT&templateid=0&message=Dear%20Customer%20your%20complaint%20is%20registered.%20Complaint%20No%20is%20%3C'.$otp.'%3E.Team%20Go2Market&filetype=2',
			  CURLOPT_RETURNTRANSFER => true,
			  CURLOPT_ENCODING => '',
			  CURLOPT_MAXREDIRS => 10,
			  CURLOPT_TIMEOUT => 0,
			  CURLOPT_FOLLOWLOCATION => true,
			  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
			  CURLOPT_CUSTOMREQUEST => 'GET',
			));
				
			$response = curl_exec($curl);
			curl_close($curl);
			//echo $response;
			*/
            http_response_code(200);
            $arr = [
                "msg" => "OTP Generated successfully",
                "status" => 200,
            ];
        } else {
            http_response_code(400);
            $arr = [
                "msg" => "Error try again later",
                "status" => 400,
            ];
        }
    }
    echo json_encode($arr);	
}

function get_payment_option()
{
	require_once "../config/database.php";
	$payment = $con->query("select * from payment_option")->fetch_assoc();
	print_r($payment);exit;
            $records = [
                "cod" => $payment["cod"],
                "paytm" => $payment["paytm"],
				"razorpay" => $payment['razorpay']
            ];
            http_response_code(200);
            $arr = [
                "msg" => "data retirve successfully",
				"data" =>$records,
                "status" => 'success',
            ];
	echo json_encode($arr);	
}


function user_login_opt_verify($phone,$otp)
{
	require_once "../config/database.php";
	if($con->query("select * from otp where mobile='$phone' and otp='$otp' and valid_till>'".date("Y-m-d H:i:s")."'")->num_rows > 0) {

	$con->query("update users set mobile_verified_status='Yes' and last_login_date='".date("Y-m-d H:i:s")."'  where phone='$phone'");
			$result = $con->query("select * from users where phone='$phone'");
			$data = [];
			$row = $result->fetch_assoc();
			$_SESSION['key'] = myCrypt($phone, $key);
            $records = [
                "id" => $row["id"],
                "name" => $row["name"],
				"wallet_points" => $row['wallet_points'],
				"key" =>$_SESSION['key'],
            ];

			$_SESSION['user_name']=$row["name"];
			$_SESSION['user_id'] =$row["id"];
			
            array_push($data, $records);
            http_response_code(200);
            $arr = [
                "msg" => "User Verified successfully",
				"data" =>$data,
                "status" => 'success',
            ];
	} else {
            http_response_code(200);
            $arr = [
                "msg" => "Error try again later",
                "status" => 'fail',
            ];		
	}
	echo json_encode($arr);	
}

function logout_user()
{
	session_start();
	session_unset();
	session_destroy();
    http_response_code(200);
            $arr = [
                "msg" => "logout successfully",
                "status" => 'success',
            ];	
			echo json_encode($arr);	
}


function add_user($data)
{
    require_once "../config/database.php";
    if (
        $con->query("select * from users where phone='" . $data["phone"] . "'")
            ->num_rows == 0
    ) {
        $insert =
            "insert into users(name,email,phone,city,password,added_date) values('" .
            $data["name"] .
            "','" .
            $data["email"] .
            "','" .
            $data["phone"] .
            "','" .
            $data["city"] .
            "','" .
            password_hash($data["password"],PASSWORD_BCRYPT) .
            "','" .
            date("Y-m-d H:i:s") .
            "')";
        if ($con->query($insert)) {
            http_response_code(200);
            $arr = [
                "msg" => "Record Inserted successfully",
                "status" => 200,
            ];
        } else {
            http_response_code(400);
            $arr = [
                "msg" => "Error try again later",
                "status" => 400,
            ];
        }
    } else {
        http_response_code(400);
        $arr = ["msg" => "User Already Exist", "status" => 400];
    }
    echo json_encode($arr);
}

function get_user_data()
{
    require_once "../config/database.php";
    $result = $con->query("select * from users");
    $data = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $records = [
                "id" => $row["id"],
                "name" => $row["name"],
                "email" => $row["email"],
                "phone" => $row["phone"],
                "city" => $row["city"],
                "status" => $row["status"],
                "last_login_datetime" => $row["last_login_date"],
                "last_login_ip" => $row["last_login_ip"],
            ];
            array_push($data, $records);
        }
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => http_response_code(200),
        ];
        echo json_encode($arr);
    } else {
        $arr = [
            "msg" => "Record not found",
            "status" => http_response_code(400),
        ];
        echo json_encode($arr);
    }
}

function get_user_data_with_id($id)
{
    require_once "../config/database.php";
    $result = $con->query("select * from users where id='$id'");
    $data = [];
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();

        $records = [
            "id" => $row["id"],
            "name" => $row["name"],
            "email" => $row["email"],
            "phone" => $row["phone"],
            "city" => $row["city"],
            "status" => $row["status"],
            "last_login_datetime" => $row["last_login_date"],
            "last_login_ip" => $row["last_login_ip"],
        ];
        array_push($data, $records);
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not found", "status" => 400];
        echo json_encode($arr);
    }
}

function update_user($id, $data)
{
    require_once "../config/database.php";
    $set = "";
	$pass = 0;
    foreach ($data as $key => $value) {
		if($key=="password"){
			$pass = 1;
		} else {
			$set .= $key . "='" . $value . "',";
		}
    }
    $set = substr($set, 0, -1);

	if($pass==0){
		
		if ($con->query("select * from users where id='$id'")->num_rows > 0) {
			if ($con->query("update users set $set where id='$id'")) {
				http_response_code(200);
				$arr = [
					"msg" => "Record Updated successfully",
					"status" => 200,
				];
			} else {
				$arr = [
					"msg" => "Error try again later",
					"status" => 400,
				];
			}
		} else {
			http_response_code(400);
			$arr = ["msg" => "Record not found", "status" => 400];
		}
		
	} else {
		http_response_code(405);
		$arr = [
				"msg" => "Method Not Allowed",
				"status" => 405,
			];		
	}
    echo json_encode($arr);
}

function delete_user($id)
{
    require_once "../config/database.php";
    if ($con->query("select * from users where id='$id'")->num_rows > 0) {
        if ($con->query("delete from users where id='$id'")) {
            http_response_code(200);
            $arr = [
                "msg" => "Record Removed successfully",
                "status" => 200,
            ];
        } else {
            $arr = [
                "msg" => "Error try again later",
                "status" => 400,
            ];
        }
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not found", "status" => 400];
    }
    echo json_encode($arr);
}

function user_change_password($phone,$old_password,$new_password)
{
    require_once "../config/database.php";

	if($pass==0){
		
		if ($con->query("select * from users where id='$id'")->num_rows > 0) {
			if ($con->query("update users set $set where id='$id'")) {
				http_response_code(200);
				$arr = [
					"msg" => "Record Updated successfully",
					"status" => 200,
				];
			} else {
				$arr = [
					"msg" => "Error try again later",
					"status" => 400,
				];
			}
		} else {
			http_response_code(400);
			$arr = ["msg" => "Record not found", "status" => 400];
		}
		
	} else {
		http_response_code(405);
		$arr = [
				"msg" => "Method Not Allowed",
				"status" => 405,
			];		
	}
    echo json_encode($arr);	
}



	
function user_login($phone,$password)
{	

	require_once "../config/database.php";

	
	$data = $con->query("select * from users where phone='$phone' and status='Active'");
	
	if ($data->num_rows > 0) {
		$data = $data->fetch_assoc();
		$nbf = new DateTimeImmutable();
		if(password_verify($password,$data['password'])){
			
			$payload = array(
				"id"=>$data['id'],
				"name"=>$data['name'],
				"email"=>$data['email'],
				"phone"=>$data['phone'],
				"city"=>$data['city'],
				"nbf" =>$nbf->getTimestamp(),
				"exp" =>$nbf->modify('+1 minutes')->getTimestamp() ,
			);
			$iss = new DateTimeImmutable();
			$jwt = JWT::encode($payload,'dootcare','HS256');
			$array['name'] =$data['name'];
			$array['phone'] =$data['phone'];
			$array['jwt'] = $jwt;

			
			http_response_code(200);
			$arr = ["msg" => "Login successfully", "status" => 200,'data'=>$array];			
		} else {
			http_response_code(401);
			$arr = ["msg" => "Invalid id or password", "status" => 401];		
		}
		
	} else {
		http_response_code(400);
		$arr = ["msg" => "User Not Found", "status" => 400];		
	}
	echo json_encode($arr);
}*/



function token_validation($token)
{
	try
	{
		$decodes = JWT::decode($token,new Key('dootcare','HS256'));
		/*$now = new DateTimeImmutable();
		if($decodes->nbf > $now->getTimestamp() or $decodes->exp < $now->getTimestamp())
		{
			http_response_code(401);
			$arr = ["msg" => "Expired Token", "status" => 400,"data"=>'token expired'];
			exit;			
		}*/
		
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


function get_group_category()
{
    require_once "../config/database.php";
    $result = $con->query("SELECT c.id,c.name,c.slug,c.icon_img, COUNT(*) as services_count FROM services s left join category c on c.id=s.category where c.status='Active' GROUP BY c.name");
    $data = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $records = [
                "id" => $row["id"],
                "name" => $row["name"],
                "slug" => $row["slug"],
                "icon" => $row["icon_img"],
				"services_total" => $row["services_count"]
            ];
            array_push($data, $records);
        }
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => http_response_code(200),
        ];
        echo json_encode($arr);
    } else {
        $arr = [
            "msg" => "Record not found",
            "status" => http_response_code(400),
        ];
        echo json_encode($arr);
    }
}


function get_group_category_with_slug($slug)
{
    require_once "../config/database.php";

    $result = $con->query("select * from services where category='".$con->query("select id from category where slug='$slug'")->fetch_assoc()['id']."'");
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()){
        $records = [
            "id" => $row["id"],
            "name" => $row["name"],
            "slug" => $row["slug"],
            "icon" => $row["icon_img"]
        ];

			array_push($data, $records);
		}
		
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not found", "status" => 400];
        echo json_encode($arr);
    }
}

function get_all_services()
{
    require_once "../config/database.php";
    $result = $con->query("select * from services where status='Active'");
    $data = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $records = [
                "id" => $row["id"],
                "name" => $row["name"],
                "slug" => $row["slug"],
                "icon" => $row["icon_img"]
            ];
            array_push($data, $records);
        }
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => http_response_code(200),
        ];
        echo json_encode($arr);
    } else {
        $arr = [
            "msg" => "Record not found",
            "status" => http_response_code(400),
        ];
        echo json_encode($arr);
    }
}


function single_sevices_with_slug($id)
{
    require_once "../config/database.php";

    $result = $con->query("select * from service_type where id='$id'");
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()){
        $records = [
            "id" => $row["id"],
            "name" => $row["name"],
            "amount" => $row["amount"],
            "details" => $row["details"],
			"slider_1" => $row["slider_1"],
			"estimate_time" => $row["estimate_time"],
        ];

			array_push($data, $records);
		}
		
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not found", "status" => 400];
        echo json_encode($arr);
    }
}


function get_services_with_slug($slug)
{
    require_once "../config/database.php";

    $result = $con->query("select * from service_type where service_id='".$con->query("select id from services where slug='$slug'")->fetch_assoc()['id']."'");
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()){
        $records = [
            "id" => $row["id"],
            "name" => $row["name"],
            "amount" => $row["amount"],
            "details" => $row["details"],
			"slider_1" => $row["slider_1"],
			"estimate_time" => $row["estimate_time"],
        ];

			array_push($data, $records);
		}
		
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not found", "status" => 400];
        echo json_encode($arr);
    }
}

function myCrypt($value, $key)
{	
	$iv = "1234567890123412";
    $encrypted_data = openssl_encrypt($value, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($encrypted_data);
}

function myDecrypt($value, $key)
{
	$iv = "1234567890123412";
    $value = base64_decode($value);
    $data = openssl_decrypt($value, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    return $data;
}

function add_to_cart($data,$phone)
{	
	require_once "../config/database.php";
	if($phone!=""){
	$phone = myDecrypt($phone, $key);
	
	if($con->query("select * from cart where mobile_no='$phone'")->num_rows==0){
		$insert = "insert into cart(mobile_no,data,added_dt) values($phone,'".addslashes(json_encode($data,true))."','".date("Y-m-d H:i:s")."')";
	} else {
		$insert = "update cart set data='".addslashes(json_encode($data,true))."',added_dt='".date("Y-m-d H:i:s")."' where mobile_no='$phone'";
	}

	if($con->query($insert)){
        http_response_code(200);
        $arr = [
            "msg" => "Record saved successfully",
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not saved", "status" => 400];
        echo json_encode($arr);
    }
	}
}

function get_cart($phone)
{
	require_once "../config/database.php";
	$phone = myDecrypt($phone,$key);
	$data = stripslashes($con->query("select data from cart where mobile_no='$phone'")->fetch_assoc()['data']);
	$json = json_decode($data,true);
	//print_r($json);exit;
	$st = [];
	foreach($json as $data)
	{
		$data['image'] = $con->query("select slider_1 from service_type where id='".$data['item_id']."'")->fetch_assoc()['slider_1'];
		//print_r($data);
		$st[] = $data;
	}
	//print_r(json_encode($st));
	//exit;
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $st,
            "status" => 200,
        ];
        echo json_encode($arr);
	
}


function add_address($data)
{ 
	//print_r(data);exit;
	$user_key = $data['user_key'];
	require_once "../config/database.php";
	if($user_key!=""){
	$phone = myDecrypt($user_key, $key);

		if($con->query("select * from address where mobile='$phone'")->num_rows == 0){
			$con->query("update users set name ='".$data['name']."' where phone='$phone'");
		}
		
		if($data['isDefault'] == "Yes"){
			$con->query("update users set name ='".strtoupper($data['name'])."',email='".$data['email']."' where phone='$phone'");
		}
		
		$insert = "insert into address(mobile,address_mobile,name,address,pincode,email,default_address,added_dt) values($phone,'".$data['address_mobile']."','".strtoupper($data['name'])."','".$data['address']."','".$data['pincode']."','".$data['email']."','".$data['isDefault']."','".date("Y-m-d H:i:s")."')";

		if($con->query($insert)){
			http_response_code(200);
			$arr = [
				"msg" => "Record saved successfully",
				"status" => 200,
			];
			echo json_encode($arr);
		} else {
			http_response_code(400);
			$arr = ["msg" => "Record not saved", "status" => 400];
			echo json_encode($arr);
		}
	} else {
        http_response_code(401);
        $arr = [
            "msg" => "Unauthorized Request",
            "status" => 401,
        ];
        echo json_encode($arr);		
	}	
}


function update_address($data)
{
	require_once "../config/database.php";
	$user_key = $data['user_key'];
	if($user_key!=""){
	$phone = myDecrypt($user_key, $key);
	
	if($con->query("select * from address where mobile='$phone'")->num_rows == 0){
		$con->query("update users set name ='".$data['name']."' where phone='$phone'");
	}
	
	if($data['isDefault'] == "Yes"){
		$con->query("update users set name ='".strtoupper($data['name'])."',email='".$data['email']."' where phone='$phone'");
	}
	
	$insert = "update address set address_mobile='".$data['address_mobile']."',name='".strtoupper($data['name'])."',address='".$data['address']."',pincode='".$data['pincode']."',email='".$data['email']."',default_address='".$data['isDefault']."' where id='".$data['address_id']."'";

	if($con->query($insert)){
        http_response_code(200);
        $arr = [
            "msg" => "Record saved successfully",
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not saved", "status" => 400];
        echo json_encode($arr);
    }
	} else {
        http_response_code(401);
        $arr = [
            "msg" => "Unauthorized Request",
            "status" => 401,
        ];
        echo json_encode($arr);		
	}	
}

function add_order($data)
{ 
	//print_r(data);exit;
	$user_key = $data['user_key'];
	require_once "../config/database.php";
	if($user_key!=""){
	$phone = myDecrypt($user_key, $key);

		if($con->query("insert into orders(user_mobile,order_date,work_date_time,address,total,discount,discount_coupon,gst,point_redeem,order_total,payment_mode,payment_id) values('$phone','".date("Y-m-d H:i:s")."','".date("Y-m-d H:i:s",strtotime($data['workdate']))."','".$data['address_id']."','".$data['total']."','".$data['discount']."','".$data['discount_coupon']."','".$data['gst']."','".$data['point_redeem']."','".$data['total_payment']."','".$data['payment_mode']."','".$data['razorPayId']."')")){

		$order_id = date("YmdHis")."".$con->insert_id;
		$con->query("update orders set order_id='$order_id' where id='".$con->insert_id."'");
		//print_r($_POST['cart_data']);
		
		$sel = $con->query("select * from cart where mobile_no='$phone'")->fetch_assoc()['data'];
				
		foreach(json_decode($sel) as $cart){ 
			//print_r($cart);
			$con->query("insert into order_items(order_id,item_id,item_name,item_rate,qty,amount) values('$order_id','".$cart->item_id."','".$cart->name."','".$cart->amount."','".$cart->qty."','".($cart->amount*$cart->qty)."')");
		}

			http_response_code(200);
			$arr = [
				"msg" => "Record saved successfully",
				"order_od"=>$order_id,
				"status" => 200,
			];
			echo json_encode($arr);
			
		} else {
			http_response_code(400);
			$arr = ["msg" => "Record not saved", "status" => 400];
			echo json_encode($arr);
		}
	} else {
        http_response_code(401);
        $arr = [
            "msg" => "Unauthorized Request",
            "status" => 401,
        ];
        echo json_encode($arr);		
	}	
}


function get_orders($phone)
{
	require_once "../config/database.php";
	$phone = myDecrypt($phone,$key);
    $result = $con->query("select * from orders left join address on address.id=orders.address where user_mobile='$phone'");
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()){
        $records = [
            "order_id" => $row["order_id"],
            "order_date" => $row["order_date"],
            "work_date_time" => $row["work_date_time"],
            "payment_mode" => $row["payment_mode"],
			"mobile" => $row["mobile"],
			"email_id" => $row["email"],
			"address" => $row["address.address"],
			"pincode" => $row["pincode"],
			"total" => $row["total"],
			"discount" => $row["discount"],
			"discount_coupon" => $row["discount_coupon"],
			"gst" => $row["gst"],
			"order_total" => $row["order_total"],
			"point_redeem" => $row["point_redeem"],
			"payment_id" => $row["payment_id"],
			"status" => $row["status"]
        ];

			array_push($data, $records);
		}
		
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } 
}


function remove_address($data,$user_key)
{
	require_once "../config/database.php";
	
	if($user_key!=""){
	$phone = myDecrypt($user_key, $key);
	
	$insert = "delete from address where id='".$data['address_id']."'";

	if($con->query($insert)){
        http_response_code(200);
        $arr = [
            "msg" => "Address Removed successfully",
            "status" => 200,
        ];
        echo json_encode($arr);
    } else {
        http_response_code(400);
        $arr = ["msg" => "Record not saved", "status" => 400];
        echo json_encode($arr);
    }
	} else {
        http_response_code(401);
        $arr = [
            "msg" => "Unauthorized Request",
            "status" => 401,
        ];
        echo json_encode($arr);		
	}	
}


function get_address($phone)
{
	require_once "../config/database.php";
	$phone = myDecrypt($phone,$key);
    $result = $con->query("select * from address where mobile='$phone'");
    $data = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()){
        $records = [
            "id" => $row["id"],
            "name" => $row["name"],
            "address_mobile" => $row["address_mobile"],
            "address" => $row["address"],
			"pincode" => $row["pincode"],
			"email" => $row["email"],
			"default_address" => $row["default_address"],
        ];

			array_push($data, $records);
		}
		
        http_response_code(200);
        $arr = [
            "msg" => "Record fetch successfully",
            "data" => $data,
            "status" => 200,
        ];
        echo json_encode($arr);
    } 
}



function handle_error()
{
    http_response_code(405);
    $arr = ["msg" => "Method Not Allowed", "status" => 405];
    echo json_encode($arr);
}
?>
