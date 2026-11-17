// src/utils/agenda.ts
// Agrupa las cuotas pendientes de la agenda por cliente: una tarjeta por cliente, en la sección
// más urgente que le corresponda (Atrasadas, Hoy, Mañana o Próximos 7 días).
import { diasEntre } from '@/utils/mora';
import { sumarDias } from '@/utils/formato';

export type Seccion = 'atrasadas' | 'hoy' | 'manana' | 'proximos';

// Lo mínimo que se necesita de cada cuota pendiente.
export type CuotaAgenda = {
  cliente_id: number;
  fecha_vencimiento: string; // 'YYYY-MM-DD'
  aCobrar: number; // lo que falta de la cuota (más la mora, si corresponde)
};

export type CobroCliente<T extends CuotaAgenda> = {
  clienteId: number;
  seccion: Seccion;
  cuotas: T[]; // todas sus cuotas pendientes dentro de la ventana, de la más vieja a la más nueva
  cobrarAhora: number; // atrasadas más las de hoy
  cuotasAhora: number; // cuántas cuotas suman "cobrar ahora"
  diasMasVieja: number; // días de atraso de la cuota más vieja (0 si no hay atrasadas)
  despues: number; // cuotas futuras dentro de la ventana
  fechaDespues: string | null; // vencimiento de la próxima cuota futura
};

export function agruparPorCliente<T extends CuotaAgenda>(
  cuotas: T[],
  hoy: string
): CobroCliente<T>[] {
  const manana = sumarDias(hoy, 1);
  const porCliente = new Map<number, T[]>();
  for (const cuota of cuotas) {
    const lista = porCliente.get(cuota.cliente_id) ?? [];
    lista.push(cuota);
    porCliente.set(cuota.cliente_id, lista);
  }

  const grupos: CobroCliente<T>[] = [];
  for (const [clienteId, lista] of porCliente) {
    lista.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
    const ahora = lista.filter((q) => q.fecha_vencimiento <= hoy);
    const futuras = lista.filter((q) => q.fecha_vencimiento > hoy);
    const masVieja = lista[0].fecha_vencimiento;
    const seccion: Seccion =
      masVieja < hoy
        ? 'atrasadas'
        : masVieja === hoy
          ? 'hoy'
          : masVieja === manana
            ? 'manana'
            : 'proximos';
    grupos.push({
      clienteId,
      seccion,
      cuotas: lista,
      cobrarAhora: redondear(ahora.reduce((suma, q) => suma + q.aCobrar, 0)),
      cuotasAhora: ahora.length,
      diasMasVieja: Math.max(0, diasEntre(masVieja, hoy)),
      despues: redondear(futuras.reduce((suma, q) => suma + q.aCobrar, 0)),
      fechaDespues: futuras[0]?.fecha_vencimiento ?? null,
    });
  }
  // Dentro de cada sección, primero el que tiene la cuota más vieja.
  return grupos.sort((a, b) =>
    a.cuotas[0].fecha_vencimiento.localeCompare(b.cuotas[0].fecha_vencimiento)
  );
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
