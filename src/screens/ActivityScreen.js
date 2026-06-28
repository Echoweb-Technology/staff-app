import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import {colors, fontFamily} from '../theme';

const activities = [
  {
    icon: 'login',
    title: 'Attendance check-in',
    detail: 'VT Central Office · Photo verified',
    time: '09:02 AM',
    color: colors.success,
  },
  {
    icon: 'clipboard-check-outline',
    title: 'Vehicle checklist',
    detail: 'MH 12 AB 4581 · 9 items passed',
    time: '08:48 AM',
    color: '#D97706',
  },
  {
    icon: 'swap-horizontal-bold',
    title: 'Vehicle takeover',
    detail: 'Received from Ravi Kumar',
    time: '08:35 AM',
    color: '#7C5CBA',
  },
];

export default function ActivityScreen() {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Activity" subtitle="Your recent records" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>TODAY · 8 JUNE</Text>
        <View style={styles.card}>
          {activities.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.row,
                index === activities.length - 1 && styles.rowLast,
              ]}>
              <View style={[styles.icon, {backgroundColor: `${item.color}18`}]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={22}
                  color={item.color}
                />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.detail}>{item.detail}</Text>
              </View>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 30},
  date: {
    color: colors.textMuted,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  row: {
    minHeight: 79,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {borderBottomWidth: 0},
  icon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {flex: 1, marginLeft: 11},
  title: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  detail: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 2,
  },
  time: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 9,
  },
});
