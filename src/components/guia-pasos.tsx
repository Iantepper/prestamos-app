import { StyleSheet, Text, View } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { ThemedText } from '@/components/themed-text';
import { Colors, EstiloTarjeta, Spacing } from '@/constants/theme';

export type Paso = {
  texto: string;
  hecho?: boolean;
  boton?: { texto: string; onPress: () => void };
};

type Props = { titulo: string; pasos: Paso[] };

// Guía de pasos numerados para los estados vacíos, con un botón que lleva a cada acción.
export function GuiaPasos({ titulo, pasos }: Props) {
  return (
    <View style={styles.tarjeta}>
      <ThemedText style={styles.titulo}>{titulo}</ThemedText>
      {pasos.map((paso, i) => (
        <View key={paso.texto} style={styles.paso}>
          <View style={styles.fila}>
            <View style={[styles.numero, paso.hecho && styles.numeroHecho]}>
              <Text style={styles.textoNumero}>{paso.hecho ? '✓' : i + 1}</Text>
            </View>
            <ThemedText style={styles.textoPaso}>
              {paso.texto}
              {paso.hecho ? ' (listo)' : ''}
            </ThemedText>
          </View>
          {paso.boton && !paso.hecho ? (
            <BotonGrande texto={paso.boton.texto} onPress={paso.boton.onPress} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const TAMANO_NUMERO = 40;

const styles = StyleSheet.create({
  tarjeta: {
    ...EstiloTarjeta,
    gap: Spacing.four,
  },
  titulo: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  paso: {
    gap: Spacing.two,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  numero: {
    width: TAMANO_NUMERO,
    height: TAMANO_NUMERO,
    borderRadius: TAMANO_NUMERO / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroHecho: {
    backgroundColor: Colors.textSecondary,
  },
  textoNumero: {
    color: Colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  textoPaso: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
  },
});
