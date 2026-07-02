import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';

function SettingsRow({ label, subtitle, onPress, disabled, styles }) {
  return (
    <Pressable style={[styles.row, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled}>
      <View>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!disabled && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

export default function SettingsScreen({ onSetupDevice }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.container}>
      <SettingsRow
        label="Set up new device"
        subtitle="Pair a Pi over Bluetooth"
        onPress={onSetupDevice}
        styles={styles}
      />
      <SettingsRow
        label="Archive settings"
        subtitle="Private/Convenient mode, archive destinations — not built yet"
        disabled
        styles={styles}
      />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowDisabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: 16,
      color: theme.text,
    },
    labelDisabled: {
      color: theme.textMuted,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 2,
    },
    chevron: {
      fontSize: 20,
      color: theme.textMuted,
    },
  });
}
