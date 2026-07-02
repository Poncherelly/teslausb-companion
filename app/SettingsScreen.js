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

// CIFS/SMB only — the only archive backend actually deployed on real
// hardware, and the only one upstream teslausb sets up via plain fstab
// entries. rsync/NFS/rclone exist upstream too but aren't built here yet
// (rclone in particular needs its own OAuth-webview wizard — see
// docs/ARCHIVE_AND_TESLA.md).
function ArchiveConfigRow({ styles, theme }) {
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [server, setServer] = useState('');
  const [shareName, setShareName] = useState('');
  const [musicShareName, setMusicShareName] = useState('');
  const [shareUser, setShareUser] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${PI_SERVICE_URL}/archive/config`)
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  function startEditing() {
    setServer(config?.server ?? '');
    setShareName(config?.shareName ?? '');
    setMusicShareName(config?.musicShareName ?? '');
    setShareUser(config?.shareUser ?? '');
    setSharePassword('');
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${PI_SERVICE_URL}/archive/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server,
          shareName,
          musicShareName: musicShareName || null,
          shareUser,
          sharePassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update archive settings');
      setConfig((prev) => ({ ...prev, server, shareName, musicShareName: musicShareName || null, shareUser }));
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
        <Text style={styles.label}>Archive destination</Text>
        <TextInput
          style={styles.input}
          placeholder="Server (hostname or IP)"
          placeholderTextColor={theme.placeholder}
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Clips share (e.g. TeslaCam/ModelY)"
          placeholderTextColor={theme.placeholder}
          value={shareName}
          onChangeText={setShareName}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Music share (optional)"
          placeholderTextColor={theme.placeholder}
          value={musicShareName}
          onChangeText={setMusicShareName}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={theme.placeholder}
          value={shareUser}
          onChangeText={setShareUser}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.placeholder}
          value={sharePassword}
          onChangeText={setSharePassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.warning}>
          Saving reboots the Pi to apply the change — this takes a minute or two.
        </Text>
        <View style={styles.editButtons}>
          <Pressable style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={styles.saveButton}
            onPress={save}
            disabled={saving || !server || !shareName || !shareUser || !sharePassword}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  let subtitle = 'Loading…';
  if (config != null) {
    subtitle = config.configured
      ? `${config.server}/${config.shareName}${config.reachable === false ? ' · unreachable' : ''}`
      : 'Not configured';
  }

  return <SettingsRow label="Archive settings" subtitle={subtitle} onPress={startEditing} styles={styles} />;
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
      <ArchiveConfigRow styles={styles} theme={theme} />
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
