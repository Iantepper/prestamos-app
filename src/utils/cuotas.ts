// src/utils/cuotas.ts
// Cálculo de cuotas con interés simple sobre el total:
//   total = monto + monto * tasa% / 100
//   cuota = total / cantidad de cuotas (todas iguales; la última absorbe el redondeo)

export type Frecuencia = 'semanal' | 'quincenal' | 'mensual';

export type CuotaCalculada = {
  numero: number;
  fechaVencimiento: string; // 'YYYY-MM-DD'
  monto: number;
};

export type DatosPrestamo = {
  monto: number;
  tasaPct: number;
  cantCuotas: number;
  frecuencia: Frecuencia;
  fechaInicio: string; // 'YYYY-MM-DD'
};

export function totalADevolver(monto: number, tasaPct: number): number {
  return redondear(monto + (monto * tasaPct) / 100);
}

export function calcularCuotas(datos: DatosPrestamo): CuotaCalculada[] {
  const { monto, tasaPct, cantCuotas, frecuencia, fechaInicio } = datos;
  if (!(monto > 0) || !(cantCuotas >= 1) || tasaPct < 0) {
    throw new Error('Datos de préstamo inválidos');
  }

  const total = totalADevolver(monto, tasaPct);
  const montoBase = redondear(total / cantCuotas);

  const cuotas: CuotaCalculada[] = [];
  let acumulado = 0;
  for (let i = 1; i <= cantCuotas; i++) {
    // La última cuota ajusta la diferencia por redondeo para que sumen exacto el total.
    const montoCuota = i === cantCuotas ? redondear(total - acumulado) : montoBase;
    acumulado = redondear(acumulado + montoCuota);
    cuotas.push({
      numero: i,
      fechaVencimiento: sumarPeriodos(fechaInicio, frecuencia, i),
      monto: montoCuota,
    });
  }
  return cuotas;
}

// La primera cuota vence un período después de la fecha de inicio.
function sumarPeriodos(fechaISO: string, frecuencia: Frecuencia, n: number): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);

  if (frecuencia === 'mensual') {
    const mesDestino = mes - 1 + n;
    const anioDestino = anio + Math.floor(mesDestino / 12);
    const mesNormalizado = ((mesDestino % 12) + 12) % 12;
    const ultimoDia = new Date(anioDestino, mesNormalizado + 1, 0).getDate();
    return formatear(anioDestino, mesNormalizado + 1, Math.min(dia, ultimoDia));
  }

  const diasPorPeriodo = frecuencia === 'semanal' ? 7 : 14;
  const f = new Date(anio, mes - 1, dia + diasPorPeriodo * n);
  return formatear(f.getFullYear(), f.getMonth() + 1, f.getDate());
}

function formatear(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
