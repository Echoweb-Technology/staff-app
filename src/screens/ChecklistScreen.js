import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ScreenHeader from '../components/ScreenHeader';
import CustomAlert from '../components/CustomAlert';
import { getChecklistVehicles } from '../services/checklistApi';
import { colors, fontFamily, shadows } from '../theme';

const VehicleCard = memo(function VehicleCard({ item, onPress }) {
  const isDone = item.already_inspected;
  return (
    <TouchableOpacity
      style={styles.cardWrapper}
      onPress={() => onPress(item)}
      activeOpacity={0.85}>
      <LinearGradient
        colors={isDone ? ['#E8F5E9', '#C8E6C9'] : ['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.vehicleCard, isDone && styles.vehicleCardDone]}>
        <View style={styles.vehicleLeft}>
          <View style={[styles.vehicleIcon, isDone && styles.vehicleIconDone]}>
            <MaterialCommunityIcons
              name={isDone ? 'check-circle' : 'car-side'}
              size={24}
              color={isDone ? colors.success : colors.primary}
            />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={[styles.vehicleReg, isDone && styles.vehicleRegDone]}>
              {item.registration} {isDone ? ' * inspected' : ''}
            </Text>
            {item.driver_name ? (
              <Text style={styles.vehicleDriver}>{item.driver_name}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.vehicleRight}>
          {isDone ? (
            <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>Done</Text>
            </LinearGradient>
          ) : (
            <View style={styles.tapBadge}>
              <Text style={styles.tapBadgeText}>Inspect</Text>
            </View>
          )}
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={isDone ? colors.success : '#AAB6BB'}
          />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

export default function ChecklistScreen({ navigation }) {
  const [vehicles, setVehicles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getChecklistVehicles();
      const list = res.data?.vehicles || [];
      setVehicles(list);
      setFiltered(list);
    } catch (error) {
      if (error.message !== 'UNAUTHORIZED') {
        setAlertConfig({
          visible: true,
          title: 'Unable to load vehicles',
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
      loadVehicles();
    }, [loadVehicles]),
  );

  const handleSearch = useCallback(
    async text => {
      setSearch(text);

      if (!text.trim()) {
        setFiltered(vehicles);
        return;
      }

      // Client-side filter for instant response
      const local = vehicles.filter(v =>
        v.registration?.toLowerCase().includes(text.toLowerCase()),
      );
      setFiltered(local);
    },
    [vehicles],
  );

  const handleSelect = useCallback(
    vehicle => {
      if (vehicle.already_inspected) {
        navigation.navigate('ChecklistDetails', { vehicle });
      } else {
        navigation.navigate('ChecklistForm', { vehicle });
      }
    },
    [navigation],
  );

  const uninspectedCount = vehicles.filter(v => !v.already_inspected).length;
  const doneCount = vehicles.filter(v => v.already_inspected).length;

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title="Vehicle Checklist"
          subtitle="Loading..."
          navigation={navigation}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Vehicle Checklist"
        subtitle={`${doneCount} done · ${uninspectedCount} pending`}
        navigation={navigation}
      />
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
      <View style={styles.content}>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search vehicle registration..."
            placeholderTextColor="#AAB6BB"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Summary chip */}
        <View style={styles.summaryRow}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.summaryChip}>
            <Text style={styles.summaryCount}>{vehicles.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </LinearGradient>
          <LinearGradient colors={['#4CAF50', '#2E7D32']} style={[styles.summaryChip, styles.summaryChipDone]}>
            <Text style={[styles.summaryCount, styles.summaryCountDone]}>
              {doneCount}
            </Text>
            <Text style={styles.summaryLabel}>Inspected</Text>
          </LinearGradient>
          <LinearGradient colors={['#FF9800', '#F57C00']} style={[styles.summaryChip, styles.summaryChipPending]}>
            <Text style={[styles.summaryCount, styles.summaryCountPending]}>
              {uninspectedCount}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </LinearGradient>
        </View>

        {/* Vehicle list */}
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="car-off"
              size={48}
              color={colors.border}
            />
            <Text style={styles.emptyText}>
              {search
                ? 'No vehicles match your search'
                : 'No vehicles assigned this month'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.registration}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={8}
            renderItem={({ item }) => (
              <VehicleCard item={item} onPress={handleSelect} />
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 6 },
  center: {
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
  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    height: 50,
    padding: 0,
  },
  /* Summary */
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    ...shadows.card,
    elevation: 4,
  },
  summaryChipDone: {},
  summaryChipPending: {},
  summaryCount: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
  summaryCountDone: {},
  summaryCountPending: {},
  summaryLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fontFamily.medium,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /* List */
  list: { paddingBottom: 20, gap: 8 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  /* Vehicle card */
  cardWrapper: {
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: '#FFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  vehicleCardDone: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  vehicleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconDone: {
    backgroundColor: colors.successSoft,
  },
  vehicleInfo: { flex: 1 },
  vehicleReg: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
  },
  vehicleRegDone: { color: colors.success },
  vehicleDriver: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
  vehicleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doneBadge: {
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },
  tapBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tapBadgeText: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
    fontSize: 10,
  },
});
