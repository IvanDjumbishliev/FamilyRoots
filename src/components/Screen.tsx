import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';

export function Screen({
  children,
  keyboardOffset = 0,
}: PropsWithChildren<{ keyboardOffset?: number }>) {
  const { theme } = useTheme();
  const { gutter, tablet } = useLayout();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: tablet ? 36 : 20,
            paddingBottom: 48,
          }}
        >
          <View
            role={Platform.OS === 'web' ? 'main' : undefined}
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: theme.layout.contentWidth,
              gap: tablet ? 28 : 20,
            }}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
