// src/utils/formato.ts
// Formato de montos y fechas para mostrar en pantalla y leer de los formularios.

// Formato argentino: $ 100.000 (con centavos solo si los hay: $ 1.333,33).
export function formatearPesos(valor: number): string {
  const [entero, decimales] = Math.abs(valor).toFixed(2).split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signo = valor < 0 ? '-' : '';
  return `$ ${signo}${conPuntos}${decimales === '00' ? '' : `,${decimales}`}`;
}

// 'YYYY-MM-DD' -> 'DD/MM/AAAA'
export function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

// 'DD/MM/AAAA' -> 'YYYY-MM-DD', o null si no es una fecha válida.
export function leerFecha(texto: string): string | null {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return null;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const anio = Number(partes[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Número entero escrito por el usuario (ignora puntos y espacios). NaN si está vacío.
export function leerEntero(texto: string): number {
  const digitos = texto.replace(/[^\d]/g, '');
  return digitos ? Number(digitos) : NaN;
}

// Número con decimales escrito con coma o con punto. NaN si no es válido.
export function leerDecimal(texto: string): number {
  const limpio = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : NaN;
}
