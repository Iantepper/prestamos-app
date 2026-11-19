// src/utils/reparto.ts
// Reparte un pago de un cliente entre sus cuotas pendientes, de la más vieja a la más nueva.
// En cada cuota, lo cobrado cubre primero el recargo por mora (si hay) y el resto va a la cuota,
// igual que en el cobro de una sola cuota. Se pueden adelantar cuotas futuras.

export type CuotaPendiente = {
  id: number;
  numero: number;
  monto: number; // monto completo de la cuota
  falta: number; // lo que falta de la cuota (monto - monto_pagado)
  recargo: number; // recargo por mora que falta cobrar (0 si no hay mora)
};

export type Aplicacion = {
  cuotaId: number;
  numero: number;
  monto: number; // parte que va a la cuota
  mora: number; // parte que va al recargo
  adeudado: number; // lo que se debía de esa cuota (falta + recargo)
  completa: boolean; // si con este pago la cuota queda saldada
};

// Lo que debe en total el cliente: tope de lo que se le puede cobrar.
export function saldoTotal(cuotas: CuotaPendiente[]): number {
  return redondear(cuotas.reduce((suma, q) => suma + q.falta + q.recargo, 0));
}

// `cuotas` tiene que venir ordenada de la más vieja a la más nueva.
export function repartirPago(cuotas: CuotaPendiente[], monto: number): Aplicacion[] {
  const aplicaciones: Aplicacion[] = [];
  let resto = redondear(monto);
  for (const cuota of cuotas) {
    if (resto <= 0) break;
    const adeudado = redondear(cuota.falta + cuota.recargo);
    if (adeudado <= 0) continue;
    const aplicado = Math.min(resto, adeudado);
    const mora = Math.min(aplicado, cuota.recargo);
    aplicaciones.push({
      cuotaId: cuota.id,
      numero: cuota.numero,
      monto: redondear(aplicado - mora),
      mora: redondear(mora),
      adeudado,
      completa: aplicado >= adeudado,
    });
    resto = redondear(resto - aplicado);
  }
  return aplicaciones;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
