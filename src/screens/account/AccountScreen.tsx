import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useCategoryStore } from '../../store/categoryStore';
import type { Category } from '../../db/categoryDb';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

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

// 카테고리 타입 탭 목록
const CATEGORY_TABS: Array<{ type: Category['type']; label: string }> = [
  { type: 'schedule', label: '일정' },
  { type: 'routine', label: '루틴' },
  { type: 'todo', label: '할일' },
];

// ─────────────────────────────────────────────
// 카테고리 추가/수정 모달
// ─────────────────────────────────────────────

interface CategoryModalProps {
  visible: boolean;
  initial?: { id: string; name: string; color: string } | null;
  /** 현재 탭에서 다른 카테고리가 이미 사용 중인 색상 목록 */
  usedColors: string[];
  onConfirm: (name: string, color: string) => void;
  onClose: () => void;
}

function CategoryModal({ visible, initial, usedColors, onConfirm, onClose }: CategoryModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  // useEffect 안에서 최신 usedColors를 읽되 의존성에는 포함하지 않기 위해 ref 사용
  const usedColorsRef = React.useRef(usedColors);
  usedColorsRef.current = usedColors;

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      if (initial) {
        // 수정 모드: 기존 색상으로 초기화
        setColor(initial.color);
      } else {
        // 추가 모드: 현재 탭에서 사용 중이지 않은 첫 번째 색상을 기본 선택
        const unusedColor = COLOR_PALETTE.find((c) => !usedColorsRef.current.includes(c)) ?? COLOR_PALETTE[0];
        setColor(unusedColor);
      }
    }
  }, [visible, initial]);

  const canConfirm = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            {initial ? '카테고리 수정' : '카테고리 추가'}
          </Text>

          {/* 이름 입력 */}
          <TextInput
            label="이름"
            value={name}
            onChangeText={setName}
            mode="outlined"
            maxLength={12}
            style={styles.modalInput}
            autoFocus
          />

          {/* 색상 팔레트 */}
          <Text style={[styles.paletteLabel, { color: theme.colors.onSurfaceVariant }]}>
            색상 선택
          </Text>
          <View style={styles.palette}>
            {COLOR_PALETTE.map((c) => {
              const isSelected = color === c;
              const isUsed = usedColors.includes(c);
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    isSelected && styles.colorCircleSelected,
                  ]}
                  onPress={() => { if (!isSelected) setColor(c); }}
                  activeOpacity={0.8}
                >
                  {/* 선택된 색상: 체크마크 */}
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  )}
                  {/* 다른 카테고리가 이미 사용 중인 색상: 오른쪽 상단 흰 점 */}
                  {isUsed && !isSelected && (
                    <View style={styles.usedDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 사용 중 색상 안내 */}
          {usedColors.length > 0 && (
            <View style={styles.usedColorHint}>
              <View style={styles.usedDotSample} />
              <Text style={[styles.usedColorHintText, { color: theme.colors.onSurfaceVariant }]}>
                이미 사용 중인 색상
              </Text>
            </View>
          )}

          {/* 미리보기 */}
          <View style={styles.previewRow}>
            <View style={[styles.previewDot, { backgroundColor: color }]} />
            <Text style={[styles.previewName, { color: theme.colors.onSurface }]}>
              {name.trim() || '카테고리명'}
            </Text>
          </View>

          {/* 버튼 */}
          <View style={styles.modalButtons}>
            <Button mode="text" onPress={onClose} style={styles.modalBtn}>
              취소
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(name.trim(), color)}
              disabled={!canConfirm}
              style={styles.modalBtn}
            >
              {initial ? '수정' : '추가'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 메인 스크린
// ─────────────────────────────────────────────

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

  // ── 카테고리 관리 상태 ──────────────────────
  const [activeTab, setActiveTab] = useState<Category['type']>('schedule');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const scheduleCategories = useCategoryStore((s) => s.scheduleCategories);
  const routineCategories = useCategoryStore((s) => s.routineCategories);
  const todoCategories = useCategoryStore((s) => s.todoCategories);
  const fetchAllCategories = useCategoryStore((s) => s.fetchAllCategories);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const editCategory = useCategoryStore((s) => s.editCategory);
  const removeCategory = useCategoryStore((s) => s.removeCategory);
  const reorderCategories = useCategoryStore((s) => s.reorderCategories);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const currentCategories =
    activeTab === 'schedule'
      ? scheduleCategories
      : activeTab === 'routine'
        ? routineCategories
        : todoCategories;

  const handleAddPress = () => {
    setEditingCategory(null);
    setModalVisible(true);
  };

  const handleEditPress = (cat: Category) => {
    setEditingCategory(cat);
    setModalVisible(true);
  };

  const handleDeletePress = (cat: Category) => {
    Alert.alert(
      '카테고리 삭제',
      `'${cat.name}' 카테고리를 삭제하면 해당 항목이 '기타'로 변경됩니다. 계속할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => removeCategory(cat.id, cat.name, activeTab),
        },
      ],
      { cancelable: true },
    );
  };

  const handleModalConfirm = (name: string, color: string) => {
    setModalVisible(false);
    if (editingCategory) {
      editCategory(editingCategory.id, name, color, editingCategory.name, activeTab);
    } else {
      addCategory(activeTab, name, color);
    }
  };

  // 편집 중인 카테고리 자신을 제외한, 현재 탭에서 이미 사용 중인 색상 목록
  const usedColors = currentCategories
    .filter((cat) => cat.id !== editingCategory?.id)
    .map((cat) => cat.color);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        {/* ── 카테고리 관리 섹션 ─────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>카테고리 관리</Text>
          <IconButton
            icon="plus"
            size={20}
            iconColor={theme.colors.primary}
            onPress={handleAddPress}
            style={styles.addIconBtn}
          />
        </View>

        {/* 탭 */}
        <View style={[styles.tabRow, { borderBottomColor: theme.colors.outlineVariant }]}>
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.type;
            return (
              <TouchableOpacity
                key={tab.type}
                style={[
                  styles.tabItem,
                  isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
                ]}
                onPress={() => setActiveTab(tab.type)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 카테고리 목록 */}
        <Surface style={[styles.categoryListCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {currentCategories.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              카테고리가 없습니다
            </Text>
          ) : (
            <DraggableFlatList
              data={currentCategories}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => reorderCategories(activeTab, data)}
              scrollEnabled={false}
              renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<Category>) => {
                const index = getIndex() ?? 0;
                const isLast = index === currentCategories.length - 1;
                return (
                  <ScaleDecorator>
                    <View>
                      <View style={[
                        styles.categoryRow,
                        isActive && { backgroundColor: theme.colors.surfaceVariant },
                      ]}>
                        {/* 드래그 핸들 */}
                        <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                          <MaterialCommunityIcons
                            name="drag-horizontal-variant"
                            size={18}
                            color={theme.colors.outline}
                          />
                        </TouchableOpacity>
                        <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                        <Text style={[styles.categoryName, { color: theme.colors.onSurface }]}>
                          {item.name}
                        </Text>
                        {item.isDefault ? (
                          /* 기본(기타) 카테고리: '기본' 레이블만 표시 */
                          <Text style={[styles.defaultBadge, { color: theme.colors.onSurfaceVariant }]}>
                            기본
                          </Text>
                        ) : (
                          <View style={styles.categoryActions}>
                            <IconButton
                              icon="pencil-outline"
                              size={18}
                              iconColor={theme.colors.onSurfaceVariant}
                              onPress={() => handleEditPress(item)}
                              style={styles.actionBtn}
                            />
                            <IconButton
                              icon="trash-can-outline"
                              size={18}
                              iconColor={theme.colors.error}
                              onPress={() => handleDeletePress(item)}
                              style={styles.actionBtn}
                            />
                          </View>
                        )}
                      </View>
                      {/* 마지막 항목 아래 구분선 없음 */}
                      {!isLast && (
                        <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                      )}
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
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

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 카테고리 추가/수정 모달 */}
      <CategoryModal
        visible={modalVisible}
        initial={editingCategory}
        usedColors={usedColors}
        onConfirm={handleModalConfirm}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
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
  nameInput: { flex: 1 },
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
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  saveBtn: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  // ── 카테고리 관리 ──────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  addIconBtn: {
    margin: 0,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryListCard: {
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    overflow: 'visible',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dragHandle: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
  },
  defaultBadge: {
    fontSize: 11,
    marginRight: spacing.base,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    margin: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontSize: 14,
  },
  logoutButton: {
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    borderColor: 'transparent',
  },
  bottomPadding: { height: spacing.xl },
  // ── 카테고리 모달 ──────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  modalInput: {
    // Paper TextInput 기본값 사용
  },
  paletteLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  // 색상 원 오른쪽 상단에 표시되는 "사용 중" 점
  usedDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  usedColorHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  usedDotSample: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  usedColorHintText: {
    fontSize: 11,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  modalBtn: {
    // 기본값 사용
  },
});
