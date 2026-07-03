import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Streams the same way video playback does — GET /music/download
// supports HTTP Range requests (Express's res.sendFile), so the
// player can seek without downloading the whole file first.
function NowPlayingBar({ track, onClose, styles }) {
  const player = useAudioPlayer(track.url);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
    // Only re-run when the track itself changes, not on every player
    // identity change from useAudioPlayer's own internals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.url]);

  return (
    <View style={styles.nowPlaying}>
      <View style={styles.nowPlayingInfo}>
        <Text style={styles.nowPlayingName} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={styles.nowPlayingTime}>
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      </View>
      <Pressable
        style={styles.nowPlayingButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Text style={styles.nowPlayingButtonText}>{status.playing ? '⏸' : '▶'}</Text>
      </Pressable>
      <Pressable style={styles.nowPlayingButton} onPress={onClose}>
        <Text style={styles.nowPlayingButtonText}>✕</Text>
      </Pressable>
    </View>
  );
}

function Breadcrumb({ path, onNavigate, styles }) {
  const segments = path ? path.split('/') : [];
  return (
    <View style={styles.breadcrumb}>
      <Pressable onPress={() => onNavigate('')}>
        <Text style={styles.breadcrumbLink}>Music</Text>
      </Pressable>
      {segments.map((segment, i) => (
        <View key={i} style={styles.breadcrumbSegment}>
          <Text style={styles.breadcrumbSeparator}> / </Text>
          <Pressable onPress={() => onNavigate(segments.slice(0, i + 1).join('/'))}>
            <Text style={styles.breadcrumbLink}>{segment}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function SourceToggle({ source, onChange, styles }) {
  return (
    <View style={styles.sourceToggle}>
      {[
        { key: 'pi', label: 'On device' },
        { key: 'archive', label: 'Archive' },
      ].map(({ key, label }) => (
        <Pressable
          key={key}
          style={[styles.sourceButton, source === key && styles.sourceButtonActive]}
          onPress={() => onChange(key)}
        >
          <Text style={[styles.sourceButtonLabel, source === key && styles.sourceButtonLabelActive]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MusicBrowser() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [source, setSource] = useState('pi');
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const [playingTrack, setPlayingTrack] = useState(null);
  const [uploading, setUploading] = useState(false);

  function changeSource(next) {
    setSource(next);
    setPath('');
    setPlayingTrack(null);
  }

  function playFile(item) {
    const filePath = path ? `${path}/${item.name}` : item.name;
    setPlayingTrack({
      name: item.name,
      url: `${PI_SERVICE_URL}/music/download?source=${source}&path=${encodeURIComponent(filePath)}`,
    });
  }

  function refresh() {
    let cancelled = false;
    fetch(`${PI_SERVICE_URL}/music?source=${source}&path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setEntries([]);
        } else {
          setError(null);
          setEntries(data.entries);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(refresh, [source, path]);

  // Upload/delete only ever target the archive share — teslausb's own
  // copy-music.sh then syncs changes down to the car on its own
  // schedule (see pi-service/src/routes/music.js). Uploading directly
  // to the on-device partition isn't supported since it's live-exposed
  // to the car as a USB gadget.
  async function handleUpload() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });
      const res = await fetch(
        `${PI_SERVICE_URL}/music/upload?source=archive&path=${encodeURIComponent(path)}`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      refresh();
    } catch (err) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(item) {
    const filePath = path ? `${path}/${item.name}` : item.name;
    Alert.alert('Delete this file?', `${item.name} will be removed from the archive.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(
              `${PI_SERVICE_URL}/music?source=archive&path=${encodeURIComponent(filePath)}`,
              { method: 'DELETE' }
            );
            if (!res.ok && res.status !== 204) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Delete failed');
            }
            refresh();
          } catch (err) {
            Alert.alert('Delete failed', err.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <SourceToggle source={source} onChange={changeSource} styles={styles} />
      <Breadcrumb path={path} onNavigate={setPath} styles={styles} />
      {source === 'archive' && (
        <Pressable style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Text style={styles.uploadButtonText}>+ Upload music here</Text>
          )}
        </Pressable>
      )}
      {error && <Text style={styles.error}>Error: {error}</Text>}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowMain}
              onPress={() =>
                item.type === 'folder'
                  ? setPath(path ? `${path}/${item.name}` : item.name)
                  : playFile(item)
              }
            >
              <Text style={styles.icon}>{item.type === 'folder' ? '📁' : '🎵'}</Text>
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                {item.type === 'file' && <Text style={styles.meta}>{formatSize(item.size)}</Text>}
              </View>
            </Pressable>
            {source === 'archive' && item.type === 'file' && (
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteButtonText}>🗑</Text>
              </Pressable>
            )}
          </View>
        )}
      />
      {playingTrack && (
        <NowPlayingBar
          key={playingTrack.url}
          track={playingTrack}
          onClose={() => setPlayingTrack(null)}
          styles={styles}
        />
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    sourceToggle: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 8,
    },
    sourceButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: theme.surface,
    },
    sourceButtonActive: {
      backgroundColor: theme.accent,
    },
    sourceButtonLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    sourceButtonLabelActive: {
      color: '#fff',
      fontWeight: '600',
    },
    breadcrumb: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.surface,
    },
    breadcrumbSegment: {
      flexDirection: 'row',
    },
    breadcrumbLink: {
      fontSize: 14,
      color: theme.accent,
    },
    breadcrumbSeparator: {
      fontSize: 14,
      color: theme.textMuted,
    },
    error: {
      color: theme.error,
      marginHorizontal: 16,
      marginTop: 8,
    },
    uploadButton: {
      alignItems: 'center',
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.accent,
      borderRadius: 8,
      borderStyle: 'dashed',
    },
    uploadButtonText: {
      fontSize: 14,
      color: theme.accent,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    deleteButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    deleteButtonText: {
      fontSize: 18,
    },
    icon: {
      fontSize: 20,
      marginRight: 12,
    },
    rowText: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      color: theme.text,
    },
    meta: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    nowPlaying: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    nowPlayingInfo: {
      flex: 1,
      marginRight: 8,
    },
    nowPlayingName: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '600',
    },
    nowPlayingTime: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
    nowPlayingButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    nowPlayingButtonText: {
      fontSize: 18,
      color: theme.accent,
    },
  });
}
