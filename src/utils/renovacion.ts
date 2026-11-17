// src/utils/renovacion.ts
// Cálculo de las dos formas de renovar un préstamo, con el mismo "Monto del nuevo crédito" (X).
// Funciones puras: no dependen de la base ni de React.
//
// Deuda: suma de (monto − monto_pagado) de las cuotas pendientes, sin mora.
//
// Modo "Descontar lo que debe": crédito nuevo de monto X, con interés sobre X completo (incluye lo
//   que debía). Se le entrega X menos la deuda; X tiene que ser mayor que la deuda. El préstamo
//   actual se cierra y sus cuotas pendientes se cancelan.
//
// Modo "Sumar a las cuotas que quedan": se entrega X completo. Con X, el interés y la cantidad de
//   cuotas se calculan cuotas nuevas (calcularCuotas); la cuota nueva i se suma a la i-ésima cuota
//   pendiente, de la más vieja a la más nueva. Si las nuevas son más que las pendientes, las que
//   sobran se agregan al final con la frecuencia del préstamo; si son menos, solo se agrandan las
//   primeras.
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
  montoNuevo: number; // X
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
  if (!(datos.montoNuevo > 0))
    throw new ErrorRenovacion('El monto del nuevo crédito tiene que ser mayor a 0');
  if (!(datos.tasaPct >= 0)) throw new ErrorRenovacion('El interés no puede ser negativo');
  if (!(Number.isInteger(datos.cantCuotas) && datos.cantCuotas >= 1)) {
    throw new ErrorRenovacion('La cantidad de cuotas tiene que ser 1 o más');
  }
}

export type ResultadoDescuento = {
  deuda: number;
  entregado: number; // X − deuda
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
  if (datos.montoNuevo <= deuda) {
    throw new ErrorRenovacion(
      `El monto del nuevo crédito tiene que ser mayor a lo que debe (${formatearPesos(deuda)})`
    );
  }
  const cuotas = calcularCuotas({
    monto: datos.montoNuevo,
    tasaPct: datos.tasaPct,
    cantCuotas: datos.cantCuotas,
    frecuencia: datos.frecuencia,
    fechaInicio: datos.fechaInicio,
  });
  return {
    deuda,
    entregado: redondear(datos.montoNuevo - deuda),
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
  entregado: number; // X completo
  modificadas: CuotaModificada[];
  agregadas: CuotaAgregada[];
  totalNuevo: number; // lo que se suma a devolver por X
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
  const vigentes = cuotasActuales.filter((q) => q.estado !== 'cancelada');
  const ultimaActual = vigentes.reduce(
    (max, q) => (q.fechaVencimiento > max ? q.fechaVencimiento : max),
    ''
  );
  const ultimoNumero = Math.max(...cuotasActuales.map((q) => q.numero));

  // Las fechas que se usan son las de las cuotas que sobran: un período, dos, ... después de la
  // última cuota del préstamo. Los montos son los de calcularCuotas (la última absorbe el redondeo).
  const nuevas = calcularCuotas({
    monto: datos.montoNuevo,
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

  const deuda = calcularDeuda(cuotasActuales);
  const totalNuevo = redondear(nuevas.reduce((suma, q) => suma + q.monto, 0));
  return {
    deuda,
    entregado: redondear(datos.montoNuevo),
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

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
