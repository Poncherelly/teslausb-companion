import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PI_SERVICE_URL } from './config';

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Breadcrumb({ path, onNavigate }) {
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

export default function MusicBrowser() {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${PI_SERVICE_URL}/music?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setEntries([]);
        } else {
          setError(null);
          setEntries(data.entries);
        }
      })
      .catch((err) => setError(err.message));
  }, [path]);

  return (
    <View style={styles.container}>
      <Breadcrumb path={path} onNavigate={setPath} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  breadcrumb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f7f7f7',
  },
  breadcrumbSegment: {
    flexDirection: 'row',
  },
  breadcrumbLink: {
    fontSize: 14,
    color: '#0066cc',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#999',
  },
  error: {
    color: 'red',
    marginHorizontal: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
});
