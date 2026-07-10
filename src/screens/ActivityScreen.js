import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import {colors, fontFamily} from '../theme';

export default function ActivityScreen() {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Notifications" subtitle="Alerts and updates" />
      <View style={styles.content}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="bell-off-outline" size={32} color="#CBE2E9" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            You're all caught up! Check back later for important alerts and updates.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {flex: 1, paddingHorizontal: 18, justifyContent: 'center'},
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginBottom: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
