import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function emailDestination(route: '/verify-email' | '/reset-password') {
  if (Platform.OS === 'web') return new URL(route, window.location.origin).href;
  return Linking.createURL(route, { scheme: 'familyroots' });
}

export const emailInstructions =
  'If the address can receive this request, we’ll send a code. Check your inbox and spam folder.';
