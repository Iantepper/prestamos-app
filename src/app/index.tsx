// Agenda de cobros: una tarjeta por cliente, en la sección más urgente que le corresponda
// (Atrasadas, Hoy, Mañana o Próximos 7 días).
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { CuadroCobro, textoDias } from '@/components/cuadro-cobro';
import { avisar } from '@/components/dialogos';
import { Monto } from '@/components/monto';
import { EncabezadoPantalla } from '@/components/encabezado-pantalla';
import { GuiaPasos } from '@/components/guia-pasos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Colors,
  bordeDestacado,
  EstiloTarjeta,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { listarCobrosPendientes, type CobroPendiente } from '@/db/agenda';
import { registrarPago } from '@/db/pagos';
import { contarClientesYPrestamos } from '@/db/resumen';
import { agruparPorCliente, type Seccion } from '@/utils/agenda';
import { formatearDiaMes, hoyISO, sumarDias } from '@/utils/formato';
import { llamar } from '@/utils/llamar';
import { calcularMoraPendiente } from '@/utils/mora';
import { reprogramarRecordatorios } from '@/utils/recordatorios';

const COLOR_VENCIDA = Colors.danger;

// Un cobro con lo que hay que cobrar hoy: lo que falta de la cuota más la mora si está vencida.
type Cobro = CobroPendiente & { diasAtraso: number; recargo: number; aCobrar: number };

// color: rojo para las atrasadas, ámbar para las de hoy; null para el resto.
const SECCIONES: { clave: Seccion; titulo: string; color: string | null }[] = [
  { clave: 'atrasadas', titulo: 'Atrasadas', color: COLOR_VENCIDA },
  { clave: 'hoy', titulo: 'Hoy', color: Colors.today },
  { clave: 'manana', titulo: 'Mañana', color: null },
  { clave: 'proximos', titulo: 'Próximos 7 días', color: null },
];

export default function AgendaScreen() {
  const db = useSQLiteContext();
  const [filas, setFilas] = useState<CobroPendiente[]>([]);
  // null mientras carga, para no mostrar la guía un instante antes de los datos.
  const [cantidades, setCantidades] = useState<{ clientes: number; prestamos: number } | null>(
    null
  );
  const [hoy, setHoy] = useState(hoyISO);
  const [recarga, setRecarga] = useState(0);
  const [cobroACobrar, setCobroACobrar] = useState<Cobro | null>(null);

  // Se recarga cada vez que se entra a la pestaña (por si se cargó un préstamo o un pago)
  // y después de cobrar desde acá.
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      const fechaHoy = hoyISO();
      Promise.all([
        listarCobrosPendientes(db, sumarDias(fechaHoy, 7)),
        contarClientesYPrestamos(db),
      ]).then(([resultado, totales]) => {
        if (!activo) return;
        setHoy(fechaHoy);
        setFilas(resultado);
        setCantidades(totales);
      });
      return () => {
        activo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, recarga])
  );

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

  // El resumen de arriba cuenta cuotas; las tarjetas se agrupan por cliente.
  const atrasadas = cobros.filter((c) => c.fecha_vencimiento < hoy);
  const deHoy = cobros.filter((c) => c.fecha_vencimiento === hoy);
  const porCliente = agruparPorCliente(cobros, hoy);

  const cobrar = async (cobro: Cobro, pago: { monto: number; mora: number }) => {
    try {
      await registrarPago(db, { cuotaId: cobro.cuota_id, fecha: hoyISO(), ...pago });
    } catch {
      avisar('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setCobroACobrar(null);
    setRecarga((r) => r + 1);
    reprogramarRecordatorios(db);
    avisar('Pago registrado');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <EncabezadoPantalla
            titulo="Agenda"
            descripcion="Lo que tenés que cobrar hoy y en los próximos días."
          />

          {cantidades && cantidades.prestamos === 0 ? (
            <GuiaPasos
              titulo="Para empezar"
              pasos={[
                {
                  texto: 'Cargá un cliente',
                  hecho: cantidades.clientes > 0,
                  boton: {
                    texto: 'Cargar mi primer cliente',
                    onPress: () => router.navigate('/clientes'),
                  },
                },
                {
                  texto: 'Creá un préstamo',
                  boton: {
                    texto: 'Crear un préstamo',
                    onPress: () => router.navigate('/prestamos'),
                  },
                },
                { texto: 'Cobrá desde la Agenda: las cuotas van a aparecer acá' },
              ]}
            />
          ) : cobros.length === 0 ? (
            <ThemedText style={styles.texto}>No tenés cobros para estos días</ThemedText>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.tarjeta}>
                <ThemedText style={styles.destacado}>
                  Hoy tenés que cobrar <Monto valor={sumar(deHoy)} /> en {textoCuotas(deHoy.length)}
                </ThemedText>
                {atrasadas.length > 0 ? (
                  <ThemedText style={[styles.texto, styles.vencida]}>
                    Además tenés {textoCuotas(atrasadas.length)} atrasadas por{' '}
                    <Monto valor={sumar(atrasadas)} />
                  </ThemedText>
                ) : null}
              </ThemedView>

              {SECCIONES.map((seccion) => {
                const clientes = porCliente.filter((g) => g.seccion === seccion.clave);
                if (clientes.length === 0) return null;
                return (
                  <View key={seccion.clave} style={styles.grupo}>
                    <ThemedText
                      type="subtitle"
                      style={[styles.tituloGrupo, seccion.color ? { color: seccion.color } : null]}>
                      {seccion.titulo}
                    </ThemedText>
                    {clientes.map((grupo) => {
                      const cliente = grupo.cuotas[0];
                      return (
                        <ThemedView
                          key={grupo.clienteId}
                          type="backgroundElement"
                          style={[
                            styles.tarjeta,
                            seccion.color ? bordeDestacado(seccion.color) : null,
                          ]}>
                          <ThemedText style={styles.destacado}>{cliente.cliente_nombre}</ThemedText>
                          {grupo.cobrarAhora > 0 ? (
                            <>
                              <ThemedText style={styles.destacado}>
                                Cobrar ahora: <Monto valor={grupo.cobrarAhora} />
                              </ThemedText>
                              <ThemedText
                                style={[styles.texto, grupo.diasMasVieja > 0 && styles.vencida]}>
                                {textoCuotas(grupo.cuotasAhora)}
                                {grupo.diasMasVieja > 0
                                  ? `, la más vieja venció hace ${textoDias(grupo.diasMasVieja)}`
                                  : ', vence hoy'}
                              </ThemedText>
                            </>
                          ) : null}
                          {grupo.despues > 0 && grupo.fechaDespues ? (
                            <ThemedText
                              style={grupo.cobrarAhora > 0 ? styles.texto : styles.destacado}>
                              {grupo.cobrarAhora > 0 ? 'Después' : 'Cobrar'}:{' '}
                              <Monto valor={grupo.despues} /> el{' '}
                              {formatearDiaMes(grupo.fechaDespues)}
                            </ThemedText>
                          ) : null}
                          {grupo.cobrarAhora === 0 ? (
                            <ThemedText style={styles.texto}>
                              {textoCuotas(grupo.cuotas.length)}
                            </ThemedText>
                          ) : null}
                          <ThemedText style={styles.texto}>{cliente.direccion}</ThemedText>
                          {cliente.telefono ? (
                            <ThemedText style={styles.texto}>Tel: {cliente.telefono}</ThemedText>
                          ) : null}
                          <View style={styles.botones}>
                            <View style={styles.filaBotones}>
                              <BotonGrande
                                texto="Cómo llegar"
                                variante="secundario"
                                onPress={() => abrirMapa(cliente.direccion)}
                                style={styles.botonFila}
                              />
                              {cliente.telefono ? (
                                <BotonGrande
                                  texto="Llamar"
                                  variante="secundario"
                                  icono={{ ios: 'phone.fill', android: 'call', web: 'call' }}
                                  onPress={() => llamar(cliente.telefono ?? '')}
                                  style={styles.botonFila}
                                />
                              ) : null}
                            </View>
                            <BotonGrande texto="Cobrar" onPress={() => setCobroACobrar(cliente)} />
                          </View>
                        </ThemedView>
                      );
                    })}
                  </View>
                );
              })}
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
    avisar('No se pudo abrir el mapa');
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
  tarjeta: EstiloTarjeta,
  botones: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  // "Cómo llegar" y "Llamar" lado a lado; sin teléfono, "Cómo llegar" ocupa todo el ancho.
  filaBotones: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botonFila: {
    flex: 1,
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
