import { useColorScheme } from 'react-native';

const light = {
  background: '#fff',
  surface: '#f7f7f7',
  border: '#eee',
  text: '#111',
  textSecondary: '#666',
  textMuted: '#888',
  placeholder: '#f2f2f2',
  accent: '#0066cc',
  error: '#d00',
  inputBorder: '#ccc',
};

const dark = {
  background: '#000',
  surface: '#1c1c1e',
  border: '#2c2c2e',
  text: '#f2f2f2',
  textSecondary: '#aaa',
  textMuted: '#888',
  placeholder: '#2c2c2e',
  accent: '#4da3ff',
  error: '#ff6b6b',
  inputBorder: '#444',
};

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
