import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import CustomAlert from '../components/CustomAlert';
import {submitChecklist} from '../services/checklistApi';
import {compressImageHeavy, pickImageFromCamera} from '../utils/imagePicker';
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

const BEHAVIOR_OPTS = [
  {label: 'Poor', value: 'poor'},
  {label: 'Average', value: 'average'},
  {label: 'Good', value: 'good'},
];

function empty() {
  const s = {};
  ITEMS.forEach(i => (s[i.key] = ''));
  return s;
}

export default function ChecklistFormScreen({navigation, route}) {
  const {vehicle} = route.params;
  const scrollRef = useRef(null);

  const [statuses, setStatuses] = useState(empty);
  const [remarks, setRemarks] = useState({});
  const [itemImages, setItemImages] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null });

  const setStatus = useCallback((key, val) => {
    setStatuses(prev => ({...prev, [key]: val}));
    if (val === 'yes') {
      setRemarks(prev => {
        const n = {...prev};
        delete n[key];
        return n;
      });
    }
  }, []);

  const setRemark = useCallback((key, text) => {
    setRemarks(prev => ({...prev, [key]: text}));
  }, []);

  const captureItemPhoto = useCallback(async key => {
    try {
      const img = await pickImageFromCamera();
      if (!img?.uri) return;
      const compressed = await compressImageHeavy(img.uri);
      setItemImages(prev => ({...prev, [key]: compressed}));
    } catch (e) {
      setAlertConfig({
        visible: true,
        title: 'Camera error',
        message: e.message,
        type: 'error',
      });
    }
  }, []);

  const PHOTO_KEYS = useMemo(() => [
    { key: 'outer_front', label: 'Outer Front' },
    { key: 'outer_back', label: 'Outer Back' },
    { key: 'outer_left', label: 'Outer Left' },
    { key: 'outer_right', label: 'Outer Right' },
    { key: 'inner_front', label: 'Inner Front' },
    { key: 'inner_back', label: 'Inner Back' },
  ], []);

  const completed = useMemo(
    () => ITEMS.filter(i => statuses[i.key] !== '').length,
    [statuses],
  );
  const total = ITEMS.length;
  const progress = completed / total;

  const missingRemarks = useMemo(
    () =>
      ITEMS.filter(
        i =>
          i.type === 'yesno' &&
          statuses[i.key] === 'no' &&
          (!remarks[i.key] || remarks[i.key].trim() === ''),
      ).map(i => i.label),
    [statuses, remarks],
  );

  const missingPhotos = useMemo(
    () => PHOTO_KEYS.filter(p => !itemImages[p.key]).map(p => p.label),
    [PHOTO_KEYS, itemImages]
  );

  const canSubmit =
    completed === total && missingRemarks.length === 0 && missingPhotos.length === 0;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('vehicle_id', vehicle.vehicle_id || '');
      fd.append('vehicle_reg', vehicle.registration);
      fd.append('driver_id', vehicle.driver_id || '');
      fd.append('driver_name', vehicle.driver_name || '');

      Object.entries(statuses).forEach(([k, v]) => fd.append(k, v));
      fd.append('remarks', JSON.stringify(remarks));

      Object.entries(itemImages).forEach(([key, uri]) => {
        fd.append(`item_image_${key}`, {
          uri,
          type: 'image/jpeg',
          name: `${key}_${Date.now()}.jpg`,
        });
      });

      const res = await submitChecklist(fd, vehicle.registration);
      setAlertConfig({
        visible: true,
        title: 'Checklist submitted',
        message: `Status: ${(res.data?.overall_status || 'OK').toUpperCase()}`,
        type: 'success',
        onConfirm: () => {
          setAlertConfig({ ...alertConfig, visible: false });
          navigation.goBack();
        },
      });
    } catch (e) {
      setAlertConfig({
        visible: true,
        title: 'Submission failed',
        message: e.message,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [statuses, remarks, itemImages, navigation, vehicle]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Vehicle Checklist"
        subtitle={vehicle.registration}
        navigation={navigation}
      />
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        onConfirm={alertConfig.onConfirm}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Vehicle banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialCommunityIcons
              name="car-side"
              size={28}
              color={colors.white}
            />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerReg}>{vehicle.registration}</Text>
            {vehicle.driver_name ? (
              <Text style={styles.bannerDriver}>
                Driver: {vehicle.driver_name}
                {vehicle.driver1_name ? ` / ${vehicle.driver1_name}` : ''}
              </Text>
            ) : null}
          </View>
          {vehicle.already_inspected ? (
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>Re-inspect</Text>
            </View>
          ) : null}
        </View>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressTitle}>
              {completed} of {total} items
            </Text>
            <Text
              style={[
                styles.progressPercent,
                progress === 1 && styles.progressFull,
              ]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: `${progress * 100}%`},
                progress === 1 && styles.progressFillDone,
              ]}
            />
          </View>
        </View>

        {/* Checklist items */}
        <View style={styles.listCard}>
          {ITEMS.map((item, idx) => {
            const val = statuses[item.key];
            const isBehavior = item.type === 'behavior';
            const needsRemark = !isBehavior && val === 'no';
            const isLast = idx === ITEMS.length - 1;

            return (
              <View
                key={item.key}
                style={[styles.itemRow, isLast && styles.itemRowLast]}>
                {/* Label row */}
                <View style={styles.itemLabelRow}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </View>

                {/* Toggle buttons */}
                {isBehavior ? (
                  <View style={styles.behaviorRow}>
                    {BEHAVIOR_OPTS.map(opt => {
                      const active = val === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.behaveBtn,
                            active &&
                              (opt.value === 'good'
                                ? styles.behaveBtnGood
                                : opt.value === 'average'
                                  ? styles.behaveBtnAvg
                                  : styles.behaveBtnPoor),
                          ]}
                          onPress={() => setStatus(item.key, opt.value)}>
                          <Text
                            style={[
                              styles.behaveText,
                              active && styles.behaveTextActive,
                            ]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.yesnoRow}>
                    <TouchableOpacity
                      style={[styles.ynBtn, val === 'yes' && styles.ynBtnYes]}
                      onPress={() => setStatus(item.key, 'yes')}>
                      <MaterialCommunityIcons
                        name={val === 'yes' ? 'check-circle' : 'circle-outline'}
                        size={20}
                        color={val === 'yes' ? colors.success : '#AAB6BB'}
                      />
                      <Text
                        style={[
                          styles.ynText,
                          val === 'yes' && styles.ynTextYes,
                        ]}>
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ynBtn, val === 'no' && styles.ynBtnNo]}
                      onPress={() => setStatus(item.key, 'no')}>
                      <MaterialCommunityIcons
                        name={val === 'no' ? 'close-circle' : 'circle-outline'}
                        size={20}
                        color={val === 'no' ? colors.danger : '#AAB6BB'}
                      />
                      <Text
                        style={[
                          styles.ynText,
                          val === 'no' && styles.ynTextNo,
                        ]}>
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Remark */}
                {needsRemark && (
                  <View style={styles.remarkWrap}>
                    <TextInput
                      style={[
                        styles.remarkInput,
                        !remarks[item.key]?.trim() && styles.remarkInputErr,
                      ]}
                      value={remarks[item.key] || ''}
                      onChangeText={t => setRemark(item.key, t)}
                      placeholder="Describe the issue (required)..."
                      placeholderTextColor="#B0C3C9"
                      multiline
                      textAlignVertical="top"
                    />
                    {!remarks[item.key]?.trim() && (
                      <Text style={styles.remarkErr}>Remark required</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Vehicle Photos */}
        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Vehicle Photos (Required)</Text>
          <View style={styles.photoGrid}>
            {PHOTO_KEYS.map(photo => {
              const uri = itemImages[photo.key];
              return (
                <View key={photo.key} style={styles.photoBox}>
                  <TouchableOpacity
                    style={[styles.photoBoxBtn, uri && styles.photoBoxBtnActive]}
                    onPress={() => captureItemPhoto(photo.key)}>
                    {uri ? (
                      <Image source={{uri}} style={styles.photoBoxImg} />
                    ) : (
                      <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#B0C3C9" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.photoBoxLabel}>{photo.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Validation hint */}
        {(missingRemarks.length > 0 || missingPhotos.length > 0) && (
          <View style={styles.warnCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={colors.danger}
            />
            <View style={{flex: 1}}>
              {missingRemarks.length > 0 && (
                <Text style={styles.warnText}>Add remarks for: {missingRemarks.join(', ')}</Text>
              )}
              {missingPhotos.length > 0 && (
                <Text style={styles.warnText}>Add photos for: {missingPhotos.join(', ')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Submit */}
        <PrimaryButton
          label={
            submitting
              ? 'Submitting...'
              : canSubmit
                ? 'Submit checklist'
                : 'Submit'
          }
          icon="clipboard-check-outline"
          disabled={!canSubmit}
          loading={submitting}
          onPress={handleSubmit}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: 18, paddingBottom: 32},

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 12,
    ...shadows.card,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInfo: {flex: 1},
  bannerReg: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 18,
  },
  bannerDriver: {
    color: '#CBE2E9',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 2,
  },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bannerBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },

  /* Progress */
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    ...shadows.card,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
  progressPercent: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 16,
  },
  progressFull: {color: colors.success},
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E6EDF0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  progressFillDone: {backgroundColor: colors.success},

  /* List card */
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...shadows.card,
  },
  itemRow: {paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border},
  itemRowLast: {borderBottomWidth: 0},
  itemLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    marginBottom: 12,
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
  photoBoxBtnActive: {
    borderColor: colors.primary,
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

  /* Yes/No */
  yesnoRow: {flexDirection: 'row', gap: 10},
  ynBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  ynBtnYes: {borderColor: colors.success, backgroundColor: colors.successSoft},
  ynBtnNo: {borderColor: colors.danger, backgroundColor: colors.dangerSoft},
  ynText: {color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 13},
  ynTextYes: {color: colors.success},
  ynTextNo: {color: colors.danger},

  /* Behavior */
  behaviorRow: {flexDirection: 'row', gap: 8},
  behaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  behaveBtnGood: {borderColor: colors.success, backgroundColor: colors.successSoft},
  behaveBtnAvg: {borderColor: colors.accent, backgroundColor: colors.accentSoft},
  behaveBtnPoor: {borderColor: colors.danger, backgroundColor: colors.dangerSoft},
  behaveText: {color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 12},
  behaveTextActive: {color: colors.text, fontFamily: fontFamily.semibold},

  /* Remark */
  remarkWrap: {marginTop: 10},
  remarkInput: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
  remarkInputErr: {borderColor: colors.danger},
  remarkErr: {
    color: colors.danger,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 4,
  },

  /* Warning */
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  warnText: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
