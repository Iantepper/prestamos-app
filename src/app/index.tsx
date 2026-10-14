// Agenda de cobros: cuotas atrasadas, de hoy, de mañana y de los próximos 7 días.
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { textoDias } from '@/components/cuadro-cobro';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listarCobrosPendientes, type CobroPendiente } from '@/db/agenda';
import { formatearFecha, formatearPesos, hoyISO, sumarDias } from '@/utils/formato';
import { calcularMoraPendiente } from '@/utils/mora';

const COLOR_VENCIDA = '#D32F2F';

// Un cobro con lo que hay que cobrar hoy: lo que falta de la cuota más la mora si está vencida.
type Cobro = CobroPendiente & { diasAtraso: number; aCobrar: number };

type Grupo = { titulo: string; atrasadas: boolean; cobros: Cobro[] };

export default function AgendaScreen() {
  const db = useSQLiteContext();
  const [filas, setFilas] = useState<CobroPendiente[]>([]);
  const [hoy, setHoy] = useState(hoyISO);

  // Se recarga cada vez que se entra a la pestaña (por si se cargó un préstamo o un pago).
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      const fechaHoy = hoyISO();
      listarCobrosPendientes(db, sumarDias(fechaHoy, 7)).then((resultado) => {
        if (!activo) return;
        setHoy(fechaHoy);
        setFilas(resultado);
      });
      return () => {
        activo = false;
      };
    }, [db])
  );

  const manana = sumarDias(hoy, 1);
  const cobros: Cobro[] = filas.map((fila) => {
    const { diasAtraso, recargo } = calcularMoraPendiente(
      {
        monto: fila.monto,
        fechaVencimiento: fila.fecha_vencimiento,
        moraPagada: fila.mora_pagada,
      },
      fila.mora_diaria_pct,
      hoy
    );
    const aCobrar = Math.round((fila.monto - fila.monto_pagado + recargo) * 100) / 100;
    return { ...fila, diasAtraso, aCobrar };
  });

  const grupos: Grupo[] = [
    {
      titulo: 'Atrasadas',
      atrasadas: true,
      cobros: cobros.filter((c) => c.fecha_vencimiento < hoy),
    },
    { titulo: 'Hoy', atrasadas: false, cobros: cobros.filter((c) => c.fecha_vencimiento === hoy) },
    {
      titulo: 'Mañana',
      atrasadas: false,
      cobros: cobros.filter((c) => c.fecha_vencimiento === manana),
    },
    {
      titulo: 'Próximos 7 días',
      atrasadas: false,
      cobros: cobros.filter((c) => c.fecha_vencimiento > manana),
    },
  ];
  const [atrasadas, deHoy] = grupos;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <ThemedText type="subtitle">Agenda de cobros</ThemedText>

          {cobros.length === 0 ? (
            <ThemedText style={styles.texto}>No tenés cobros para estos días</ThemedText>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.tarjeta}>
                <ThemedText style={styles.destacado}>
                  Hoy tenés que cobrar {formatearPesos(sumar(deHoy.cobros))} en{' '}
                  {textoCuotas(deHoy.cobros.length)}
                </ThemedText>
                {atrasadas.cobros.length > 0 ? (
                  <ThemedText style={[styles.texto, styles.vencida]}>
                    Además tenés {textoCuotas(atrasadas.cobros.length)} atrasadas por{' '}
                    {formatearPesos(sumar(atrasadas.cobros))}
                  </ThemedText>
                ) : null}
              </ThemedView>

              {grupos
                .filter((grupo) => grupo.cobros.length > 0)
                .map((grupo) => (
                  <View key={grupo.titulo} style={styles.grupo}>
                    <ThemedText
                      type="subtitle"
                      style={[styles.tituloGrupo, grupo.atrasadas && styles.vencida]}>
                      {grupo.titulo}
                    </ThemedText>
                    {grupo.cobros.map((cobro) => (
                      <ThemedView
                        key={cobro.cuota_id}
                        type="backgroundElement"
                        style={[styles.tarjeta, grupo.atrasadas && styles.tarjetaVencida]}>
                        <ThemedText style={styles.destacado}>{cobro.cliente_nombre}</ThemedText>
                        <ThemedText style={styles.destacado}>
                          Cobrar: {formatearPesos(cobro.aCobrar)}
                        </ThemedText>
                        {grupo.atrasadas ? (
                          <ThemedText style={[styles.texto, styles.vencida]}>
                            Vencida hace {textoDias(cobro.diasAtraso)}
                          </ThemedText>
                        ) : (
                          <ThemedText style={styles.texto}>
                            Vence el {formatearFecha(cobro.fecha_vencimiento)}
                          </ThemedText>
                        )}
                        <ThemedText style={styles.texto}>{cobro.direccion}</ThemedText>
                        {cobro.telefono ? (
                          <ThemedText style={styles.texto}>Tel: {cobro.telefono}</ThemedText>
                        ) : null}
                      </ThemedView>
                    ))}
                  </View>
                ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function sumar(cobros: Cobro[]): number {
  return Math.round(cobros.reduce((suma, c) => suma + c.aCobrar, 0) * 100) / 100;
}

function textoCuotas(cantidad: number): string {
  return cantidad === 1 ? '1 cuota' : `${cantidad} cuotas`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  grupo: {
    gap: Spacing.three,
  },
  tituloGrupo: {
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
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  destacado: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  vencida: {
    color: COLOR_VENCIDA,
    fontWeight: '700',
  },
});
