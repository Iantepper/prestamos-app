// src/utils/busqueda.ts
// Búsqueda de clientes por nombre: sin distinguir mayúsculas ni acentos ("jose" encuentra "José").

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Devuelve los elementos cuyo nombre contiene lo buscado. Con la búsqueda vacía, devuelve todos.
export function filtrarPorNombre<T extends { nombre: string }>(lista: T[], busqueda: string): T[] {
  const buscado = normalizarTexto(busqueda);
  if (!buscado) return lista;
  return lista.filter((item) => normalizarTexto(item.nombre).includes(buscado));
}
