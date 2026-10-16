import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const COLOR_SELECCION = Colors.primary;

type Props = {
  texto: string;
  detalle?: string;
  seleccionada: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode; // contenido extra debajo del texto
};

// Tarjeta grande para elegir una opción entre varias (cliente, frecuencia).
export function OpcionGrande({ texto, detalle, seleccionada, onPress, style, children }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionada }}
      style={[
        styles.opcion,
        {
          backgroundColor: seleccionada ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: seleccionada ? COLOR_SELECCION : theme.border,
        },
        style,
      ]}>
      <ThemedText style={styles.texto}>{texto}</ThemedText>
      {detalle ? <ThemedText style={styles.detalle}>{detalle}</ThemedText> : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  opcion: {
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  detalle: {
    fontSize: 20,
    lineHeight: 28,
  },
});
