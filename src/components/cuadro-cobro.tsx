import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { CampoTexto } from '@/components/campo-texto';
import { CuadroModal } from '@/components/cuadro-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { escribirMonto, formatearPesos, leerMonto } from '@/utils/formato';

type Props = {
  numeroCuota: number;
  cliente: string;
  montoCuota: number;
  montoPagado: number;
  diasAtraso: number;
  recargo: number; // recargo por mora que falta cobrar
  // `monto` es la parte que va a la cuota y `mora` la que va al recargo.
  onConfirmar: (pago: { monto: number; mora: number }) => void;
  onCancelar: () => void;
};

// Cuadro para cobrar una cuota: muestra el total y deja cambiarlo si el cliente paga una parte.
export function CuadroCobro({
  numeroCuota,
  cliente,
  montoCuota,
  montoPagado,
  diasAtraso,
  recargo,
  onConfirmar,
  onCancelar,
}: Props) {
  const total = redondear(montoCuota - montoPagado + recargo);
  const [cobrado, setCobrado] = useState(() => escribirMonto(total));
  const [error, setError] = useState<string>();

  const confirmar = () => {
    const cobradoNum = leerMonto(cobrado);
    if (!(cobradoNum > 0)) {
      setError('Escribí cuánto te paga, por ejemplo 5000');
      return;
    }
    if (cobradoNum > total) {
      setError(`No puede ser más que ${formatearPesos(total)}`);
      return;
    }
    setError(undefined);
    // Lo cobrado cubre primero el recargo por mora y el resto va a la cuota.
    const mora = Math.min(cobradoNum, recargo);
    // Un cobro registrado no se puede borrar: se pide confirmación antes de guardarlo.
    Alert.alert(
      '¿Confirmás el cobro?',
      `Vas a registrar que ${cliente} te pagó ${formatearPesos(cobradoNum)}.`,
      [
        { text: 'No, volver', style: 'cancel' },
        {
          text: 'Sí, cobré',
          onPress: () => onConfirmar({ monto: redondear(cobradoNum - mora), mora }),
        },
      ]
    );
  };

  return (
    <CuadroModal titulo={`Cobrar cuota ${numeroCuota} a ${cliente}`} onCerrar={onCancelar}>
      <ThemedView type="backgroundElement" style={styles.tarjeta}>
        <ThemedText style={styles.texto}>Monto de la cuota: {formatearPesos(montoCuota)}</ThemedText>
        {montoPagado > 0 ? (
          <ThemedText style={styles.texto}>Ya pagó: {formatearPesos(montoPagado)}</ThemedText>
        ) : null}
        {recargo > 0 ? (
          <ThemedText style={styles.texto}>
            Recargo por mora ({textoDias(diasAtraso)} de atraso): {formatearPesos(recargo)}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.total}>Total a cobrar: {formatearPesos(total)}</ThemedText>
      </ThemedView>

      <CampoTexto
        etiqueta="Cuánto te paga ahora ($)"
        value={cobrado}
        onChangeText={setCobrado}
        error={error}
        keyboardType="decimal-pad"
      />

      <BotonGrande texto="Confirmar cobro" onPress={confirmar} />
      <BotonGrande texto="Cancelar" variante="secundario" onPress={onCancelar} />
    </CuadroModal>
  );
}

export function textoDias(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  total: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
});
