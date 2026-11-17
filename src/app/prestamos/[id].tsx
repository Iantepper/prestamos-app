import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { CuadroCobro, textoDias } from '@/components/cuadro-cobro';
import { CuadroEditarCuota } from '@/components/cuadro-editar-cuota';
import { useAviso, useConfirmar } from '@/components/dialogos';
import { Monto } from '@/components/monto';
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
import { registrarPago } from '@/db/pagos';
import {
  actualizarCuota,
  eliminarPrestamoSinPagos,
  listarCuotas,
  obtenerPrestamo,
  type Cuota,
  type PrestamoDetalle,
} from '@/db/prestamos';
import { formatearDiaMes, formatearFecha, hoyISO } from '@/utils/formato';
import { calcularMoraPendiente } from '@/utils/mora';
import { reprogramarRecordatorios } from '@/utils/recordatorios';

const COLOR_PAGADA = Colors.primary;
const COLOR_VENCIDA = Colors.danger;

const TEXTO_FRECUENCIA = {
  semanal: 'por semana',
  quincenal: 'cada 15 días',
  mensual: 'por mes',
} as const;

export default function DetallePrestamoScreen() {
  const db = useSQLiteContext();
  const confirmar = useConfirmar();
  const avisar = useAviso();
  const { id } = useLocalSearchParams<{ id: string }>();
  const prestamoId = Number(id);
  const [prestamo, setPrestamo] = useState<PrestamoDetalle | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [cuotaACobrar, setCuotaACobrar] = useState<Cuota | null>(null);
  const [cuotaAEditar, setCuotaAEditar] = useState<Cuota | null>(null);

  // Se recarga al volver a la pantalla (por ejemplo, después de renovar) y después de cada cambio.
  useFocusEffect(
    useCallback(() => {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, prestamoId, recarga])
  );

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

  // Las cuotas canceladas (pasaron a un préstamo nuevo al renovar) no cuentan en los saldos.
  const vigentes = cuotas.filter((q) => q.estado !== 'cancelada');
  // Saldo: lo cobrado y lo que falta de cada cuota (los recargos por mora se cuentan aparte).
  const cobrado = redondear(cuotas.reduce((suma, q) => suma + q.monto_pagado, 0));
  const faltaCobrar = redondear(
    vigentes.reduce((suma, q) => suma + Math.max(0, q.monto - q.monto_pagado), 0)
  );
  const moraCobrada = redondear(cuotas.reduce((suma, q) => suma + q.mora_pagada, 0));
  // Suma de las cuotas: coincide con monto + interés, salvo que se haya editado alguna cuota.
  const totalADevolver = redondear(vigentes.reduce((suma, q) => suma + q.monto, 0));

  // Solo se puede borrar un préstamo activo que todavía no cobró nada y no participó de una
  // renovación.
  const tienePagos = cuotas.some((q) => q.monto_pagado > 0 || q.mora_pagada > 0);
  const sePuedeRenovar =
    prestamo.estado === 'activo' && cuotas.some((q) => q.estado === 'pendiente');
  const sePuedeEliminar =
    prestamo.estado === 'activo' && prestamo.renueva_a === null && prestamo.renovado_el === null;

  const eliminar = async () => {
    try {
      const eliminado = await eliminarPrestamoSinPagos(db, prestamo.id);
      if (!eliminado) {
        avisar('No se puede eliminar', 'Este préstamo tiene pagos registrados.');
        return;
      }
    } catch {
      avisar('No se pudo eliminar', 'Probá de nuevo.');
      return;
    }
    reprogramarRecordatorios(db);
    avisar('Préstamo eliminado');
    router.back();
  };

  const confirmarEliminar = async () => {
    const seguro = await confirmar({
      titulo: '¿Seguro? No se puede deshacer',
      mensaje: `Se va a borrar el préstamo de ${prestamo.cliente_nombre} con todas sus cuotas.`,
      confirmar: 'Sí, eliminar',
      destructiva: true,
    });
    if (seguro) await eliminar();
  };

  const guardarCuota = async (
    cuota: Cuota,
    cambios: { fechaVencimiento: string; monto: number }
  ) => {
    try {
      await actualizarCuota(db, cuota.id, cambios);
    } catch {
      avisar('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setCuotaAEditar(null);
    setRecarga((r) => r + 1);
    reprogramarRecordatorios(db);
    avisar('Cuota actualizada');
  };

  const cobrar = async (cuota: Cuota, pago: { monto: number; mora: number }) => {
    try {
      await registrarPago(db, { cuotaId: cuota.id, fecha: hoy, ...pago });
    } catch {
      avisar('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setCuotaACobrar(null);
    setRecarga((r) => r + 1);
    reprogramarRecordatorios(db);
    avisar('Pago registrado');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido}>
        <ThemedText type="subtitle">{prestamo.cliente_nombre}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          {prestamo.estado === 'saldado' ? (
            <ThemedText style={[styles.destacado, styles.pagada]}>Préstamo saldado</ThemedText>
          ) : null}
          {prestamo.estado === 'renovado' ? (
            <ThemedText style={styles.destacado}>
              Préstamo renovado: lo que debía pasó a un préstamo nuevo
            </ThemedText>
          ) : null}
          {prestamo.renovado_el ? (
            <ThemedText style={styles.destacado}>
              Renovado el {formatearDiaMes(prestamo.renovado_el)}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.texto}>
            Prestado: <Monto valor={prestamo.monto} />
          </ThemedText>
          <ThemedText style={styles.texto}>Interés: {prestamo.tasa_interes} %</ThemedText>
          <ThemedText style={styles.texto}>
            Total a devolver: <Monto valor={totalADevolver} />
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
          <ThemedText style={styles.texto}>
            Cobrado: <Monto valor={cobrado} />
          </ThemedText>
          {moraCobrada > 0 ? (
            <ThemedText style={styles.texto}>
              Recargos por mora cobrados: <Monto valor={moraCobrada} />
            </ThemedText>
          ) : null}
          <ThemedText style={styles.destacado}>
            Falta cobrar: <Monto valor={faltaCobrar} />
          </ThemedText>
        </ThemedView>

        {sePuedeRenovar ? (
          <BotonGrande
            texto="Renovar préstamo"
            variante="secundario"
            onPress={() =>
              router.push({
                pathname: '/prestamos/renovar',
                params: { id: prestamo.id, desde: 'detalle' },
              })
            }
          />
        ) : null}
        {prestamo.estado === 'renovado' && prestamo.renovado_por !== null ? (
          <BotonGrande
            texto="Ver el préstamo nuevo"
            onPress={() =>
              router.replace({
                pathname: '/prestamos/[id]',
                params: { id: prestamo.renovado_por! },
              })
            }
          />
        ) : null}

        <ThemedText type="subtitle" style={styles.tituloLista}>
          Cuotas
        </ThemedText>
        {cuotas.map((cuota) => {
          const pagada = cuota.estado === 'pagada';
          const cancelada = cuota.estado === 'cancelada';
          const pendiente = cuota.estado === 'pendiente';
          const { diasAtraso } = moraDe(cuota);
          const vencida = pendiente && diasAtraso > 0;
          return (
            <ThemedView
              key={cuota.id}
              type="backgroundElement"
              style={[styles.tarjeta, vencida && styles.tarjetaVencida]}>
              <ThemedText style={styles.destacado}>
                Cuota {cuota.numero}: <Monto valor={cuota.monto} />
              </ThemedText>
              <ThemedText style={styles.texto}>
                Vence el {formatearFecha(cuota.fecha_vencimiento)}
              </ThemedText>
              {!pagada && cuota.monto_pagado > 0 ? (
                <ThemedText style={styles.texto}>
                  Ya pagó: <Monto valor={cuota.monto_pagado} />
                </ThemedText>
              ) : null}
              {pagada ? (
                <ThemedText style={[styles.texto, styles.pagada]}>Pagada</ThemedText>
              ) : cancelada ? (
                <ThemedText style={styles.texto} themeColor="textSecondary">
                  Cancelada: pasó al préstamo nuevo
                </ThemedText>
              ) : vencida ? (
                <ThemedText style={[styles.texto, styles.vencida]}>
                  Vencida hace {textoDias(diasAtraso)}
                </ThemedText>
              ) : (
                <ThemedText style={styles.texto}>Pendiente</ThemedText>
              )}
              {pendiente ? (
                <View style={styles.botones}>
                  <BotonGrande texto="Cobrar" onPress={() => setCuotaACobrar(cuota)} />
                  <BotonGrande
                    texto="Editar"
                    variante="secundario"
                    onPress={() => setCuotaAEditar(cuota)}
                  />
                </View>
              ) : null}
            </ThemedView>
          );
        })}

        {sePuedeEliminar ? (
          <View style={styles.eliminar}>
            {tienePagos ? (
              <ThemedText style={styles.texto} themeColor="textSecondary">
                Este préstamo tiene pagos registrados, por eso no se puede eliminar.
              </ThemedText>
            ) : (
              <BotonGrande
                texto="Eliminar préstamo"
                variante="peligro"
                onPress={confirmarEliminar}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {cuotaACobrar ? (
        <CuadroCobro
          numeroCuota={cuotaACobrar.numero}
          cliente={prestamo.cliente_nombre}
          montoCuota={cuotaACobrar.monto}
          montoPagado={cuotaACobrar.monto_pagado}
          diasAtraso={moraDe(cuotaACobrar).diasAtraso}
          recargo={moraDe(cuotaACobrar).recargo}
          onConfirmar={(pago) => cobrar(cuotaACobrar, pago)}
          onCancelar={() => setCuotaACobrar(null)}
        />
      ) : null}

      {cuotaAEditar ? (
        <CuadroEditarCuota
          numeroCuota={cuotaAEditar.numero}
          fechaVencimiento={cuotaAEditar.fecha_vencimiento}
          monto={cuotaAEditar.monto}
          montoPagado={cuotaAEditar.monto_pagado}
          onGuardar={(cambios) => guardarCuota(cuotaAEditar, cambios)}
          onCancelar={() => setCuotaAEditar(null)}
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
  tarjeta: EstiloTarjeta,
  tarjetaVencida: bordeDestacado(COLOR_VENCIDA),
  eliminar: {
    marginTop: Spacing.five,
  },
  botones: {
    marginTop: Spacing.two,
    gap: Spacing.two,
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
