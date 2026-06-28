<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token, Authorization');
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/helpers/handover_helper.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    staffTransferJsonResponse(405, 'Method Not Allowed');
}

require_once __DIR__ . '/../../database.php';
require_once __DIR__ . '/../supervisor/helpers/jwt_helper.php';

global $con;
if (!($con instanceof mysqli)) {
    staffTransferJsonResponse(500, 'Database connection failed');
}

$transactionStarted = false;

$headers = function_exists('apache_request_headers')
    ? apache_request_headers()
    : getallheaders();
$user = validateJWT($headers);

try {
    $vehicleId = trim((string) ($_POST['vehicle_id'] ?? ''));
    $driverId = trim((string) ($_POST['driver_id'] ?? ''));
    $driverSourceType = staffTransferNormalizeDriverSource($_POST['driver_source_type'] ?? '');
    $driverRole = staffTransferNormalizeAssignmentType($_POST['driver_role'] ?? 'primary');
    $takeoverDatetime = staffTransferRequireRecentDatetime((string) ($_POST['takeover_dt'] ?? ''));

    if ($vehicleId === '' || $driverId === '') {
        throw new RuntimeException('Vehicle and driver are required.');
    }

    $vehicle = staffTransferFetchVehicleById($con, $vehicleId);
    if (!$vehicle) {
        throw new RuntimeException('Vehicle not found.');
    }

    $driverRecord = staffTransferFetchDriverRecord($con, $driverId, $driverSourceType);
    if (!$driverRecord) {
        throw new RuntimeException('Driver not found.');
    }

    $assignedDrivers = staffTransferFetchAssignedDriversForVehicle($con, $vehicleId);
    $matchedDriver = null;
    foreach ($assignedDrivers as $assignedDriver) {
        if ((string) $assignedDriver['driver_id'] === $driverId) {
            $matchedDriver = $assignedDriver;
            break;
        }
    }

    if (!$matchedDriver) {
        throw new RuntimeException('Selected driver is not assigned to this vehicle.');
    }

    $driverRole = $matchedDriver['role_key'];
    $driverSourceType = $matchedDriver['source_type_key'];
    $takeoverType = ($driverRole === 'secondary' || $driverSourceType === 'temp')
        ? 'secondary'
        : 'primary';

    $supervisor = trim((string) ($_POST['supervisor'] ?? ''));
    if ($supervisor === '') {
        $supervisor = staffTransferFetchActorName($user);
    }

    $documentMissing = trim((string) ($_POST['document_missing'] ?? ''));
    $majorDamage = trim((string) ($_POST['major_damage'] ?? ''));
    $majorItem = trim((string) ($_POST['major_item'] ?? ''));
    $formNo = trim((string) ($_POST['form_no'] ?? ''));
    $meterReading = trim((string) ($_POST['meter_reading'] ?? '0'));
    $fuelLevel = trim((string) ($_POST['fuel_level'] ?? ''));
    $remark = trim((string) ($_POST['remark'] ?? ''));

    $tyre1 = trim((string) ($_POST['t1'] ?? ''));
    $tyre2 = trim((string) ($_POST['t2'] ?? ''));
    $tyre3 = trim((string) ($_POST['t3'] ?? ''));
    $tyre4 = trim((string) ($_POST['t4'] ?? ''));
    $tyre5 = trim((string) ($_POST['t5'] ?? ''));

    $takeoverForm = '';
    $frontSide = '';
    $backSide = '';
    $interior = '';
    $leftSide = '';
    $rightSide = '';
    $odometerImage = '';
    $carDriverImage = '';
    $stepneyToolsImage = '';
    $accessoriesImage = '';
    $chargerImage = '';
    $batteryAuxImage = '';

    if ($takeoverType === 'secondary') {
        $odometerImage = staffTransferSaveUpload(
            $_FILES['odometer_image'] ?? null,
            'takeover',
            'odometer_image',
            true
        );
        $carDriverImage = staffTransferSaveUpload(
            $_FILES['driver_car_image'] ?? null,
            'takeover',
            'driver_car_image',
            true
        );
    } else {
        if ($meterReading === '' || $fuelLevel === '') {
            throw new RuntimeException('Meter reading and fuel level are required.');
        }

        $takeoverForm = staffTransferSaveUpload(
            $_FILES['takeover_form'] ?? null,
            'takeover',
            'takeover_form',
            true
        );
        $frontSide = staffTransferSaveUpload(
            $_FILES['front_side'] ?? null,
            'takeover',
            'front_side',
            true
        );
        $backSide = staffTransferSaveUpload(
            $_FILES['back_side'] ?? null,
            'takeover',
            'back_side',
            true
        );
        $interior = staffTransferSaveUpload(
            $_FILES['interior'] ?? null,
            'takeover',
            'interior',
            true
        );
        $leftSide = staffTransferSaveUpload(
            $_FILES['left_side'] ?? null,
            'takeover',
            'left_side',
            true
        );
        $rightSide = staffTransferSaveUpload(
            $_FILES['right_side'] ?? null,
            'takeover',
            'right_side',
            true
        );
        $odometerImage = staffTransferSaveUpload(
            $_FILES['odometer_image'] ?? null,
            'takeover',
            'odometer_image',
            true
        );
        $stepneyToolsImage = staffTransferSaveUpload(
            $_FILES['stepney_tools_image'] ?? null,
            'takeover',
            'stepney_tools_image',
            true
        );
        $accessoriesImage = staffTransferSaveUpload(
            $_FILES['accessories_image'] ?? null,
            'takeover',
            'accessories_image',
            true
        );
        $chargerImage = staffTransferSaveUpload(
            $_FILES['charger_image'] ?? null,
            'takeover',
            'charger_image'
        ) ?? '';
        $batteryAuxImage = staffTransferSaveUpload(
            $_FILES['battery_aux_image'] ?? null,
            'takeover',
            'battery_aux_image',
            true
        );
    }

    $driverLabel = $driverRecord['driver_name'] . '(' . $driverRecord['driver_code'] . ')';
    $driverTypeValue = $driverSourceType === 'temp' ? 'Temp' : 'Permanent';
    $addedBy = (string) ($user['user_code'] ?? $user['user_name'] ?? 'staff-app');

    $stmt = $con->prepare(
        "SELECT handover_id
         FROM handover
         WHERE vehicle_id = ? AND driver_id = ?
         ORDER BY handover_id DESC
         LIMIT 1"
    );
    $stmt->bind_param('ss', $vehicleId, $driverId);
    $stmt->execute();
    $lastHandover = $stmt->get_result()->fetch_assoc();
    $lastHandoverId = $lastHandover['handover_id'] ?? null;

    $con->begin_transaction();
    $transactionStarted = true;

    $insert = $con->prepare(
        "INSERT INTO takeover (
            vehicle_id, vehicle_reg, driver_id, driver_name, supervisor,
            document_missing, major_damage, major_item_missing, takeover_form_no, meter_reading,
            fuel_level, takeover_datetime, takeover_form, front_side, back_side,
            interior, left_side, right_side, odometer_image, car_driver_image,
            tyre1, tyre2, tyre3, tyre4, stepney5, added_by, added_datetime,
            last_handover_id, remark, driver_type, stepney_tools_image, accessories_image,
            charger_image, battery_aux_image
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, NOW(),
            ?, ?, ?, ?, ?,
            ?, ?
        )"
    );

    $insert->bind_param(
        'sssssssssssssssssssssssssssssssss',
        $vehicle['vehicle_id'],
        $vehicle['registration'],
        $driverRecord['driver_id'],
        $driverLabel,
        $supervisor,
        $documentMissing,
        $majorDamage,
        $majorItem,
        $formNo,
        $meterReading,
        $fuelLevel,
        $takeoverDatetime,
        $takeoverForm,
        $frontSide,
        $backSide,
        $interior,
        $leftSide,
        $rightSide,
        $odometerImage,
        $carDriverImage,
        $tyre1,
        $tyre2,
        $tyre3,
        $tyre4,
        $tyre5,
        $addedBy,
        $lastHandoverId,
        $remark,
        $driverTypeValue,
        $stepneyToolsImage,
        $accessoriesImage,
        $chargerImage,
        $batteryAuxImage
    );

    if (!$insert->execute()) {
        throw new RuntimeException('Takeover insert failed: ' . $insert->error);
    }

    $takeoverId = (int) $insert->insert_id;

    if ($driverSourceType === 'temp') {
        $releaseDriver = $con->prepare(
            "UPDATE temp_driver
             SET assinged_vehicle = '', assinged_vehicle_id = 0
             WHERE driver_id = ?"
        );
        $releaseDriver->bind_param('s', $driverRecord['driver_id']);
        $releaseDriver->execute();
    } else {
        $releaseDriver = $con->prepare(
            "UPDATE driver
             SET assinged_vehicle = '', assinged_vehicle_id = 0
             WHERE driver_id = ?"
        );
        $releaseDriver->bind_param('s', $driverRecord['driver_id']);
        $releaseDriver->execute();
    }

    if ($driverSourceType === 'temp' || $driverRole === 'primary') {
        $releaseVehicle = $con->prepare(
            "UPDATE vehicle
             SET driver_id = 0, driver = '', action = 'Takeover', action_dt = NOW()
             WHERE vehicle_id = ?"
        );
        $releaseVehicle->bind_param('s', $vehicle['vehicle_id']);
        $releaseVehicle->execute();
    } else {
        $releaseVehicle = $con->prepare(
            "UPDATE vehicle
             SET driver1_id = 0, driver1 = '', action = 'Takeover', action_dt = NOW()
             WHERE vehicle_id = ?"
        );
        $releaseVehicle->bind_param('s', $vehicle['vehicle_id']);
        $releaseVehicle->execute();
    }

    if ($takeoverType === 'primary') {
        $updateTyres = $con->prepare(
            "UPDATE tyre_manage
             SET tyre1_condition = ?, tyre2_condition = ?, tyre3_condition = ?,
                 tyre4_condition = ?, tyre5_condition = ?
             WHERE vehicle_id = ?"
        );
        $updateTyres->bind_param(
            'ssssss',
            $tyre1,
            $tyre2,
            $tyre3,
            $tyre4,
            $tyre5,
            $vehicle['vehicle_id']
        );
        $updateTyres->execute();
    }

    $con->commit();
    $transactionStarted = false;

    staffTransferJsonResponse(200, 'Takeover submitted successfully', [
        'takeover_id' => $takeoverId,
        'vehicle_id' => $vehicle['vehicle_id'],
        'registration' => $vehicle['registration'],
        'driver_name' => $driverLabel,
        'driver_type' => strtolower($driverTypeValue),
        'takeover_type' => $takeoverType,
        'last_handover_id' => $lastHandoverId ? (int) $lastHandoverId : null,
    ]);
} catch (Throwable $exception) {
    if ($transactionStarted) {
        $con->rollback();
    }

    staffTransferJsonResponse(422, $exception->getMessage());
}
