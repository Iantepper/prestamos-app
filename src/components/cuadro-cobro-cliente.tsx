import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { CampoMonto, useMonto } from '@/components/campo-monto';
import { CuadroModal } from '@/components/cuadro-modal';
import { useConfirmar } from '@/components/dialogos';
import { Monto } from '@/components/monto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EstiloTarjeta, Spacing } from '@/constants/theme';
import { listarCuotasPendientesCliente } from '@/db/pagos';
import { formatearPesos, hoyISO } from '@/utils/formato';
import { repartirPago, saldoTotal, type CuotaPendiente } from '@/utils/reparto';

type Props = {
  clienteId: number;
  cliente: string;
  montoInicial: number; // lo que hay que cobrar ahora (atrasadas más las de hoy)
  onConfirmar: (monto: number) => void;
  onCancelar: () => void;
};

// Cobro a un cliente: lo que paga se reparte solo entre sus cuotas pendientes, de la más vieja a
// la más nueva. Antes de confirmar muestra a qué cuotas se aplica.
export function CuadroCobroCliente({
  clienteId,
  cliente,
  montoInicial,
  onConfirmar,
  onCancelar,
}: Props) {
  const db = useSQLiteContext();
  const preguntar = useConfirmar();
  const [cuotas, setCuotas] = useState<CuotaPendiente[] | null>(null);
  const pagado = useMonto({ inicial: montoInicial });
  const [error, setError] = useState<string>();

  useEffect(() => {
    let activo = true;
    listarCuotasPendientesCliente(db, clienteId, hoyISO()).then((filas) => {
      if (activo) setCuotas(filas);
    });
    return () => {
      activo = false;
    };
  }, [db, clienteId]);

  const saldo = cuotas ? saldoTotal(cuotas) : 0;
  const montoNum = pagado.numero;
  const valido = cuotas !== null && montoNum > 0 && montoNum <= saldo;
  const aplicaciones = valido ? repartirPago(cuotas, montoNum) : [];

  const confirmar = async () => {
    if (!(montoNum > 0)) {
      setError('Escribí cuánto te pagó, por ejemplo 5.000');
      return;
    }
    if (montoNum > saldo) {
      setError(`No puede ser más de lo que debe: ${formatearPesos(saldo)}`);
      return;
    }
    setError(undefined);
    // Un cobro registrado no se puede borrar: se pide confirmación antes de guardarlo.
    const seguro = await preguntar({
      titulo: '¿Confirmás el cobro?',
      mensaje: `Vas a registrar que ${cliente} te pagó ${formatearPesos(montoNum)}.`,
      confirmar: 'Sí, cobré',
    });
    if (seguro) onConfirmar(montoNum);
  };

  return (
    <CuadroModal titulo={`Cobrar a ${cliente}`} onCerrar={onCancelar}>
      <ThemedView type="backgroundElement" style={styles.tarjeta}>
        {montoInicial > 0 ? (
          <ThemedText style={styles.total}>
            Cobrar ahora: <Monto valor={montoInicial} />
          </ThemedText>
        ) : null}
        {cuotas ? (
          <ThemedText style={styles.texto}>
            Debe en total: <Monto valor={saldo} />
          </ThemedText>
        ) : null}
      </ThemedView>

      <CampoMonto etiqueta="¿Cuánto te pagó? ($)" monto={pagado} error={error} />

      {aplicaciones.length > 0 ? (
        <View style={styles.reparto}>
          <ThemedText style={styles.subtitulo}>Se aplica a:</ThemedText>
          {aplicaciones.map((a) => (
            <ThemedText key={a.cuotaId} style={styles.texto}>
              Cuota {a.numero}:{' '}
              {a.completa ? (
                'completa'
              ) : (
                <>
                  <Monto valor={a.monto + a.mora} /> de <Monto valor={a.adeudado} />
                </>
              )}
            </ThemedText>
          ))}
        </View>
      ) : null}

      <BotonGrande texto="Confirmar cobro" onPress={confirmar} />
      <BotonGrande texto="Cancelar" variante="secundario" onPress={onCancelar} />
    </CuadroModal>
  );
}

const styles = StyleSheet.create({
  tarjeta: EstiloTarjeta,
  reparto: {
    gap: Spacing.one,
  },
  subtitulo: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
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
