import React, {useCallback, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import {
  clearStoredStaffSession,
  getStoredStaffUser,
} from '../services/staffApi';
import {colors, fontFamily, shadows} from '../theme';

const menu = [
  ['account-outline', 'Personal details'],
  ['clock-outline', 'Shift and attendance'],
  ['map-marker-outline', 'Assigned workplace'],
  ['help-circle-outline', 'Help and support'],
];

export default function ProfileScreen({navigation}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const storedUser = await getStoredStaffUser();
      setUser(storedUser);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser]),
  );

  const initials = (user?.name || 'VT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  const roleLine = [user?.type || 'Staff member', user?.code || '']
    .filter(Boolean)
    .join(' · ');

  const logout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await clearStoredStaffSession();
          navigation.getParent()?.reset({index: 0, routes: [{name: 'Login'}]});
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" subtitle="Staff account" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'VT'}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null}
          <Text style={styles.name}>{user?.name || 'Staff member'}</Text>
          <Text style={styles.role}>{roleLine || 'VT Staff'}</Text>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active employee</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menu.map(([icon, label], index) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.menuRow,
                index === menu.length - 1 && styles.last,
              ]}>
              <View style={styles.menuIcon}>
                <MaterialCommunityIcons
                  name={icon}
                  size={21}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.menuLabel}>{label}</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color="#A1AFB4"
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logout} onPress={logout}>
          <MaterialCommunityIcons
            name="logout"
            size={21}
            color={colors.danger}
          />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>VT Staff · Version 1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 30},
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 24,
    ...shadows.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  avatarText: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontSize: 25,
  },
  loader: {
    marginTop: 14,
    marginBottom: -2,
  },
  name: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 19,
    marginTop: 12,
  },
  role: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 3,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeText: {
    color: colors.success,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginTop: 20,
  },
  menuRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  last: {borderBottomWidth: 0},
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  menuLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginLeft: 11,
  },
  logout: {
    height: 54,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    marginTop: 20,
  },
  logoutText: {
    color: colors.danger,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  version: {
    color: '#A0ADB2',
    fontFamily: fontFamily.regular,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 15,
  },
});
