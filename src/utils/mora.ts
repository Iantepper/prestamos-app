// src/utils/mora.ts
// Recargo simple por mora: monto de la cuota × mora% diaria × días de atraso.

export type Mora = {
  diasAtraso: number;
  recargo: number;
};

export function calcularMora(
  cuota: { monto: number; fechaVencimiento: string }, // fecha 'YYYY-MM-DD'
  moraDiariaPct: number,
  hoy: string // 'YYYY-MM-DD'
): Mora {
  const diasAtraso = Math.max(0, diasEntre(cuota.fechaVencimiento, hoy));
  const recargo = Math.round(cuota.monto * moraDiariaPct * diasAtraso) / 100;
  return { diasAtraso, recargo };
}

// Días de calendario desde una fecha hasta otra (negativo si `hasta` es anterior).
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / MS_POR_DIA);
}

// Mora que todavía falta cobrar de una cuota: el recargo calculado menos lo ya cobrado de mora.
export function calcularMoraPendiente(
  cuota: { monto: number; fechaVencimiento: string; moraPagada: number },
  moraDiariaPct: number,
  hoy: string
): Mora {
  const mora = calcularMora(cuota, moraDiariaPct, hoy);
  const recargo = Math.max(0, Math.round((mora.recargo - cuota.moraPagada) * 100) / 100);
  return { diasAtraso: mora.diasAtraso, recargo };
}
