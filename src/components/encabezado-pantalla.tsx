import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = { titulo: string; descripcion: string };

// Título grande de cada pantalla principal, con una línea que explica para qué sirve.
export function EncabezadoPantalla({ titulo, descripcion }: Props) {
  return (
    <View style={styles.contenedor}>
      <ThemedText style={styles.titulo} accessibilityRole="header">
        {titulo}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{descripcion}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  titulo: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
  },
});
