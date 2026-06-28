import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, fontFamily, shadows} from '../theme';

const SearchablePicker = ({
  label,
  value,
  options = [],
  placeholder = 'Select...',
  onSelect,
  onSearch,
  renderLabel,
  searchPlaceholder = 'Type to search...',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState(options);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync results when options change and modal is not visible
  useEffect(() => {
    if (!modalVisible) {
      setResults(options);
    }
  }, [options, modalVisible]);

  // When value changes externally, try to find its label from options or results
  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
    }
  }, [value]);

  const handleSearch = useCallback(
    text => {
      setSearchText(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!onSearch) {
        // Client-side filtering fallback
        const filtered = options.filter(item => {
          const searchStr = (item.label || String(item.value || '')).toLowerCase();
          return searchStr.includes(text.toLowerCase());
        });
        setResults(filtered);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const searchResults = await onSearch(text);
          setResults(searchResults);
        } catch {
          // Keep current results on error
        } finally {
          setSearching(false);
        }
      }, 350);
    },
    [onSearch, options],
  );

  const handleOpen = useCallback(() => {
    setSearchText('');
    setResults(options);
    setModalVisible(true);

    // Focus search input after modal opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  }, [options]);

  const handleClose = useCallback(() => {
    setModalVisible(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const handleSelect = useCallback(
    item => {
      setSelectedLabel(item.label);
      handleClose();
      onSelect(item.value, item);
    },
    [handleClose, onSelect],
  );

  const displayLabel = value
    ? options.find(o => String(o.value) === String(value))?.label ||
      results.find(o => String(o.value) === String(value))?.label ||
      selectedLabel ||
      renderLabel?.(value) ||
      placeholder
    : placeholder;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selector, value ? styles.selectorActive : null]}
        onPress={handleOpen}
        activeOpacity={0.7}>
        <Text
          style={[styles.selectorText, !value && styles.selectorPlaceholder]}
          numberOfLines={1}>
          {displayLabel}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={value ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={styles.searchWrap}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={colors.textMuted}
              />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchText}
                onChangeText={handleSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : searchText ? (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Results */}
            <FlatList
              data={results}
              keyExtractor={(item, index) =>
                `${item.value || item.label || ''}_${index}`
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons
                    name="database-search-outline"
                    size={40}
                    color={colors.border}
                  />
                  <Text style={styles.emptyText}>
                    {searching
                      ? 'Searching...'
                      : searchText
                        ? 'No results found'
                        : 'No items available'}
                  </Text>
                </View>
              }
              renderItem={({item}) => {
                const isSelected =
                  value !== '' &&
                  String(item.value) === String(value);
                return (
                  <TouchableOpacity
                    style={[
                      styles.resultItem,
                      isSelected && styles.resultItemActive,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}>
                    <View style={styles.resultTextWrap}>
                      <Text
                        style={[
                          styles.resultText,
                          isSelected && styles.resultTextActive,
                        ]}
                        numberOfLines={2}>
                        {item.label}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.resultSubtitle}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={22}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldWrap: {marginBottom: 14},
  fieldLabel: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginBottom: 6,
  },
  selector: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  selectorText: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  selectorPlaceholder: {
    color: colors.textMuted,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    height: 46,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 4,
  },
  resultItemActive: {
    backgroundColor: colors.primarySoft,
  },
  resultTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  resultText: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  resultTextActive: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
});

export default SearchablePicker;
