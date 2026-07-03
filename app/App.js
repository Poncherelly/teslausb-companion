import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import ArchiveBrowser from './ArchiveBrowser';
import AppBanner from './AppBanner';
import BlePairingScreen from './BlePairingScreen';
import MusicBrowser from './MusicBrowser';
import SettingsScreen from './SettingsScreen';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

// Order/labels match Tesla's own in-car dashcam tab convention.
// See docs/ARCHITECTURE.md "Two-tab clip browser".
const CATEGORY_ORDER = [
  { key: 'saved', label: 'Saved' },
  { key: 'sentry', label: 'Sentry' },
  { key: 'recent', label: 'Recent' },
];

function groupIntoSections(clips) {
  return CATEGORY_ORDER.map(({ key, label }) => ({
    title: label,
    data: clips.filter((c) => c.category === key),
  })).filter((section) => section.data.length > 0);
}

// Only Saved/Sentry events have a real thumb.png from the car;
// RecentClips has none — see pi-service/src/lib/clips-scan.js.
const HAS_THUMBNAIL = new Set(['saved', 'sentry']);

function ClipRow({ item, onPress, styles }) {
  return (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
      {HAS_THUMBNAIL.has(item.category) ? (
        <Image
          style={styles.thumbnail}
          source={{ uri: `${PI_SERVICE_URL}/clips/${item.id}/thumbnail` }}
        />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.filename}>{item.filename}</Text>
        <Text style={styles.meta}>
          {new Date(item.timestamp).toLocaleString()} · {(item.size / 1024 / 1024).toFixed(0)} MB
          {item.state === 'archived' ? ' · Archived' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

// Streams directly from the same download endpoint — it already
// supports HTTP Range requests (confirmed against the real Pi), which
// is what lets the player seek without downloading the whole file
// first. `clip.file` (set by ArchiveBrowser's per-file playback) plays
// that specific camera-angle/sidecar file instead of the clip's
// representative front-camera file.
//
// "Delete from Pi" only ever shows for on-device clips with a real
// confirmed-archived state (clip.source === 'pi' && clip.state ===
// 'archived') — archive-sourced plays (from ArchiveBrowser) never set
// `source`/`state` at all, so the button is correctly absent there
// without needing a separate check; the backend independently
// re-verifies archived status at delete time regardless (see
// pi-service/src/routes/clips.js).
function VideoPlayerModal({ clip, onClose, onDeleted, styles }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const url = clip
    ? `${PI_SERVICE_URL}/clips/${encodeURIComponent(clip.id)}/download${
        clip.file ? `?file=${encodeURIComponent(clip.file)}` : ''
      }`
    : null;
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  const canDelete = clip?.source === 'pi' && clip?.state === 'archived';
  const filename = clip?.file ?? clip?.filename ?? 'clip.mp4';

  async function handleSave() {
    setSaving(true);
    try {
      // writeOnly=true — this app only ever saves clips, never reads the
      // existing library, so this triggers the narrower "add photos
      // only" permission prompt on iOS instead of full library access.
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow Photos access in your phone settings to save clips.');
        return;
      }
      const destination = new File(Paths.cache, filename);
      const downloaded = await File.downloadFileAsync(url, destination);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      downloaded.delete();
      Alert.alert('Saved', 'Clip saved to your Photos library.');
    } catch (err) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete this clip?',
      'This deletes it from the Pi only — the archived copy is unaffected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await fetch(`${PI_SERVICE_URL}/clips/${encodeURIComponent(clip.id)}`, {
                method: 'DELETE',
              });
              if (!res.ok && res.status !== 204) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to delete clip');
              }
              onDeleted?.(clip.id);
              onClose();
            } catch (err) {
              Alert.alert('Delete failed', err.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <Modal visible={clip != null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.playerContainer}>
        <Pressable style={styles.playerClose} onPress={onClose}>
          <Text style={styles.playerCloseText}>Close</Text>
        </Pressable>
        {clip && (
          <VideoView style={styles.playerVideo} player={player} allowsFullscreen contentFit="contain" />
        )}
        {clip && (
          <View style={styles.playerActions}>
            <Pressable style={styles.playerActionButton} onPress={handleSave} disabled={saving || deleting}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.playerActionText}>Save to Photos</Text>
              )}
            </Pressable>
            {canDelete && (
              <Pressable
                style={[styles.playerActionButton, styles.playerActionButtonDanger]}
                onPress={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.playerActionText}>Delete from Pi</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function SectionHeader({ section, styles }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );
}

export default function App() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [tab, setTab] = useState('device');
  const [clips, setClips] = useState([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playingClip, setPlayingClip] = useState(null);
  const [pairingVisible, setPairingVisible] = useState(false);

  // Archive has its own dedicated component (ArchiveBrowser) with its
  // own fetch/state, not shared with this on-device effect — splitting
  // them structurally rules out the class of race condition that hit
  // the shared-state version of this (see CHANGELOG "Fixed" entry
  // 2026-07-02: switching tabs before the much-slower archive fetch
  // resolved could let it overwrite on-device data, or vice versa).
  useEffect(() => {
    if (tab !== 'device') return;
    let cancelled = false;
    setClipsLoading(true);
    fetch(`${PI_SERVICE_URL}/clips?source=pi`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setClips(data.clips);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setClipsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  function handleClipDeleted(id) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <AppBanner />

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, tab === 'device' && styles.tabActive]}
          onPress={() => setTab('device')}
        >
          <Text style={[styles.tabLabel, tab === 'device' && styles.tabLabelActive]}>
            On device
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'archive' && styles.tabActive]}
          onPress={() => setTab('archive')}
        >
          <Text style={[styles.tabLabel, tab === 'archive' && styles.tabLabelActive]}>
            Archive
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'music' && styles.tabActive]}
          onPress={() => setTab('music')}
        >
          <Text style={[styles.tabLabel, tab === 'music' && styles.tabLabelActive]}>
            Music
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'settings' && styles.tabActive]}
          onPress={() => setTab('settings')}
        >
          <Text style={[styles.tabLabel, tab === 'settings' && styles.tabLabelActive]}>
            Settings
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>Error: {error}</Text>}

      {tab === 'device' && (
        clipsLoading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color={theme.textMuted} />
          </View>
        ) : groupIntoSections(clips).length > 0 ? (
          <SectionList
            style={styles.list}
            sections={groupIntoSections(clips)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ClipRow item={item} onPress={setPlayingClip} styles={styles} />}
            renderSectionHeader={({ section }) => <SectionHeader section={section} styles={styles} />}
            stickySectionHeadersEnabled
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No clips found on the device.</Text>
          </View>
        )
      )}
      {tab === 'archive' && <ArchiveBrowser onPlay={setPlayingClip} />}
      {tab === 'music' && <MusicBrowser />}
      {tab === 'settings' && <SettingsScreen onSetupDevice={() => setPairingVisible(true)} />}

      <VideoPlayerModal
        clip={playingClip}
        onClose={() => setPlayingClip(null)}
        onDeleted={handleClipDeleted}
        styles={styles}
      />
      <BlePairingScreen visible={pairingVisible} onClose={() => setPairingVisible(false)} />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 60,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.text,
    },
    tabLabel: {
      fontSize: 15,
      color: theme.textMuted,
    },
    tabLabelActive: {
      color: theme.text,
      fontWeight: '600',
    },
    error: {
      color: theme.error,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    list: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    sectionCount: {
      fontSize: 13,
      color: theme.textMuted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    thumbnail: {
      width: 64,
      height: 48,
      borderRadius: 4,
      backgroundColor: theme.surface,
      marginRight: 12,
    },
    thumbnailPlaceholder: {
      width: 64,
      height: 48,
      borderRadius: 4,
      backgroundColor: theme.placeholder,
      marginRight: 12,
    },
    rowText: {
      flex: 1,
    },
    filename: {
      fontSize: 15,
      color: theme.text,
    },
    meta: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    placeholderText: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: 'center',
    },
    playerContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    playerClose: {
      position: 'absolute',
      top: 50,
      right: 16,
      zIndex: 1,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 6,
    },
    playerCloseText: {
      color: '#fff',
      fontSize: 15,
    },
    playerVideo: {
      width: '100%',
      flex: 1,
    },
    playerActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 16,
      paddingBottom: 32,
      paddingHorizontal: 16,
    },
    playerActionButton: {
      flex: 1,
      maxWidth: 200,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    playerActionButtonDanger: {
      backgroundColor: theme.error,
    },
    playerActionText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
