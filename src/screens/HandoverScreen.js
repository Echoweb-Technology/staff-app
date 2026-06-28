import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Picker} from '@react-native-picker/picker';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import SearchablePicker from '../components/SearchablePicker';
import {
  getTransferMeta,
  submitHandover,
  submitTakeover,
} from '../services/handoverApi';
import {getStoredStaffUser} from '../services/staffApi';
import {compressImageHeavy, pickImageFromCamera} from '../utils/imagePicker';
import {colors, fontFamily, shadows} from '../theme';

const FUEL_OPTIONS = [
  {label: 'Select fuel level', value: ''},
  {label: 'Zero', value: 'Zero'},
  {label: 'Quarter', value: 'Quater'},
  {label: 'Half', value: 'Half'},
  {label: 'Three Quarters', value: 'Three Quarters'},
  {label: 'Full', value: 'Full'},
];

const TYRE_OPTIONS = [
  {label: 'Select tyre condition', value: ''},
  {label: 'Excellent', value: 'Excellent'},
  {label: 'Good', value: 'Good'},
  {label: 'OK', value: 'OK'},
  {label: 'Poor', value: 'Poor'},
  {label: 'Change', value: 'Change'},
];

const HANDOVER_PRIMARY_PHOTOS = [
  ['handover_form', 'Handover form', true, 'file-document-outline'],
  ['front_side', 'Front side', true, 'car-arrow-right'],
  ['back_side', 'Back side', true, 'car-back'],
  ['left_side', 'Left side', true, 'car-side'],
  ['right_side', 'Right side', true, 'car-side'],
  ['interior', 'Interior', true, 'car-seat'],
  ['odometer_image', 'Odometer', true, 'counter'],
  ['stepney_tools_image', 'Stepney and tools', true, 'toolbox-outline'],
  ['accessories_image', 'Accessories', true, 'shape-outline'],
  ['charger_image', 'Charger (if EMV)', false, 'ev-station'],
  ['battery_aux_image', 'Battery aux', true, 'car-battery'],
];

const HANDOVER_SECONDARY_PHOTOS = [
  ['odometer_image', 'Odometer image', false, 'counter'],
  ['driver_car_image', 'Driver with car', false, 'account-supervisor-outline'],
];

const TAKEOVER_PRIMARY_PHOTOS = [
  ['takeover_form', 'Takeover form', true, 'file-document-outline'],
  ['front_side', 'Front side', true, 'car-arrow-right'],
  ['back_side', 'Back side', true, 'car-back'],
  ['left_side', 'Left side', true, 'car-side'],
  ['right_side', 'Right side', true, 'car-side'],
  ['interior', 'Interior', true, 'car-seat'],
  ['odometer_image', 'Odometer', true, 'counter'],
  ['stepney_tools_image', 'Stepney and tools', true, 'toolbox-outline'],
  ['accessories_image', 'Accessories', true, 'shape-outline'],
  ['charger_image', 'Charger (if EMV)', false, 'ev-station'],
  ['battery_aux_image', 'Battery aux', true, 'car-battery'],
];

const TAKEOVER_SECONDARY_PHOTOS = [
  ['odometer_image', 'Odometer image', true, 'counter'],
  ['driver_car_image', 'Driver with car', true, 'account-supervisor-outline'],
];

function createPhotoState() {
  return {};
}

function buildInitialTyres() {
  return {t1: '', t2: '', t3: '', t4: '', t5: ''};
}

function createInitialHandoverForm(supervisor = '') {
  return {
    assignmentType: 'primary',
    vehicleId: '',
    driverSelection: '',
    driverId: '',
    driverSourceType: 'permanent',
    supervisor,
    clientId: '',
    handoverDt: new Date(),
    meterReading: '',
    fuelLevel: '',
    formNo: '',
    documentMissing: '',
    majorDamage: '',
    majorItem: '',
    remark: '',
    tyres: buildInitialTyres(),
    photos: createPhotoState(),
  };
}

function createInitialTakeoverForm(supervisor = '') {
  return {
    vehicleId: '',
    driverSelection: '',
    driverId: '',
    driverSourceType: 'permanent',
    driverRole: 'primary',
    supervisor,
    takeoverDt: new Date(),
    meterReading: '',
    fuelLevel: '',
    formNo: '',
    documentMissing: '',
    majorDamage: '',
    majorItem: '',
    remark: '',
    tyres: buildInitialTyres(),
    photos: createPhotoState(),
  };
}

function createEmptyMeta(workflow) {
  return {
    workflow,
    supervisors: [],
    clients: [],
    vehicles: [],
    drivers: [],
    vehicle_context: null,
  };
}

function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatDateLabel(date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatServerDate(value) {
  if (!value) {
    return '--';
  }

  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDateLabel(parsed);
}

function buildTyresFromContext(context) {
  const tyres = buildInitialTyres();
  context?.vehicle_context?.tyres?.tyres?.forEach((item, index) => {
    tyres[`t${index + 1}`] = item.condition || '';
  });
  return tyres;
}

function getDriverSubtitle(driver) {
  if (!driver) {
    return '';
  }

  const parts = [];
  if (driver.driver_code) {
    parts.push(driver.driver_code);
  }
  if (driver.role) {
    parts.push(driver.role);
  }
  if (driver.source_type) {
    parts.push(driver.source_type);
  }

  return parts.join(' · ');
}

function getVehicleLabel(vehicle) {
  return vehicle.registration || `Vehicle ${vehicle.vehicle_id}`;
}

function appendImageToFormData(formData, fieldName, uri) {
  formData.append(fieldName, {
    uri,
    type: 'image/jpeg',
    name: `${fieldName}_${Date.now()}.jpg`,
  });
}

export default function HandoverScreen({navigation}) {
  const [mode, setMode] = useState('handover');
  const [currentUser, setCurrentUser] = useState(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [handoverMeta, setHandoverMeta] = useState(createEmptyMeta('handover'));
  const [takeoverMeta, setTakeoverMeta] = useState(createEmptyMeta('takeover'));
  const [handoverForm, setHandoverForm] = useState(createInitialHandoverForm());
  const [takeoverForm, setTakeoverForm] = useState(createInitialTakeoverForm());

  const loadInitialData = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const user = await getStoredStaffUser();
      setCurrentUser(user);
      const defaultSupervisor = user?.name || '';

      const [handoverResponse, takeoverResponse] = await Promise.all([
        getTransferMeta({mode: 'handover', assignment_type: 'primary'}),
        getTransferMeta({mode: 'takeover'}),
      ]);

      setHandoverMeta(handoverResponse.data);
      setTakeoverMeta(takeoverResponse.data);
      setHandoverForm(prev => ({
        ...prev,
        supervisor:
          prev.supervisor || defaultSupervisor || handoverResponse.data.actor?.name || '',
      }));
      setTakeoverForm(prev => ({
        ...prev,
        supervisor:
          prev.supervisor || defaultSupervisor || takeoverResponse.data.actor?.name || '',
      }));
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        Alert.alert('Unable to load handover data', error.message);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  const refreshCurrentMode = useCallback(async () => {
    setLoadingMeta(true);
    try {
      if (mode === 'handover') {
        const response = await getTransferMeta({
          mode: 'handover',
          assignment_type: handoverForm.assignmentType,
          vehicle_id: handoverForm.vehicleId,
          driver_id: handoverForm.driverId,
        });
        setHandoverMeta(response.data);
      } else {
        const response = await getTransferMeta({
          mode: 'takeover',
          vehicle_id: takeoverForm.vehicleId,
          driver_id: takeoverForm.driverId,
        });
        setTakeoverMeta(response.data);
      }
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        Alert.alert('Unable to refresh', error.message);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, [handoverForm.assignmentType, handoverForm.driverId, handoverForm.vehicleId, mode, takeoverForm.driverId, takeoverForm.vehicleId]);

  useFocusEffect(
    useCallback(() => {
      if (!hasBootstrapped) {
        loadInitialData().finally(() => setHasBootstrapped(true));
      } else {
        refreshCurrentMode();
      }
    }, [hasBootstrapped, loadInitialData, refreshCurrentMode]),
  );

  const handoverVehicleOptions = handoverMeta.vehicles || [];
  const handoverDriverOptions = handoverMeta.drivers || [];
  const takeoverVehicleOptions = takeoverMeta.vehicles || [];
  const takeoverDriverOptions =
    takeoverMeta.vehicle_context?.assigned_drivers || [];

  const currentHandoverVehicle = useMemo(
    () =>
      handoverVehicleOptions.find(
        item => String(item.vehicle_id) === String(handoverForm.vehicleId),
      ) || handoverMeta.vehicle_context?.vehicle,
    [handoverForm.vehicleId, handoverMeta.vehicle_context?.vehicle, handoverVehicleOptions],
  );

  const currentTakeoverVehicle = useMemo(
    () =>
      takeoverVehicleOptions.find(
        item => String(item.vehicle_id) === String(takeoverForm.vehicleId),
      ) || takeoverMeta.vehicle_context?.vehicle,
    [takeoverForm.vehicleId, takeoverMeta.vehicle_context?.vehicle, takeoverVehicleOptions],
  );

  const handoverPhotoFields =
    handoverForm.assignmentType === 'primary'
      ? HANDOVER_PRIMARY_PHOTOS
      : HANDOVER_SECONDARY_PHOTOS;
  const takeoverPhotoFields =
    takeoverForm.driverRole === 'secondary' || takeoverForm.driverSourceType === 'temp'
      ? TAKEOVER_SECONDARY_PHOTOS
      : TAKEOVER_PRIMARY_PHOTOS;

  const handleModeChange = nextMode => {
    setMode(nextMode);
  };

  const handleHandoverAssignmentChange = async nextType => {
    const nextForm = {
      ...createInitialHandoverForm(
        handoverForm.supervisor || currentUser?.name || handoverMeta.actor?.name || '',
      ),
      assignmentType: nextType,
    };

    setHandoverForm(nextForm);
    setLoadingMeta(true);
    try {
      const response = await getTransferMeta({
        mode: 'handover',
        assignment_type: nextType,
      });
      setHandoverMeta(response.data);
    } catch (error) {
      Alert.alert('Unable to load handover options', error.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleHandoverVehicleChange = async vehicleId => {
    const nextForm = {
      ...handoverForm,
      vehicleId,
      driverSelection: '',
      driverId: '',
      driverSourceType: 'permanent',
      tyres: buildInitialTyres(),
      photos: createPhotoState(),
    };
    setHandoverForm(nextForm);

    setLoadingMeta(true);
    try {
      const response = await getTransferMeta({
        mode: 'handover',
        assignment_type: nextForm.assignmentType,
        vehicle_id: vehicleId,
      });
      setHandoverMeta(response.data);
      setHandoverForm(prev => ({
        ...prev,
        tyres: buildTyresFromContext(response.data),
      }));
    } catch (error) {
      Alert.alert('Unable to load vehicle details', error.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleTakeoverVehicleChange = async vehicleId => {
    const nextForm = {
      ...createInitialTakeoverForm(
        takeoverForm.supervisor || currentUser?.name || takeoverMeta.actor?.name || '',
      ),
      vehicleId,
    };
    setTakeoverForm(nextForm);

    setLoadingMeta(true);
    try {
      const response = await getTransferMeta({
        mode: 'takeover',
        vehicle_id: vehicleId,
      });
      setTakeoverMeta(response.data);
      setTakeoverForm(prev => ({
        ...prev,
        tyres: buildTyresFromContext(response.data),
      }));
    } catch (error) {
      Alert.alert('Unable to load takeover vehicle', error.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleTakeoverDriverChange = async value => {
    const [driverId, sourceType, role] = value.split('|');
    const nextForm = {
      ...takeoverForm,
      driverSelection: value,
      driverId,
      driverSourceType: sourceType,
      driverRole: role,
      photos: createPhotoState(),
    };
    setTakeoverForm(nextForm);

    setLoadingMeta(true);
    try {
      const response = await getTransferMeta({
        mode: 'takeover',
        vehicle_id: nextForm.vehicleId,
        driver_id: driverId,
      });
      setTakeoverMeta(response.data);
      setTakeoverForm(prev => ({
        ...prev,
        tyres: buildTyresFromContext(response.data),
      }));
    } catch (error) {
      Alert.alert('Unable to load handover history', error.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  /* ── Search handlers for searchable dropdowns ── */

  const searchVehicles = useCallback(
    async searchText => {
      const params = {
        mode,
        fetch: 'vehicles',
        search: searchText,
      };
      if (mode === 'handover') {
        params.assignment_type = handoverForm.assignmentType;
      }
      const res = await getTransferMeta(params);
      const list = res.data?.vehicles || [];
      return list.map(item => ({
        label: getVehicleLabel(item),
        value: String(item.vehicle_id),
      }));
    },
    [mode, handoverForm.assignmentType],
  );

  const searchHandoverDrivers = useCallback(
    async searchText => {
      const res = await getTransferMeta({
        mode: 'handover',
        assignment_type: handoverForm.assignmentType,
        fetch: 'drivers',
        search: searchText,
      });
      const list = res.data?.drivers || [];
      return list.map(item => ({
        label: `${item.driver_name}${item.driver_code ? ` (${item.driver_code})` : ''}`,
        value: `${item.driver_id}|${String(item.source_type).toLowerCase()}`,
        subtitle: item.source_type,
      }));
    },
    [handoverForm.assignmentType],
  );

  const searchSupervisors = useCallback(
    async searchText => {
      const res = await getTransferMeta({
        mode,
        fetch: 'supervisors',
        search: searchText,
      });
      const list = res.data?.supervisors || [];
      return list.map(item => ({
        label: item,
        value: item,
      }));
    },
    [mode],
  );

  const searchClients = useCallback(
    async searchText => {
      const res = await getTransferMeta({
        mode: 'handover',
        fetch: 'clients',
        search: searchText,
      });
      const list = res.data?.clients || [];
      return list.map(item => ({
        label: item.client_name,
        value: String(item.client_id),
      }));
    },
    [],
  );

  const captureCompressedPhoto = async (target, fieldKey) => {
    try {
      const image = await pickImageFromCamera();
      if (!image?.uri) {
        return;
      }

      const compressedUri = await compressImageHeavy(image.uri);
      if (target === 'handover') {
        setHandoverForm(prev => ({
          ...prev,
          photos: {...prev.photos, [fieldKey]: compressedUri},
        }));
      } else {
        setTakeoverForm(prev => ({
          ...prev,
          photos: {...prev.photos, [fieldKey]: compressedUri},
        }));
      }
    } catch (error) {
      Alert.alert('Camera unavailable', error.message);
    }
  };

  const openRemoteImage = async url => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Unable to open image', 'Please try again later.');
    }
  };

  const submitHandoverForm = async () => {
    if (!handoverForm.vehicleId || !handoverForm.driverId) {
      Alert.alert('Missing details', 'Please select a vehicle and driver.');
      return;
    }

    if (
      handoverForm.assignmentType === 'primary' &&
      (!handoverForm.formNo || !handoverForm.meterReading || !handoverForm.fuelLevel)
    ) {
      Alert.alert(
        'Required fields',
        'Form number, meter reading and fuel level are required for primary handover.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assignment_type', handoverForm.assignmentType);
      formData.append('vehicle_id', String(handoverForm.vehicleId));
      formData.append('driver_id', String(handoverForm.driverId));
      formData.append('driver_source_type', handoverForm.driverSourceType);
      formData.append('handover_dt', formatDateForApi(handoverForm.handoverDt));
      formData.append('supervisor', handoverForm.supervisor);
      formData.append('client_id', handoverForm.clientId);
      formData.append('meter_reading', handoverForm.meterReading);
      formData.append('fuel_level', handoverForm.fuelLevel);
      formData.append('form_no', handoverForm.formNo);
      formData.append('document_missing', handoverForm.documentMissing);
      formData.append('major_damage', handoverForm.majorDamage);
      formData.append('major_item', handoverForm.majorItem);
      formData.append('remark', handoverForm.remark);
      Object.entries(handoverForm.tyres).forEach(([key, value]) => {
        formData.append(key, value);
      });

      Object.entries(handoverForm.photos).forEach(([fieldName, uri]) => {
        if (uri) {
          appendImageToFormData(formData, fieldName, uri);
        }
      });

      const response = await submitHandover(formData);
      Alert.alert(
        'Handover submitted',
        `Handover ID: ${response.data?.handover_id || '--'}`,
      );

      const supervisor = handoverForm.supervisor || currentUser?.name || '';
      const resetForm = createInitialHandoverForm(supervisor);
      setHandoverForm(resetForm);
      await loadInitialData();
      setMode('handover');
    } catch (error) {
      Alert.alert('Handover failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitTakeoverForm = async () => {
    if (!takeoverForm.vehicleId || !takeoverForm.driverId) {
      Alert.alert('Missing details', 'Please select a vehicle and driver.');
      return;
    }

    if (
      (takeoverForm.driverRole === 'secondary' || takeoverForm.driverSourceType === 'temp')
        ? !takeoverForm.photos.odometer_image || !takeoverForm.photos.driver_car_image
        : !takeoverForm.meterReading || !takeoverForm.fuelLevel
    ) {
      Alert.alert(
        'Required fields',
        takeoverForm.driverRole === 'secondary' || takeoverForm.driverSourceType === 'temp'
          ? 'Secondary takeover needs odometer and driver-with-car images.'
          : 'Meter reading and fuel level are required for primary takeover.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('vehicle_id', String(takeoverForm.vehicleId));
      formData.append('driver_id', String(takeoverForm.driverId));
      formData.append('driver_source_type', takeoverForm.driverSourceType);
      formData.append('driver_role', takeoverForm.driverRole);
      formData.append('takeover_dt', formatDateForApi(takeoverForm.takeoverDt));
      formData.append('supervisor', takeoverForm.supervisor);
      formData.append('meter_reading', takeoverForm.meterReading);
      formData.append('fuel_level', takeoverForm.fuelLevel);
      formData.append('form_no', takeoverForm.formNo);
      formData.append('document_missing', takeoverForm.documentMissing);
      formData.append('major_damage', takeoverForm.majorDamage);
      formData.append('major_item', takeoverForm.majorItem);
      formData.append('remark', takeoverForm.remark);
      Object.entries(takeoverForm.tyres).forEach(([key, value]) => {
        formData.append(key, value);
      });

      Object.entries(takeoverForm.photos).forEach(([fieldName, uri]) => {
        if (uri) {
          appendImageToFormData(formData, fieldName, uri);
        }
      });

      const response = await submitTakeover(formData);
      Alert.alert(
        'Takeover submitted',
        `Takeover ID: ${response.data?.takeover_id || '--'}`,
      );

      const supervisor = takeoverForm.supervisor || currentUser?.name || '';
      const resetForm = createInitialTakeoverForm(supervisor);
      setTakeoverForm(resetForm);
      await loadInitialData();
      setMode('takeover');
    } catch (error) {
      Alert.alert('Takeover failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderHandoverContext = () => {
    const context = handoverMeta.vehicle_context;
    if (!context) {
      return null;
    }

    const latestTakeover = context.latest_takeover;
    const warning =
      handoverForm.assignmentType === 'primary' && context.availability_code === 2
        ? 'Primary slot is already occupied for this vehicle.'
        : handoverForm.assignmentType === 'secondary' &&
            handoverForm.driverSourceType === 'permanent' &&
            context.availability_code === 1
          ? 'Secondary slot is already occupied for this vehicle.'
          : null;

    return (
      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>Vehicle context</Text>
        <KeyValueRow
          label="Vehicle"
          value={getVehicleLabel(currentHandoverVehicle || {})}
        />
        <KeyValueRow
          label="Charger"
          value={context.charger_no || 'Not assigned'}
        />
        {latestTakeover ? (
          <>
            <KeyValueRow
              label="Last takeover"
              value={`#${latestTakeover.takeover_id}`}
            />
            <KeyValueRow
              label="Takeover from"
              value={latestTakeover.driver_name || '--'}
            />
            <KeyValueRow
              label="Taken by"
              value={latestTakeover.supervisor || '--'}
            />
            <KeyValueRow
              label="Takeover time"
              value={formatServerDate(latestTakeover.takeover_datetime)}
            />
            <ImageLinkRow
              label="Previous images"
              links={[
                [
                  'Odometer',
                  latestTakeover.images?.odometer_image?.url,
                ],
                [
                  'Driver + Car',
                  latestTakeover.images?.car_driver_image?.url,
                ],
              ]}
              onOpen={openRemoteImage}
            />
          </>
        ) : (
          <Text style={styles.helperText}>
            No previous takeover record found for this vehicle.
          </Text>
        )}
        {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
      </View>
    );
  };

  const renderTakeoverContext = () => {
    const context = takeoverMeta.vehicle_context;
    if (!context) {
      return null;
    }

    const latestHandover = context.latest_handover;

    return (
      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>Assigned driver details</Text>
        <KeyValueRow
          label="Vehicle"
          value={getVehicleLabel(currentTakeoverVehicle || {})}
        />
        <KeyValueRow
          label="Charger"
          value={context.charger_no || 'Not assigned'}
        />
        {latestHandover ? (
          <>
            <KeyValueRow
              label="Last handover"
              value={`#${latestHandover.handover_id}`}
            />
            <KeyValueRow
              label="Driver"
              value={latestHandover.driver_name || '--'}
            />
            <KeyValueRow
              label="Handed by"
              value={latestHandover.supervisor || '--'}
            />
            <KeyValueRow
              label="Handover time"
              value={formatServerDate(latestHandover.handover_datetime)}
            />
            <ImageLinkRow
              label="Reference images"
              links={[
                ['Form', latestHandover.images?.handover_form?.url],
                ['Odometer', latestHandover.images?.odometer_image?.url],
                ['Driver + Car', latestHandover.images?.car_driver_image?.url],
              ]}
              onOpen={openRemoteImage}
            />
          </>
        ) : (
          <Text style={styles.helperText}>
            Select a driver to load the latest handover reference.
          </Text>
        )}
      </View>
    );
  };

  const renderTyreSection = (tyres, onChange) => {
    const tyreMeta =
      (mode === 'handover'
        ? handoverMeta.vehicle_context?.tyres?.tyres
        : takeoverMeta.vehicle_context?.tyres?.tyres) || [];

    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Tyre condition</Text>
        {['t1', 't2', 't3', 't4', 't5'].map((key, index) => (
          <PickerField
            key={key}
            label={tyreMeta[index]?.label || `Tyre ${index + 1}`}
            value={tyres[key]}
            options={TYRE_OPTIONS}
            onChange={value => onChange(key, value)}
          />
        ))}
      </View>
    );
  };

  const renderPhotoSection = (target, fields, photos) => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Photo uploads</Text>
      <Text style={styles.helperText}>
        Photos are compressed before upload to keep the form fast even with many
        image fields.
      </Text>
      {fields.map(([fieldKey, label, required, icon]) => (
        <PhotoCaptureCard
          key={fieldKey}
          label={label}
          icon={icon}
          required={required}
          uri={photos[fieldKey]}
          onPress={() => captureCompressedPhoto(target, fieldKey)}
        />
      ))}
    </View>
  );

  const renderHandoverForm = () => (
    <>
      <HeroCard
        badge="Driver handover"
        title={
          handoverForm.assignmentType === 'primary'
            ? 'Assign a primary driver'
            : 'Assign a secondary or temp driver'
        }
        description="This mirrors the web flow with assignment type, previous takeover context, tyre condition, and compressed photo uploads."
      />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Basic details</Text>
        <SegmentRow
          value={handoverForm.assignmentType}
          items={[
            ['primary', 'Primary'],
            ['secondary', 'Secondary'],
          ]}
          onChange={handleHandoverAssignmentChange}
        />
        <SearchablePicker
          label="Vehicle"
          value={handoverForm.vehicleId}
          options={handoverVehicleOptions.map(item => ({
            label: getVehicleLabel(item),
            value: String(item.vehicle_id),
          }))}
          placeholder="Select vehicle"
          onSelect={(value) => handleHandoverVehicleChange(value)}
          onSearch={searchVehicles}
        />
        <SearchablePicker
          label="Handover to driver"
          value={handoverForm.driverSelection}
          options={handoverDriverOptions.map(item => ({
            label: `${item.driver_name} (${getDriverSubtitle(item)})`,
            value: `${item.driver_id}|${String(item.source_type).toLowerCase()}`,
            subtitle: item.source_type,
          }))}
          placeholder="Select driver"
          onSelect={value => {
            const [driverId, sourceType] = value.split('|');
            setHandoverForm(prev => ({
              ...prev,
              driverSelection: value,
              driverId,
              driverSourceType: sourceType || 'permanent',
            }));
          }}
        />
        <DateField
          label="Handover date and time"
          value={formatDateLabel(handoverForm.handoverDt)}
          onPress={() => setDatePickerTarget('handover')}
        />
        <SearchablePicker
          label="Handover done by"
          value={handoverForm.supervisor}
          options={handoverMeta.supervisors.map(item => ({
            label: item,
            value: item,
          }))}
          placeholder="Select supervisor"
          onSearch={searchSupervisors}
          onSelect={value => setHandoverForm(prev => ({...prev, supervisor: value}))}
        />
        {handoverForm.assignmentType === 'primary' ? (
          <SearchablePicker
            label="Department"
            value={handoverForm.clientId}
            options={handoverMeta.clients.map(item => ({
              label: item.client_name,
              value: String(item.client_id),
            }))}
            placeholder="Select client/department"
            onSearch={searchClients}
            onSelect={value => setHandoverForm(prev => ({...prev, clientId: value}))}
          />
        ) : null}
      </View>

      {renderHandoverContext()}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Vehicle details</Text>
        {handoverForm.assignmentType === 'primary' ? (
          <>
            <TextField
              label="Vehicle KM reading"
              value={handoverForm.meterReading}
              onChange={value =>
                setHandoverForm(prev => ({...prev, meterReading: value}))
              }
              keyboardType="numeric"
            />
            <PickerField
              label="Fuel level"
              value={handoverForm.fuelLevel}
              options={FUEL_OPTIONS}
              onChange={value =>
                setHandoverForm(prev => ({...prev, fuelLevel: value}))
              }
            />
          </>
        ) : null}
        <TextField
          label="Handover form number"
          value={handoverForm.formNo}
          onChange={value => setHandoverForm(prev => ({...prev, formNo: value}))}
        />
        {handoverForm.assignmentType === 'primary' ? (
          <>
            <TextField
              label="Documents missing"
              value={handoverForm.documentMissing}
              onChange={value =>
                setHandoverForm(prev => ({...prev, documentMissing: value}))
              }
            />
            <TextField
              label="Major damages noted"
              value={handoverForm.majorDamage}
              onChange={value =>
                setHandoverForm(prev => ({...prev, majorDamage: value}))
              }
            />
            <TextField
              label="Items missing"
              value={handoverForm.majorItem}
              onChange={value =>
                setHandoverForm(prev => ({...prev, majorItem: value}))
              }
            />
          </>
        ) : null}
        <TextField
          label="Remark"
          value={handoverForm.remark}
          onChange={value => setHandoverForm(prev => ({...prev, remark: value}))}
          multiline
        />
      </View>

      {handoverForm.assignmentType === 'primary'
        ? renderTyreSection(handoverForm.tyres, (key, value) =>
            setHandoverForm(prev => ({
              ...prev,
              tyres: {...prev.tyres, [key]: value},
            }))
          )
        : null}

      {renderPhotoSection('handover', handoverPhotoFields, handoverForm.photos)}

      <PrimaryButton
        label="Submit handover"
        icon="swap-horizontal-bold"
        loading={submitting}
        onPress={submitHandoverForm}
      />
    </>
  );

  const renderTakeoverForm = () => (
    <>
      <HeroCard
        badge="Driver takeover"
        title="Receive the vehicle back"
        description="This follows the web takeover flow with vehicle-wise driver lookup, latest handover context, and full or simplified photo requirements based on driver role."
      />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Basic details</Text>
        <SearchablePicker
          label="Vehicle"
          value={takeoverForm.vehicleId}
          options={takeoverVehicleOptions.map(item => ({
            label: getVehicleLabel(item),
            value: String(item.vehicle_id),
          }))}
          placeholder="Select vehicle"
          onSelect={handleTakeoverVehicleChange}
          onSearch={searchVehicles}
        />
        <SearchablePicker
          label="Takeover from driver"
          value={takeoverForm.driverSelection}
          options={takeoverDriverOptions.map(item => ({
            label: `${item.driver_name} (${getDriverSubtitle(item)})`,
            value: `${item.driver_id}|${item.source_type_key}|${item.role_key}`,
            subtitle: `${item.source_type} · ${item.role}`,
          }))}
          placeholder="Select driver"
          onSelect={handleTakeoverDriverChange}
        />
        <DateField
          label="Takeover date and time"
          value={formatDateLabel(takeoverForm.takeoverDt)}
          onPress={() => setDatePickerTarget('takeover')}
        />
        <SearchablePicker
          label="Takeover done by"
          value={takeoverForm.supervisor}
          options={takeoverMeta.supervisors.map(item => ({
            label: item,
            value: item,
          }))}
          placeholder="Select supervisor"
          onSearch={searchSupervisors}
          onSelect={value => setTakeoverForm(prev => ({...prev, supervisor: value}))}
        />
      </View>

      {renderTakeoverContext()}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Vehicle details</Text>
        {takeoverForm.driverRole === 'secondary' || takeoverForm.driverSourceType === 'temp' ? (
          <Text style={styles.helperText}>
            Secondary or temp takeover keeps the compact web flow: odometer plus
            driver-with-car images.
          </Text>
        ) : (
          <>
            <TextField
              label="Vehicle KM reading"
              value={takeoverForm.meterReading}
              onChange={value =>
                setTakeoverForm(prev => ({...prev, meterReading: value}))
              }
              keyboardType="numeric"
            />
            <PickerField
              label="Fuel level"
              value={takeoverForm.fuelLevel}
              options={FUEL_OPTIONS}
              onChange={value =>
                setTakeoverForm(prev => ({...prev, fuelLevel: value}))
              }
            />
          </>
        )}
        <TextField
          label="Takeover form number"
          value={takeoverForm.formNo}
          onChange={value => setTakeoverForm(prev => ({...prev, formNo: value}))}
        />
        <TextField
          label="Documents missing"
          value={takeoverForm.documentMissing}
          onChange={value =>
            setTakeoverForm(prev => ({...prev, documentMissing: value}))
          }
        />
        <TextField
          label="Major damages noted"
          value={takeoverForm.majorDamage}
          onChange={value =>
            setTakeoverForm(prev => ({...prev, majorDamage: value}))
          }
        />
        <TextField
          label="Items missing"
          value={takeoverForm.majorItem}
          onChange={value => setTakeoverForm(prev => ({...prev, majorItem: value}))}
        />
        <TextField
          label="Remark"
          value={takeoverForm.remark}
          onChange={value => setTakeoverForm(prev => ({...prev, remark: value}))}
          multiline
        />
      </View>

      {takeoverForm.driverRole === 'secondary' || takeoverForm.driverSourceType === 'temp'
        ? null
        : renderTyreSection(takeoverForm.tyres, (key, value) =>
            setTakeoverForm(prev => ({
              ...prev,
              tyres: {...prev.tyres, [key]: value},
            }))
          )}

      {renderPhotoSection('takeover', takeoverPhotoFields, takeoverForm.photos)}

      <PrimaryButton
        label="Submit takeover"
        icon="check-bold"
        loading={submitting}
        onPress={submitTakeoverForm}
      />
    </>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Handover / Takeover"
        subtitle="Replicated from web workflow"
        navigation={navigation}
        rightIcon="refresh"
        onRightPress={refreshCurrentMode}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>
          {['handover', 'takeover'].map(item => (
            <TouchableOpacity
              key={item}
              style={[
                styles.segmentItem,
                mode === item && styles.segmentActive,
              ]}
              onPress={() => handleModeChange(item)}>
              <Text
                style={[
                  styles.segmentText,
                  mode === item && styles.segmentTextActive,
                ]}>
                {item === 'handover' ? 'Handover' : 'Takeover'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadingMeta ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading transfer workflow...</Text>
          </View>
        ) : mode === 'handover' ? (
          renderHandoverForm()
        ) : (
          renderTakeoverForm()
        )}
      </ScrollView>

      {datePickerTarget ? (
        <DateTimePicker
          value={
            datePickerTarget === 'handover'
              ? handoverForm.handoverDt
              : takeoverForm.takeoverDt
          }
          mode="datetime"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            if (event.type === 'dismissed') {
              setDatePickerTarget(null);
              return;
            }

            const value = selectedDate || new Date();
            if (datePickerTarget === 'handover') {
              setHandoverForm(prev => ({...prev, handoverDt: value}));
            } else {
              setTakeoverForm(prev => ({...prev, takeoverDt: value}));
            }
            setDatePickerTarget(null);
          }}
        />
      ) : null}
    </View>
  );
}

function HeroCard({badge, title, description}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>{badge}</Text>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroDescription}>{description}</Text>
    </View>
  );
}

function SegmentRow({value, items, onChange}) {
  return (
    <View style={styles.innerSegment}>
      {items.map(([itemValue, label]) => (
        <TouchableOpacity
          key={itemValue}
          style={[
            styles.innerSegmentItem,
            value === itemValue && styles.innerSegmentItemActive,
          ]}
          onPress={() => onChange(itemValue)}>
          <Text
            style={[
              styles.innerSegmentText,
              value === itemValue && styles.innerSegmentTextActive,
            ]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PickerField({label, value, options, onChange}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={itemValue => onChange(itemValue)}
          dropdownIconColor={colors.textMuted}
          style={styles.picker}>
          {options.map(option => (
            <Picker.Item
              key={`${label}_${option.value}`}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function DateField({label, value, onPress}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.dateButton} onPress={onPress}>
        <MaterialCommunityIcons
          name="calendar-clock"
          size={20}
          color={colors.primary}
        />
        <Text style={styles.dateButtonText}>{value}</Text>
      </TouchableOpacity>
    </View>
  );
}

function TextField({label, value, onChange, keyboardType, multiline}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={label}
        placeholderTextColor="#98A7AD"
      />
    </View>
  );
}

function KeyValueRow({label, value}) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value || '--'}</Text>
    </View>
  );
}

function ImageLinkRow({label, links, onOpen}) {
  const availableLinks = links.filter(([, url]) => Boolean(url));
  if (!availableLinks.length) {
    return null;
  }

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.linkRow}>
        {availableLinks.map(([linkLabel, url]) => (
          <TouchableOpacity
            key={`${label}_${linkLabel}`}
            style={styles.linkChip}
            onPress={() => onOpen(url)}>
            <MaterialCommunityIcons
              name="open-in-new"
              size={14}
              color={colors.primary}
            />
            <Text style={styles.linkChipText}>{linkLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function PhotoCaptureCard({label, icon, required, uri, onPress}) {
  return (
    <TouchableOpacity style={styles.photoCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.photoIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.photoText}>
        <Text style={styles.photoLabel}>
          {label}
          {required ? ' *' : ''}
        </Text>
        <Text style={styles.photoHint}>
          {uri ? 'Photo captured. Tap to retake.' : 'Tap to capture photo'}
        </Text>
      </View>
      {uri ? (
        <Image source={{uri}} style={styles.photoPreview} />
      ) : (
        <MaterialCommunityIcons
          name="camera-plus-outline"
          size={24}
          color={colors.textMuted}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 32},
  segment: {
    height: 50,
    flexDirection: 'row',
    backgroundColor: '#E6EDEF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: 10,
  },
  heroCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...shadows.card,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 21,
    marginTop: 14,
  },
  heroDescription: {
    color: '#D9EDF2',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  contextCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2DFB1',
  },
  contextTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    marginBottom: 12,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginBottom: 6,
  },
  pickerWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
  },
  dateButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  inputMultiline: {
    minHeight: 92,
    paddingTop: 14,
    paddingBottom: 14,
  },
  innerSegment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 15,
    padding: 4,
    marginBottom: 14,
  },
  innerSegmentItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerSegmentItemActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  innerSegmentText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
  },
  innerSegmentTextActive: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  keyLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    flex: 1,
  },
  keyValue: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 8,
  },
  warningText: {
    color: colors.danger,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E6D3A5',
  },
  linkChipText: {
    color: colors.primary,
    fontFamily: fontFamily.medium,
    fontSize: 11,
  },
  photoCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  photoLabel: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  photoHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 3,
  },
  photoPreview: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
});
