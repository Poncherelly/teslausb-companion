import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

// Same rule pi-service/src/lib/hostname-update.js enforces server-side —
// checked client-side too so the user gets immediate feedback.
const HOSTNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

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

function DeviceNameRow({ styles }) {
  const [hostname, setHostname] = useState(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${PI_SERVICE_URL}/system/status`)
      .then((res) => res.json())
      .then((data) => setHostname(data.hostname))
      .catch(() => {});
  }, []);

  function startEditing() {
    setInput(hostname ?? '');
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!HOSTNAME_PATTERN.test(input)) {
      setError('Letters, numbers, and hyphens only — no spaces.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${PI_SERVICE_URL}/system/hostname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename device');
      setHostname(input);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.label}>Device name</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.warning}>
          Renaming reboots the Pi to apply the change — this takes a minute or two.
        </Text>
        <View style={styles.editButtons}>
          <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={save} disabled={saving || !input}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SettingsRow label="Device name" subtitle={hostname ?? 'Loading…'} onPress={startEditing} styles={styles} />
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
      <DeviceNameRow styles={styles} />
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
    editRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.text,
      marginTop: 8,
    },
    warning: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 8,
    },
    error: {
      fontSize: 13,
      color: theme.error,
      marginTop: 6,
    },
    editButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
    },
    cancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    cancelButtonText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    saveButton: {
      backgroundColor: '#111',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 70,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
