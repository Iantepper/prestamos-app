// Agenda de cobros: cuotas atrasadas, de hoy, de mañana y de los próximos 7 días.
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { CuadroCobro, textoDias } from '@/components/cuadro-cobro';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listarCobrosPendientes, type CobroPendiente } from '@/db/agenda';
import { registrarPago } from '@/db/pagos';
import { formatearFecha, formatearPesos, hoyISO, sumarDias } from '@/utils/formato';
import { calcularMoraPendiente } from '@/utils/mora';

const COLOR_VENCIDA = '#D32F2F';

// Un cobro con lo que hay que cobrar hoy: lo que falta de la cuota más la mora si está vencida.
type Cobro = CobroPendiente & { diasAtraso: number; recargo: number; aCobrar: number };

type Grupo = { titulo: string; atrasadas: boolean; cobros: Cobro[] };

export default function AgendaScreen() {
  const db = useSQLiteContext();
  const [filas, setFilas] = useState<CobroPendiente[]>([]);
  const [hoy, setHoy] = useState(hoyISO);
  const [recarga, setRecarga] = useState(0);
  const [cobroACobrar, setCobroACobrar] = useState<Cobro | null>(null);

  // Se recarga cada vez que se entra a la pestaña (por si se cargó un préstamo o un pago)
  // y después de cobrar desde acá.
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, recarga])
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
    return { ...fila, diasAtraso, recargo, aCobrar };
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

  const cobrar = async (cobro: Cobro, pago: { monto: number; mora: number }) => {
    try {
      await registrarPago(db, { cuotaId: cobro.cuota_id, fecha: hoyISO(), ...pago });
    } catch {
      Alert.alert('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setCobroACobrar(null);
    setRecarga((r) => r + 1);
    Alert.alert('Pago registrado');
  };

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
                        <View style={styles.botones}>
                          <BotonGrande
                            texto="Cómo llegar"
                            onPress={() => abrirMapa(cobro.direccion)}
                          />
                          <BotonGrande texto="Cobrar" onPress={() => setCobroACobrar(cobro)} />
                        </View>
                      </ThemedView>
                    ))}
                  </View>
                ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {cobroACobrar ? (
        <CuadroCobro
          numeroCuota={cobroACobrar.numero}
          cliente={cobroACobrar.cliente_nombre}
          montoCuota={cobroACobrar.monto}
          montoPagado={cobroACobrar.monto_pagado}
          diasAtraso={cobroACobrar.diasAtraso}
          recargo={cobroACobrar.recargo}
          onConfirmar={(pago) => cobrar(cobroACobrar, pago)}
          onCancelar={() => setCobroACobrar(null)}
        />
      ) : null}
    </ThemedView>
  );
}

// Abre la app de mapas del celular buscando la dirección del cliente.
async function abrirMapa(direccion: string) {
  const consulta = encodeURIComponent(`${direccion}, Argentina`);
  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${consulta}`);
  } catch {
    Alert.alert('No se pudo abrir el mapa');
  }
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
  botones: {
    marginTop: Spacing.two,
    gap: Spacing.two,
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
