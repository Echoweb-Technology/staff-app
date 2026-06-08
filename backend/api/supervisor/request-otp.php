<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
require_once "../../database.php";

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

$mobile_number = preg_replace('/\D/', '', $input['mobile_number'] ?? $_POST['mobile_number'] ?? '');
$addedBy = $input['added_by'] ?? $_POST['added_by'] ?? '';
$addedDt = $input['added_dt'] ?? $_POST['added_dt'] ?? date('Y-m-d H:i:s');

if (!$mobile_number) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Mobile number required"]);
    exit;
}

// Common function to find user with status filters
function findUserByMobile($con, $table, $mobileFields, $mobile_number, $statusCondition) {
    $where = [];
    foreach ($mobileFields as $field) {
        $where[] = "$field = '$mobile_number'";
    }
    $whereClause = implode(" OR ", $where);

    $query = "SELECT * FROM $table WHERE ($whereClause) AND $statusCondition LIMIT 1";
    $result = $con->query($query);

    if ($result && $result->num_rows > 0) {
        return $result->fetch_assoc();
    }
    return null;
}

// ---- Check in tables ----

// 1️⃣ Staff (supervisor)
$user = findUserByMobile(
    $con,
    'staff',
    ['mobile', 'alt_mob'],
    $mobile_number,
    "working_status = 'ACTIVE'"
);
$type = 'Supervisor';
$codeField = 'emp_code';

// 2️⃣ Driver
if (!$user) {
    $user = findUserByMobile(
        $con,
        'driver',
        ['driver_mobile', 'alt_mob'],
        $mobile_number,
        "driver_status = 'Active'"
    );
    if ($user) {
        $type = 'Driver';
        $codeField = 'driver_code';
    }
}

// 3️⃣ Supporting Staff
if (!$user) {
    $user = findUserByMobile(
        $con,
        'supporting_staff',
        ['mobile', 'alt_mob'],
        $mobile_number,
        "status = 'Active'"
    );
    if ($user) {
        $type = 'Supporting Staff';
        $codeField = 'ss_code'; // adjust if actual field differs
    }
}

// ---- Not found ----
if (!$user) {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Number not found or inactive"]);
    exit;
}

// ---- Generate OTP and Log ----
$otp = rand(1000, 9999);
$otpExp = date('Y-m-d H:i:s', strtotime('+2 minutes'));
$code = $user[$codeField] ?? null;

$stmtInsert = $con->prepare("
    INSERT INTO driver_login_log (dr_code, type, mobile_no, otp, added_by, added_dt, otp_expiry)
    VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmtInsert->bind_param("sssisss", $code, $type, $mobile_number, $otp, $addedBy, $addedDt, $otpExp);
$stmtInsert->execute();

// ---- Send OTP ----
// Uncomment this line for production use
// ---- Send OTP ----
$response = sendOtp($mobile_number, $otp);
//print_r($response);
// ---- Response ----
if ($response['status'] === 'success') {
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "OTP sent successfully",
        "otp_expiry" => $otpExp,
        "type" => $type
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Failed to send OTP",
        "debug" => $response['msg']  // ← This will show the real reason
    ]);
}



function sendOtp($mobile, $otp) {
		$authkey = "92NsaG99KiM";
		$sender = "VIVKTR";
		$user = "Vivektravels";
		$entityid = "1701162727718534840";
		$templateid = "1707174066221127414";
		
		$message = "Dear Driver, Your OTP for Vivek Travels driver app login is $otp. Please do not share this OTP with anyone. Thank you, Vivek Travels";
		
		$message = urlencode($message);
		
		$url = "https://hindit.net.in/api/pushsms?authkey=$authkey&sender=$sender&mobile=$mobile&user=$user&entityid=$entityid&templateid=$templateid&rpt=1&text=$message";
		
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		$response = curl_exec($ch);
		$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);
		
	//	echo $http_code;
	//	print_R($response);
		
	 if ($http_code == 200) {
        return ['status' => 'success', 'msg' => $response];
    } else {
        return ['status' => 'error', 'msg' => $response];
    }
	}
	
?>
