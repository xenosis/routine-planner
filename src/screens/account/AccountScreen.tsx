import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const COLOR_PALETTE = [
  '#6366F1', // 인디고
  '#10B981', // 에메랄드
  '#F59E0B', // 앰버
  '#EF4444', // 레드
  '#3B82F6', // 블루
  '#EC4899', // 핑크
  '#8B5CF6', // 퍼플
  '#06B6D4', // 시안
];

const DEFAULT_COLOR = COLOR_PALETTE[0];

export default function AccountScreen(): React.JSX.Element {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);

  const savedName = session?.user.user_metadata?.display_name ?? '';
  const savedColor = session?.user.user_metadata?.name_color ?? DEFAULT_COLOR;

  const [displayName, setDisplayName] = useState(savedName);
  const [selectedColor, setSelectedColor] = useState(savedColor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(session?.user.user_metadata?.display_name ?? '');
    setSelectedColor(session?.user.user_metadata?.name_color ?? DEFAULT_COLOR);
  }, [session]);

  const isDirty = displayName.trim() !== savedName || selectedColor !== savedColor;

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSaving(true);
    const err = await updateDisplayName(trimmed, selectedColor);
    setSaving(false);
    if (err) Alert.alert('저장 실패', err);
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => signOut() },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>계정</Text>
      </View>

      {/* 앱 아이콘 + 이름 */}
      <View style={styles.logoArea}>
        <MaterialCommunityIcons name="refresh-circle" size={64} color={theme.colors.primary} />
        <Text style={[styles.appName, { color: theme.colors.onBackground }]}>Doro</Text>
      </View>

      {/* 이메일 카드 */}
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <MaterialCommunityIcons name="account-outline" size={20} color={theme.colors.onSurfaceVariant} />
        <View style={styles.cardText}>
          <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant }]}>로그인 계정</Text>
          <Text style={[styles.cardValue, { color: theme.colors.onSurface }]}>
            {session?.user.email ?? '-'}
          </Text>
        </View>
      </Surface>

      {/* 이름표 설정 */}
      <Surface style={[styles.card, styles.nameCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text style={[styles.cardLabel, { color: theme.colors.onSurfaceVariant, marginBottom: spacing.sm }]}>
          작성자 (일정 카드에 표시될 이름과 색상)
        </Text>

        {/* 이름 입력 + 미리보기 뱃지 */}
        <View style={styles.nameRow}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            placeholder="예: 세웅, 신영"
            maxLength={10}
            style={styles.nameInput}
            dense
          />
          {displayName.trim() ? (
            <View style={[styles.previewBadge, { backgroundColor: selectedColor + '22', borderColor: selectedColor }]}>
              <Text style={[styles.previewBadgeText, { color: selectedColor }]}>
                {displayName.trim()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 색상 팔레트 */}
        <View style={styles.palette}>
          {COLOR_PALETTE.map((color) => (
            <TouchableOpacity
              key={color}
              style={[styles.colorCircle, { backgroundColor: color }]}
              onPress={() => setSelectedColor(color)}
              activeOpacity={0.8}
            >
              {selectedColor === color && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {isDirty && (
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || !displayName.trim()}
            style={styles.saveBtn}
          >
            저장
          </Button>
        )}
      </Surface>

      {/* 로그아웃 버튼 */}
      <Button
        mode="outlined"
        onPress={handleLogout}
        style={styles.logoutButton}
        textColor={theme.colors.error}
        icon="logout"
      >
        로그아웃
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  logoArea: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  appName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  nameCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
  },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 12 },
  cardValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  palette: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  logoutButton: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderColor: 'transparent',
  },
});
