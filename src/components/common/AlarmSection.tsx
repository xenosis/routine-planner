import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { borderRadius, spacing } from '../../theme';
import { formatAlarmTime } from '../../utils/scheduleAlarms';
import { ALARM_PRESETS, TIME_UNITS } from '../../constants/alarm';
import type { TimeUnit } from '../../constants/alarm';

interface AlarmSectionProps {
  alarmTimes: number[];
  onAlarmTimesChange: (times: number[]) => void;
  defaultOpen?: boolean;
}

export default function AlarmSection({ alarmTimes, onAlarmTimesChange, defaultOpen = false }: AlarmSectionProps) {
  const theme = useTheme();
  const [showAddPanel, setShowAddPanel] = useState(defaultOpen);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<TimeUnit>('min');

  const handleAddPreset = useCallback((minutes: number) => {
    if (alarmTimes.includes(minutes)) return;
    onAlarmTimesChange([...alarmTimes, minutes].sort((a, b) => a - b));
  }, [alarmTimes, onAlarmTimesChange]);

  const handleAddCustom = useCallback(() => {
    const num = parseInt(customValue, 10);
    if (!num || num <= 0) return;
    let minutes = num;
    if (customUnit === 'hour') minutes = num * 60;
    if (customUnit === 'day') minutes = num * 1440;
    if (customUnit === 'week') minutes = num * 10080;
    if (!alarmTimes.includes(minutes)) {
      onAlarmTimesChange([...alarmTimes, minutes].sort((a, b) => a - b));
    }
    setCustomValue('');
    setShowAddPanel(false);
  }, [customValue, customUnit, alarmTimes, onAlarmTimesChange]);

  const handleRemoveAlarm = useCallback((minutes: number) => {
    onAlarmTimesChange(alarmTimes.filter((m) => m !== minutes));
  }, [alarmTimes, onAlarmTimesChange]);

  return (
    <View style={styles.container}>
      {alarmTimes.map((mins) => (
        <View key={mins} style={[styles.alarmTimeItem, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[styles.alarmTimeIcon, { color: theme.colors.primary }]}>○</Text>
          <Text style={[styles.alarmTimeText, { color: theme.colors.onSurface }]}>
            {formatAlarmTime(mins)}
          </Text>
          <IconButton
            icon="close"
            size={16}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => handleRemoveAlarm(mins)}
            style={styles.removeAlarmBtn}
          />
        </View>
      ))}

      {!showAddPanel ? (
        <TouchableOpacity style={styles.addAlarmBtn} onPress={() => setShowAddPanel(true)} activeOpacity={0.7}>
          <Text style={[styles.addAlarmBtnText, { color: theme.colors.primary }]}>+ 알람 추가</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.addPanel, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.panelSectionLabel, { color: theme.colors.onSurfaceVariant }]}>빠른 선택</Text>
          <View style={styles.presetRow}>
            {ALARM_PRESETS.map((preset) => {
              const isSelected = alarmTimes.includes(preset.minutes);
              return (
                <Chip
                  key={preset.minutes}
                  mode={isSelected ? 'flat' : 'outlined'}
                  selected={isSelected}
                  onPress={() => handleAddPreset(preset.minutes)}
                  style={styles.presetChip}
                  compact
                >
                  {preset.label}
                </Chip>
              );
            })}
          </View>

          <Text style={[styles.panelSectionLabel, { color: theme.colors.onSurfaceVariant }]}>직접 입력</Text>
          <View style={styles.customInputRow}>
            <TextInput
              value={customValue}
              onChangeText={setCustomValue}
              mode="outlined"
              keyboardType="numeric"
              placeholder="숫자"
              style={styles.customInput}
              dense
            />
            <View style={styles.unitToggleRow}>
              {TIME_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit.value}
                  style={[
                    styles.unitBtn,
                    {
                      backgroundColor: customUnit === unit.value ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.outline,
                    },
                  ]}
                  onPress={() => setCustomUnit(unit.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unitBtnText, { color: customUnit === unit.value ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                    {unit.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              mode="contained"
              onPress={handleAddCustom}
              disabled={!customValue || parseInt(customValue, 10) <= 0}
              compact
              style={styles.customAddBtn}
            >
              추가
            </Button>
          </View>

          <Button
            mode="text"
            onPress={() => { setShowAddPanel(false); setCustomValue(''); }}
            style={styles.cancelPanelBtn}
            labelStyle={{ color: theme.colors.onSurfaceVariant }}
          >
            취소
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
    gap: spacing.xs,
  },
  alarmTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingLeft: spacing.sm,
    paddingVertical: 0,
    marginBottom: 3,
  },
  alarmTimeIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  alarmTimeText: {
    flex: 1,
    fontSize: 14,
  },
  removeAlarmBtn: {
    margin: 0,
  },
  addAlarmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignSelf: 'flex-start',
  },
  addAlarmBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addPanel: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  panelSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  presetChip: {
    marginBottom: 0,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customInput: {
    width: 80,
  },
  unitToggleRow: {
    flexDirection: 'row',
    gap: 2,
  },
  unitBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customAddBtn: {
    marginLeft: spacing.xs,
  },
  cancelPanelBtn: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },
});
