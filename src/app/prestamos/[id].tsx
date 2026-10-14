import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CuadroCobro, textoDias } from '@/components/cuadro-cobro';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { registrarPago } from '@/db/pagos';
import {
  listarCuotas,
  obtenerPrestamo,
  type Cuota,
  type PrestamoDetalle,
} from '@/db/prestamos';
import { totalADevolver } from '@/utils/cuotas';
import { formatearFecha, formatearPesos, hoyISO } from '@/utils/formato';
import { calcularMoraPendiente } from '@/utils/mora';

const COLOR_PAGADA = '#2E7D32';
const COLOR_VENCIDA = '#D32F2F';

const TEXTO_FRECUENCIA = {
  semanal: 'por semana',
  quincenal: 'cada 15 días',
  mensual: 'por mes',
} as const;

export default function DetallePrestamoScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const prestamoId = Number(id);
  const [prestamo, setPrestamo] = useState<PrestamoDetalle | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [cuotaACobrar, setCuotaACobrar] = useState<Cuota | null>(null);

  useEffect(() => {
    let activo = true;
    Promise.all([obtenerPrestamo(db, prestamoId), listarCuotas(db, prestamoId)]).then(
      ([filaPrestamo, filasCuotas]) => {
        if (!activo) return;
        setPrestamo(filaPrestamo);
        setCuotas(filasCuotas);
        setCargando(false);
      }
    );
    return () => {
      activo = false;
    };
  }, [db, prestamoId, recarga]);

  if (cargando) return <ThemedView style={styles.container} />;

  if (!prestamo) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.contenido}>
          <ThemedText style={styles.texto}>No se encontró el préstamo.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const hoy = hoyISO();

  // Días de atraso y recargo por mora que todavía falta cobrar de una cuota.
  const moraDe = (cuota: Cuota) =>
    calcularMoraPendiente(
      {
        monto: cuota.monto,
        fechaVencimiento: cuota.fecha_vencimiento,
        moraPagada: cuota.mora_pagada,
      },
      prestamo.mora_diaria_pct,
      hoy
    );

  // Saldo: lo cobrado y lo que falta de cada cuota (los recargos por mora se cuentan aparte).
  const cobrado = redondear(cuotas.reduce((suma, q) => suma + q.monto_pagado, 0));
  const faltaCobrar = redondear(
    cuotas.reduce((suma, q) => suma + Math.max(0, q.monto - q.monto_pagado), 0)
  );
  const moraCobrada = redondear(cuotas.reduce((suma, q) => suma + q.mora_pagada, 0));

  const cobrar = async (cuota: Cuota, pago: { monto: number; mora: number }) => {
    try {
      await registrarPago(db, { cuotaId: cuota.id, fecha: hoy, ...pago });
    } catch {
      Alert.alert('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setCuotaACobrar(null);
    setRecarga((r) => r + 1);
    Alert.alert('Pago registrado');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido}>
        <ThemedText type="subtitle">{prestamo.cliente_nombre}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          {prestamo.estado === 'saldado' ? (
            <ThemedText style={[styles.destacado, styles.pagada]}>Préstamo saldado</ThemedText>
          ) : null}
          <ThemedText style={styles.texto}>Prestado: {formatearPesos(prestamo.monto)}</ThemedText>
          <ThemedText style={styles.texto}>Interés: {prestamo.tasa_interes} %</ThemedText>
          <ThemedText style={styles.texto}>
            Total a devolver:{' '}
            {formatearPesos(totalADevolver(prestamo.monto, prestamo.tasa_interes))}
          </ThemedText>
          <ThemedText style={styles.texto}>
            {prestamo.cant_cuotas} cuotas, {TEXTO_FRECUENCIA[prestamo.frecuencia]}
          </ThemedText>
          <ThemedText style={styles.texto}>
            Empezó el {formatearFecha(prestamo.fecha_inicio)}
          </ThemedText>
          {prestamo.mora_diaria_pct > 0 ? (
            <ThemedText style={styles.texto}>
              Recargo por mora: {prestamo.mora_diaria_pct} % por día
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          <ThemedText style={styles.texto}>Cobrado: {formatearPesos(cobrado)}</ThemedText>
          {moraCobrada > 0 ? (
            <ThemedText style={styles.texto}>
              Recargos por mora cobrados: {formatearPesos(moraCobrada)}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.destacado}>
            Falta cobrar: {formatearPesos(faltaCobrar)}
          </ThemedText>
        </ThemedView>

        <ThemedText type="subtitle" style={styles.tituloLista}>
          Cuotas
        </ThemedText>
        {cuotas.map((cuota) => {
          const pagada = cuota.estado === 'pagada';
          const { diasAtraso } = moraDe(cuota);
          const vencida = !pagada && diasAtraso > 0;
          return (
            <Pressable
              key={cuota.id}
              disabled={pagada}
              accessibilityRole="button"
              onPress={() => setCuotaACobrar(cuota)}
              style={({ pressed }) => pressed && styles.presionado}>
              <ThemedView
                type="backgroundElement"
                style={[styles.tarjeta, vencida && styles.tarjetaVencida]}>
                <ThemedText style={styles.destacado}>
                  Cuota {cuota.numero}: {formatearPesos(cuota.monto)}
                </ThemedText>
                <ThemedText style={styles.texto}>
                  Vence el {formatearFecha(cuota.fecha_vencimiento)}
                </ThemedText>
                {!pagada && cuota.monto_pagado > 0 ? (
                  <ThemedText style={styles.texto}>
                    Ya pagó: {formatearPesos(cuota.monto_pagado)}
                  </ThemedText>
                ) : null}
                {pagada ? (
                  <ThemedText style={[styles.texto, styles.pagada]}>Pagada</ThemedText>
                ) : vencida ? (
                  <ThemedText style={[styles.texto, styles.vencida]}>
                    Vencida hace {textoDias(diasAtraso)}
                  </ThemedText>
                ) : (
                  <ThemedText style={styles.texto}>Pendiente</ThemedText>
                )}
                {!pagada ? (
                  <ThemedText style={styles.texto} themeColor="textSecondary">
                    Tocá para cobrar
                  </ThemedText>
                ) : null}
              </ThemedView>
            </Pressable>
          );
        })}
      </ScrollView>

      {cuotaACobrar ? (
        <CuadroCobro
          numeroCuota={cuotaACobrar.numero}
          montoCuota={cuotaACobrar.monto}
          montoPagado={cuotaACobrar.monto_pagado}
          diasAtraso={moraDe(cuotaACobrar).diasAtraso}
          recargo={moraDe(cuotaACobrar).recargo}
          onConfirmar={(pago) => cobrar(cuotaACobrar, pago)}
          onCancelar={() => setCuotaACobrar(null)}
        />
      ) : null}
    </ThemedView>
  );
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  tituloLista: {
    marginTop: Spacing.three,
  },
  tarjeta: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'transparent',
    gap: Spacing.one,
  },
  tarjetaVencida: {
    borderColor: COLOR_VENCIDA,
  },
  presionado: {
    opacity: 0.7,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  destacado: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  pagada: {
    color: COLOR_PAGADA,
    fontWeight: '700',
  },
  vencida: {
    color: COLOR_VENCIDA,
    fontWeight: '700',
  },
});
