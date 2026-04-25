import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing } from '../../theme';

const KAKAO_API_KEY = 'eeab0879e05ca3035c29c73568804020';
const KAKAO_JS_KEY = '2c81f19c246d8fadbc3136c32f88f9d3';

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  category_group_name: string;
  x: string; // 경도
  y: string; // 위도
}

interface LocationSearchModalProps {
  visible: boolean;
  initialQuery?: string;
  onSelect: (placeName: string) => void;
  onClose: () => void;
}

function buildKakaoMapHtml(jsKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
  <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'JS_ERROR', msg: msg, src: src }));
    };

    kakao.maps.load(function() {

    var map = new kakao.maps.Map(document.getElementById('map'), {
      center: new kakao.maps.LatLng(37.5665, 126.9780),
      level: 6
    });
    var markers = [];

    function clearMarkers() {
      markers.forEach(function(m) { m.setMap(null); });
      markers = [];
    }

    function addMarkers(places) {
      clearMarkers();
      if (!places || !places.length) return;
      var bounds = new kakao.maps.LatLngBounds();
      places.forEach(function(place) {
        var pos = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
        new kakao.maps.Marker({ position: pos, map: map });
        bounds.extend(pos);
      });
      map.setBounds(bounds);
    }

    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'PLACES') {
          addMarkers(data.places);
        } else if (data.type === 'FOCUS') {
          var pos = new kakao.maps.LatLng(parseFloat(data.y), parseFloat(data.x));
          map.setCenter(pos);
          map.setLevel(3);
        } else if (data.type === 'RESET') {
          clearMarkers();
          map.setCenter(new kakao.maps.LatLng(37.5665, 126.9780));
          map.setLevel(6);
        }
      } catch(err) {}
    });

    }); // kakao.maps.load
  </script>
</body>
</html>`;
}

async function searchKakaoPlaces(query: string): Promise<KakaoPlace[]> {
  if (!KAKAO_API_KEY || !query.trim()) return [];
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

const MAP_HTML = buildKakaoMapHtml(KAKAO_JS_KEY);

export default function LocationSearchModal({
  visible,
  initialQuery,
  onSelect,
  onClose,
}: LocationSearchModalProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebView로 메시지 전송
  const sendToMap = useCallback((data: object) => {
    const json = JSON.stringify(data);
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} })); true;`
    );
  }, []);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (visible) {
      setQuery(initialQuery ?? '');
      setResults([]);
      setError(null);
      setLoading(false);
      setSelectedPlace(null);
    } else {
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      setSelectedPlace(null);
    }
  }, [visible]);

  // 검색어 변경 → 디바운스 검색
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setResults([]);
      setSelectedPlace(null);
      setLoading(false);
      sendToMap({ type: 'RESET' });
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPlace(null);

    debounceTimer.current = setTimeout(async () => {
      try {
        const places = await searchKakaoPlaces(query);
        setResults(places);
        sendToMap(places.length > 0
          ? { type: 'PLACES', places }
          : { type: 'RESET' }
        );
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

  // 장소 탭: 지도 포커스 이동 (선택 확정 아님)
  const handlePlacePress = useCallback((place: KakaoPlace) => {
    Keyboard.dismiss();
    setSelectedPlace(place);
    sendToMap({ type: 'FOCUS', x: place.x, y: place.y });
  }, [sendToMap]);

  // 선택 확정
  const handleConfirm = useCallback(() => {
    if (selectedPlace) onSelect(selectedPlace.place_name);
  }, [selectedPlace, onSelect]);

  const renderItem = useCallback(({ item }: { item: KakaoPlace }) => {
    const isSelected = selectedPlace?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.resultItem,
          { borderBottomColor: theme.colors.outlineVariant },
          isSelected && { backgroundColor: theme.colors.primaryContainer },
        ]}
        onPress={() => handlePlacePress(item)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={isSelected ? 'map-marker' : 'map-marker-outline'}
          size={18}
          color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
          style={styles.resultIcon}
        />
        <View style={styles.resultText}>
          <Text style={[styles.placeName, { color: isSelected ? theme.colors.primary : theme.colors.onSurface }]}>
            {item.place_name}
          </Text>
          <Text style={[styles.addressName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {item.road_address_name || item.address_name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [theme, handlePlacePress, selectedPlace]);

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

        {/* 카카오 지도 */}
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: MAP_HTML, baseUrl: 'http://localhost' }}
            javaScriptEnabled
            mixedContentMode="always"
            originWhitelist={['*']}
            scrollEnabled={false}
            style={styles.map}
            onError={(e) => console.warn('WebView 에러:', e.nativeEvent)}
            onHttpError={(e) => console.warn('WebView HTTP 에러:', e.nativeEvent.statusCode)}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'JS_ERROR') console.warn('지도 JS 에러:', msg.msg, msg.src);
              } catch {}
            }}
          />
        </View>

        {/* 검색 결과 리스트 */}
        <View style={styles.listContainer}>
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
              <MaterialCommunityIcons name="map-search-outline" size={32} color={theme.colors.outline} />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                검색 결과가 없습니다
              </Text>
            </View>
          )}

          {!loading && !error && !query.trim() && (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="map-marker-outline" size={32} color={theme.colors.outline} />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                검색어를 입력하세요
              </Text>
            </View>
          )}

          {!loading && !error && results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={selectedPlace ? styles.listPaddingWithBar : undefined}
            />
          )}
        </View>

        {/* 하단 선택 확정 바 — absolute로 지도 크기 영향 없음 */}
        {selectedPlace && (
          <TouchableOpacity
            style={[
              styles.confirmBar,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.primary} />
            <Text style={[styles.confirmName, { color: theme.colors.onPrimaryContainer }]} numberOfLines={1}>
              {selectedPlace.place_name}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
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
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  listContainer: {
    maxHeight: 260,
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
  listPaddingWithBar: {
    paddingBottom: 52,
  },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  confirmName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    borderRadius: borderRadius.md,
  },
});
