import { Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';

type Props = {
  texto: string;
  onPress: () => void;
};

// Botón grande y de alto contraste para las acciones principales.
export function BotonGrande({ texto, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.boton, pressed && styles.presionado]}>
      <Text style={styles.texto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 60,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: {
    opacity: 0.8,
  },
  texto: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
});
