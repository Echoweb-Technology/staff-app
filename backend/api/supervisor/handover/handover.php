<?php
	header("Access-Control-Allow-Origin: *");
	header("Access-Control-Allow-Credentials: true");
	header("Access-Control-Max-Age: 3600");
	header("Access-Control-Allow-Methods: POST, OPTIONS");
	header("Content-Type: application/json");
	header("Access-Control-Allow-Headers: Origin, Content-Type, Authorization, X-Auth-Token");
	error_reporting(E_ALL);
	ini_set('display_errors', 0);
	use \Firebase\JWT\JWT;
	use \Firebase\JWT\Key;
	
	require "../../jwt/src/JWT.php";
	require "../../jwt/src/Key.php";
	require_once "../../../database.php";
	
	if ($_SERVER["REQUEST_METHOD"] !== "POST") {
		http_response_code(405);
		echo json_encode(["msg" => "Method Not Allowed", "status" => 405]);
		exit;
	}
	
	// --- AUTH CHECK ---
	$headers = getallheaders();
	if (empty($headers['Authorization'])) {
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
	
	try {
		$decoded = JWT::decode($jwt, new Key('dootcare', 'HS256'));
		} catch (Exception $e) {
		http_response_code(401);
		echo json_encode(["msg" => "Invalid or expired token", "status" => 401]);
		exit;
	}
	
	
	$baseRequired = ["vehicle_id", "registration", "driver_id", "driver_name", "handover_dt"];
	
	$primaryRequired = ["vehicle_km", "fuel", "form_no"];
	$primaryRequiredImages = [
    "handover_image",
    "front_image",
    "back_image",
    "interior_image",
    "left_image",
    "right_image",
    "other_image"
	];
	
	$handover_type = strtolower($_POST["handover_type"] ?? "");
	
	$required = $baseRequired;
	
	if ($handover_type === "primary") {
		$required = array_merge($required, $primaryRequired);
		
		// Check images separatelyyy
		foreach ($primaryRequiredImages as $img) {
			if (empty($_FILES[$img]['name'])) {
				http_response_code(400);
				echo json_encode(["msg" => "Missing image: $img", "status" => 400]);
				exit;
			}
		}
	}

	foreach ($required as $field) {
		if (empty($_POST[$field])) {
			http_response_code(400);
			echo json_encode(["msg" => "Missing field: $field", "status" => 400]);
			exit;
		}
	}
	
	
	function processImageUpload($fileInputName, $subFolder, $baseUploadFolder = "/home/1376799.cloudwaysapps.com/bvfjbngedt/public_html/vms/upload/handover") {
		
		if (empty($_FILES[$fileInputName]['name'])) {
			return null;
		}
		
		$imageFileType = strtolower(pathinfo($_FILES[$fileInputName]['name'], PATHINFO_EXTENSION));
		$valid_extensions = ["jpg", "jpeg", "png", "webp"];
		if (!in_array($imageFileType, $valid_extensions)) {
			throw new Exception("Invalid file type for $fileInputName");
		}
		
		$destinationFolder = rtrim($baseUploadFolder, '/') . '/' . $subFolder;
		
		if (!is_dir($destinationFolder)) {
			mkdir($destinationFolder, 0777, true);
		}
		
		
		$fileName = date("Ymd_His") . "_" . uniqid() . "." . $imageFileType;
		$absolutePath = $destinationFolder . "/" . $fileName;
		
		$relativePath = "upload/handover/" . $subFolder . "/" . $fileName;
		
		if ($_FILES[$fileInputName]['size'] <= 500000) {
			move_uploaded_file($_FILES[$fileInputName]['tmp_name'], $absolutePath);
			} else {
			$compressedPath = $destinationFolder . "/compressed_" . $fileName;
			compressImage($_FILES[$fileInputName]['tmp_name'], $compressedPath, $imageFileType);
			$relativePath = "upload/handover/" . $subFolder . "/compressed_" . $fileName;
		}
		
		return $relativePath;
	}
	
	
	function compressImage($source, $destination, $type) {
		list($width, $height) = getimagesize($source);
		$new_width = (int)($width * 0.8);
		$new_height = (int)($height * 0.8);
		
		switch ($type) {
			case 'jpg':
			case 'jpeg': $image = imagecreatefromjpeg($source); break;
			case 'png': $image = imagecreatefrompng($source); break;
			case 'webp': $image = imagecreatefromwebp($source); break;
			default: return false;
		}
		
		$new_image = imagecreatetruecolor($new_width, $new_height);
		imagecopyresampled($new_image, $image, 0, 0, 0, 0, $new_width, $new_height, $width, $height);
		
		switch ($type) {
			case 'jpg':
			case 'jpeg': imagejpeg($new_image, $destination, 85); break;
			case 'png': imagepng($new_image, $destination, 8); break;
			case 'webp': imagewebp($new_image, $destination, 80); break;
		}
		
		imagedestroy($image);
		imagedestroy($new_image);
		return true;
	}
	
	// --- VARIABLE ASSIGNMENT ---
	$car_id = $_POST["vehicle_id"];
	$car = $_POST["registration"];
	$driver_id = $_POST["driver_id"];
	$driver = $_POST["driver_name"];
	$supervisor = $decoded->data->username ?? "System";
	$handover_dt = $_POST["handover_dt"];
	$handover_type = $_POST["handover_type"];
	$driver_type = $_POST["driver_type"];
	
	$document_missing = "";
	$km_reading = "";
	$major_damage = "";
	$major_item = "";
	$form_no = "";
	$fuel_level = "";
	$form = $front_side = $back_side = $interior = $left_side = $right_side = $other_image = "";
	$odometer_image = $car_driver_image = "";
	$t1 = $t2 = $t3 = $t4 = $t5 = "";
	$remark = "";
	
	// --- CONDITIONAL FIELD HANDLING ---
	if (strtolower($handover_type) === "secondary") {
		$odometer_image = processImageUpload("odometer_image", "odometer");
		$car_driver_image = processImageUpload("car_driver_image", "driver_car");
		} else { // primary
		$document_missing = $_POST["documents_missing"] ?? "";
		$major_damage = $_POST["major_damages"] ?? "";
		$major_item = $_POST["items_missing"] ?? "";
		$form_no = $_POST["form_no"] ?? "";
		$fuel_level = $_POST["fuel"] ?? "";
		$km_reading = $_POST["km_reading"] ?? "";
		
		$form = processImageUpload("handover_image", "form");
		$front_side = processImageUpload("front_image", "front_side");
		$back_side = processImageUpload("back_image", "back_side");
		$interior = processImageUpload("interior_image", "interior");
		$left_side = processImageUpload("left_image", "left_side");
		$right_side = processImageUpload("right_image", "right_side");
		$other_image = processImageUpload("other_image", "other_image");
		
		$t1 = $_POST['tyre_conditions']['tyre1'] ?? "";
		$t2 = $_POST['tyre_conditions']['tyre2'] ?? "";
		$t3 = $_POST['tyre_conditions']['tyre3'] ?? "";
		$t4 = $_POST['tyre_conditions']['tyre4'] ?? "";
		$t5 = $_POST['tyre_conditions']['tyre5'] ?? "";
		
		$remark = $_POST["remark"] ?? "";
	}
	
	// --- START TRANSACTION ---
	$con->begin_transaction();
	
	try {
		// Insert into handover
		$stmt = $con->prepare("INSERT INTO handover (
        vehicle_id, vehicle_reg, driver_id, driver_name, supervisor,
        document_missing, major_damage, major_item_missing, km_reading, handover_form_no,
        fuel_level, handover_datetime, handover_form, front_side, back_side,
        interior, left_side, right_side, other_image, odometer_image, car_driver_image,
        tyre1, tyre2, tyre3, tyre4, stepney5, remark, added_by, added_datetime,
        driver_type, handover_type
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)");
		
		$stmt->bind_param(
        "ssssssssssssssssssssssssssssss",
        $car_id, $car, $driver_id, $driver, $supervisor,
        $document_missing, $major_damage, $major_item, $km_reading, $form_no,
        $fuel_level, $handover_dt, $form, $front_side, $back_side,
        $interior, $left_side, $right_side, $other_image, $odometer_image, $car_driver_image,
        $t1, $t2, $t3, $t4, $t5, $remark, $supervisor, $driver_type, $handover_type
		);
		
		if (!$stmt->execute()) {
			throw new Exception("Handover insert failed: " . $stmt->error);
		}
		
		$insert_id = $stmt->insert_id;
		$stmt->close();
		
		// Update driver & vehicle
		if (strtolower($handover_type) === "secondary" && strtolower($driver_type) === "temp") {
			$con->query("UPDATE temp_driver SET assinged_vehicle = '$car', assinged_vehicle_id = '$car_id' WHERE driver_id = '$driver_id'");
			$con->query("UPDATE vehicle SET driver_id = '$driver_id', driver = '$driver', driver_type = '$driver_type', action = 'Handover', action_dt = NOW() WHERE vehicle_id = '$car_id'");
			}else if(strtolower($handover_type) === "secondary" && strtolower($driver_type) === "permanent"){
			// what if type is secondary and driver_type is Permanent.
			$con->query("UPDATE driver SET assinged_vehicle = '$car', assinged_vehicle_id = '$car_id' WHERE driver_id = '$driver_id'");
			$con->query("UPDATE vehicle SET driver1_id = '$driver_id', driver1 = '$driver', action = 'Handover', action_dt = NOW() WHERE vehicle_id = '$car_id'");
			
			}else {
			$con->query("UPDATE driver SET assinged_vehicle = '$car', assinged_vehicle_id = '$car_id' WHERE driver_id = '$driver_id'");
			$con->query("UPDATE vehicle SET driver_id = '$driver_id', driver = '$driver', action = 'Handover', action_dt = NOW() WHERE vehicle_id = '$car_id'");
			
			if (strtolower($handover_type) === "primary") {
				$con->query("UPDATE tyre_manage SET
                tyre1_condition = '$t1',
                tyre2_condition = '$t2',
                tyre3_condition = '$t3',
                tyre4_condition = '$t4',
                tyre5_condition = '$t5'
                WHERE vehicle_id = '$car_id'");
			}
		}
		
		
		if (strtolower($handover_type) === "primary") {
			$bookingResult = $con->query("SELECT booking_id FROM monthly_bookings_vehicle WHERE vehicle='$car' AND DATE(date) >= '" . date("Y-m-d", strtotime($handover_dt)) . "' GROUP BY booking_id");
			if ($bookingResult && $bookingResult->num_rows > 0) {
				$multiQuery = "";
				while ($row = $bookingResult->fetch_assoc()) {
					$bid = $row['booking_id'];
					$multiQuery .= "
                    UPDATE monthly_bookings_driver SET driver='$driver_id' WHERE booking_id='$bid' AND DATE(date) >= '" . date("Y-m-d", strtotime($handover_dt)) . "';
                    UPDATE monthly_booking SET driver='$driver_id' WHERE booking_id='$bid';
					";
				}
				if (!empty($multiQuery)) {
					$con->multi_query($multiQuery);
					while ($con->more_results() && $con->next_result()) {;} // flush multi_query results
				}
			}
		}
		
		$con->commit();
		
		echo json_encode([
        "msg" => "Handover successfully recorded",
        "status" => 200,
        "handover_id" => $insert_id
		]);
		} catch (Exception $e) {
		$con->rollback();
		http_response_code(500);
		echo json_encode([
        "msg" => "Transaction failed: " . $e->getMessage(),
        "status" => 500
		]);
	}
?>
