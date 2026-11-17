// src/utils/riesgo.ts
// Perfil de riesgo de un cliente según los intentos de cobro fallidos (el prestamista se preocupa
// por el segundo intento de cobro fallido). Se evalúa en este orden, con todos sus préstamos:
//   Riesgo (rojo):          2 o más cuotas vencidas sin cobrar completas.
//   Con atrasos (amarillo): exactamente 1 cuota vencida sin cobrar, o alguna cuota pagada después
//                           de su vencimiento en los últimos 90 días (se cuenta por cuota).
//   Nuevo (gris):           sin pagos y sin cuotas vencidas.
//   Cumplidor (verde):      el resto.
// Cuota vencida: su fecha es anterior a hoy y no está completamente pagada (un pago parcial no
// la salda).
import { ColoresRiesgo } from '@/constants/theme';
import { diasEntre } from '@/utils/mora';

export type NivelRiesgo = 'cumplidor' | 'con_atrasos' | 'riesgo' | 'nuevo';

export type HistorialCliente = {
  pagos: { cuotaId: number; fecha: string; fechaVencimiento: string }[]; // fechas 'YYYY-MM-DD'
  vencimientosPendientes: string[]; // vencimientos de sus cuotas que no están completamente pagadas
};

// Ventana para mirar las cuotas pagadas tarde.
const DIAS_VENTANA = 90;

export function calcularPerfilRiesgo(historial: HistorialCliente, hoy: string): NivelRiesgo {
  const vencidas = historial.vencimientosPendientes.filter((fecha) => fecha < hoy).length;
  // Cuotas (no pagos) que recibieron algún pago después de vencer, en los últimos 90 días.
  const cuotasPagadasTarde = new Set(
    historial.pagos
      .filter((p) => p.fecha > p.fechaVencimiento && diasEntre(p.fecha, hoy) <= DIAS_VENTANA)
      .map((p) => p.cuotaId)
  ).size;

  if (vencidas >= 2) return 'riesgo';
  if (vencidas === 1 || cuotasPagadasTarde > 0) return 'con_atrasos';
  if (historial.pagos.length === 0) return 'nuevo';
  return 'cumplidor';
}

export const PERFILES: Record<NivelRiesgo, { texto: string; color: string; colorTexto: string }> = {
  cumplidor: {
    texto: 'Cumplidor',
    color: ColoresRiesgo.cumplidor.fondo,
    colorTexto: ColoresRiesgo.cumplidor.texto,
  },
  con_atrasos: {
    texto: 'Con atrasos',
    color: ColoresRiesgo.con_atrasos.fondo,
    colorTexto: ColoresRiesgo.con_atrasos.texto,
  },
  riesgo: {
    texto: 'Riesgo',
    color: ColoresRiesgo.riesgo.fondo,
    colorTexto: ColoresRiesgo.riesgo.texto,
  },
  nuevo: {
    texto: 'Nuevo',
    color: ColoresRiesgo.nuevo.fondo,
    colorTexto: ColoresRiesgo.nuevo.texto,
  },
};
