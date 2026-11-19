// src/utils/renovacion.ts
// Cálculo de las dos formas de renovar un préstamo, a partir de la plata que se entrega en mano (E).
// Funciones puras: no dependen de la base ni de React.
//
// Deuda: suma de (monto − monto_pagado) de las cuotas pendientes, sin mora.
// E tiene que ser mayor que 0. El crédito total se calcula: X = E + deuda.
//
// Modo "Descontar lo que debe": crédito nuevo de monto X, con interés sobre X completo (incluye lo
//   que debía). El préstamo actual se cierra y sus cuotas pendientes se cancelan.
//
// Modo "Sumar a las cuotas que quedan": el interés se cobra solo sobre E. Con E, el interés y la
//   cantidad de cuotas se calculan cuotas nuevas (calcularCuotas); la cuota nueva i se suma a la i-ésima cuota pendiente, de la más vieja a la más nueva. Si las nuevas
//   son más que las pendientes, las que sobran se agregan al final con la frecuencia del préstamo;
//   si son menos, solo se agrandan las primeras.
import { calcularCuotas, type CuotaCalculada, type Frecuencia } from '@/utils/cuotas';
import { formatearPesos } from '@/utils/formato';

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

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
