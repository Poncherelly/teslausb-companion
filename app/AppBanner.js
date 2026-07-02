import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PI_SERVICE_URL } from './config';
import { useTheme } from './theme';

// Placeholder mark, not a designed logo — swap in a real app icon
// asset whenever one exists.
function AppIcon({ styles }) {
  return (
    <View style={styles.icon}>
      <Text style={styles.iconText}>T</Text>
    </View>
  );
}

export default function AppBanner() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [hostname, setHostname] = useState(null);
  const [connected, setConnected] = useState(null); // null = still checking

  useEffect(() => {
    let cancelled = false;

    function checkStatus() {
      fetch(`${PI_SERVICE_URL}/system/status`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setHostname(data.hostname);
          setConnected(true);
        })
        .catch(() => {
          if (!cancelled) setConnected(false);
        });
    }

    // Retries periodically instead of only checking once at mount —
    // a one-off transient failure (e.g. pi-service mid-restart)
    // otherwise left this stuck showing "Pi not reachable" until the
    // whole app was closed and reopened.
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <AppIcon styles={styles} />
        <Text style={styles.appName}>TeslaUSB Companion</Text>
      </View>
      <Text style={styles.piName}>
        {connected === null && 'Connecting…'}
        {connected === true && hostname}
        {connected === false && 'Pi not reachable'}
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    banner: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    icon: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    iconText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    appName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    piName: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 2,
      marginLeft: 36,
    },
  });
}
