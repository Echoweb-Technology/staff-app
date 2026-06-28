import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import {pickImageFromCamera} from '../utils/imagePicker';
import {
  getCurrentPositionAsync,
  requestLocationPermissionAsync,
} from '../utils/location';
import {getAttendanceStatus, punchAttendance} from '../services/staffApi';
import {colors, fontFamily, shadows} from '../theme';

function formatTime(value) {
  if (!value) {
    return null;
  }
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AttendanceScreen({navigation}) {
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('ready');
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const response = await getAttendanceStatus();
      setAttendanceStatus(response.data);
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        Alert.alert('Unable to load attendance', error.message);
      }
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const verifyLocation = async () => {
    setLocationStatus('checking');
    try {
      const permission = await requestLocationPermissionAsync();
      if (!permission) {
        throw new Error('Location permission is required.');
      }
      const position = await getCurrentPositionAsync();
      setCoords(position);
      setLocationStatus('inside');
    } catch (error) {
      setCoords(null);
      setLocationStatus('ready');
      Alert.alert('Location unavailable', error.message);
    }
  };

  const capturePhoto = async () => {
    try {
      const result = await pickImageFromCamera();
      if (result) {
        setPhoto(result.uri);
      }
    } catch (error) {
      Alert.alert('Camera unavailable', error.message);
    }
  };

  const submitAttendance = async () => {
    if (!coords) {
      Alert.alert('Location required', 'Verify your location before marking attendance.');
      return;
    }

    const action = attendanceStatus?.can_punch_out ? 'out' : 'in';

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('action', action);
      formData.append('latitude', String(coords.latitude));
      formData.append('longitude', String(coords.longitude));

      if (photo) {
        formData.append('photo', {
          uri: photo,
          type: 'image/jpeg',
          name: `attendance_${action}_${Date.now()}.jpg`,
        });
      }

      const response = await punchAttendance(formData);
      setAttendanceStatus(response.data);

      Alert.alert(
        action === 'in' ? 'Checked in' : 'Checked out',
        response.msg || 'Your attendance has been recorded.',
        [{text: 'Done', onPress: () => navigation.goBack()}],
      );
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        Alert.alert('Session expired', 'Please log in again.');
        return;
      }
      Alert.alert('Attendance failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const locationVerified = locationStatus === 'inside';
  const canPunchIn = attendanceStatus?.can_punch_in;
  const canPunchOut = attendanceStatus?.can_punch_out;
  const alreadyDone = attendanceStatus?.checked_in && attendanceStatus?.checked_out;
  const punchLabel = canPunchOut ? 'Check out' : 'Mark attendance';
  const punchIcon = canPunchOut ? 'logout' : 'check-circle-outline';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Photo Attendance"
        subtitle={todayLabel}
        navigation={navigation}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {attendanceStatus?.checked_in ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Today&apos;s attendance</Text>
            <Text style={styles.summaryLine}>
              In: {formatTime(attendanceStatus.in_time) || '--'}
              {attendanceStatus.in_source ? ` (${attendanceStatus.in_source})` : ''}
            </Text>
            <Text style={styles.summaryLine}>
              Out: {formatTime(attendanceStatus.out_time) || 'Pending'}
              {attendanceStatus.out_source ? ` (${attendanceStatus.out_source})` : ''}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.locationCard,
            locationVerified && styles.locationCardVerified,
          ]}>
          <View
            style={[
              styles.locationIcon,
              locationVerified && styles.locationIconVerified,
            ]}>
            <MaterialCommunityIcons
              name={locationVerified ? 'map-marker-check' : 'map-marker-radius'}
              size={28}
              color={locationVerified ? colors.success : colors.primary}
            />
          </View>
          <View style={styles.locationText}>
            <Text style={styles.cardTitle}>
              {locationVerified
                ? 'Location captured'
                : 'Verify your location'}
            </Text>
            <Text style={styles.cardDescription}>
              {locationVerified && coords
                ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                : 'Your GPS coordinates will be stored with this punch.'}
            </Text>
          </View>
          {locationVerified ? (
            <MaterialCommunityIcons
              name="check-decagram"
              size={25}
              color={colors.success}
            />
          ) : null}
        </View>

        {!alreadyDone ? (
          <>
            <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
            <Text style={styles.sectionTitle}>Take a live photo</Text>
            <Text style={styles.sectionDescription}>
              Keep your face clearly visible. Gallery uploads are disabled for
              attendance.
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.cameraBox}
              onPress={capturePhoto}>
              {photo ? (
                <>
                  <Image source={{uri: photo}} style={styles.photo} />
                  <View style={styles.retakeBadge}>
                    <MaterialCommunityIcons
                      name="camera-retake-outline"
                      size={18}
                      color={colors.white}
                    />
                    <Text style={styles.retakeText}>Retake</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.faceGuide}>
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={76}
                      color="#9AB1BA"
                    />
                  </View>
                  <View style={styles.cameraAction}>
                    <MaterialCommunityIcons
                      name="camera"
                      size={23}
                      color={colors.white}
                    />
                  </View>
                  <Text style={styles.cameraTitle}>Tap to open camera</Text>
                  <Text style={styles.cameraHint}>Use a well-lit background</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.requirementRow}>
          <Requirement label="Live location" complete={locationVerified} />
          <Requirement label="Face photo" complete={Boolean(photo) || alreadyDone} />
          <Requirement
            label={canPunchOut ? 'Check out' : 'Check in'}
            complete={alreadyDone}
          />
        </View>

        {alreadyDone ? (
          <PrimaryButton
            label="Attendance completed for today"
            icon="check-decagram"
            onPress={() => navigation.goBack()}
          />
        ) : !locationVerified ? (
          <PrimaryButton
            label={
              locationStatus === 'checking'
                ? 'Checking location...'
                : 'Verify location'
            }
            icon="crosshairs-gps"
            onPress={verifyLocation}
            loading={locationStatus === 'checking'}
          />
        ) : (
          <PrimaryButton
            label={loadingStatus ? 'Loading status...' : punchLabel}
            icon={punchIcon}
            onPress={submitAttendance}
            disabled={!photo || loadingStatus || (!canPunchIn && !canPunchOut)}
            loading={submitting || loadingStatus}
          />
        )}
      </ScrollView>
    </View>
  );
}

function Requirement({label, complete}) {
  return (
    <View style={styles.requirement}>
      <MaterialCommunityIcons
        name={complete ? 'check-circle' : 'circle-outline'}
        size={16}
        color={complete ? colors.success : '#9AA8AE'}
      />
      <Text style={styles.requirementText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 30},
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  summaryTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    marginBottom: 6,
  },
  summaryLine: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    ...shadows.card,
  },
  locationCardVerified: {
    backgroundColor: colors.successSoft,
    borderColor: '#BFE9DB',
  },
  locationIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconVerified: {backgroundColor: colors.surface},
  locationText: {flex: 1, marginHorizontal: 13},
  cardTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
  },
  cardDescription: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  stepLabel: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    marginTop: 5,
  },
  sectionDescription: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 18,
  },
  cameraBox: {
    height: 300,
    borderRadius: 25,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#A9BEC6',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  faceGuide: {
    width: 130,
    height: 160,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#C7D5DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraAction: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  cameraTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    marginTop: 10,
  },
  cameraHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
  photo: {width: '100%', height: '100%'},
  retakeBadge: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: 'rgba(15,61,76,0.9)',
  },
  retakeText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  requirement: {flexDirection: 'row', alignItems: 'center', gap: 5},
  requirementText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 10,
  },
});
