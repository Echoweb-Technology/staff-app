<?php
include realpath(__DIR__ . "/../../database.php");

date_default_timezone_set("Asia/Kolkata");

/* ===================== CONFIG ===================== */
$targetDate = date('Y-m-d',strtotime("-1 day"));
$vendorCode = 'vtpl';
$apiSleep   = 1; // seconds between API calls (safety)

/* ===================== HELPERS ===================== */
function now()
{
    return date("H:i:s");
}

function fetchGpsKm($vehicleReg, $from, $to, &$timeTaken = 0)
{
    $start = microtime(true);

    $vehicleReg = urlencode($vehicleReg);
    $from       = urlencode($from);
    $to         = urlencode($to);

    $url = "https://gtrac.in/newtracking/vehicle_km_sum_vivek.php?veh_reg=$vehicleReg&start_date=$from&end_date=$to";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_ENCODING => "gzip,deflate",
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $timeTaken = round(microtime(true) - $start, 2);

    if (!$response) {
        return 0;
    }

    $response = str_replace('},]', '}]', $response);
    $data = json_decode($response);

    if (isset($data->vehicleData[0]->KM)) {
        return round((float)$data->vehicleData[0]->KM, 2);
    }

    return 0;
}

/* ===================== START ===================== */
$scriptStart = microtime(true);
echo "[" . now() . "] Script started\n";

/* ===================== FETCH ROWS ===================== */
$sql = "
SELECT sub_booking_id, vehicle
FROM monthly_bookings_vehicle
WHERE date = '$targetDate'
  AND vendor_code = '$vendorCode'   and vehicle !=''
";
// and gps_km_slot_1 is null
$result = $con->query($sql);

if (!$result || $result->num_rows == 0) {
    echo "[" . now() . "] No records found\n";
    exit;
}

$totalRows = $result->num_rows;
echo "[" . now() . "] Total rows: {$totalRows}\n";

/* ===================== PROCESS ===================== */
$counter = 0;

while ($row = $result->fetch_assoc()) {

    $counter++;
    $rowStart = microtime(true);

    $id         = $row['sub_booking_id'];
    $vehicleGps = trim($row['vehicle']);

    if ($vehicleGps === '') {
        echo "[" . now() . "] ID {$id} skipped (empty GPS)\n";
        continue;
    }

    /* SLOT TIMES */
    $slot1_from = "$targetDate 05:00";
    $slot1_to   = "$targetDate 21:00";

    $slot2_from = "$targetDate 21:00";
    $slot2_to   = date("Y-m-d 05:00", strtotime($targetDate . " +1 day"));

    /* API CALLS */
    $slot1_time = 0;
    $slot2_time = 0;

    $gps_km_slot_1 = fetchGpsKm($vehicleGps, $slot1_from, $slot1_to, $slot1_time);
    sleep($apiSleep);
    $gps_km_slot_2 = fetchGpsKm($vehicleGps, $slot2_from, $slot2_to, $slot2_time);

    /* UPDATE */
    $update = "
        UPDATE monthly_bookings_vehicle
        SET 
            gps_km_slot_1 = '$gps_km_slot_1',
            gps_km_slot_2 = '$gps_km_slot_2'
        WHERE sub_booking_id = '$id'
        LIMIT 1
    ";
    $con->query($update);

    $rowTotal = round(microtime(true) - $rowStart, 2);

    echo "[" . now() . "] {$counter}/{$totalRows} | "
       . "ID {$id} | "
       . "Slot1={$gps_km_slot_1} ({$slot1_time}s) | "
       . "Slot2={$gps_km_slot_2} ({$slot2_time}s) | "
       . "Total={$rowTotal}s\n";
}

/* ===================== END ===================== */
$totalTime = round(microtime(true) - $scriptStart, 2);
echo "[" . now() . "] DONE | Total Script Time: {$totalTime}s\n";
