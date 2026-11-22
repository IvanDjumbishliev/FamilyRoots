import type { Ref } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type View,
} from 'react-native';

type Props = PressableProps & {
  ref?: Ref<View>;
  onClick?: PressableProps['onPress'];
};

export function LinkPressable({ onClick, onPress, ...props }: Props) {
  // Expo Router injects onClick on web. React Native Web Pressable dispatches
  // its own click handler to onPress, so forward the injected handler there.
  return (
    <Pressable
      {...props}
      onPress={Platform.OS === 'web' ? (onClick ?? onPress) : onPress}
    />
  );
}
