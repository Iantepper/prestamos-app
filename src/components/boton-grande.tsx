import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

const COLOR_PRINCIPAL = Colors.primary;
const COLOR_PELIGRO = Colors.danger;

type Props = {
  texto: string;
  onPress: () => void;
  // principal: verde lleno; secundario: borde verde (acciones menos importantes);
  // peligro: rojo lleno (acción principal que no se puede deshacer);
  // peligroBorde: borde y texto rojos sobre blanco (acción que no se puede deshacer,
  // pero que no debe ser el botón dominante, por ejemplo "Eliminar" en una lista).
  variante?: 'principal' | 'secundario' | 'peligro' | 'peligroBorde';
  style?: StyleProp<ViewStyle>;
  // Ícono a la izquierda del texto: SF Symbol en iOS y Material Symbol en Android y web.
  icono?: SymbolViewProps['name'];
};

// Botón grande y de alto contraste para las acciones principales.
export function BotonGrande({ texto, onPress, variante = 'principal', style, icono }: Props) {
  const colorTexto =
    variante === 'secundario'
      ? COLOR_PRINCIPAL
      : variante === 'peligroBorde'
        ? COLOR_PELIGRO
        : Colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.boton,
        variante === 'secundario' && styles.secundario,
        variante === 'peligro' && styles.peligro,
        variante === 'peligroBorde' && styles.peligroBorde,
        pressed && styles.presionado,
        style,
      ]}>
      <View style={styles.contenido}>
        {icono ? <SymbolView name={icono} size={26} tintColor={colorTexto} /> : null}
        <Text style={[styles.texto, { color: colorTexto }]}>{texto}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 60,
    paddingHorizontal: Spacing.three,
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
  peligroBorde: {
    backgroundColor: Colors.backgroundElement,
    borderColor: COLOR_PELIGRO,
  },
  presionado: {
    opacity: 0.8,
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  texto: {
    flexShrink: 1, // si no entra en una línea, el texto baja de renglón en vez de salirse
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
