import { StyleSheet, Text } from 'react-native';

import { formatearPesos } from '@/utils/formato';

// Monto en pesos en negrita, para usar dentro de un texto: "Prestado: <Monto valor={...} />".
// `enteros` lo muestra redondeado a pesos enteros (ver formatearPesos).
export function Monto({ valor, enteros }: { valor: number; enteros?: boolean }) {
  return <Text style={styles.monto}>{formatearPesos(valor, { enteros })}</Text>;
}

const styles = StyleSheet.create({
  monto: {
    fontWeight: '700',
  },
});
