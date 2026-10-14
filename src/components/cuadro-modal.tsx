import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  titulo: string;
  onCerrar: () => void; // botón "atrás" de Android
  children: ReactNode;
};

// Pantalla completa que sube desde abajo, para formularios cortos (editar, cobrar).
export function CuadroModal({ titulo, onCerrar, children }: Props) {
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets>
            <ThemedText type="subtitle">{titulo}</ThemedText>
            {children}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
