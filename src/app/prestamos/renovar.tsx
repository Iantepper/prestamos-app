// Renovación de un préstamo en dos pasos:
//   1. Cuánta plata se le da en mano, interés y cantidad de cuotas.
//   2. Revisar cómo va a pagar y confirmar.
// El préstamo sigue siendo uno solo: lo nuevo se suma a las cuotas que quedan.
// Las reglas de cálculo están en src/utils/renovacion.ts y el guardado en renovarPrestamo.
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { CampoMonto, useMonto } from '@/components/campo-monto';
import { CampoTexto } from '@/components/campo-texto';
import { useAviso, useConfirmar } from '@/components/dialogos';
import { IndicadorRiesgo } from '@/components/indicador-riesgo';
import { Monto } from '@/components/monto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  bordeDestacado,
  Colors,
  EstiloTarjeta,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import {
  cuotasParaRenovar,
  listarRenovaciones,
  obtenerAdicionales,
  obtenerPrestamo,
  renovarPrestamo,
  type PrestamoDetalle,
} from '@/db/prestamos';
import { obtenerPerfilesRiesgo } from '@/db/riesgo';
import {
  formatearDiaMes,
  formatearFecha,
  formatearPesos,
  hoyISO,
  leerDecimal,
  leerEntero,
} from '@/utils/formato';
import { reprogramarRecordatorios } from '@/utils/recordatorios';
import {
  calcularDeuda,
  calcularSuma,
  cuotasPendientes,
  ErrorRenovacion,
  explicarCronograma,
  MENSAJE_ENTREGA,
  montoOriginal,
  preverCuotas,
  resumirCuotas,
  textoCronograma,
  type Adicional,
  type CuotaActual,
  type FilaRenovacion,
} from '@/utils/renovacion';
import type { NivelRiesgo } from '@/utils/riesgo';

const COLOR_ERROR = Colors.danger;

type Errores = { monto?: string; tasa?: string; cuotas?: string };

// Intenta un cálculo y, si los datos no sirven, devuelve el mensaje de error para mostrar.
function intentar<T>(calculo: () => T): { valor: T | null; error: string | null } {
  try {
    return { valor: calculo(), error: null };
  } catch (e) {
    if (e instanceof ErrorRenovacion) return { valor: null, error: e.message };
    throw e;
  }
}

export default function RenovarScreen() {
  const db = useSQLiteContext();
  const confirmar = useConfirmar();
  const avisar = useAviso();
  const { id, desde } = useLocalSearchParams<{ id: string; desde?: string }>();
  const prestamoId = Number(id);
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation();

  const [prestamo, setPrestamo] = useState<PrestamoDetalle | null>(null);
  const [cuotas, setCuotas] = useState<CuotaActual[]>([]);
  const [adicionales, setAdicionales] = useState<Map<number, Adicional[]>>(new Map());
  const [renovaciones, setRenovaciones] = useState<FilaRenovacion[]>([]);
  const [perfil, setPerfil] = useState<NivelRiesgo>('nuevo');
  const [cargando, setCargando] = useState(true);

  const [paso, setPaso] = useState<1 | 2>(1);
  const entrega = useMonto({ enteros: true });
  const [tasa, setTasa] = useState('');
  const [cantCuotas, setCantCuotas] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([
      obtenerPrestamo(db, prestamoId),
      cuotasParaRenovar(db, prestamoId),
      obtenerPerfilesRiesgo(db, hoyISO()),
      obtenerAdicionales(db),
      listarRenovaciones(db, prestamoId),
    ]).then(([filaPrestamo, filasCuotas, perfiles, partes, filasRenovaciones]) => {
      if (!activo) return;
      setPrestamo(filaPrestamo);
      setCuotas(filasCuotas);
      setAdicionales(partes);
      setRenovaciones(filasRenovaciones);
      if (filaPrestamo) setPerfil(perfiles.get(filaPrestamo.cliente_id) ?? 'nuevo');
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [db, prestamoId]);

  // Si se entró desde la Agenda, al salir de esta pantalla (por terminar o por volver atrás) se
  // vuelve a la Agenda, que se refresca sola al recibir el foco.
  useEffect(() => {
    if (desde !== 'agenda') return;
    return navigation.addListener('beforeRemove', () => {
      setTimeout(() => router.navigate('/'), 0);
    });
  }, [navigation, desde]);

  const irAPaso = (nuevo: 1 | 2) => {
    setPaso(nuevo);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  if (cargando) return <ThemedView style={styles.container} />;

  const pendientes = cuotasPendientes(cuotas);
  if (!prestamo || prestamo.estado !== 'activo' || pendientes.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.contenido}>
          <ThemedText style={styles.texto}>
            Este préstamo no se puede renovar: tiene que estar activo y con cuotas pendientes.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const deuda = calcularDeuda(cuotas);
  const entregaNum = entrega.numero;
  const tasaNum = leerDecimal(tasa);
  const cuotasNum = leerEntero(cantCuotas);
  const datos = { entrega: entregaNum, tasaPct: tasaNum, cantCuotas: cuotasNum };

  const validar = (): boolean => {
    const nuevos: Errores = {};
    if (!(entregaNum > 0)) nuevos.monto = MENSAJE_ENTREGA;
    if (!(tasaNum >= 0)) nuevos.tasa = 'Escribí el interés (puede ser 0)';
    if (!(cuotasNum > 0)) nuevos.cuotas = 'Escribí una cantidad de cuotas mayor a 0';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  // Solo se calcula en la revisión, con los datos ya validados.
  const suma =
    paso === 2
      ? intentar(() => calcularSuma(cuotas, prestamo.frecuencia, datos))
      : { valor: null, error: null };
  const prevision = suma.valor ? preverCuotas(cuotas, suma.valor, adicionales, hoyISO()) : null;
  const proximaNueva = prevision?.pendientes[0];

  const vigentes = cuotas.filter((q) => q.estado !== 'cancelada');
  const pagas = vigentes.filter((q) => q.estado === 'pagada').length;
  const cuotaAntes = pendientes[0].monto;
  const proxima = pendientes[0];
  const faltaProxima = redondear(proxima.monto - proxima.montoPagado);
  const gruposHoy = resumirCuotas(pendientes);

  const confirmarRenovacion = async () => {
    if (!suma.valor || guardando) return;
    const entregado = suma.valor.entregado;
    const seguro = await confirmar({
      titulo: '¿Confirmás la renovación?',
      mensaje: `Le vas a dar hoy ${formatearPesos(entregado)} a ${prestamo.cliente_nombre}. Las cuotas nuevas se suman a las que le quedan.`,
      confirmar: 'Sí, renovar',
    });
    if (!seguro) return;
    setGuardando(true);
    try {
      await renovarPrestamo(db, prestamo.id, { modo: 'sumar', ...datos }, hoyISO());
    } catch (e) {
      setGuardando(false);
      await avisar(
        'No se pudo renovar',
        e instanceof ErrorRenovacion ? e.message : 'Probá de nuevo.'
      );
      return;
    }
    reprogramarRecordatorios(db);
    // Se vuelve a donde se estaba; desde el alta, al préstamo renovado.
    if (desde === 'agenda' || desde === 'detalle') {
      router.back();
    } else {
      router.replace({ pathname: '/prestamos/[id]', params: { id: prestamo.id } });
    }
    avisar(
      'Préstamo renovado',
      `Le diste ${formatearPesos(entregado)} a ${prestamo.cliente_nombre}. Sus cuotas ya quedaron actualizadas.`
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <ThemedText type="subtitle">{prestamo.cliente_nombre}</ThemedText>
        <ThemedText themeColor="textSecondary">Paso {paso} de 2</ThemedText>

        {paso === 1 ? (
          <>
            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Préstamo actual</ThemedText>
              <ThemedText style={styles.texto}>
                Monto original: <Monto valor={montoOriginal(prestamo.monto, renovaciones)} />
              </ThemedText>
              <ThemedText style={styles.texto}>Interés: {prestamo.tasa_interes} %</ThemedText>
              <ThemedText style={styles.texto}>
                Cuotas pagas: {pagas} de {vigentes.length}
              </ThemedText>
              {gruposHoy.length === 1 ? (
                <ThemedText style={styles.texto}>
                  Cada cuota: <Monto valor={gruposHoy[0].monto} />
                </ThemedText>
              ) : (
                <ThemedText style={styles.texto}>
                  Cuotas que quedan: {textoCronograma(gruposHoy, prestamo.frecuencia)}
                </ThemedText>
              )}
              <ThemedText style={styles.texto}>
                Próxima cuota: <Monto valor={faltaProxima} /> el{' '}
                {formatearFecha(proxima.fechaVencimiento)}
              </ThemedText>
              <View style={styles.debeHoy}>
                <ThemedText style={styles.titulo}>
                  Debe hoy: <Monto valor={deuda} />
                </ThemedText>
                <ThemedText style={styles.texto}>en {textoCuotas(pendientes.length)}</ThemedText>
              </View>
            </ThemedView>

            <CampoMonto
              etiqueta="¿Cuánta plata le vas a dar en mano? ($)"
              monto={entrega}
              error={errores.monto}
              placeholder="Ej: 50.000"
            />
            <CampoTexto
              etiqueta="Interés total (%)"
              value={tasa}
              onChangeText={setTasa}
              error={errores.tasa}
              keyboardType="decimal-pad"
              placeholder="Ej: 20"
            />
            <CampoTexto
              etiqueta="Cantidad de cuotas"
              value={cantCuotas}
              onChangeText={setCantCuotas}
              error={errores.cuotas}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="Ej: 4"
            />

            <ThemedText themeColor="textSecondary">
              Se sigue cobrando {TEXTO_FRECUENCIA[prestamo.frecuencia]}, como hasta ahora. El
              interés se cobra solo sobre la plata que le vas a dar, y se suma a las cuotas que
              quedan.
            </ThemedText>

            <BotonGrande
              texto="Revisar la renovación"
              onPress={() => {
                if (validar()) irAPaso(2);
              }}
            />
          </>
        ) : null}

        {paso === 2 ? (
          <>
            <ThemedText style={styles.titulo}>Revisá antes de confirmar</ThemedText>

            {suma.error ? (
              <ThemedText style={[styles.texto, styles.error]}>{suma.error}</ThemedText>
            ) : null}

            {suma.valor && prevision && proximaNueva ? (
              <>
                <ThemedView type="backgroundElement" style={[styles.tarjeta, styles.entrega]}>
                  <ThemedText style={styles.titulo}>Cómo va a pagar</ThemedText>
                  <ThemedText style={styles.destacado}>
                    Próxima cuota:{' '}
                    <Monto valor={redondear(proximaNueva.monto - proximaNueva.montoPagado)} /> (el{' '}
                    {formatearDiaMes(proximaNueva.fechaVencimiento)})
                  </ThemedText>
                  {proximaNueva.desglose ? (
                    <ThemedText themeColor="textSecondary" style={styles.chico}>
                      {formatearPesos(proximaNueva.monto)} = {proximaNueva.desglose}
                      {proximaNueva.montoPagado > 0
                        ? ` (ya pagó ${formatearPesos(proximaNueva.montoPagado)})`
                        : ''}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.texto}>
                    Va a pagar:{' '}
                    {textoCronograma(
                      resumirCuotas(
                        prevision.pendientes.map((q) => ({
                          monto: redondear(q.monto - q.montoPagado),
                        }))
                      ),
                      prestamo.frecuencia
                    )}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.texto}>
                    Hasta ahora pagaba{' '}
                    {gruposHoy.length > 1
                      ? textoCronograma(gruposHoy, prestamo.frecuencia)
                      : `${formatearPesos(cuotaAntes)} por cuota`}
                  </ThemedText>
                  <ThemedText style={styles.entregaLinea}>
                    Le vas a dar hoy: <Monto valor={suma.valor.entregado} />
                  </ThemedText>
                </ThemedView>

                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <ThemedText style={styles.destacado}>Cuándo cambia el monto</ThemedText>
                  {explicarCronograma(prevision.pendientes).map((frase) => (
                    <ThemedText key={frase} style={styles.texto}>
                      {frase}
                    </ThemedText>
                  ))}
                </ThemedView>

                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <ThemedText style={styles.destacado}>Cómo quedan las cuotas</ThemedText>
                  {prevision.lista.map((q) => (
                    <View key={q.clave}>
                      <ThemedText style={styles.texto}>
                        Cuota {q.numero}: {formatearFecha(q.fechaVencimiento)} ·{' '}
                        <Monto valor={q.monto} />
                        {q.nota}
                      </ThemedText>
                      {q.desglose ? (
                        <ThemedText themeColor="textSecondary" style={styles.chico}>
                          {q.desglose}
                        </ThemedText>
                      ) : null}
                    </View>
                  ))}
                </ThemedView>

                <ThemedView type="backgroundElement" style={styles.tarjeta}>
                  <ThemedText style={styles.destacado}>Cómo viene pagando</ThemedText>
                  <IndicadorRiesgo nivel={perfil} />
                  {perfil === 'riesgo' ? (
                    <ThemedView style={styles.avisoRiesgo}>
                      <ThemedText style={styles.textoAvisoRiesgo}>
                        Este cliente tiene 2 o más cuotas vencidas sin cobrar
                      </ThemedText>
                    </ThemedView>
                  ) : null}
                </ThemedView>

                <ThemedText themeColor="textSecondary" style={styles.chico}>
                  Total a devolver: {formatearPesos(suma.valor.totalDesdeHoy)} · última cuota{' '}
                  {formatearDiaMes(suma.valor.ultimaFecha)}
                </ThemedText>

                <BotonGrande texto="Confirmar renovación" onPress={confirmarRenovacion} />
              </>
            ) : null}

            <BotonGrande
              texto="Volver a cambiar los datos"
              variante="secundario"
              onPress={() => irAPaso(1)}
            />
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const TEXTO_FRECUENCIA = {
  semanal: 'cada semana',
  quincenal: 'cada 15 días',
  mensual: 'cada mes',
} as const;

function textoCuotas(cantidad: number): string {
  return cantidad === 1 ? '1 cuota' : `${cantidad} cuotas`;
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
  tarjeta: EstiloTarjeta,
  entrega: bordeDestacado(Colors.primary),
  debeHoy: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  titulo: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  destacado: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  entregaLinea: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  chico: {
    fontSize: 18,
    lineHeight: 26,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  error: {
    color: COLOR_ERROR,
    fontWeight: '700',
  },
  avisoRiesgo: {
    ...EstiloTarjeta,
    ...bordeDestacado(COLOR_ERROR),
  },
  textoAvisoRiesgo: {
    color: COLOR_ERROR,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
});
