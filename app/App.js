import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

// Hardcoded for this first vertical-slice test. Once BLE pairing exists,
// the app will learn the Pi's address during setup instead.
const PI_SERVICE_URL = 'http://192.168.50.103:3000';

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

function ClipRow({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.filename}>{item.filename}</Text>
      <Text style={styles.meta}>
        {new Date(item.timestamp).toLocaleString()} · {(item.size / 1024 / 1024).toFixed(0)} MB
      </Text>
    </View>
  );
}

function SectionHeader({ section }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState('device');
  const [clips, setClips] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab !== 'device') return;
    fetch(`${PI_SERVICE_URL}/clips`)
      .then((res) => res.json())
      .then((data) => setClips(data.clips))
      .catch((err) => setError(err.message));
  }, [tab]);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

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
      </View>

      {error && <Text style={styles.error}>Error: {error}</Text>}

      {tab === 'device' ? (
        <SectionList
          style={styles.list}
          sections={groupIntoSections(clips)}
          keyExtractor={(item) => item.id}
          renderItem={ClipRow}
          renderSectionHeader={SectionHeader}
          stickySectionHeadersEnabled
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Archive browsing isn't implemented yet — no archive-sync
            process exists to report what's been backed up.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderBottomColor: '#111',
  },
  tabLabel: {
    fontSize: 15,
    color: '#888',
  },
  tabLabelActive: {
    color: '#111',
    fontWeight: '600',
  },
  error: {
    color: 'red',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 13,
    color: '#888',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filename: {
    fontSize: 15,
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
