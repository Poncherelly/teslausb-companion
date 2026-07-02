import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

// Matches the real archive structure confirmed 2026-07-02: only
// SavedClips/SentryClips are ever synced there (RecentClips, the
// rolling buffer, isn't archived) — see docs/DATA_MODEL.md. Listed in
// this order (not alphabetical) to match Tesla's own dashcam tab
// convention, same as the flat "On device" list.
const CATEGORY_LABELS = {
  saved: 'SavedClips',
  sentry: 'SentryClips',
  recent: 'RecentClips',
};
const CATEGORY_ORDER = ['saved', 'sentry', 'recent'];

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Breadcrumb({ segments, onNavigate, styles }) {
  return (
    <View style={styles.breadcrumb}>
      <Pressable onPress={() => onNavigate(0)}>
        <Text style={styles.breadcrumbLink}>Archive</Text>
      </Pressable>
      {segments.map((label, i) => (
        <View key={i} style={styles.breadcrumbSegment}>
          <Text style={styles.breadcrumbSeparator}> / </Text>
          <Pressable onPress={() => onNavigate(i + 1)}>
            <Text style={styles.breadcrumbLink}>{label}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// Three-level drill-down (Category -> Event -> Files) rather than the
// flat categorized list the "On device" tab uses — mirrors the same
// folder-browsing pattern as MusicBrowser.js, per explicit request
// 2026-07-03. Category/event levels are derived client-side from one
// GET /clips?source=archive fetch (already needed anyway); only the
// file level needs its own request, since listing every file for every
// event up front would be far slower than the already-slow ~20s full
// clip scan.
export default function ArchiveBrowser({ onPlay }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(null);
  const [event, setEvent] = useState(null);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${PI_SERVICE_URL}/clips?source=archive`)
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!event) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    setFilesLoading(true);
    fetch(`${PI_SERVICE_URL}/clips/${encodeURIComponent(event.id)}/files`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFiles(data.files || []);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  function navigateTo(depth) {
    if (depth <= 0) {
      setCategory(null);
      setEvent(null);
    } else if (depth === 1) {
      setEvent(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.textMuted} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // Level 2: files within one event.
  if (category && event) {
    return (
      <View style={styles.container}>
        <Breadcrumb
          segments={[CATEGORY_LABELS[category], event.timestamp]}
          onNavigate={navigateTo}
          styles={styles}
        />
        {filesLoading ? (
          <ActivityIndicator color={theme.textMuted} style={styles.centerSpinner} />
        ) : (
          <FlatList
            data={files}
            keyExtractor={(f) => f.name}
            renderItem={({ item }) => {
              const isVideo = item.name.endsWith('.mp4');
              return (
                <Pressable
                  style={styles.row}
                  disabled={!isVideo}
                  onPress={() => onPlay({ id: event.id, file: item.name })}
                >
                  <Text style={styles.icon}>{isVideo ? '🎬' : '📄'}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{formatSize(item.size)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    );
  }

  // Level 1: events within one category.
  if (category) {
    const events = clips
      .filter((c) => c.category === category)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return (
      <View style={styles.container}>
        <Breadcrumb segments={[CATEGORY_LABELS[category]]} onNavigate={navigateTo} styles={styles} />
        <FlatList
          data={events}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setEvent(item)}>
              {category !== 'recent' ? (
                <Image
                  style={styles.thumbnail}
                  source={{ uri: `${PI_SERVICE_URL}/clips/${item.id}/thumbnail` }}
                />
              ) : (
                <Text style={styles.icon}>📁</Text>
              )}
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.timestamp}</Text>
                <Text style={styles.meta}>{formatSize(item.size)}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    );
  }

  // Level 0: category folders — only categories with at least one real
  // clip are shown (RecentClips never appears for the real archive).
  const categoriesPresent = CATEGORY_ORDER.filter((key) => clips.some((c) => c.category === key));
  return (
    <View style={styles.container}>
      <FlatList
        data={categoriesPresent}
        keyExtractor={(key) => key}
        renderItem={({ item: key }) => {
          const count = clips.filter((c) => c.category === key).length;
          return (
            <Pressable style={styles.row} onPress={() => setCategory(key)}>
              <Text style={styles.icon}>📁</Text>
              <View style={styles.rowText}>
                <Text style={styles.name}>{CATEGORY_LABELS[key]}</Text>
                <Text style={styles.meta}>
                  {count} {count === 1 ? 'event' : 'events'}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              No archived clips yet — check Settings to confirm the archive destination is configured.
            </Text>
          </View>
        }
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    centerSpinner: {
      marginTop: 24,
    },
    errorText: {
      color: theme.error,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: 'center',
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    icon: {
      fontSize: 20,
      marginRight: 12,
      width: 20,
      textAlign: 'center',
    },
    thumbnail: {
      width: 64,
      height: 48,
      borderRadius: 4,
      backgroundColor: theme.surface,
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
  });
}
