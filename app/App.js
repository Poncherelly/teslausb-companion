import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { FlatList, StyleSheet, Text, View } from 'react-native';

// Hardcoded for this first vertical-slice test. Once BLE pairing exists,
// the app will learn the Pi's address during setup instead.
const PI_SERVICE_URL = 'http://192.168.50.103:3000';

export default function App() {
  const [clips, setClips] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${PI_SERVICE_URL}/clips`)
      .then((res) => res.json())
      .then((data) => setClips(data.clips))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Clips</Text>
      {error && <Text style={styles.error}>Error: {error}</Text>}
      <FlatList
        style={styles.list}
        data={clips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.filename}>{item.filename}</Text>
            <Text style={styles.meta}>
              {item.category} · {item.state}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  error: {
    color: 'red',
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  row: {
    paddingVertical: 10,
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
});
