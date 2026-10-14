// src/utils/riesgo.ts
// Perfil de riesgo de un cliente según sus atrasos:
//   Riesgo (rojo):       3 o más pagos tardíos en los últimos 90 días, o una cuota vencida hace 15 días o más.
//   Con atrasos (amarillo): 1 o 2 pagos tardíos en los últimos 90 días, o una cuota vencida hace menos de 15 días.
//   Nuevo (gris):        sin pagos registrados y sin cuotas vencidas.
//   Cumplidor (verde):   tiene pagos, ninguno tardío en los últimos 90 días, y ninguna cuota vencida.
// Pago tardío: la fecha del pago es posterior al vencimiento de su cuota.
import { diasEntre } from '@/utils/mora';

export type NivelRiesgo = 'cumplidor' | 'con_atrasos' | 'riesgo' | 'nuevo';

export type HistorialCliente = {
  pagos: { fecha: string; fechaVencimiento: string }[]; // fechas 'YYYY-MM-DD'
  vencimientosPendientes: string[]; // vencimientos de sus cuotas sin pagar
};

const DIAS_VENTANA = 90;
const DIAS_ATRASO_GRAVE = 15;
const PAGOS_TARDIOS_RIESGO = 3;

export function calcularPerfilRiesgo(historial: HistorialCliente, hoy: string): NivelRiesgo {
  const pagosTardios = historial.pagos.filter(
    (pago) => diasEntre(pago.fecha, hoy) <= DIAS_VENTANA && pago.fecha > pago.fechaVencimiento
  ).length;
  const maxDiasAtraso = Math.max(0, ...historial.vencimientosPendientes.map((f) => diasEntre(f, hoy)));

  if (pagosTardios >= PAGOS_TARDIOS_RIESGO || maxDiasAtraso >= DIAS_ATRASO_GRAVE) return 'riesgo';
  if (pagosTardios > 0 || maxDiasAtraso > 0) return 'con_atrasos';
  if (historial.pagos.length === 0) return 'nuevo';
  return 'cumplidor';
}

export const PERFILES: Record<NivelRiesgo, { texto: string; color: string; colorTexto: string }> = {
  cumplidor: { texto: 'Cumplidor', color: '#2E7D32', colorTexto: '#ffffff' },
  con_atrasos: { texto: 'Con atrasos', color: '#F9A825', colorTexto: '#000000' },
  riesgo: { texto: 'Riesgo', color: '#D32F2F', colorTexto: '#ffffff' },
  nuevo: { texto: 'Nuevo', color: '#757575', colorTexto: '#ffffff' },
};
