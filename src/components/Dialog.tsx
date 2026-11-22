import { Modal, Pressable, ScrollView, View } from 'react-native';

import { DialogContent } from '@/components/DialogContent';
import { useTheme } from '@/hooks/useTheme';
import type { DialogProps } from '@/types/dialog';

export function Dialog({ open, title, children, onClose }: DialogProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={open} transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          bounces={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          <View
            accessibilityViewIsModal
            style={{ width: '100%', maxWidth: 460 }}
          >
            <DialogContent title={title} onClose={onClose}>
              {children}
            </DialogContent>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
