import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getAttendanceStatus, getStoredStaffUser, getPermissions} from '../services/staffApi';
import {colors, fontFamily, shadows} from '../theme';

const baseModules = [
  {
    title: 'Photo Attendance',
    subtitle: 'Face photo with live location',
    icon: 'camera-account',
    color: colors.primary,
    soft: colors.primarySoft,
    route: 'Attendance',
    status: 'Mark now',
  },
  {
    title: 'Handover / Takeover',
    subtitle: 'Transfer vehicle responsibility',
    icon: 'swap-horizontal-bold',
    color: '#7C5CBA',
    soft: '#F0ECFA',
    route: 'Handover',
    status: '1 pending',
  },
  {
    title: 'Vehicle Checklist',
    subtitle: 'Inspect condition and safety',
    icon: 'clipboard-check-outline',
    color: '#D97706',
    soft: colors.accentSoft,
    route: 'Checklist',
    status: 'Due today',
  },
];

function formatTime(value) {
  if (!value) {
    return '--';
  }

  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGreetingByTime(date) {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  if (hour < 21) {
    return 'Good evening';
  }

  return 'Good night';
}

function getFirstName(name) {
  if (!name) {
    return 'there';
  }

  return String(name).trim().split(/\s+/)[0];
}

function buildAttendanceCard(attendanceStatus) {
  if (!attendanceStatus) {
    return {
      badge: 'Today',
      title: 'Loading your day summary',
      description: 'Checking your attendance state for today.',
      chipLabel: 'Syncing',
      chipStyle: 'neutral',
      actionLabel: 'Open attendance',
      actionIcon: 'camera-outline',
      moduleStatus: 'Syncing status',
    };
  }

  if (attendanceStatus.checked_out) {
    return {
      badge: 'Attendance complete',
      title: 'You have finished today',
      description: `Checked in at ${formatTime(
        attendanceStatus.in_time,
      )} and checked out at ${formatTime(attendanceStatus.out_time)}.`,
      chipLabel: 'Completed',
      chipStyle: 'success',
      actionLabel: 'View attendance',
      actionIcon: 'clipboard-text-clock-outline',
      moduleStatus: 'Completed today',
    };
  }

  if (attendanceStatus.can_punch_out) {
    return {
      badge: 'On duty',
      title: `Checked in at ${formatTime(attendanceStatus.in_time)}`,
      description:
        'Your workday is active. Use check out when you are ready to end the shift.',
      chipLabel: 'Checked in',
      chipStyle: 'success',
      actionLabel: 'Check out now',
      actionIcon: 'logout',
      moduleStatus: 'Check out pending',
    };
  }

  return {
    badge: 'Ready to start',
    title: 'Mark your check in',
    description:
      'Capture live location and a quick selfie to start attendance for today.',
    chipLabel: 'Pending',
    chipStyle: 'warning',
    actionLabel: 'Check in now',
    actionIcon: 'login',
    moduleStatus: 'Ready to mark',
  };
}

export default function DashboardScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [workingStatus, setWorkingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const greeting = getGreetingByTime(now);
  const firstName = getFirstName(user?.name);
  const attendanceCard = useMemo(
    () => buildAttendanceCard(attendanceStatus),
    [attendanceStatus],
  );
  const modules = useMemo(() => {
    let list = baseModules;
    if (permissions) {
      list = list.filter(m => {
        if (m.route === 'Checklist' && !permissions.checklist) return false;
        if (m.route === 'Handover' && !permissions.handover) return false;
        if (m.route === 'Attendance' && !permissions.attendance) return false;
        return true;
      });
    }
    return list.map(module =>
      module.route === 'Attendance'
        ? {...module, status: attendanceCard.moduleStatus}
        : module,
    );
  }, [attendanceCard.moduleStatus, permissions]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [storedUser, response, permsRes] = await Promise.all([
        getStoredStaffUser(),
        getAttendanceStatus(),
        getPermissions().catch(() => ({ permissions: {} })),
      ]);

      setUser(storedUser);
      setAttendanceStatus(response.data ?? null);
      setPermissions(permsRes?.permissions ?? {});
      setWorkingStatus(permsRes?.working_status ?? null);
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        setLoadError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  if (workingStatus === 'INACTIVE') {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <MaterialCommunityIcons name="account-cancel" size={64} color={colors.danger} />
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 24, color: colors.text, marginTop: 20 }}>Account Inactive</Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: 10 }}>
          Oops you are inactive now. Please contact your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, {paddingTop: insets.top + 14}]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>{date}</Text>
            <Text style={styles.greeting}>{`${greeting}, ${firstName}`}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={24}
              color={colors.text}
            />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {(!permissions || permissions.attendance) && (
          <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{attendanceCard.badge}</Text>
            </View>
            <View
              style={[
                styles.heroChip,
                attendanceCard.chipStyle === 'success' && styles.heroChipSuccess,
                attendanceCard.chipStyle === 'warning' && styles.heroChipWarning,
              ]}>
              <View
                style={[
                  styles.heroChipDot,
                  attendanceCard.chipStyle === 'success' &&
                    styles.heroChipDotSuccess,
                  attendanceCard.chipStyle === 'warning' &&
                    styles.heroChipDotWarning,
                ]}
              />
              <Text style={styles.heroChipText}>{attendanceCard.chipLabel}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{attendanceCard.title}</Text>
          <Text style={styles.heroDescription}>{attendanceCard.description}</Text>

          {loading ? (
            <View style={styles.heroLoading}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.heroLoadingText}>Refreshing attendance</Text>
            </View>
          ) : (
            <View style={styles.heroStatsRow}>
              <SummaryStat label="Check in" value={formatTime(attendanceStatus?.in_time)} />
              <SummaryStat
                label="Check out"
                value={formatTime(attendanceStatus?.out_time)}
              />
              <SummaryStat
                label="Status"
                value={attendanceStatus?.status || attendanceCard.chipLabel}
              />
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.heroAction}
            onPress={() => navigation.navigate('Attendance')}>
            <View style={styles.heroActionIcon}>
              <MaterialCommunityIcons
                name={attendanceCard.actionIcon}
                size={18}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.heroActionText}>{attendanceCard.actionLabel}</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.primaryDark}
            />
          </TouchableOpacity>

          <View style={styles.heroFooter}>
            <MaterialCommunityIcons
              name={loadError ? 'alert-circle-outline' : 'map-marker-radius'}
              size={15}
              color={loadError ? '#FFD8D8' : '#CBE2E9'}
            />
            <Text style={styles.heroFooterText}>
              {loadError ||
                'Attendance uses live location and updates automatically after each punch.'}
            </Text>
          </View>
        </View>
        )}

        {modules.length > 0 && (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Staff operations</Text>
          </View>
        )}

        {modules.map(module => (
          <TouchableOpacity
            key={module.title}
            activeOpacity={0.85}
            style={styles.moduleCard}
            onPress={() => navigation.navigate(module.route)}>
            <View style={[styles.moduleIcon, {backgroundColor: module.soft}]}>
              <MaterialCommunityIcons
                name={module.icon}
                size={27}
                color={module.color}
              />
            </View>
            <View style={styles.moduleContent}>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
              <Text style={[styles.moduleStatus, {color: module.color}]}>
                {module.status}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={25}
              color="#A4B0B5"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function SummaryStat({label, value}) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value || '--'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 28},
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  greeting: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 22,
    marginTop: 3,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.primaryDark,
    marginBottom: 26,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 23,
    marginTop: 16,
  },
  heroDescription: {
    color: '#CBE2E9',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  heroChipSuccess: {
    backgroundColor: 'rgba(94,227,177,0.16)',
  },
  heroChipWarning: {
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  heroChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBE2E9',
  },
  heroChipDotSuccess: {
    backgroundColor: '#5EE3B1',
  },
  heroChipDotWarning: {
    backgroundColor: colors.accent,
  },
  heroChipText: {
    color: colors.white,
    fontFamily: fontFamily.medium,
    fontSize: 11,
  },
  heroLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },
  heroLoadingText: {
    color: '#CBE2E9',
    fontFamily: fontFamily.medium,
    fontSize: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    gap: 10,
  },
  heroStat: {
    flex: 1,
    minHeight: 70,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroStatLabel: {
    color: '#AFCBD3',
    fontFamily: fontFamily.regular,
    fontSize: 10,
  },
  heroStatValue: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    marginTop: 6,
  },
  heroAction: {
    minHeight: 54,
    borderRadius: 17,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  heroActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionText: {
    flex: 1,
    color: colors.primaryDark,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    marginLeft: 12,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  heroFooterText: {
    flex: 1,
    color: '#CBE2E9',
    fontFamily: fontFamily.regular,
    fontSize: 10,
    lineHeight: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
  },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
  },
  moduleCard: {
    minHeight: 108,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleContent: {flex: 1, marginLeft: 14},
  moduleTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },
  moduleSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
  moduleStatus: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    marginTop: 7,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    padding: 15,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F7E5B7',
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTextWrap: {flex: 1, marginLeft: 12},
  noticeTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  noticeText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
});
