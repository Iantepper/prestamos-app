// Renovación de un préstamo en tres pasos:
//   1. Cuánta plata se entrega en mano y datos del crédito.
//   2. Comparar los dos modos ("Descontar lo que debe" y "Sumar a las cuotas que quedan").
//   3. Revisar el modo elegido y confirmar.
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
  obtenerPrestamo,
  renovarPrestamo,
  type PrestamoDetalle,
} from '@/db/prestamos';
import { obtenerPerfilesRiesgo } from '@/db/riesgo';
import type { Frecuencia } from '@/utils/cuotas';
import {
  formatearDiaMes,
  formatearFecha,
  formatearPesos,
  hoyISO,
  leerDecimal,
  leerEntero,
  leerFecha,
} from '@/utils/formato';
import { reprogramarRecordatorios } from '@/utils/recordatorios';
import {
  calcularDescuento,
  calcularDeuda,
  calcularSuma,
  cuotasPendientes,
  ErrorRenovacion,
  MENSAJE_ENTREGA,
  resumirCuotas,
  textoCronograma,
  type CuotaActual,
  type GrupoCuotas,
  type ResultadoDescuento,
  type ResultadoSuma,
} from '@/utils/renovacion';
import type { NivelRiesgo } from '@/utils/riesgo';

const COLOR_ERROR = Colors.danger;

type Modo = 'descuento' | 'sumar';
type Errores = { monto?: string; tasa?: string; cuotas?: string; fecha?: string };

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
  const [perfil, setPerfil] = useState<NivelRiesgo>('nuevo');
  const [cargando, setCargando] = useState(true);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [modo, setModo] = useState<Modo>('descuento');
  const entrega = useMonto({ enteros: true });
  const [tasa, setTasa] = useState('');
  const [cantCuotas, setCantCuotas] = useState('');
  const [fecha, setFecha] = useState(() => formatearFecha(hoyISO()));
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([
      obtenerPrestamo(db, prestamoId),
      cuotasParaRenovar(db, prestamoId),
      obtenerPerfilesRiesgo(db, hoyISO()),
    ]).then(([filaPrestamo, filasCuotas, perfiles]) => {
      if (!activo) return;
      setPrestamo(filaPrestamo);
      setCuotas(filasCuotas);
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

  const irAPaso = (nuevo: 1 | 2 | 3) => {
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
  const fechaISO = leerFecha(fecha);
  const datos = { entrega: entregaNum, tasaPct: tasaNum, cantCuotas: cuotasNum };

  const validar = (): boolean => {
    const nuevos: Errores = {};
    if (!(entregaNum > 0)) nuevos.monto = MENSAJE_ENTREGA;
    if (!(tasaNum >= 0)) nuevos.tasa = 'Escribí el interés (puede ser 0)';
    if (!(cuotasNum > 0)) nuevos.cuotas = 'Escribí una cantidad de cuotas mayor a 0';
    if (!fechaISO) nuevos.fecha = 'Escribí la fecha como día/mes/año. Ej: 05/11/2026';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  // Los dos cálculos, con los mismos datos. Solo se usan desde el paso 2, con los datos ya validados.
  const descuento =
    paso >= 2 && fechaISO
      ? intentar(() =>
          calcularDescuento(cuotas, {
            ...datos,
            frecuencia: prestamo.frecuencia,
            fechaInicio: fechaISO,
          })
        )
      : { valor: null, error: null };
  const suma =
    paso >= 2
      ? intentar(() => calcularSuma(cuotas, prestamo.frecuencia, datos))
      : { valor: null, error: null };

  const vigentes = cuotas.filter((q) => q.estado !== 'cancelada');
  const pagas = vigentes.filter((q) => q.estado === 'pagada').length;
  const cobrado = vigentes.reduce((s, q) => s + q.montoPagado, 0);
  const cuotaAntes = pendientes[0].monto;
  const proxima = pendientes[0];
  const faltaProxima = Math.round((proxima.monto - proxima.montoPagado) * 100) / 100;
  const gruposHoy = resumirCuotas(pendientes);
  const planElegido =
    modo === 'descuento'
      ? descuento.valor && planDescuento(descuento.valor, prestamo.frecuencia)
      : suma.valor && planSuma(suma.valor, pendientes, prestamo.frecuencia);

  const confirmarRenovacion = async () => {
    const elegido = modo === 'descuento' ? descuento.valor : suma.valor;
    if (!elegido || !fechaISO || guardando) return;
    const seguro = await confirmar({
      titulo: '¿Confirmás la renovación?',
      mensaje: `Le vas a dar hoy ${formatearPesos(elegido.entregado)} a ${prestamo.cliente_nombre}.`,
      confirmar: 'Sí, renovar',
    });
    if (!seguro) return;
    setGuardando(true);
    let vigente: number;
    try {
      vigente = await renovarPrestamo(
        db,
        prestamo.id,
        modo === 'descuento' ? { modo, ...datos, fechaInicio: fechaISO } : { modo, ...datos },
        hoyISO()
      );
    } catch (e) {
      setGuardando(false);
      await avisar(
        'No se pudo renovar',
        e instanceof ErrorRenovacion ? e.message : 'Probá de nuevo.'
      );
      return;
    }
    reprogramarRecordatorios(db);
    // Se vuelve a la Agenda si se vino de ahí. Si no, al préstamo que queda vigente: el mismo si se
    // sumó, el nuevo si se descontó.
    if (desde === 'agenda' || (modo === 'sumar' && desde === 'detalle')) {
      router.back();
    } else {
      router.replace({ pathname: '/prestamos/[id]', params: { id: vigente } });
    }
    avisar(
      'Préstamo renovado',
      `Le diste ${formatearPesos(elegido.entregado)} a ${prestamo.cliente_nombre}.`
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
        <ThemedText themeColor="textSecondary">Paso {paso} de 3</ThemedText>

        {paso === 1 ? (
          <>
            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Préstamo actual</ThemedText>
              <ThemedText style={styles.texto}>
                Monto original: <Monto valor={prestamo.monto} />
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
              Se sigue cobrando {TEXTO_FRECUENCIA[prestamo.frecuencia]}, como hasta ahora. Si sumás
              a las cuotas que quedan, el interés se cobra solo sobre la plata que le vas a dar.
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Solo si descontás lo que debe</ThemedText>
              <CampoTexto
                etiqueta="Fecha de inicio (día/mes/año)"
                value={fecha}
                onChangeText={setFecha}
                error={errores.fecha}
                keyboardType="numbers-and-punctuation"
                placeholder="Ej: 05/11/2026"
              />
            </ThemedView>

            <BotonGrande
              texto="Ver las dos opciones"
              onPress={() => {
                if (validar()) irAPaso(2);
              }}
            />
          </>
        ) : null}

        {paso === 2 ? (
          <>
            <ThemedText style={styles.destacado}>
              Le das <Monto valor={entregaNum} /> en mano. Elegí cómo renovar:
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.titulo}>Descontar lo que debe</ThemedText>
              {descuento.valor ? (
                <>
                  <ComoPaga
                    plan={planDescuento(descuento.valor, prestamo.frecuencia)}
                    cuotaAntes={cuotaAntes}
                  />
                  <LineaTotal plan={planDescuento(descuento.valor, prestamo.frecuencia)} />
                  <BotonGrande
                    texto="Elegir: descontar"
                    onPress={() => {
                      setModo('descuento');
                      irAPaso(3);
                    }}
                  />
                </>
              ) : (
                <ThemedText style={[styles.texto, styles.error]}>{descuento.error}</ThemedText>
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.titulo}>Sumar a las cuotas que quedan</ThemedText>
              {suma.valor ? (
                <>
                  <ComoPaga
                    plan={planSuma(suma.valor, pendientes, prestamo.frecuencia)}
                    cuotaAntes={cuotaAntes}
                  />
                  <LineaTotal plan={planSuma(suma.valor, pendientes, prestamo.frecuencia)} />
                  <BotonGrande
                    texto="Elegir: sumar"
                    onPress={() => {
                      setModo('sumar');
                      irAPaso(3);
                    }}
                  />
                </>
              ) : (
                <ThemedText style={[styles.texto, styles.error]}>{suma.error}</ThemedText>
              )}
            </ThemedView>

            <BotonGrande
              texto="Volver a cambiar los datos"
              variante="secundario"
              onPress={() => irAPaso(1)}
            />
          </>
        ) : null}

        {paso === 3 ? (
          <>
            <ThemedText style={styles.titulo}>Revisá antes de confirmar</ThemedText>

            {planElegido ? (
              <ThemedView type="backgroundElement" style={[styles.tarjeta, styles.entrega]}>
                <ThemedText style={styles.titulo}>Cómo va a pagar</ThemedText>
                <ComoPaga plan={planElegido} />
              </ThemedView>
            ) : null}

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Préstamo actual</ThemedText>
              <ThemedText style={styles.texto}>
                Monto original: <Monto valor={prestamo.monto} />
              </ThemedText>
              <ThemedText style={styles.texto}>
                Empezó el {formatearFecha(prestamo.fecha_inicio)}
              </ThemedText>
              <ThemedText style={styles.texto}>
                Cuotas pagas: {pagas} de {vigentes.length}
              </ThemedText>
              <ThemedText style={styles.texto}>
                Cobrado: <Monto valor={cobrado} />
              </ThemedText>
              <ThemedText style={styles.texto}>
                Falta: <Monto valor={deuda} />
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Qué se hace</ThemedText>
              <ThemedText style={styles.texto}>
                {modo === 'descuento'
                  ? `Se cierra este préstamo y se hace uno nuevo de ${formatearPesos(planElegido?.creditoTotal ?? 0)}: los ${formatearPesos(deuda)} que debe más los ${formatearPesos(entregaNum)} que le vas a dar. El interés se cobra sobre todo ese monto.`
                  : `Le vas a dar ${formatearPesos(entregaNum)}. El interés se cobra solo sobre esa plata, y las cuotas nuevas se suman a las que le quedan, de la más vieja a la más nueva.`}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.tarjeta}>
              <ThemedText style={styles.destacado}>Cómo queda</ThemedText>
              {modo === 'descuento' && descuento.valor
                ? descuento.valor.cuotas.map((q) => (
                    <ThemedText key={q.numero} style={styles.texto}>
                      Cuota {q.numero}: {formatearFecha(q.fechaVencimiento)} ·{' '}
                      <Monto valor={q.monto} />
                    </ThemedText>
                  ))
                : null}
              {modo === 'sumar' && suma.valor ? (
                <ListaSuma cuotas={vigentes} r={suma.valor} />
              ) : null}
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

            {planElegido ? <LineaTotal plan={planElegido} /> : null}

            <BotonGrande texto="Confirmar renovación" onPress={confirmarRenovacion} />
            <BotonGrande
              texto="Volver a las dos opciones"
              variante="secundario"
              onPress={() => irAPaso(2)}
            />
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

// Lo que va a pagar el cliente de ahora en adelante con cada modo.
type Plan = {
  proxima: { monto: number; fecha: string };
  grupos: GrupoCuotas[];
  frecuencia: Frecuencia;
  entregado: number;
  creditoTotal: number;
  deuda: number;
  total: number;
  ultimaFecha: string;
};

function planDescuento(r: ResultadoDescuento, frecuencia: Frecuencia): Plan {
  return {
    proxima: { monto: r.cuotas[0].monto, fecha: r.cuotas[0].fechaVencimiento },
    grupos: resumirCuotas(r.cuotas),
    frecuencia,
    entregado: r.entregado,
    creditoTotal: r.creditoTotal,
    deuda: r.deuda,
    total: r.total,
    ultimaFecha: r.ultimaFecha,
  };
}

// Con "sumar" sigue pagando las cuotas pendientes (las agrandadas y las que sobran del préstamo
// anterior) y después las agregadas. De cada pendiente cuenta lo que falta pagar.
function planSuma(r: ResultadoSuma, pendientes: CuotaActual[], frecuencia: Frecuencia): Plan {
  const cambios = new Map(r.modificadas.map((q) => [q.id, q.monto]));
  const desdeHoy = [
    ...pendientes.map((q) => ({
      monto: Math.round(((cambios.get(q.id) ?? q.monto) - q.montoPagado) * 100) / 100,
      fecha: q.fechaVencimiento,
    })),
    ...r.agregadas.map((q) => ({ monto: q.monto, fecha: q.fechaVencimiento })),
  ];
  return {
    proxima: desdeHoy[0],
    grupos: resumirCuotas(desdeHoy),
    frecuencia,
    entregado: r.entregado,
    creditoTotal: r.creditoTotal,
    deuda: r.deuda,
    total: r.totalDesdeHoy,
    ultimaFecha: r.ultimaFecha,
  };
}

function ComoPaga({ plan, cuotaAntes }: { plan: Plan; cuotaAntes?: number }) {
  return (
    <>
      <ThemedText style={styles.destacado}>
        Próxima cuota: <Monto valor={plan.proxima.monto} /> (el{' '}
        {formatearDiaMes(plan.proxima.fecha)})
      </ThemedText>
      <ThemedText style={styles.texto}>
        Va a pagar: {textoCronograma(plan.grupos, plan.frecuencia)}
      </ThemedText>
      {cuotaAntes !== undefined ? (
        <ThemedText themeColor="textSecondary" style={styles.texto}>
          Hoy paga {formatearPesos(cuotaAntes)} por cuota
        </ThemedText>
      ) : null}
      <ThemedText style={styles.entregaLinea}>
        Le vas a dar hoy: <Monto valor={plan.entregado} />
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.chico}>
        Crédito total: {formatearPesos(plan.creditoTotal)} (debe {formatearPesos(plan.deuda)} + le
        das {formatearPesos(plan.entregado)})
      </ThemedText>
    </>
  );
}

function LineaTotal({ plan }: { plan: Plan }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.chico}>
      Total a devolver: {formatearPesos(plan.total)} · última cuota{' '}
      {formatearDiaMes(plan.ultimaFecha)}
    </ThemedText>
  );
}

// Todas las cuotas del préstamo como quedan después de sumar: las pagas igual, las pendientes
// agrandadas y las nuevas al final.
function ListaSuma({ cuotas, r }: { cuotas: CuotaActual[]; r: ResultadoSuma }) {
  const cambios = new Map(r.modificadas.map((q) => [q.id, q.monto]));
  const lista = [
    ...[...cuotas]
      .sort((a, b) => a.numero - b.numero)
      .map((q) => ({
        clave: `c${q.id}`,
        numero: q.numero,
        fecha: q.fechaVencimiento,
        monto: cambios.get(q.id) ?? q.monto,
        nota: q.estado === 'pagada' ? ' (pagada)' : cambios.has(q.id) ? ' (agrandada)' : '',
      })),
    ...r.agregadas.map((q) => ({
      clave: `n${q.numero}`,
      numero: q.numero,
      fecha: q.fechaVencimiento,
      monto: q.monto,
      nota: ' (nueva)',
    })),
  ];
  return (
    <>
      {lista.map((q) => (
        <ThemedText key={q.clave} style={styles.texto}>
          Cuota {q.numero}: {formatearFecha(q.fecha)} · <Monto valor={q.monto} />
          {q.nota}
        </ThemedText>
      ))}
    </>
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
