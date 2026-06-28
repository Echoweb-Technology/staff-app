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
    $assignmentType = staffTransferNormalizeAssignmentType($_POST['assignment_type'] ?? '');
    $driverSourceType = staffTransferNormalizeDriverSource($_POST['driver_source_type'] ?? '');
    $vehicleId = trim((string) ($_POST['vehicle_id'] ?? ''));
    $driverId = trim((string) ($_POST['driver_id'] ?? ''));
    $handoverDatetime = staffTransferRequireRecentDatetime((string) ($_POST['handover_dt'] ?? ''));

    if ($vehicleId === '' || $driverId === '') {
        throw new RuntimeException('Vehicle and driver are required.');
    }

    if ($assignmentType === 'primary' && $driverSourceType !== 'permanent') {
        throw new RuntimeException('Primary handover only supports permanent drivers.');
    }

    $vehicle = staffTransferFetchVehicleById($con, $vehicleId);
    if (!$vehicle) {
        throw new RuntimeException('Vehicle not found.');
    }

    $driverRecord = staffTransferFetchDriverRecord($con, $driverId, $driverSourceType);
    if (!$driverRecord) {
        throw new RuntimeException('Driver not found.');
    }

    if ($assignmentType === 'primary' && (string) $vehicle['driver_id'] !== '0') {
        throw new RuntimeException('Primary driver is already assigned to this vehicle.');
    }

    if (
        $assignmentType === 'secondary' &&
        $driverSourceType === 'permanent' &&
        (string) $vehicle['driver1_id'] !== '0'
    ) {
        throw new RuntimeException('Secondary driver is already assigned to this vehicle.');
    }

    if (
        $assignmentType === 'secondary' &&
        $driverSourceType === 'temp' &&
        (string) $vehicle['driver_id'] !== '0'
    ) {
        throw new RuntimeException('Primary slot is already occupied for temp driver handover.');
    }

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
    $clientId = trim((string) ($_POST['client_id'] ?? '0'));

    $tyre1 = trim((string) ($_POST['t1'] ?? ''));
    $tyre2 = trim((string) ($_POST['t2'] ?? ''));
    $tyre3 = trim((string) ($_POST['t3'] ?? ''));
    $tyre4 = trim((string) ($_POST['t4'] ?? ''));
    $tyre5 = trim((string) ($_POST['t5'] ?? ''));

    $handoverForm = '';
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

    if ($assignmentType === 'secondary') {
        $latestTakeover = staffTransferFetchLatestTakeoverForVehicle($con, $vehicleId);

        $odometerImage = staffTransferSaveUpload(
            $_FILES['odometer_image'] ?? null,
            'handover',
            'odometer_image'
        ) ?: ($latestTakeover['images']['odometer_image']['path'] ?? '');

        $carDriverImage = staffTransferSaveUpload(
            $_FILES['driver_car_image'] ?? null,
            'handover',
            'driver_car_image'
        ) ?: ($latestTakeover['images']['car_driver_image']['path'] ?? '');

        if ($odometerImage === '' || $carDriverImage === '') {
            throw new RuntimeException(
                'Secondary handover needs odometer and driver-with-car images or a previous takeover image.'
            );
        }
    } else {
        if ($formNo === '' || $meterReading === '' || $fuelLevel === '') {
            throw new RuntimeException('Form number, meter reading and fuel level are required.');
        }

        $handoverForm = staffTransferSaveUpload(
            $_FILES['handover_form'] ?? null,
            'handover',
            'handover_form',
            true
        );
        $frontSide = staffTransferSaveUpload(
            $_FILES['front_side'] ?? null,
            'handover',
            'front_side',
            true
        );
        $backSide = staffTransferSaveUpload(
            $_FILES['back_side'] ?? null,
            'handover',
            'back_side',
            true
        );
        $interior = staffTransferSaveUpload(
            $_FILES['interior'] ?? null,
            'handover',
            'interior',
            true
        );
        $leftSide = staffTransferSaveUpload(
            $_FILES['left_side'] ?? null,
            'handover',
            'left_side',
            true
        );
        $rightSide = staffTransferSaveUpload(
            $_FILES['right_side'] ?? null,
            'handover',
            'right_side',
            true
        );
        $odometerImage = staffTransferSaveUpload(
            $_FILES['odometer_image'] ?? null,
            'handover',
            'odometer_image',
            true
        );
        $stepneyToolsImage = staffTransferSaveUpload(
            $_FILES['stepney_tools_image'] ?? null,
            'handover',
            'stepney_tools_image',
            true
        );
        $accessoriesImage = staffTransferSaveUpload(
            $_FILES['accessories_image'] ?? null,
            'handover',
            'accessories_image',
            true
        );
        $chargerImage = staffTransferSaveUpload(
            $_FILES['charger_image'] ?? null,
            'handover',
            'charger_image'
        ) ?? '';
        $batteryAuxImage = staffTransferSaveUpload(
            $_FILES['battery_aux_image'] ?? null,
            'handover',
            'battery_aux_image',
            true
        );
    }

    $driverLabel = $driverRecord['driver_name'] . '(' . $driverRecord['driver_code'] . ')';
    $driverTypeValue = $driverSourceType === 'temp' ? 'Temp' : 'Permanent';
    $assignmentTypeValue = $assignmentType === 'secondary' ? 'Secondary' : 'Primary';
    $addedBy = (string) ($user['user_code'] ?? $user['user_name'] ?? 'staff-app');

    $con->begin_transaction();
    $transactionStarted = true;

    $stmt = $con->prepare(
        "INSERT INTO handover (
            vehicle_id, vehicle_reg, driver_id, driver_name, supervisor,
            document_missing, major_damage, major_item_missing, meter_reading, handover_form_no,
            fuel_level, handover_datetime, handover_form, front_side, back_side,
            interior, left_side, right_side, odometer_image, car_driver_image,
            tyre1, tyre2, tyre3, tyre4, stepney5, remark, added_by, added_datetime,
            driver_type, handover_type, stepney_tools_image, accessories_image,
            charger_image, battery_aux_image, client
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, NOW(),
            ?, ?, ?, ?,
            ?, ?, ?
        )"
    );

    $stmt->bind_param(
        'ssssssssssssssssssssssssssssssssss',
        $vehicle['vehicle_id'],
        $vehicle['registration'],
        $driverRecord['driver_id'],
        $driverLabel,
        $supervisor,
        $documentMissing,
        $majorDamage,
        $majorItem,
        $meterReading,
        $formNo,
        $fuelLevel,
        $handoverDatetime,
        $handoverForm,
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
        $remark,
        $addedBy,
        $driverTypeValue,
        $assignmentTypeValue,
        $stepneyToolsImage,
        $accessoriesImage,
        $chargerImage,
        $batteryAuxImage,
        $clientId
    );

    if (!$stmt->execute()) {
        throw new RuntimeException('Handover insert failed: ' . $stmt->error);
    }

    $handoverId = (int) $stmt->insert_id;

    if ($assignmentType === 'secondary' && $driverSourceType === 'temp') {
        $updateDriver = $con->prepare(
            "UPDATE temp_driver
             SET assinged_vehicle = ?, assinged_vehicle_id = ?
             WHERE driver_id = ?"
        );
        $updateDriver->bind_param(
            'sss',
            $vehicle['registration'],
            $vehicle['vehicle_id'],
            $driverRecord['driver_id']
        );
        $updateDriver->execute();

        $updateVehicle = $con->prepare(
            "UPDATE vehicle
             SET driver_id = ?, driver = ?, driver_type = ?, action = 'Handover', action_dt = NOW()
             WHERE vehicle_id = ?"
        );
        $updateVehicle->bind_param(
            'ssss',
            $driverRecord['driver_id'],
            $driverLabel,
            $driverTypeValue,
            $vehicle['vehicle_id']
        );
        $updateVehicle->execute();
    } elseif ($assignmentType === 'secondary') {
        $updateDriver = $con->prepare(
            "UPDATE driver
             SET assinged_vehicle = ?, assinged_vehicle_id = ?
             WHERE driver_id = ?"
        );
        $updateDriver->bind_param(
            'sss',
            $vehicle['registration'],
            $vehicle['vehicle_id'],
            $driverRecord['driver_id']
        );
        $updateDriver->execute();

        $updateVehicle = $con->prepare(
            "UPDATE vehicle
             SET driver1_id = ?, driver1 = ?, action = 'Handover', action_dt = NOW()
             WHERE vehicle_id = ?"
        );
        $updateVehicle->bind_param(
            'sss',
            $driverRecord['driver_id'],
            $driverLabel,
            $vehicle['vehicle_id']
        );
        $updateVehicle->execute();
    } else {
        $updateDriver = $con->prepare(
            "UPDATE driver
             SET assinged_vehicle = ?, assinged_vehicle_id = ?
             WHERE driver_id = ?"
        );
        $updateDriver->bind_param(
            'sss',
            $vehicle['registration'],
            $vehicle['vehicle_id'],
            $driverRecord['driver_id']
        );
        $updateDriver->execute();

        $updateVehicle = $con->prepare(
            "UPDATE vehicle
             SET driver_id = ?, driver = ?, action = 'Handover', action_dt = NOW()
             WHERE vehicle_id = ?"
        );
        $updateVehicle->bind_param(
            'sss',
            $driverRecord['driver_id'],
            $driverLabel,
            $vehicle['vehicle_id']
        );
        $updateVehicle->execute();

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

        $bookingStmt = $con->prepare(
            "SELECT booking_id
             FROM monthly_bookings_vehicle
             WHERE vehicle = ? AND DATE(date) >= ?
             GROUP BY booking_id"
        );
        $effectiveDate = date('Y-m-d', strtotime($handoverDatetime));
        $bookingStmt->bind_param('ss', $vehicle['registration'], $effectiveDate);
        $bookingStmt->execute();
        $bookingResult = $bookingStmt->get_result();

        while ($bookingRow = $bookingResult->fetch_assoc()) {
            $bookingId = $bookingRow['booking_id'];
            $updateMonthlyDriver = $con->prepare(
                "UPDATE monthly_bookings_driver
                 SET driver = ?
                 WHERE booking_id = ? AND DATE(date) >= ?"
            );
            $updateMonthlyDriver->bind_param(
                'sss',
                $driverRecord['driver_id'],
                $bookingId,
                $effectiveDate
            );
            $updateMonthlyDriver->execute();

            $updateMonthlyBooking = $con->prepare(
                "UPDATE monthly_booking SET driver = ? WHERE booking_id = ?"
            );
            $updateMonthlyBooking->bind_param(
                'ss',
                $driverRecord['driver_id'],
                $bookingId
            );
            $updateMonthlyBooking->execute();
        }
    }

    $con->commit();
    $transactionStarted = false;

    staffTransferJsonResponse(200, 'Handover submitted successfully', [
        'handover_id' => $handoverId,
        'vehicle_id' => $vehicle['vehicle_id'],
        'registration' => $vehicle['registration'],
        'driver_name' => $driverLabel,
        'handover_type' => strtolower($assignmentTypeValue),
        'driver_type' => strtolower($driverTypeValue),
    ]);
} catch (Throwable $exception) {
    if ($transactionStarted) {
        $con->rollback();
    }

    staffTransferJsonResponse(422, $exception->getMessage());
}
