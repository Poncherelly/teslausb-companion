import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PI_SERVICE_URL } from './config';
import { subscribeToEvents } from './events';
import { useTheme } from './theme';

// Real logo (172x96, ~1.79:1 aspect ratio, background chroma-keyed
// transparent) — provided 2026-07-02. Sits on an explicit white oval
// regardless of app theme, since the logo itself reads poorly directly
// on a dark background.
const LOGO = require('./assets/banner-logo.png');
const LOGO_ASPECT_RATIO = 172 / 96;
const LOGO_HEIGHT = 32;
const PILL_PADDING_H = 14;
const PILL_PADDING_V = 6;
const PILL_WIDTH = LOGO_HEIGHT * LOGO_ASPECT_RATIO + PILL_PADDING_H * 2;
const PILL_HEIGHT = LOGO_HEIGHT + PILL_PADDING_V * 2;

export default function AppBanner() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [hostname, setHostname] = useState(null);
  const [connected, setConnected] = useState(null); // null = still checking
  const [liveStatus, setLiveStatus] = useState(null);

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

  // Live archive-sync status (GET /events, added 2026-07-03) — shows
  // real activity (archiving, syncing music, waiting for the car to be
  // idle) as an extra line under the hostname while something's
  // happening, clearing once archiveloop reports it's finished.
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (event.type === 'idle') {
        setLiveStatus(null);
      } else {
        setLiveStatus(event.message);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <View style={styles.logoPill}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>TeslaUSB Companion</Text>
      </View>
      <Text style={styles.piName}>
        {connected === null && 'Connecting…'}
        {connected === true && hostname}
        {connected === false && 'Pi not reachable'}
      </Text>
      {liveStatus && <Text style={styles.liveStatus}>{liveStatus}</Text>}
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
    logoPill: {
      width: PILL_WIDTH,
      height: PILL_HEIGHT,
      borderRadius: PILL_HEIGHT / 2,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    logo: {
      width: LOGO_HEIGHT * LOGO_ASPECT_RATIO,
      height: LOGO_HEIGHT,
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
      marginLeft: PILL_WIDTH + 10,
    },
    liveStatus: {
      fontSize: 12,
      color: theme.accent,
      marginTop: 2,
      marginLeft: PILL_WIDTH + 10,
    },
  });
}
