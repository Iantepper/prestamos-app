import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

const COLOR_PRINCIPAL = Colors.primary;
const COLOR_PELIGRO = Colors.danger;

type Props = {
  texto: string;
  onPress: () => void;
  // principal: verde lleno; secundario: borde verde (acciones menos importantes);
  // peligro: rojo (acciones que no se pueden deshacer).
  variante?: 'principal' | 'secundario' | 'peligro';
};

// Botón grande y de alto contraste para las acciones principales.
export function BotonGrande({ texto, onPress, variante = 'principal' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.boton,
        variante === 'secundario' && styles.secundario,
        variante === 'peligro' && styles.peligro,
        pressed && styles.presionado,
      ]}>
      <Text style={[styles.texto, variante === 'secundario' && styles.textoSecundario]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 60,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: COLOR_PRINCIPAL,
    backgroundColor: COLOR_PRINCIPAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secundario: {
    backgroundColor: 'transparent',
  },
  peligro: {
    backgroundColor: COLOR_PELIGRO,
    borderColor: COLOR_PELIGRO,
  },
  presionado: {
    opacity: 0.8,
  },
  texto: {
    color: Colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  textoSecundario: {
    color: COLOR_PRINCIPAL,
  },
});
