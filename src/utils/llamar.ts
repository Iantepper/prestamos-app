// src/utils/llamar.ts
// Abre el marcador del celular con el teléfono del cliente.
import { Alert, Linking } from 'react-native';

// Deja solo lo que sirve para marcar: quita espacios, guiones y paréntesis ("(011) 4567-8901" -> "01145678901").
export function limpiarTelefono(telefono: string): string {
  return telefono.replace(/[\s\-()]/g, '');
}

export async function llamar(telefono: string): Promise<void> {
  const numero = limpiarTelefono(telefono);
  try {
    if (!numero) throw new Error('Teléfono vacío');
    await Linking.openURL(`tel:${numero}`);
  } catch {
    Alert.alert('No se pudo abrir el teléfono');
  }
}
