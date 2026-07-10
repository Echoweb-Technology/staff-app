import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import CustomAlert from '../components/CustomAlert';
import {getChecklistDetails} from '../services/checklistApi';
import {colors, fontFamily, shadows} from '../theme';

const ITEMS = [
  {key: 'document_folder', label: 'Document Folder', type: 'yesno'},
  {key: 'car_body_inner', label: 'Car Body Position (Inner)', type: 'yesno'},
  {key: 'car_body_outer', label: 'Car Body Position (Outer)', type: 'yesno'},
  {key: 'driver_behavior', label: 'Driver Behavior', type: 'behavior'},
  {key: 'driver_uniform', label: 'Driver Uniform', type: 'yesno'},
  {key: 'first_aid_box', label: 'First Aid Box', type: 'yesno'},
  {key: 'fire_extinguisher', label: 'Fire Extinguisher', type: 'yesno'},
  {key: 'torch', label: 'Torch', type: 'yesno'},
  {key: 'umbrella', label: 'Umbrella', type: 'yesno'},
  {key: 'seat_cover', label: 'Seat Cover', type: 'yesno'},
  {key: 'gps', label: 'GPS', type: 'yesno'},
  {key: 'extra_tyre', label: 'Extra Tyre', type: 'yesno'},
  {key: 'vehicle_tool_kit', label: 'Vehicle Tool Kit', type: 'yesno'},
  {key: 'dnd_tag', label: 'DND Tag', type: 'yesno'},
  {key: 'head_rest', label: 'Head Rest', type: 'yesno'},
  {key: 'napkin_box', label: 'Napkin Box', type: 'yesno'},
  {key: 'car_perfume', label: 'Car Perfume', type: 'yesno'},
  {key: 'car_charger', label: 'Car Charger', type: 'yesno'},
];

const IMAGE_BASE_URL = 'https://vtms.co.in/api/';

const PHOTO_KEYS = [
  { key: 'outer_front', label: 'Outer Front' },
  { key: 'outer_back', label: 'Outer Back' },
  { key: 'outer_left', label: 'Outer Left' },
  { key: 'outer_right', label: 'Outer Right' },
  { key: 'inner_front', label: 'Inner Front' },
  { key: 'inner_back', label: 'Inner Back' },
];

export default function ChecklistDetailsScreen({navigation, route}) {
  const {vehicle} = route.params;
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getChecklistDetails(vehicle.registration);
      setDetails(res.data);
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        setAlertConfig({
          visible: true,
          title: 'Unable to load details',
          message: error.message,
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [vehicle.registration]);

  const itemImages = useMemo(() => {
    if (!details?.item_images) return {};
    try {
      return typeof details.item_images === 'string'
        ? JSON.parse(details.item_images)
        : details.item_images;
    } catch (e) {
      return {};
    }
  }, [details]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Inspection Details"
          subtitle={vehicle.registration}
          navigation={navigation}
        />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Inspection Details"
          subtitle={vehicle.registration}
          navigation={navigation}
        />
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        />
        <View style={styles.centerWrap}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No details found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Inspection Details"
        subtitle={`${vehicle.registration} • ${details.inspection_date}`}
        navigation={navigation}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.banner, details.overall_status === 'pass' ? styles.bannerPass : styles.bannerFail]}>
          <View style={styles.bannerIcon}>
            <MaterialCommunityIcons
              name={details.overall_status === 'pass' ? 'check-circle' : 'alert-circle'}
              size={32}
              color={colors.white}
            />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>
              Inspection {details.overall_status === 'pass' ? 'Passed' : 'Failed'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              Inspected on {new Date(details.created_at).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Checklist Items</Text>
          {ITEMS.map((item, idx) => {
            const val = details[item.key];
            const isLast = idx === ITEMS.length - 1;
            const remark = details.remarks ? details.remarks[item.key] : null;

            return (
              <View key={item.key} style={[styles.itemRow, isLast && styles.itemRowLast]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {val === 'yes' || val === 'good' ? (
                    <View style={[styles.badge, styles.badgePass]}>
                      <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                      <Text style={[styles.badgeText, { color: colors.success }]}>
                        {val === 'yes' ? 'Yes' : 'Good'}
                      </Text>
                    </View>
                  ) : val === 'no' || val === 'poor' ? (
                    <View style={[styles.badge, styles.badgeFail]}>
                      <MaterialCommunityIcons name="close-circle" size={14} color={colors.danger} />
                      <Text style={[styles.badgeText, { color: colors.danger }]}>
                        {val === 'no' ? 'No' : 'Poor'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeWarn]}>
                      <MaterialCommunityIcons name="alert-circle" size={14} color={colors.accent} />
                      <Text style={[styles.badgeText, { color: colors.accent }]}>Average</Text>
                    </View>
                  )}
                </View>
                {remark ? (
                  <Text style={styles.itemRemark}>Remark: {remark}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Vehicle Photos */}
        <View style={[styles.listCard, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Vehicle Photos</Text>
          <View style={styles.photoGrid}>
            {PHOTO_KEYS.map(photo => {
              const relPath = itemImages[photo.key];
              const uri = relPath ? (relPath.startsWith('http') ? relPath : IMAGE_BASE_URL + relPath) : null;
              return (
                <View key={photo.key} style={styles.photoBox}>
                  <View style={styles.photoBoxBtn}>
                    {uri ? (
                      <Image source={{uri}} style={styles.photoBoxImg} />
                    ) : (
                      <MaterialCommunityIcons name="image-off-outline" size={24} color="#B0C3C9" />
                    )}
                  </View>
                  <Text style={styles.photoBoxLabel}>{photo.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingBottom: 32, paddingTop: 10 },
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
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 16,
    ...shadows.card,
  },
  bannerPass: { backgroundColor: colors.success },
  bannerFail: { backgroundColor: colors.danger },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInfo: { flex: 1 },
  bannerTitle: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 20,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: 4,
  },

  /* List Card */
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    marginBottom: 12,
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePass: { backgroundColor: colors.successSoft },
  badgeFail: { backgroundColor: colors.dangerSoft },
  badgeWarn: { backgroundColor: colors.accentSoft },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  itemRemark: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 6,
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  photoBox: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoBoxBtn: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  photoBoxImg: {
    width: '100%',
    height: '100%',
  },
  photoBoxLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textAlign: 'center',
  },
});
