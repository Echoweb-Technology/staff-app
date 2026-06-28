import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import CustomAlert from '../components/CustomAlert';
import {getChecklistSummary} from '../services/checklistApi';
import {colors, fontFamily, shadows} from '../theme';

export default function ChecklistSummaryScreen({navigation}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [expandedSup, setExpandedSup] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getChecklistSummary();
      setData(res.data);
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        setAlertConfig({
          visible: true,
          title: 'Unable to load summary',
          message: error.message,
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  const toggleExpand = empId => {
    setExpandedSup(prev => (prev === empId ? null : empId));
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Checklist Summary"
          subtitle="Manager overview"
          navigation={navigation}
        />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading summary...</Text>
        </View>
      </View>
    );
  }

  const summary = data?.summary;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Checklist Summary"
        subtitle={
          data?.manager_name
            ? `${data.manager_name} — ${data.summary?.total_inspected || 0} of ${data.summary?.total_vehicles || 0} inspected`
            : 'Manager overview'
        }
        navigation={navigation}
      />
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Overall stats */}
        {summary && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statTotal]}>
              <Text style={styles.statNumber}>{summary.total_vehicles}</Text>
              <Text style={styles.statLabel}>Total vehicles</Text>
            </View>
            <View style={[styles.statCard, styles.statDone]}>
              <Text style={styles.statNumber}>{summary.total_inspected}</Text>
              <Text style={styles.statLabel}>Inspected</Text>
            </View>
            <View style={[styles.statCard, styles.statPending]}>
              <Text style={styles.statNumber}>{summary.total_pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        )}

        {summary && summary.total_vehicles > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Completion</Text>
              <Text style={styles.progressPercent}>
                {summary.completion_percent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {width: `${summary.completion_percent}%`},
                  summary.completion_percent === 100 &&
                    styles.progressFillDone,
                ]}
              />
            </View>
          </View>
        )}

        {!data?.supervisors || data.supervisors.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={48}
              color={colors.border}
            />
            <Text style={styles.emptyText}>No supervisor data found</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Supervisors</Text>
            {data.supervisors.map(sup => {
              const isExpanded = expandedSup === sup.emp_id;
              return (
                <View key={sup.emp_id} style={styles.supCard}>
                  <TouchableOpacity
                    style={styles.supHeader}
                    onPress={() => toggleExpand(sup.emp_id)}
                    activeOpacity={0.7}>
                    <View style={styles.supInfo}>
                      <View style={styles.supIcon}>
                        <MaterialCommunityIcons
                          name="account-tie"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.supName}>{sup.name}</Text>
                        <Text style={styles.supMeta}>
                          {sup.inspected_count} of {sup.total_vehicles} vehicles
                        </Text>
                      </View>
                    </View>
                    <View style={styles.supStats}>
                      <View
                        style={[
                          styles.supBadge,
                          sup.pending_count === 0
                            ? styles.supBadgeDone
                            : styles.supBadgePending,
                        ]}>
                        <Text
                          style={[
                            styles.supBadgeText,
                            sup.pending_count === 0
                              ? styles.supBadgeTextDone
                              : styles.supBadgeTextPending,
                          ]}>
                          {sup.pending_count === 0
                            ? 'Complete'
                            : `${sup.pending_count} left`}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.supDetails}>
                      {sup.inspected_vehicles &&
                      sup.inspected_vehicles.length > 0 ? (
                        sup.inspected_vehicles.map((v, idx) => (
                          <View
                            key={`${v.vehicle_reg}_${idx}`}
                            style={styles.inspectedRow}>
                            <MaterialCommunityIcons
                              name={
                                v.overall_status === 'pass'
                                  ? 'check-circle'
                                  : 'alert-circle'
                              }
                              size={18}
                              color={
                                v.overall_status === 'pass'
                                  ? colors.success
                                  : colors.danger
                              }
                            />
                            <View style={styles.inspectedInfo}>
                              <Text style={styles.inspectedReg}>
                                {v.vehicle_reg}
                              </Text>
                              {v.driver_name ? (
                                <Text style={styles.inspectedDriver}>
                                  {v.driver_name}
                                </Text>
                              ) : null}
                            </View>
                            <Text
                              style={[
                                styles.inspectedStatus,
                                v.overall_status === 'pass'
                                  ? styles.inspectedStatusPass
                                  : styles.inspectedStatusFail,
                              ]}>
                              {v.overall_status === 'pass' ? 'Pass' : 'Fail'}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noDataText}>
                          No inspections done yet
                        </Text>
                      )}

                      {sup.pending_count > 0 && (
                        <View style={styles.pendingRow}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={18}
                            color={colors.textMuted}
                          />
                          <Text style={styles.pendingText}>
                            {sup.pending_count} vehicle(s) pending inspection
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 32},
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    marginBottom: 12,
  },
  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  statTotal: {backgroundColor: colors.primaryDark},
  statDone: {backgroundColor: colors.success},
  statPending: {backgroundColor: colors.accent},
  statNumber: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 28,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.medium,
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /* Progress */
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  progressPercent: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
    fontSize: 18,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E6EDF0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  progressFillDone: {backgroundColor: colors.success},
  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  /* Supervisor cards */
  supCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadows.card,
  },
  supHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  supInfo: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  supIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supName: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  supMeta: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 1,
  },
  supStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  supBadgeDone: {
    backgroundColor: colors.successSoft,
  },
  supBadgePending: {
    backgroundColor: colors.accentSoft,
  },
  supBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },
  supBadgeTextDone: {color: colors.success},
  supBadgeTextPending: {color: colors.accent},
  /* Expanded details */
  supDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
    gap: 8,
  },
  inspectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  inspectedInfo: {flex: 1},
  inspectedReg: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 12,
  },
  inspectedDriver: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 1,
  },
  inspectedStatus: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
  },
  inspectedStatusPass: {color: colors.success},
  inspectedStatusFail: {color: colors.danger},
  noDataText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pendingText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
  },
});
