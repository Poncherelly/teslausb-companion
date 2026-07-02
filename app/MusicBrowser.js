import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  function changeSource(next) {
    setSource(next);
    setPath('');
  }

  useEffect(() => {
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
  }, [source, path]);

  return (
    <View style={styles.container}>
      <SourceToggle source={source} onChange={changeSource} styles={styles} />
      <Breadcrumb path={path} onNavigate={setPath} styles={styles} />
      {error && <Text style={styles.error}>Error: {error}</Text>}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={item.type !== 'folder'}
            onPress={() => setPath(path ? `${path}/${item.name}` : item.name)}
          >
            <Text style={styles.icon}>{item.type === 'folder' ? '📁' : '🎵'}</Text>
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              {item.type === 'file' && <Text style={styles.meta}>{formatSize(item.size)}</Text>}
            </View>
          </Pressable>
        )}
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
