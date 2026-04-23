import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  TouchableOpacity,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';

// ─────────────────────────────────────────────
// 카카오 REST API 키
// developers.kakao.com → 내 애플리케이션 → 앱 키 → REST API 키
// ─────────────────────────────────────────────
const KAKAO_API_KEY = 'eeab0879e05ca3035c29c73568804020'; // 발급받은 키를 여기에 입력하세요

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  category_group_name: string;
}

interface LocationSearchModalProps {
  visible: boolean;
  initialQuery?: string;
  onSelect: (placeName: string) => void;
  onClose: () => void;
}

async function searchKakaoPlaces(query: string): Promise<KakaoPlace[]> {
  if (!KAKAO_API_KEY) return [];
  if (!query.trim()) return [];

  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`;
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`카카오 API ${response.status}: ${body}`);
  }
  const data = await response.json();
  return data.documents as KakaoPlace[];
}

export default function LocationSearchModal({
  visible,
  initialQuery,
  onSelect,
  onClose,
}: LocationSearchModalProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달 열릴 때 initialQuery 적용, 닫힐 때 상태 초기화
  useEffect(() => {
    if (visible) {
      setQuery(initialQuery ?? '');
      setResults([]);
      setError(null);
      setLoading(false);
    } else {
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  // 검색어 변경 시 300ms 디바운스 후 API 호출
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceTimer.current = setTimeout(async () => {
      try {
        if (!KAKAO_API_KEY) {
          setError('API 키가 설정되지 않았습니다.\nLocationSearchModal.tsx의 KAKAO_API_KEY를 입력해 주세요.');
          setLoading(false);
          return;
        }
        const places = await searchKakaoPlaces(query);
        setResults(places);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('장소 검색 오류:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleSelect = useCallback((place: KakaoPlace) => {
    Keyboard.dismiss();
    onSelect(place.place_name);
  }, [onSelect]);

  const renderItem = useCallback(({ item }: { item: KakaoPlace }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: theme.colors.outlineVariant }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name="map-marker-outline"
        size={18}
        color={theme.colors.primary}
        style={styles.resultIcon}
      />
      <View style={styles.resultText}>
        <Text style={[styles.placeName, { color: theme.colors.onSurface }]}>
          {item.place_name}
        </Text>
        <Text style={[styles.addressName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {item.road_address_name || item.address_name}
        </Text>
      </View>
    </TouchableOpacity>
  ), [theme, handleSelect]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top || (Platform.OS === 'android' ? spacing.lg : 0),
          },
        ]}
      >
        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            장소 검색
          </Text>
          <IconButton
            icon="close"
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onClose}
          />
        </View>

        {/* 검색 입력창 */}
        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            mode="outlined"
            placeholder="장소명, 주소 검색"
            autoFocus
            left={<TextInput.Icon icon="magnify" />}
            right={query ? <TextInput.Icon icon="close-circle" onPress={() => setQuery('')} /> : undefined}
            style={styles.searchInput}
          />
        </View>

        {/* 결과 영역 */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={theme.colors.error} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              {error}
            </Text>
          </View>
        )}

        {!loading && !error && query.trim() && results.length === 0 && (
          <View style={styles.centerBox}>
            <MaterialCommunityIcons name="map-search-outline" size={36} color={theme.colors.outline} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              검색 결과가 없습니다
            </Text>
          </View>
        )}

        {!loading && !error && results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          />
        )}

        {!query.trim() && !loading && (
          <View style={styles.centerBox}>
            <MaterialCommunityIcons name="map-marker-outline" size={36} color={theme.colors.outline} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              검색어를 입력하세요
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchBox: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    backgroundColor: 'transparent',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    marginRight: spacing.md,
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressName: {
    fontSize: 12,
  },
});
