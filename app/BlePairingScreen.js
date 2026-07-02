import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// Must match pi-service/src/ble/peripheral.js exactly.
const SERVICE_UUID = 'e5eab36e-5fca-456d-9419-4db713b627ea';
const CHAR_UUIDS = {
  deviceInfo: 'e5eab36e-5fca-456d-9419-4db713b627eb',
  claimCode: 'e5eab36e-5fca-456d-9419-4db713b627ec',
  wifiConfig: 'e5eab36e-5fca-456d-9419-4db713b627ed',
  adminPassword: 'e5eab36e-5fca-456d-9419-4db713b627ee',
  status: 'e5eab36e-5fca-456d-9419-4db713b627ef',
};

function encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function decode(base64) {
  return Buffer.from(base64, 'base64').toString('utf8');
}

async function requestAndroidBlePermissions() {
  if (Platform.OS !== 'android') return true;

  // BLUETOOTH_SCAN/BLUETOOTH_CONNECT only exist on Android 12+ (API 31+)
  // — requesting permissions the OS doesn't recognize can prevent any
  // dialog from showing at all. Pre-12 relies on the legacy BLUETOOTH/
  // BLUETOOTH_ADMIN manifest permissions instead, which are
  // auto-granted at install time (no runtime prompt, by design).
  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  if (Platform.Version >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
  }

  const granted = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export default function BlePairingScreen({ visible, onClose }) {
  const managerRef = useRef(null);
  const deviceRef = useRef(null);
  const [step, setStep] = useState('scanning'); // scanning | found | claiming | claimed | wifi | done | error
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [statusText, setStatusText] = useState('idle');
  const [errorText, setErrorText] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    managerRef.current = new BleManager();

    async function start() {
      const ok = await requestAndroidBlePermissions();
      if (!ok) {
        setStep('error');
        setErrorText('Bluetooth permissions were not granted.');
        return;
      }

      managerRef.current.startDeviceScan([SERVICE_UUID], null, async (scanError, device) => {
        if (cancelled) return;
        if (scanError) {
          setStep('error');
          setErrorText(scanError.message);
          return;
        }
        if (!device) return;

        managerRef.current.stopDeviceScan();
        try {
          let connected = await device.connect();
          // Default BLE MTU only leaves ~20 usable bytes per write —
          // not enough for the WiFi config JSON payload. Android needs
          // this requested explicitly; iOS negotiates automatically
          // and doesn't expose requestMTU in the same way.
          if (Platform.OS === 'android') {
            connected = await connected.requestMTU(247);
          }
          await connected.discoverAllServicesAndCharacteristics();
          deviceRef.current = connected;

          const infoChar = await connected.readCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUIDS.deviceInfo
          );
          setDeviceInfo(JSON.parse(decode(infoChar.value)));

          connected.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUIDS.status,
            (monitorError, char) => {
              if (monitorError || !char?.value) return;
              setStatusText(decode(char.value));
            }
          );

          setStep('found');
        } catch (err) {
          setStep('error');
          setErrorText(err.message);
        }
      });
    }

    start();
    return () => {
      cancelled = true;
      managerRef.current?.stopDeviceScan();
      managerRef.current?.destroy();
    };
  }, [visible]);

  async function submitClaimCode() {
    setStep('claiming');
    setErrorText(null);
    try {
      await deviceRef.current.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHAR_UUIDS.claimCode,
        encode(claimCodeInput.trim())
      );
      setStep('claimed');
    } catch (err) {
      setStep('found');
      setErrorText('Claim code rejected — check the code shown on the Pi and try again.');
    }
  }

  async function submitWifi() {
    setStep('wifi-sending');
    setErrorText(null);
    try {
      await deviceRef.current.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHAR_UUIDS.wifiConfig,
        encode(JSON.stringify({ ssid, password }))
      );
      // The Pi reboots to apply this — see pi-service/src/ble/wifi-reconfigure.js
      // and docs/OPEN_QUESTIONS.md #12 (no live "connected" notification is
      // possible from the pre-reboot process).
      setStep('done');
    } catch (err) {
      setStep('claimed');
      setErrorText('Failed to send WiFi config: ' + err.message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>

        <Text style={styles.title}>Set up new device</Text>

        {step === 'scanning' && <Text style={styles.body}>Scanning for a TeslaUSB device nearby…</Text>}

        {step === 'error' && (
          <>
            <Text style={styles.error}>{errorText}</Text>
          </>
        )}

        {(step === 'found' || step === 'claiming') && (
          <>
            <Text style={styles.body}>
              Found device (serial ...{deviceInfo?.serial_last4}, firmware{' '}
              {deviceInfo?.fw_version}).{'\n\n'}
              Enter the claim code shown on the Pi:
            </Text>
            <TextInput
              style={styles.input}
              value={claimCodeInput}
              onChangeText={setClaimCodeInput}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
            />
            {errorText && <Text style={styles.error}>{errorText}</Text>}
            <Pressable
              style={styles.button}
              onPress={submitClaimCode}
              disabled={step === 'claiming' || claimCodeInput.length !== 6}
            >
              <Text style={styles.buttonText}>{step === 'claiming' ? 'Checking…' : 'Claim device'}</Text>
            </Pressable>
          </>
        )}

        {(step === 'claimed' || step === 'wifi-sending') && (
          <>
            <Text style={styles.body}>Device claimed. Enter your home WiFi details:</Text>
            <TextInput style={styles.input} value={ssid} onChangeText={setSsid} placeholder="WiFi network name" />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="WiFi password"
              secureTextEntry
            />
            {errorText && <Text style={styles.error}>{errorText}</Text>}
            <Pressable
              style={styles.button}
              onPress={submitWifi}
              disabled={step === 'wifi-sending' || !ssid || !password}
            >
              <Text style={styles.buttonText}>
                {step === 'wifi-sending' ? 'Sending…' : 'Connect to WiFi'}
              </Text>
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <Text style={styles.body}>
            WiFi details sent — the Pi is rebooting to apply them. This can take a
            minute or two; once it rejoins your network, close this screen and use
            the app as normal.
          </Text>
        )}

        <Text style={styles.statusLine}>BLE status: {statusText}</Text>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  close: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  closeText: {
    fontSize: 15,
    color: '#666',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: 'red',
    marginBottom: 12,
  },
  statusLine: {
    marginTop: 32,
    fontSize: 12,
    color: '#999',
  },
});
