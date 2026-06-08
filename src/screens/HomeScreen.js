/**
 * Home / Duty Screen – fetches driver status and shows Start Duty / End Duty.
 * Uses https://vtms.co.in/api/supervisor/driver/status.php
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AwesomeAlert from 'react-native-awesome-alerts';
import { getDriverStatus, getDashboardSlider } from '../services/driverApi';
import { requestLocationPermissionAsync, getCurrentPositionAsync } from '../utils/location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = 56;
  const bottomPadding = Math.max(insets.bottom, 8);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [sliderData, setSliderData] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'upcoming'
  const [selectedBooking, setSelectedBooking] = useState(null);

  const screenWidth = Dimensions.get('window').width;

  // AwesomeAlert state
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    showCancel: true,
    cancelText: 'Cancel / रद्द करें',
    confirmText: 'OK',
    confirmColor: '#34C759',
    onConfirm: () => { },
  });

  const showAlert = (config) => {
    setAlertConfig({ ...alertConfig, showCancel: true, cancelText: 'Cancel / रद्द करें', ...config, visible: true });
  };
  const hideAlert = () => setAlertConfig({ ...alertConfig, visible: false });

  const fetchStatus = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      // Run both API calls concurrently
      const [statusRes, sliderRes] = await Promise.allSettled([
        getDriverStatus(),
        getDashboardSlider()
      ]);

      if (statusRes.status === 'fulfilled') {
        const data = statusRes.value.data ?? statusRes.value;
        setStatus(data);
        if (data.duty_status === 'off_duty') {
          setSelectedBooking(null);
        }
      } else {
        throw new Error(statusRes.reason?.message || 'Failed to load status');
      }

      if (sliderRes.status === 'fulfilled') {
        const sData = sliderRes.value.data ?? sliderRes.value;
        setSliderData(sData);
      } else {
        console.warn('Slider fetch failed:', sliderRes.reason);
        // We don't fail the whole screen if just the slider fails
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') {
        // Token expired, redirect to login
        await AsyncStorage.removeItem('@vtstaff_jwt_token');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }
      setError(e.message || 'Failed to load status');
      setStatus(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus])
  );

  const onRefresh = () => fetchStatus(true);

  const handleLogout = async () => {
    showAlert({
      title: 'Logout / लॉग आउट',
      message: 'Are you sure you want to logout? / क्या आप वाकई लॉग आउट करना चाहते हैं?',
      confirmText: 'Logout / लॉग आउट',
      confirmColor: '#d32f2f',
      onConfirm: async () => {
        hideAlert();
        try {
          await AsyncStorage.removeItem('@vtstaff_jwt_token');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        } catch (e) {
          setTimeout(() => {
            showAlert({
              title: 'Logout Failed / लॉगआउट विफल',
              message: 'An error occurred while logging out. / लॉगआउट करते समय कोई त्रुटि हुई।',
              showCancel: false,
              confirmText: 'OK / ठीक है',
              onConfirm: hideAlert
            });
          }, 500);
        }
      },
    });
  };

  const dutyStatus = status?.duty_status ?? 'off_duty';
  const hasVehicle = status?.has_vehicle ?? false;
  
  // Today's current booking (either monthly or casual)
  const currentBooking = status?.monthly_booking || status?.casual_booking || null;
  const activeBooking = selectedBooking || currentBooking;
  const isMonthly = !!status?.monthly_booking;
  
  // Upcoming bookings
  const upcomingMonthly = status?.upcoming_monthly_booking || [];
  const upcomingCasual = status?.upcoming_casual_booking || [];
  const hasUpcoming = upcomingMonthly.length > 0 || upcomingCasual.length > 0;

  const duration = status?.duration ?? 0;
  const vehicleDetails = status?.vehicle_details ?? null;

  const handoverImage = sliderData?.handover?.front_image;
  const driverInfo = sliderData?.driver;

  // Conditionally build slides array
  const slides = [];
  if (handoverImage) {
    slides.push({ type: 'handover' });
  }
  if (driverInfo) {
    slides.push({ type: 'driver' });
  }

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setActiveSlide(index);
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleSelectBooking = (item) => {
    setSelectedBooking(item);
    setActiveTab('home');
    showAlert({
      title: 'Booking Selected / बुकिंग चुनी गई',
      message: `You have selected ${item.booking_id}. You can now start duty. / आपने ${item.booking_id} को चुना है। अब आप ड्यूटी शुरू कर सकते हैं।`,
      showCancel: false,
      confirmText: 'OK / ठीक है',
      onConfirm: hideAlert,
    });
  };

  const handleStartDuty = () => {
    if (!hasVehicle) {
      showAlert({
        title: 'Cannot start duty / ड्यूटी शुरू नहीं कर सकते',
        message: 'No vehicle assigned. Please contact operations. / कोई वाहन नहीं दिया गया है। कृपया संचालन (ऑपरेशंस) से संपर्क करें।',
        showCancel: false,
        confirmText: 'OK / ठीक है',
        onConfirm: hideAlert
      });
      return;
    }

    if (!activeBooking) {
      showAlert({
        title: 'No Booking / कोई बुकिंग नहीं',
        message: 'You cannot start duty because you have no booking assigned for today. / आप ड्यूटी शुरू नहीं कर सकते क्योंकि आपके पास आज के लिए कोई बुकिंग नहीं है।',
        showCancel: false,
        confirmText: 'OK / ठीक है',
        onConfirm: hideAlert
      });
      return;
    }

    showAlert({
      title: 'Start Duty / ड्यूटी शुरू करें',
      message: 'Are you sure you want to start duty? You will need to take a photo. / क्या आप वाकई ड्यूटी शुरू करना चाहते हैं? आपको एक फोटो लेनी होगी।',
      confirmText: 'Yes, Start / हाँ, शुरू करें',
      confirmColor: '#34C759',
      onConfirm: async () => {
        hideAlert();
        setTimeout(async () => {
          try {
            const hasPermission = await requestLocationPermissionAsync();
            if (!hasPermission) {
              showAlert({
                title: 'Location required / लोकेशन आवश्यक है',
                message: 'Location permission denied. Please allow location access to start duty. / ड्यूटी शुरू करने के लिए स्थान की अनुमति आवश्यक है।',
                showCancel: false,
                confirmText: 'OK / ठीक है',
                onConfirm: hideAlert
              });
              return;
            }
            const coords = await getCurrentPositionAsync();
            navigation.navigate('StartDuty', {
              bookingId: activeBooking?.booking_id || '',
              userName: activeBooking?.user_name || '',
              userPhoneNo: String(activeBooking?.user_phone ?? ''),
              startLatitude: String(coords.latitude),
              startLongitude: String(coords.longitude),
            });
          } catch (e) {
            showAlert({
              title: 'Location required / लोकेशन आवश्यक है',
              message: e.message || 'Please enable location and try again. / कृपया लोकेशन सक्षम करें और पुनः प्रयास करें।',
              showCancel: false,
              confirmText: 'OK / ठीक है',
              onConfirm: hideAlert
            });
          }
        }, 500);
      }
    });
  };

  const handleEndDuty = () => {
    showAlert({
      title: 'End Duty / ड्यूटी समाप्त करें',
      message: 'Are you sure you want to end duty? You will need to take a photo. / क्या आप वाकई ड्यूटी समाप्त करना चाहते हैं? आपको एक फोटो लेनी होगी।',
      confirmText: 'Yes, End / हाँ, समाप्त करें',
      confirmColor: '#FF3B30',
      onConfirm: async () => {
        hideAlert();
        setTimeout(async () => {
          try {
            const hasPermission = await requestLocationPermissionAsync();
            if (!hasPermission) {
              showAlert({
                title: 'Location required / लोकेशन आवश्यक है',
                message: 'Location permission denied. Please allow location access to end duty. / ड्यूटी समाप्त करने के लिए स्थान की अनुमति आवश्यक है।',
                showCancel: false,
                confirmText: 'OK / ठीक है',
                onConfirm: hideAlert
              });
              return;
            }
            const coords = await getCurrentPositionAsync();
            navigation.navigate('EndDuty', {
              endLatitude: String(coords.latitude),
              endLongitude: String(coords.longitude),
            });
            console.log('coords', coords);
          } catch (e) {
            showAlert({
              title: 'Location required / लोकेशन आवश्यक है',
              message: e.message || 'Please enable location and try again. / कृपया लोकेशन चालू करें और पुनः प्रयास करें।',
              showCancel: false,
              confirmText: 'OK / ठीक है',
              onConfirm: hideAlert
            });
          }
        }, 500);
      }
    });
  };

  const handleAddFuel = () => {
    if (!hasVehicle) {
      showAlert({
        title: 'Cannot Add Fuel / ईंधन नहीं भर सकते',
        message: 'No vehicle assigned. Please contact operations. / कोई वाहन नहीं दिया गया है। कृपया संचालन (ऑपरेशंस) से संपर्क करें।',
        showCancel: false,
        confirmText: 'OK / ठीक है',
        onConfirm: hideAlert
      });
      return;
    }

    // From PHP logic, we need to pass previous odometer reading
    // Let's assume duration/book status might have it, or we just pass 0 for now
    // In a real app the API would provide the `prev_odo` from vehicle_details
    navigation.navigate('AddFuel', {
      bookingId: activeBooking?.booking_id || '',
      vehicleRegistration: driverInfo?.assigned_vehicle || vehicleDetails?.registration || '',
      vehicleFuelType: driverInfo?.fuel_type || vehicleDetails?.vehicle_fuel_type || '',
      prevOdometerReading: vehicleDetails?.prev_odo || 0,
    });
  };

  if (loading && !status) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color="#34C759" />
        <Text style={styles.loadingText}>Loading... / कृपया प्रतीक्षा करें...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>VT</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout / लॉग आउट</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'home' ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: bottomNavHeight + bottomPadding + 12 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#34C759']} />
          }
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {slides.length > 0 && (
            <View style={styles.sliderContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {slides.map((slide, index) => {
                  if (slide.type === 'handover') {
                    return (
                      <View key={index} style={[styles.slideCard, { width: screenWidth - 32 }]}>
                        <Image
                          source={{ uri: handoverImage }}
                          style={styles.bannerImage}
                          resizeMode="cover"
                        />
                      </View>
                    );
                  } else if (slide.type === 'driver') {
                    const isActive = driverInfo.status === 'Active';
                    return (
                      <View key={index} style={[styles.slideCard, styles.driverCard, { width: screenWidth - 32 }]}>
                        {driverInfo.driver_image ? (
                          <Image source={{ uri: driverInfo.driver_image }} style={styles.driverImage} />
                        ) : (
                          <View style={styles.driverImagePlaceholder}>
                            <Text style={styles.driverInitials}>
                              {(driverInfo.driver_name || 'D')[0]}
                            </Text>
                          </View>
                        )}

                        <View style={styles.driverDetails}>
                          <Text style={styles.driverName}>
                            {driverInfo.driver_name || 'Unknown'}
                            {driverInfo.driver_code ? ` (${driverInfo.driver_code})` : ''}
                          </Text>
                          <Text style={styles.driverVehicle}>
                            Vehicle (वाहन): {driverInfo.assigned_vehicle || 'None'}
                          </Text>
                          <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                            <Text style={styles.statusBadgeText}>{driverInfo.status || 'Unknown'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })}
              </ScrollView>

              <View style={styles.bannerDots}>
                {slides.map((_, i) => (
                  <View key={i} style={[styles.dot, activeSlide === i && styles.dotActive]} />
                ))}
              </View>
            </View>
          )}

          {/* Today's Booking Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today Current Booking / आज की बुकिंग</Text>
          </View>

          {activeBooking ? (
            <View style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingTitle}>
                  {selectedBooking ? 'Selected Booking / चुनी हुई बुकिंग' : 'Booking Assigned / बुकिंग मिल गई'}
                </Text>
                {activeBooking.user_phone ? (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => Linking.openURL(`tel:${activeBooking.user_phone}`)}
                  >
                    <Text style={styles.callButtonText}>📞 Call / कॉल करें</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.bookingRow}>ID (आईडी): {activeBooking.booking_id}</Text>
              <Text style={styles.bookingRow}>User (यूज़र): {activeBooking.user_name || '–'}</Text>
              <Text style={styles.bookingRow}>Type (प्रकार): {activeBooking.bookingType === 'monthly' || isMonthly ? 'Monthly (मासिक)' : 'Casual (कैजुअल)'}</Text>
              {vehicleDetails?.registration && (
                <Text style={styles.bookingRow}>Vehicle (वाहन): {vehicleDetails.registration}</Text>
              )}
              {selectedBooking && (
                <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                  <Text style={{ color: '#007AFF', marginTop: 8, fontWeight: '600' }}>Reset Selection / चयन हटाएँ</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.bookingCard}>
              <Text style={styles.bookingTitle}>No Booking Assigned / कोई बुकिंग नहीं मिली</Text>
              <Text style={[styles.hintText, { color: '#d32f2f', fontWeight: '600' }]}>Duty cannot be started without a booking. / बिना बुकिंग के ड्यूटी शुरू नहीं की जा सकती।</Text>
              {vehicleDetails?.registration && (
                <Text style={styles.bookingRow}>Vehicle (वाहन): {vehicleDetails.registration}</Text>
              )}
            </View>
          )}

          {/* Duty Section */}
          {dutyStatus === 'off_duty' ? (
            <View style={styles.dutyRow}>
              <TouchableOpacity
                style={[
                  styles.dutyButton,
                  styles.startDuty,
                  (!hasVehicle || !activeBooking) && styles.dutyButtonDisabled,
                ]}
                onPress={handleStartDuty}
                disabled={!hasVehicle || !activeBooking}
                activeOpacity={0.8}
              >
                <Text style={styles.dutyText}>Start Duty / ड्यूटी शुरू करें</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dutyRow}>
              <TouchableOpacity
                style={[
                  styles.dutyButton,
                  styles.endDuty,
                ]}
                onPress={handleEndDuty}
                activeOpacity={0.8}
              >
                <Text style={styles.dutyText}>End Duty / ड्यूटी समाप्त करें</Text>
              </TouchableOpacity>
            </View>
          )}

          {!hasVehicle && (
            <Text style={styles.hintText}>No vehicle assigned. Start duty is disabled. / कोई वाहन नहीं दिया गया है। ड्यूटी शुरू करना बंद है।</Text>
          )}
          {dutyStatus === 'on_duty' && (
            <Text style={styles.durationText}>On duty (ड्यूटी पर): {formatDuration(duration)}</Text>
          )}

          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={handleAddFuel}>
            <View style={styles.cardIconCircle}>
              <Text style={styles.cardIconText}>⛽</Text>
            </View>
            <Text style={styles.cardTitle}>Add Fuel / ईंधन भरें</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: bottomNavHeight + bottomPadding + 12 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#34C759']} />
          }
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Bookings / आगामी बुकिंग</Text>
          </View>

          {!hasUpcoming ? (
            <View style={styles.emptyUpcoming}>
              <Text style={styles.emptyText}>No upcoming bookings found. / कोई आगामी बुकिंग नहीं मिली।</Text>
            </View>
          ) : (
            <>
              {[
                ...upcomingMonthly.map(item => ({ ...item, bookingType: 'monthly' })),
                ...upcomingCasual.map(item => ({ ...item, bookingType: 'casual', date: item.date_from })),
              ]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map((item, index) => {
                  // Robust Today Date Check (Matching Asia/Kolkata)
                  const now = new Date();
                  const offset = now.getTimezoneOffset() * 60000;
                  const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 10);
                  
                  // Extract only the date part in case there's a timestamp (e.g. "2026-05-06 09:00:00")
                  const bookingDateOnly = item.date ? item.date.split(' ')[0] : '';
                  const isToday = bookingDateOnly === localISOTime;
                  
                  // Debug log
                  console.log(`Booking ${item.booking_id}: RawDate=${item.date}, ExtractedDate=${bookingDateOnly}, LocalToday=${localISOTime}, isToday=${isToday}`);

                  return (
                    <TouchableOpacity
                      key={`${item.bookingType}-${index}`}
                      activeOpacity={isToday ? 0.7 : 1}
                      onPress={() => isToday && handleSelectBooking(item)}
                      style={[
                        styles.upcomingCard,
                        item.bookingType === 'casual' && styles.casualCard,
                        isToday && { borderColor: '#34C759', borderWidth: 2 },
                      ]}
                    >
                      <View style={[
                        styles.upcomingBadge,
                        item.bookingType === 'casual' && styles.casualBadge
                      ]}>
                        <Text style={styles.upcomingBadgeText}>
                          {item.bookingType === 'monthly' ? 'Monthly (मासिक)' : 'Casual (कैजुअल)'}
                        </Text>
                      </View>
                      {isToday && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>TODAY / आज</Text>
                        </View>
                      )}
                      <Text style={styles.upcomingDate}>{item.date || item.date_from}</Text>
                      <Text style={styles.upcomingRow}>ID: {item.booking_id}</Text>
                      <Text style={styles.upcomingRow}>Vehicle: {item.vehicle}</Text>
                      {item.user_phone ? <Text style={styles.upcomingRow}>Phone: {item.user_phone}</Text> : null}
                      
                      {isToday && (
                        <Text style={styles.selectHint}>Tap to select for duty / ड्यूटी के लिए चुनने को दबाएँ</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </>
          )}
        </ScrollView>
      )}

      <View style={[styles.bottomNav, { paddingBottom: bottomPadding }]}>
        <View style={styles.bottomNavInner}>
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.8}
            onPress={() => setActiveTab('home')}
          >
            <Text style={[styles.navIcon, activeTab === 'home' && styles.navIconActive]}>⌂</Text>
            <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>HOME / होम</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.8}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.navIcon, activeTab === 'upcoming' && styles.navIconActive]}>📅</Text>
            <Text style={[styles.navLabel, activeTab === 'upcoming' && styles.navLabelActive]}>UPCOMING / आगामी</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AwesomeAlert
        show={alertConfig.visible}
        showProgress={false}
        title={alertConfig.title}
        message={alertConfig.message}
        closeOnTouchOutside={true}
        closeOnHardwareBackPress={false}
        showCancelButton={alertConfig.showCancel}
        showConfirmButton={true}
        cancelText={alertConfig.cancelText}
        confirmText={alertConfig.confirmText}
        confirmButtonColor={alertConfig.confirmColor}
        onCancelPressed={hideAlert}
        onConfirmPressed={alertConfig.onConfirm}
        titleStyle={styles.alertTitle}
        messageStyle={styles.alertMessage}
        cancelButtonTextStyle={styles.alertCancelText}
        confirmButtonTextStyle={styles.alertConfirmText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e53935',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffeaeb',
    borderRadius: 6,
  },
  logoutText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  slideCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 180,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  driverImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  driverImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  driverDetails: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
  },
  statusInactive: {
    backgroundColor: '#ffebee',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffb300',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  callButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingRow: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  dutyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dutyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dutyButtonDisabled: {
    opacity: 0.5,
  },
  startDuty: {
    backgroundColor: '#34C759',
    marginRight: 8,
  },
  endDuty: {
    backgroundColor: '#FF3B30',
    marginLeft: 8,
  },
  dutyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  durationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardIconText: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  bottomNavInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    color: '#999999',
    marginBottom: 2,
  },
  navIconActive: {
    color: '#007AFF',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#999999',
  },
  navLabelActive: {
    color: '#007AFF',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  alertCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  emptyUpcoming: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  upcomingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  casualCard: {
    borderColor: '#e3f2fd',
  },
  upcomingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  casualBadge: {
    backgroundColor: '#E3F2FD',
  },
  upcomingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D32',
    textTransform: 'uppercase',
  },
  todayBadge: {
    position: 'absolute',
    top: 30,
    right: 10,
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  selectHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#34C759',
    fontWeight: '700',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  upcomingDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
});
