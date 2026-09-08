import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, hairlineWidth, type } from '../styles/theme';
import { colors as mobileColors, type as mobileType } from '../styles/mobileTheme';

type Meridiem = 'AM' | 'PM';

/** Convert a 12-hour clock reading to canonical 24-hour "HH:MM". */
export function to24Hour(hour12: number, minute: number, meridiem: Meridiem): string {
  const base = hour12 % 12;
  const hour24 = meridiem === 'PM' ? base + 12 : base;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parse 24-hour "HH:MM" into a 12-hour reading. Returns null when malformed. */
export function parse24Hour(value: string): { hour12: number; minute: number; meridiem: Meridiem } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return null;
  return {
    hour12: hour24 % 12 || 12,
    minute,
    meridiem: hour24 >= 12 ? 'PM' : 'AM'
  };
}

/**
 * Standard-time (12-hour) entry field. Presents hour / minute inputs plus an
 * AM/PM toggle, but stores and emits canonical 24-hour "HH:MM" so existing
 * validation and the circadian engine keep working unchanged.
 */
export function TimeField({
  label,
  value,
  onChange,
  accessibilityLabel,
  appearance = 'default'
}: {
  label: string;
  value: string;
  onChange: (value24h: string) => void;
  accessibilityLabel?: string;
  appearance?: 'default' | 'mobile';
}) {
  const usesMobileTheme = appearance === 'mobile';
  const fieldColors = usesMobileTheme ? mobileColors : colors;
  // AM/PM is derived from `value` (never local state) so the toggle can never
  // desync from the canonical time — local buffers are only for smooth typing.
  const parsed = parse24Hour(value) ?? { hour12: 12, minute: 0, meridiem: 'AM' as Meridiem };
  const meridiem = parsed.meridiem;
  const [hour, setHour] = useState(String(parsed.hour12));
  const [minute, setMinute] = useState(String(parsed.minute).padStart(2, '0'));

  // Re-sync the number buffers only when `value` changes from outside (e.g. presets),
  // not on the self-induced updates caused by typing.
  useEffect(() => {
    const next = parse24Hour(value);
    if (!next) return;
    if (Number(hour) === next.hour12 && Number(minute) === next.minute) return;
    setHour(String(next.hour12));
    setMinute(String(next.minute).padStart(2, '0'));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function emit(nextHour: string, nextMinute: string, nextMeridiem: Meridiem) {
    const hourNumber = Number(nextHour);
    const minuteNumber = Number(nextMinute);
    if (!Number.isInteger(hourNumber) || hourNumber < 1 || hourNumber > 12) return;
    if (!Number.isInteger(minuteNumber) || minuteNumber < 0 || minuteNumber > 59) return;
    onChange(to24Hour(hourNumber, minuteNumber, nextMeridiem));
  }

  return (
    <View style={styles.shell}>
      <Text style={[styles.label, usesMobileTheme ? mobileStyles.label : null]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} hour` : undefined}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '');
            setHour(digits);
            emit(digits, minute, meridiem);
          }}
          placeholder="7"
          placeholderTextColor={fieldColors.textFaint}
          style={[styles.numberField, usesMobileTheme ? mobileStyles.numberField : null]}
          value={hour}
        />
        <Text style={[styles.colon, usesMobileTheme ? mobileStyles.colon : null]}>:</Text>
        <TextInput
          accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} minute` : undefined}
          keyboardType="number-pad"
          maxLength={2}
          onBlur={() => {
            if (minute.length === 1) {
              const padded = minute.padStart(2, '0');
              setMinute(padded);
              emit(hour, padded, meridiem);
            }
          }}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '');
            setMinute(digits);
            emit(hour, digits, meridiem);
          }}
          placeholder="00"
          placeholderTextColor={fieldColors.textFaint}
          style={[styles.numberField, usesMobileTheme ? mobileStyles.numberField : null]}
          value={minute}
        />
        <View style={[styles.meridiemGroup, usesMobileTheme ? mobileStyles.meridiemGroup : null]}>
          {(['AM', 'PM'] as Meridiem[]).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: meridiem === option }}
              onPress={() => emit(hour, minute, option)}
              style={[
                styles.meridiem,
                meridiem === option ? styles.meridiemActive : null,
                usesMobileTheme && meridiem === option ? mobileStyles.meridiemActive : null
              ]}
            >
              <Text
                style={[
                  styles.meridiemText,
                  meridiem === option ? styles.meridiemTextActive : null,
                  usesMobileTheme ? mobileStyles.meridiemText : null,
                  usesMobileTheme && meridiem === option ? mobileStyles.meridiemTextActive : null
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    gap: 8
  },
  label: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  numberField: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    color: colors.text,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    minHeight: 48,
    minWidth: 46,
    paddingHorizontal: 12,
    textAlign: 'center'
  },
  colon: {
    ...type.number,
    color: colors.textMuted
  },
  meridiemGroup: {
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    flexDirection: 'row',
    marginLeft: 4,
    overflow: 'hidden'
  },
  meridiem: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 44
  },
  meridiemActive: {
    backgroundColor: colors.accentWash
  },
  meridiemText: {
    ...type.label,
    color: colors.textMuted
  },
  meridiemTextActive: {
    color: colors.accent
  }
});

const mobileStyles = StyleSheet.create({
  label: {
    ...mobileType.eyebrow,
    color: mobileColors.textMuted
  },
  numberField: {
    backgroundColor: mobileColors.surfaceInset,
    borderColor: mobileColors.borderStrong,
    color: mobileColors.text,
    fontFamily: mobileType.number.fontFamily,
    minHeight: 50
  },
  colon: {
    ...mobileType.number,
    color: mobileColors.textMuted
  },
  meridiemGroup: {
    borderColor: mobileColors.borderStrong
  },
  meridiemActive: {
    backgroundColor: mobileColors.accentWash
  },
  meridiemText: {
    ...mobileType.label,
    color: mobileColors.textMuted
  },
  meridiemTextActive: {
    color: mobileColors.accent
  }
});
