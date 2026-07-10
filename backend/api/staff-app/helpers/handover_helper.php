<?php

const STAFF_TRANSFER_PUBLIC_BASE_URL = 'https://vtms.co.in/api/staff-app/';
const STAFF_TRANSFER_UPLOAD_ROOT = 'staff-app/transfers';

function staffTransferJsonResponse(int $status, string $msg, $data = null): void
{
    http_response_code($status);
    $payload = [    
        'msg' => $msg,
        'status' => $status,
    ];

    if ($data !== null) {
        $payload['data'] = $data;
    }

    echo json_encode($payload);
    exit;
}

function staffTransferNormalizeWorkflow(string $value): string
{
    $normalized = strtolower(trim($value));
    return $normalized === 'takeover' ? 'takeover' : 'handover';
}

function staffTransferNormalizeAssignmentType(string $value): string
{
    $normalized = strtolower(trim($value));
    return $normalized === 'secondary' ? 'secondary' : 'primary';
}

function staffTransferNormalizeDriverSource(string $value): string
{
    $normalized = strtolower(trim($value));
    return $normalized === 'temp' ? 'temp' : 'permanent';
}

function staffTransferPublicUrl(?string $relativePath): ?string
{
    if (!$relativePath) {
        return null;
    }

    return STAFF_TRANSFER_PUBLIC_BASE_URL . ltrim($relativePath, '/');
}

function staffTransferBuildImageLinks(?array $record, array $fields): array
{
    $output = [];
    foreach ($fields as $field) {
        $relativePath = $record[$field] ?? null;
        $output[$field] = [
            'path' => $relativePath,
            'url' => staffTransferPublicUrl($relativePath),
        ];
    }

    return $output;
}

function staffTransferFetchVehicleById(mysqli $con, string $vehicleId): ?array
{
    $stmt = $con->prepare(
        "SELECT vehicle_id, registration, driver_id, driver1_id, driver, driver1, charger_no
         FROM vehicle
         WHERE vehicle_id = ?
         LIMIT 1"
    );
    $stmt->bind_param('s', $vehicleId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    return $row ?: null;
}

function staffTransferFetchVehiclesForHandover(
    mysqli $con,
    string $assignmentType,
    string $search = ''
): array {
    $condition = $assignmentType === 'primary'
        ? "driver_id = '0'"
        : "(driver_id = '0' OR driver1_id = '0')";

    if ($search !== '') {
        $stmt = $con->prepare(
            "SELECT vehicle_id, registration, charger_no, driver_id, driver1_id
             FROM vehicle
             WHERE {$condition}  AND (vehicle.owner_by = 'VTR' or vehicle.owner_by = 'VTPL' or vehicle.owner_by='VV1986') and (vehicle.operated_by = 'VTPL' or vehicle.operated_by = 'VV1986') AND fleet_category <> 'No More In Fleet'
               AND registration LIKE CONCAT('%', ?, '%')
             ORDER BY registration ASC
             LIMIT 50"
        );
        $stmt->bind_param('s', $search);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $con->query(
            "SELECT vehicle_id, registration, charger_no, driver_id, driver1_id
             FROM vehicle
             WHERE {$condition}  AND (vehicle.owner_by = 'VTR' or vehicle.owner_by = 'VTPL' or vehicle.owner_by='VV1986') and (vehicle.operated_by = 'VTPL' or vehicle.operated_by = 'VV1986') AND fleet_category <> 'No More In Fleet'
             ORDER BY registration ASC
             LIMIT 50"
        );
    }

    $vehicles = [];
    while ($row = $result->fetch_assoc()) {
        $vehicles[] = $row;
    }

    return $vehicles;
}

function staffTransferFetchVehiclesForTakeover(mysqli $con, string $search = ''): array
{
    if ($search !== '') {
        $stmt = $con->prepare(
            "SELECT vehicle_id, registration, charger_no, driver_id, driver1_id, driver, driver1
             FROM vehicle
             WHERE (driver_id <> '0' OR driver1_id <> '0')
               AND registration LIKE CONCAT('%', ?, '%')
             ORDER BY registration ASC
             LIMIT 50"
        );
        $stmt->bind_param('s', $search);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $con->query(
            "SELECT vehicle_id, registration, charger_no, driver_id, driver1_id, driver, driver1
             FROM vehicle
             WHERE (driver_id <> '0' OR driver1_id <> '0')
             ORDER BY registration ASC
             LIMIT 50"
        );
    }

    $vehicles = [];
    while ($row = $result->fetch_assoc()) {
        $vehicles[] = $row;
    }

    return $vehicles;
}

function staffTransferFetchAvailableDrivers(
    mysqli $con,
    string $assignmentType,
    string $search = ''
): array {
    $drivers = [];
    $searchSql = $search !== '' ? " AND (driver_name LIKE ? OR driver_code LIKE ?)" : '';

    if ($assignmentType === 'secondary') {
        $tempSql = "SELECT driver_id, driver_name, driver_code
            FROM temp_driver
            WHERE (assinged_vehicle = '' OR assinged_vehicle IS NULL)" . $searchSql . "
            ORDER BY driver_id DESC
            LIMIT 20";
        $stmt = $con->prepare($tempSql);
        if ($search !== '') {
            $searchParam = '%' . $search . '%';
            $stmt->bind_param('ss', $searchParam, $searchParam);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $drivers[] = [
                'driver_id' => $row['driver_id'],
                'driver_name' => $row['driver_name'],
                'driver_code' => $row['driver_code'],
                'source_type' => 'Temp',
            ];
        }
    }

    $permSql = "SELECT driver_id, driver_name, driver_code
        FROM driver
        WHERE driver_status <> 'Inoperative'
          AND (assinged_vehicle = '' OR assinged_vehicle IS NULL)
          AND (assinged_vehicle_id = '' OR assinged_vehicle_id IS NULL OR assinged_vehicle_id =0 )" . $searchSql . "
        ORDER BY driver_name ASC
        LIMIT 20";
    $stmt = $con->prepare($permSql);
    if ($search !== '') {
        $searchParam = '%' . $search . '%';
        $stmt->bind_param('ss', $searchParam, $searchParam);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $drivers[] = [
            'driver_id' => $row['driver_id'],
            'driver_name' => $row['driver_name'],
            'driver_code' => $row['driver_code'],
            'source_type' => 'Permanent',
        ];
    }

    return $drivers;
}

function staffTransferFetchAssignedDriversForVehicle(mysqli $con, string $vehicleId): array
{
    $vehicle = staffTransferFetchVehicleById($con, $vehicleId);
    if (!$vehicle) {
        return [];
    }

    $registration = $vehicle['registration'];
    $drivers = [];

    $permStmt = $con->prepare(
        "SELECT driver_id, driver_name, driver_code
         FROM driver
         WHERE assinged_vehicle = ?"
    );
    $permStmt->bind_param('s', $registration);
    $permStmt->execute();
    $permResult = $permStmt->get_result();
    while ($row = $permResult->fetch_assoc()) {
        $role = (string) $vehicle['driver1_id'] === (string) $row['driver_id']
            ? 'Secondary'
            : 'Primary';
        $drivers[] = [
            'driver_id' => $row['driver_id'],
            'driver_name' => $row['driver_name'],
            'driver_code' => $row['driver_code'],
            'role' => $role,
            'role_key' => strtolower($role),
            'source_type' => 'Permanent',
            'source_type_key' => 'permanent',
        ];
    }

    $tempStmt = $con->prepare(
        "SELECT driver_id, driver_name, driver_code
         FROM temp_driver
         WHERE assinged_vehicle = ?"
    );
    $tempStmt->bind_param('s', $registration);
    $tempStmt->execute();
    $tempResult = $tempStmt->get_result();
    while ($row = $tempResult->fetch_assoc()) {
        $drivers[] = [
            'driver_id' => $row['driver_id'],
            'driver_name' => $row['driver_name'],
            'driver_code' => $row['driver_code'],
            'role' => 'Primary',
            'role_key' => 'primary',
            'source_type' => 'Temp',
            'source_type_key' => 'temp',
        ];
    }

    usort($drivers, static function (array $left, array $right): int {
        return strcmp($left['driver_name'], $right['driver_name']);
    });

    return $drivers;
}

function staffTransferFetchSupervisors(mysqli $con, string $search = ''): array
{
    $sql = "SELECT name FROM staff WHERE working_status = 'Active'";
    if ($search !== '') {
        $sql .= " AND name LIKE ?";
    }
    $sql .= " ORDER BY name ASC LIMIT 50";

    $stmt = $con->prepare($sql);
    if ($search !== '') {
        $searchParam = '%' . $search . '%';
        $stmt->bind_param('s', $searchParam);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $supervisors = [];
    while ($row = $result->fetch_assoc()) {
        $supervisors[] = $row['name'];
    }

    return $supervisors;
}

function staffTransferFetchClients(mysqli $con, string $search = ''): array
{
    $sql = "SELECT client_id, client_name FROM client WHERE status = 'Active'";
    if ($search !== '') {
        $sql .= " AND client_name LIKE ?";
    }
    $sql .= " ORDER BY client_name ASC LIMIT 50";

    $stmt = $con->prepare($sql);
    if ($search !== '') {
        $searchParam = '%' . $search . '%';
        $stmt->bind_param('s', $searchParam);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $clients = [];
    while ($row = $result->fetch_assoc()) {
        $clients[] = [
            'client_id' => $row['client_id'],
            'client_name' => $row['client_name'],
        ];
    }

    return $clients;
}

function staffTransferFetchTyreDetails(mysqli $con, string $vehicleId): ?array
{
    $stmt = $con->prepare("SELECT registration FROM vehicle WHERE vehicle_id = ? LIMIT 1");
    $stmt->bind_param('s', $vehicleId);
    $stmt->execute();
    $vehicle = $stmt->get_result()->fetch_assoc();
    if (!$vehicle) {
        return null;
    }

    $stmt = $con->prepare(
        "SELECT tyre1_sno, tyre1_brand, tyre1_condition,
                tyre2_sno, tyre2_brand, tyre2_condition,
                tyre3_sno, tyre3_brand, tyre3_condition,
                tyre4_sno, tyre4_brand, tyre4_condition,
                tyre5_sno, tyre5_brand, tyre5_condition
         FROM tyre_manage
         WHERE registration = ?
         LIMIT 1"
    );
    $stmt->bind_param('s', $vehicle['registration']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }

    $tyres = [];
    for ($index = 1; $index <= 5; $index += 1) {
        $number = $row["tyre{$index}_sno"] ?? '';
        $brand = $row["tyre{$index}_brand"] ?? '';
        $condition = $row["tyre{$index}_condition"] ?? '';
        $label = trim($number . '/' . $brand, '/');
        $tyres[] = [
            'key' => 't' . $index,
            'label' => $label !== '' ? $label : 'Tyre ' . $index,
            'condition' => $condition,
        ];
    }

    return [
        'registration' => $vehicle['registration'],
        'tyres' => $tyres,
    ];
}

function staffTransferFetchLatestTakeoverForVehicle(mysqli $con, string $vehicleId): ?array
{
    $stmt = $con->prepare(
        "SELECT takeover_id, driver_name, supervisor, takeover_datetime,
                odometer_image, car_driver_image, driver_type
         FROM takeover
         WHERE vehicle_id = ?
         ORDER BY takeover_id DESC
         LIMIT 1"
    );
    $stmt->bind_param('s', $vehicleId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }

    return [
        'takeover_id' => (int) $row['takeover_id'],
        'driver_name' => $row['driver_name'],
        'supervisor' => $row['supervisor'],
        'takeover_datetime' => $row['takeover_datetime'],
        'driver_type' => $row['driver_type'],
        'images' => staffTransferBuildImageLinks(
            $row,
            ['odometer_image', 'car_driver_image']
        ),
    ];
}

function staffTransferFetchLatestHandoverForVehicleDriver(
    mysqli $con,
    string $vehicleId,
    string $driverId
): ?array {
    $stmt = $con->prepare(
        "SELECT handover_id, vehicle_reg, driver_id, driver_name, supervisor,
                handover_datetime, driver_type, handover_type, odometer_image,
                car_driver_image, handover_form, front_side, back_side, interior,
                left_side, right_side, stepney_tools_image, accessories_image,
                charger_image, battery_aux_image, meter_reading, fuel_level
         FROM handover
         WHERE vehicle_id = ? AND driver_id = ?
         ORDER BY handover_id DESC
         LIMIT 1"
    );
    $stmt->bind_param('ss', $vehicleId, $driverId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }

    return [
        'handover_id' => (int) $row['handover_id'],
        'vehicle_reg' => $row['vehicle_reg'],
        'driver_id' => $row['driver_id'],
        'driver_name' => $row['driver_name'],
        'supervisor' => $row['supervisor'],
        'handover_datetime' => $row['handover_datetime'],
        'driver_type' => $row['driver_type'],
        'handover_type' => $row['handover_type'],
        'meter_reading' => $row['meter_reading'],
        'fuel_level' => $row['fuel_level'],
        'images' => staffTransferBuildImageLinks(
            $row,
            [
                'odometer_image',
                'car_driver_image',
                'handover_form',
                'front_side',
                'back_side',
                'interior',
                'left_side',
                'right_side',
                'stepney_tools_image',
                'accessories_image',
                'charger_image',
                'battery_aux_image',
            ]
        ),
    ];
}

function staffTransferResolveVehicleAvailabilityCode(?array $vehicle): int
{
    if (!$vehicle) {
        return 0;
    }

    $hasPrimary = !empty($vehicle['driver_id']) && (string) $vehicle['driver_id'] !== '0';
    $hasSecondary = !empty($vehicle['driver1_id']) && (string) $vehicle['driver1_id'] !== '0';

    if (!$hasPrimary && !$hasSecondary) {
        return 3;
    }

    if ($hasPrimary && !$hasSecondary) {
        return 2;
    }

    if (!$hasPrimary && $hasSecondary) {
        return 1;
    }

    return 0;
}

function staffTransferFetchVehicleContext(
    mysqli $con,
    string $workflow,
    string $vehicleId,
    ?string $driverId = null
): array {
    $vehicle = staffTransferFetchVehicleById($con, $vehicleId);
    if (!$vehicle) {
        return [];
    }

    $context = [
        'vehicle' => $vehicle,
        'tyres' => staffTransferFetchTyreDetails($con, $vehicleId),
        'charger_no' => $vehicle['charger_no'] ?? '',
    ];

    if ($workflow === 'handover') {
        $context['availability_code'] = staffTransferResolveVehicleAvailabilityCode($vehicle);
        $context['latest_takeover'] = staffTransferFetchLatestTakeoverForVehicle($con, $vehicleId);
    } else {
        $context['assigned_drivers'] = staffTransferFetchAssignedDriversForVehicle($con, $vehicleId);
        if ($driverId) {
            $context['latest_handover'] = staffTransferFetchLatestHandoverForVehicleDriver(
                $con,
                $vehicleId,
                $driverId
            );
        }
    }

    return $context;
}

function staffTransferEnsureUploadDirectory(string $workflow, string $subFolder): string
{
    $baseDirectory = __DIR__ . '/../transfers';
    $directory = $baseDirectory . '/' . $workflow . '/' . trim($subFolder, '/');
    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }

    return $directory;
}

function staffTransferCreateImageResource(string $source, string $extension)
{
    switch ($extension) {
        case 'jpg':
        case 'jpeg':
            return imagecreatefromjpeg($source);
        case 'png':
            return imagecreatefrompng($source);
        case 'webp':
            return imagecreatefromwebp($source);
        default:
            return false;
    }
}

function staffTransferSaveCompressedImage(
    string $source,
    string $destination,
    string $extension
): bool {
    $image = staffTransferCreateImageResource($source, $extension);
    if (!$image) {
        return false;
    }

    [$width, $height] = getimagesize($source);
    $maxWidth = 1600;
    $targetWidth = $width > $maxWidth ? $maxWidth : $width;
    $targetHeight = (int) round(($height / max($width, 1)) * $targetWidth);

    $canvas = imagecreatetruecolor($targetWidth, $targetHeight);

    if ($extension === 'png' || $extension === 'webp') {
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
    }

    imagecopyresampled(
        $canvas,
        $image,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $width,
        $height
    );

    $saved = false;
    switch ($extension) {
        case 'jpg':
        case 'jpeg':
            $saved = imagejpeg($canvas, $destination, 78);
            break;
        case 'png':
            $saved = imagepng($canvas, $destination, 8);
            break;
        case 'webp':
            $saved = imagewebp($canvas, $destination, 78);
            break;
    }

    imagedestroy($image);
    imagedestroy($canvas);

    return $saved;
}

function staffTransferSaveUpload(
    ?array $file,
    string $workflow,
    string $subFolder,
    bool $required = false
): ?string {
    if (!$file || !isset($file['error']) || $file['error'] === UPLOAD_ERR_NO_FILE) {
        if ($required) {
            throw new RuntimeException("Missing image for {$subFolder}");
        }

        return null;
    }

    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException("Image upload failed for {$subFolder}");
    }

    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        throw new RuntimeException("Unsupported file type for {$subFolder}");
    }

    $directory = staffTransferEnsureUploadDirectory($workflow, $subFolder);
    $fileName = $subFolder . '_' . date('Ymd_His') . '_' . uniqid('', true) . '.' . $extension;
    $absolutePath = $directory . '/' . $fileName;

    $shouldCompress = $file['size'] > 350 * 1024;
    $saved = $shouldCompress
        ? staffTransferSaveCompressedImage($file['tmp_name'], $absolutePath, $extension)
        : move_uploaded_file($file['tmp_name'], $absolutePath);

    if (!$saved) {
        throw new RuntimeException("Unable to save image for {$subFolder}");
    }

    return 'transfers/' . $workflow . '/' . $subFolder . '/' . $fileName;
}

function staffTransferRequireRecentDatetime(string $value, int $allowedDays = 3): string
{
    $timestamp = strtotime($value);
    if (!$timestamp) {
        throw new RuntimeException('Invalid date and time provided.');
    }

    $minTimestamp = strtotime('-' . $allowedDays . ' days');
    $maxTimestamp = time();
    if ($timestamp < $minTimestamp) {
        throw new RuntimeException('Date is older than the allowed range.');
    }

    if ($timestamp > $maxTimestamp) {
        throw new RuntimeException('Future date and time are not allowed.');
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function staffTransferFetchDriverRecord(
    mysqli $con,
    string $driverId,
    string $sourceType
): ?array {
    $table = $sourceType === 'temp' ? 'temp_driver' : 'driver';
    $stmt = $con->prepare(
        "SELECT driver_id, driver_name, driver_code
         FROM {$table}
         WHERE driver_id = ?
         LIMIT 1"
    );
    $stmt->bind_param('s', $driverId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    return $row ?: null;
}

function staffTransferFetchActorName(array $user): string
{
    return trim((string) ($user['user_name'] ?? $user['name'] ?? $user['user_code'] ?? 'System'));
}
