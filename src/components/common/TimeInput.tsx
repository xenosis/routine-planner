import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../theme';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface TimeInputProps {
  /** "HH:mm" 형식 */
  value: string;
  onChange: (time: string) => void;
  /** Surface 카드 좌측 아이콘 (compact=false일 때만 사용) */
  icon?: 'clock-outline' | 'bell-outline';
  /** Paper TextInput 라벨 (compact=true일 때만 사용) */
  label?: string;
  /** true: Paper TextInput 스타일 (일정 화면용) / false: Surface 카드 스타일 (할일·루틴용) */
  compact?: boolean;
  style?: object;
}

// ─────────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────────

function valueToRaw(value: string): string {
  return value.replace(':', '');
}

function rawToDisplay(raw: string): string {
  if (raw.length <= 2) return raw;
  return `${raw.slice(0, 2)}:${raw.slice(2)}`;
}

/** 숫자 문자열(최대 4자리)을 "HH:mm" 형식으로 변환하며 범위를 보정한다 */
function buildTime(digits: string): string {
  const padded = digits.padEnd(4, '0');
  const h = Math.min(parseInt(padded.slice(0, 2), 10) || 0, 23);
  const m = Math.min(parseInt(padded.slice(2, 4), 10) || 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export default function TimeInput({
  value,
  onChange,
  icon = 'clock-outline',
  label,
  compact = false,
  style,
}: TimeInputProps): React.JSX.Element {
  const theme = useTheme();
  const [raw, setRaw] = useState(() => valueToRaw(value));

  // 외부에서 value가 바뀌면 raw도 동기화
  useEffect(() => {
    setRaw(valueToRaw(value));
  }, [value]);

  const displayValue = rawToDisplay(raw);

  const handleFocus = useCallback(() => {
    setRaw('');
  }, []);

  const handleChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, 4);
      setRaw(digits);
      if (digits.length === 4) {
        onChange(buildTime(digits));
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    if (raw.length > 0) {
      const time = buildTime(raw);
      setRaw(valueToRaw(time));
      onChange(time);
    } else {
      // 아무것도 입력 안 하고 포커스 아웃 → 기존값 복원
      setRaw(valueToRaw(value));
    }
  }, [raw, value, onChange]);

  // ── compact 모드 (Paper TextInput — 일정 화면) ────────
  if (compact) {
    return (
      <TextInput
        label={label}
        value={displayValue}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        mode="outlined"
        keyboardType="number-pad"
        placeholder="HH:mm"
        style={style}
      />
    );
  }

  // ── card 모드 (Surface 카드 — 할일·루틴 화면) ─────────
  const hour = raw.length >= 2 ? (parseInt(raw.slice(0, 2), 10) || 0) : null;
  const ampm = hour !== null ? (hour < 12 ? '오전' : '오후') : '';

  return (
    <Surface
      style={[cardStyles.container, { backgroundColor: theme.colors.surfaceVariant }, style]}
      elevation={0}
    >
      <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} />
      <RNTextInput
        value={displayValue}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        style={[cardStyles.input, { color: theme.colors.onSurface }]}
        placeholder="--:--"
        placeholderTextColor={theme.colors.outline}
        selectionColor={theme.colors.primary}
      />
      {ampm !== '' && (
        <Text style={[cardStyles.ampm, { color: theme.colors.onSurfaceVariant }]}>{ampm}</Text>
      )}
    </Surface>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
    padding: 0,
    // RN TextInput 기본 배경/테두리 제거
    backgroundColor: 'transparent',
  },
  ampm: {
    fontSize: 13,
    fontWeight: '600',
  },
});
