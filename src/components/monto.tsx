import { StyleSheet, Text } from 'react-native';

import { formatearPesos } from '@/utils/formato';

// Monto en pesos en negrita, para usar dentro de un texto: "Prestado: <Monto valor={...} />".
export function Monto({ valor }: { valor: number }) {
  return <Text style={styles.monto}>{formatearPesos(valor)}</Text>;
}

const styles = StyleSheet.create({
  monto: {
    fontWeight: '700',
  },
});
