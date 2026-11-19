// src/utils/renovacion.ts
// Cálculo de la renovación de un préstamo, a partir de la plata que se da en mano (E).
// Funciones puras: no dependen de la base ni de React.
//
// Deuda: suma de (monto − monto_pagado) de las cuotas pendientes, sin mora.
// E tiene que ser mayor que 0. El crédito total se calcula: X = E + deuda.
//
// Modo "Sumar a las cuotas que quedan" (el único que ofrece la pantalla): el interés se cobra solo
//   sobre E. Con E, el interés y la cantidad de cuotas se calculan cuotas nuevas (calcularCuotas); la
//   cuota nueva i se suma a la i-ésima cuota pendiente, de la más vieja a la más nueva. Si las nuevas
//   son más que las pendientes, las que sobran se agregan al final con la frecuencia del préstamo;
//   si son menos, solo se agrandan las primeras. Cada parte agregada se recuerda aparte.
//
// Modo "Descontar lo que debe" (sin uso en la pantalla, queda como la mora): crédito nuevo de monto
//   X, con interés sobre X completo. El préstamo actual se cierra y sus cuotas pendientes se cancelan.
import { calcularCuotas, type CuotaCalculada, type Frecuencia } from '@/utils/cuotas';
import { formatearDiaMes, formatearPesos } from '@/utils/formato';

export type CuotaActual = {
  id: number;
  numero: number;
  fechaVencimiento: string; // 'YYYY-MM-DD'
  monto: number;
  montoPagado: number;
  estado: 'pendiente' | 'pagada' | 'cancelada';
};

export type NuevoCredito = {
  entrega: number; // E: la plata que se le da en mano
  tasaPct: number; // interés total en %
  cantCuotas: number;
};

// Error de validación de una renovación, con un mensaje para mostrar tal cual.
export class ErrorRenovacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorRenovacion';
  }
}

export const MENSAJE_ENTREGA = 'Tenés que dar una plata mayor a cero';

// Cuotas pendientes, de la más vieja a la más nueva.
export function cuotasPendientes(cuotas: CuotaActual[]): CuotaActual[] {
  return cuotas
    .filter((q) => q.estado === 'pendiente')
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.numero - b.numero);
}

export function calcularDeuda(cuotas: CuotaActual[]): number {
  return redondear(
    cuotasPendientes(cuotas).reduce((suma, q) => suma + Math.max(0, q.monto - q.montoPagado), 0)
  );
}

function validar(datos: NuevoCredito) {
  if (!(datos.entrega > 0)) throw new ErrorRenovacion(MENSAJE_ENTREGA);
  if (!(datos.tasaPct >= 0)) throw new ErrorRenovacion('El interés no puede ser negativo');
  if (!(Number.isInteger(datos.cantCuotas) && datos.cantCuotas >= 1)) {
    throw new ErrorRenovacion('La cantidad de cuotas tiene que ser 1 o más');
  }
}

export type ResultadoDescuento = {
  deuda: number;
  entregado: number; // E
  creditoTotal: number; // X = E + deuda
  cuotas: CuotaCalculada[]; // las del préstamo nuevo
  total: number; // total a devolver del préstamo nuevo
  ultimaFecha: string;
};

export function calcularDescuento(
  cuotasActuales: CuotaActual[],
  datos: NuevoCredito & { frecuencia: Frecuencia; fechaInicio: string }
): ResultadoDescuento {
  validar(datos);
  const deuda = calcularDeuda(cuotasActuales);
  const creditoTotal = redondear(datos.entrega + deuda);
  const cuotas = calcularCuotas({
    monto: creditoTotal,
    tasaPct: datos.tasaPct,
    cantCuotas: datos.cantCuotas,
    frecuencia: datos.frecuencia,
    fechaInicio: datos.fechaInicio,
  });
  return {
    deuda,
    entregado: redondear(datos.entrega),
    creditoTotal,
    cuotas,
    total: redondear(cuotas.reduce((suma, q) => suma + q.monto, 0)),
    ultimaFecha: cuotas[cuotas.length - 1].fechaVencimiento,
  };
}

export type CuotaModificada = {
  id: number;
  numero: number;
  fechaVencimiento: string;
  montoAnterior: number;
  monto: number; // monto nuevo de la cuota (anterior + cuota nueva)
  adicional: number; // lo que se le sumó
  montoPagado: number;
};

export type CuotaAgregada = { numero: number; fechaVencimiento: string; monto: number };

export type ResultadoSuma = {
  deuda: number;
  entregado: number; // E
  creditoTotal: number; // X = E + deuda
  modificadas: CuotaModificada[];
  agregadas: CuotaAgregada[];
  totalNuevo: number; // lo que se suma a devolver: lo entregado más su interés
  totalDesdeHoy: number; // lo que falta pagar después de renovar (deuda + totalNuevo)
  ultimaFecha: string;
};

export function calcularSuma(
  cuotasActuales: CuotaActual[],
  frecuencia: Frecuencia,
  datos: NuevoCredito
): ResultadoSuma {
  validar(datos);
  const pendientes = cuotasPendientes(cuotasActuales);
  if (pendientes.length === 0) throw new ErrorRenovacion('El préstamo no tiene cuotas pendientes');
  const deuda = calcularDeuda(cuotasActuales);
  const entregado = redondear(datos.entrega);
  const vigentes = cuotasActuales.filter((q) => q.estado !== 'cancelada');
  const ultimaActual = vigentes.reduce(
    (max, q) => (q.fechaVencimiento > max ? q.fechaVencimiento : max),
    ''
  );
  const ultimoNumero = Math.max(...cuotasActuales.map((q) => q.numero));

  // Las fechas que se usan son las de las cuotas que sobran: un período, dos, ... después de la
  // última cuota del préstamo. Los montos son los de calcularCuotas (la última absorbe el redondeo).
  const nuevas = calcularCuotas({
    monto: entregado,
    tasaPct: datos.tasaPct,
    cantCuotas: datos.cantCuotas,
    frecuencia,
    fechaInicio: ultimaActual,
  });

  const modificadas: CuotaModificada[] = pendientes.slice(0, nuevas.length).map((q, i) => ({
    id: q.id,
    numero: q.numero,
    fechaVencimiento: q.fechaVencimiento,
    montoAnterior: q.monto,
    monto: redondear(q.monto + nuevas[i].monto),
    adicional: nuevas[i].monto,
    montoPagado: q.montoPagado,
  }));
  const agregadas: CuotaAgregada[] = nuevas.slice(pendientes.length).map((q, j) => ({
    numero: ultimoNumero + j + 1,
    fechaVencimiento: nuevas[j].fechaVencimiento,
    monto: q.monto,
  }));

  const totalNuevo = redondear(nuevas.reduce((suma, q) => suma + q.monto, 0));
  return {
    deuda,
    entregado,
    creditoTotal: redondear(entregado + deuda),
    modificadas,
    agregadas,
    totalNuevo,
    totalDesdeHoy: redondear(deuda + totalNuevo),
    ultimaFecha:
      agregadas.length > 0 ? agregadas[agregadas.length - 1].fechaVencimiento : ultimaActual,
  };
}

// "Cuotas 3 y 4: $ 45.000; cuotas 5 y 6: $ 15.000": agrupa cuotas seguidas con el mismo monto.
export function describirCuotas(cuotas: { numero: number; monto: number }[]): string {
  const grupos: { desde: number; hasta: number; cantidad: number; monto: number }[] = [];
  for (const q of [...cuotas].sort((a, b) => a.numero - b.numero)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.monto === q.monto && ultimo.hasta === q.numero - 1) {
      ultimo.hasta = q.numero;
      ultimo.cantidad++;
    } else {
      grupos.push({ desde: q.numero, hasta: q.numero, cantidad: 1, monto: q.monto });
    }
  }
  return grupos
    .map((g, i) => {
      const palabra = i === 0 ? 'Cuota' : 'cuota';
      const numeros =
        g.cantidad === 1
          ? `${palabra} ${g.desde}`
          : g.cantidad === 2
            ? `${palabra}s ${g.desde} y ${g.hasta}`
            : `${palabra}s ${g.desde} a ${g.hasta}`;
      return `${numeros}: ${formatearPesos(g.monto)}`;
    })
    .join('; ');
}

export type GrupoCuotas = { cantidad: number; monto: number };

// Agrupa cuotas seguidas con el mismo monto (diferencia menor a un centavo), en el orden dado.
export function resumirCuotas(cuotas: { monto: number }[]): GrupoCuotas[] {
  const grupos: GrupoCuotas[] = [];
  for (const q of cuotas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && Math.abs(ultimo.monto - q.monto) < 0.01) {
      ultimo.cantidad++;
    } else {
      grupos.push({ cantidad: 1, monto: q.monto });
    }
  }
  return grupos;
}

const UNA_POR: Record<Frecuencia, string> = {
  semanal: 'una por semana',
  quincenal: 'una cada 15 días',
  mensual: 'una por mes',
};

// "4 cuotas de $ 73.500, después 6 cuotas de $ 13.500, una por mes". Sin `frecuencia`, termina en
// el último monto.
export function textoCronograma(grupos: GrupoCuotas[], frecuencia?: Frecuencia): string {
  if (grupos.length === 0) return '';
  const partes = grupos.map(
    (g) => `${g.cantidad === 1 ? '1 cuota' : `${g.cantidad} cuotas`} de ${formatearPesos(g.monto)}`
  );
  const cronograma = partes.join(', después ');
  return frecuencia ? `${cronograma}, ${UNA_POR[frecuencia]}` : cronograma;
}

// Lo que falta pagar de las cuotas pendientes, contando de cada una lo que queda (monto − pagado):
// "Faltan pagar 2 cuotas de $ 25.000 · $ 50.000 en total". null si no falta nada.
export function resumirFaltante(
  cuotas: CuotaActual[],
  hoy: string // 'YYYY-MM-DD'
): { texto: string; vencidas: number } | null {
  const pendientes = cuotasPendientes(cuotas).filter((q) => q.monto - q.montoPagado > 0);
  if (pendientes.length === 0) return null;
  const cronograma = textoCronograma(
    resumirCuotas(pendientes.map((q) => ({ monto: redondear(q.monto - q.montoPagado) })))
  );
  return {
    texto:
      pendientes.length === 1
        ? `Falta pagar ${cronograma}`
        : `Faltan pagar ${cronograma} · ${formatearPesos(calcularDeuda(cuotas))} en total`,
    vencidas: pendientes.filter((q) => q.fechaVencimiento < hoy).length,
  };
}

// Una renovación tal como está en la tabla renovaciones.
export type FilaRenovacion = {
  id: number;
  fecha: string; // 'YYYY-MM-DD'
  modo: 'descuento' | 'sumar';
  deuda_anterior: number;
  monto_nuevo: number;
  entregado: number;
  tasa_interes: number | null; // null en las renovaciones anteriores a la versión 3 de la base
};

// Monto del crédito original: al sumar, el monto del préstamo creció con lo que se fue dando.
export function montoOriginal(montoPrestamo: number, renovaciones: FilaRenovacion[]): number {
  return redondear(
    renovaciones.reduce((m, r) => (r.modo === 'sumar' ? m - r.entregado : m), montoPrestamo)
  );
}

// Parte de una cuota que vino de una renovación. `nueva` marca la renovación que se está por hacer.
export type Adicional = {
  renovacionId: number;
  monto: number;
  fecha: string; // 'YYYY-MM-DD'
  entregado: number; // la plata que se dio en esa renovación
  nueva?: boolean;
};

export type OrigenCuota = 'original' | Omit<Adicional, 'monto'>;
export type ComponenteCuota = { origen: OrigenCuota; monto: number };

// De qué se compone una cuota. Lo original es el monto menos sus adicionales. Si la cuota se editó
// a un monto menor que sus adicionales, se muestran solo hasta completar el monto.
export function componentesDeCuota(
  monto: number,
  adicionales: Adicional[] = []
): ComponenteCuota[] {
  const sumados = adicionales.reduce((suma, a) => suma + a.monto, 0);
  const original = redondear(monto - sumados);
  const componentes: ComponenteCuota[] =
    original > 0 ? [{ origen: 'original', monto: original }] : [];
  let resto = redondear(monto - Math.max(0, original));
  for (const { monto: parte, ...origen } of adicionales) {
    const usado = Math.min(parte, resto);
    if (usado > 0) componentes.push({ origen, monto: usado });
    resto = redondear(resto - usado);
  }
  return componentes;
}

function nombreOrigen(origen: OrigenCuota): string {
  if (origen === 'original') return 'el crédito original';
  return origen.nueva ? 'el crédito nuevo' : `la renovación del ${formatearDiaMes(origen.fecha)}`;
}

function claveOrigen(origen: OrigenCuota): string {
  return origen === 'original' ? 'original' : `r${origen.renovacionId}`;
}

// "$ 25.000 original + $ 17.500 renovación del 18/11" (detalle) o
// "$ 25.000 del crédito original + $ 17.500 del crédito nuevo de $ 70.000" (cobro).
export function textoDesglose(
  componentes: ComponenteCuota[],
  estilo: 'detalle' | 'cobro' = 'detalle'
): string {
  const adicionales = componentes.filter((c) => c.origen !== 'original').length;
  return componentes
    .map(({ origen, monto }) => {
      const pesos = formatearPesos(monto);
      if (origen === 'original') {
        return estilo === 'cobro' ? `${pesos} del crédito original` : `${pesos} original`;
      }
      const dia = formatearDiaMes(origen.fecha);
      if (estilo === 'detalle') {
        return origen.nueva ? `${pesos} crédito nuevo` : `${pesos} renovación del ${dia}`;
      }
      const cuanto = formatearPesos(origen.entregado);
      return adicionales === 1 || origen.nueva
        ? `${pesos} del crédito nuevo de ${cuanto}`
        : `${pesos} del crédito del ${dia} de ${cuanto}`;
    })
    .join(' + ');
}

export type CuotaConComponentes = {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  componentes: ComponenteCuota[];
};

// Cuándo cambia el monto de las cuotas pendientes y por qué. Una frase por cada cambio:
// "Hasta la cuota 2 (18/01): $ 42.500; después baja a $ 17.500 porque termina el crédito original".
export function explicarCronograma(cuotas: CuotaConComponentes[]): string[] {
  if (cuotas.length === 0) return [];
  const frases: string[] = [];
  cuotas.slice(1).forEach((siguiente, i) => {
    const actual = cuotas[i];
    if (Math.abs(actual.monto - siguiente.monto) < 0.01) return;
    const claves = (q: CuotaConComponentes) => q.componentes.map((c) => claveOrigen(c.origen));
    const faltantes = (a: CuotaConComponentes, b: CuotaConComponentes) =>
      a.componentes
        .filter((c) => !claves(b).includes(claveOrigen(c.origen)))
        .map((c) => nombreOrigen(c.origen));
    const terminan = faltantes(actual, siguiente);
    const empiezan = faltantes(siguiente, actual);
    const motivos = [
      terminan.length > 0
        ? `${terminan.length > 1 ? 'terminan' : 'termina'} ${terminan.join(' y ')}`
        : '',
      empiezan.length > 0
        ? `${empiezan.length > 1 ? 'empiezan' : 'empieza'} ${empiezan.join(' y ')}`
        : '',
    ].filter(Boolean);
    frases.push(
      `Hasta la cuota ${actual.numero} (${formatearDiaMes(actual.fechaVencimiento)}): ` +
        `${formatearPesos(actual.monto)}; después ${siguiente.monto < actual.monto ? 'baja' : 'sube'} a ` +
        formatearPesos(siguiente.monto) +
        (motivos.length > 0 ? ` porque ${motivos.join(' y ')}` : '')
    );
  });
  if (frases.length > 0) return frases;
  const monto = formatearPesos(cuotas[0].monto);
  return [
    cuotas.length === 1
      ? `Queda 1 cuota de ${monto}`
      : `Las ${cuotas.length} cuotas son de ${monto}: el monto no cambia`,
  ];
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
