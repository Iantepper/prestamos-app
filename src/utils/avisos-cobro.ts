// src/utils/avisos-cobro.ts
// Arma los recordatorios de cobro (cuándo y qué texto), sin depender de expo-notifications,
// para poder probarlo aparte. Lo usa src/utils/recordatorios.ts para programarlos.
import { formatearPesos } from '@/utils/formato';

export const HORA_RECORDATORIO = 9;

export type Aviso = { cuando: Date; texto: string };

// Un aviso a las 9:00 (hora del celular) por cada día con cobros. Los que ya pasaron no se arman.
export function armarAvisos(
  dias: { fecha: string; cantidad: number; monto: number }[], // fecha 'YYYY-MM-DD'
  ahora: Date
): Aviso[] {
  const avisos: Aviso[] = [];
  for (const dia of dias) {
    const [anio, mes, d] = dia.fecha.split('-').map(Number);
    const cuando = new Date(anio, mes - 1, d, HORA_RECORDATORIO, 0, 0);
    if (cuando.getTime() <= ahora.getTime()) continue; // hoy después de las 9 ya no se avisa
    const cobros = dia.cantidad === 1 ? '1 cobro' : `${dia.cantidad} cobros`;
    avisos.push({ cuando, texto: `Hoy tenés ${cobros} por ${formatearPesos(dia.monto)}` });
  }
  return avisos;
}
