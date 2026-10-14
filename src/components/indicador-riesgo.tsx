import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { PERFILES, type NivelRiesgo } from '@/utils/riesgo';

// Etiqueta con el perfil de riesgo del cliente: siempre color y texto juntos.
export function IndicadorRiesgo({ nivel }: { nivel: NivelRiesgo }) {
  const perfil = PERFILES[nivel];
  return (
    <View
      style={[styles.etiqueta, { backgroundColor: perfil.color }]}
      accessibilityLabel={`Perfil: ${perfil.texto}`}>
      <Text style={[styles.texto, { color: perfil.colorTexto }]}>{perfil.texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
});
