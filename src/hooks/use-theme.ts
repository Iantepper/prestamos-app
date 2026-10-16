import { Colors } from '@/constants/theme';

// La app tiene un solo tema (claro), así que siempre devuelve la misma paleta.
export function useTheme() {
  return Colors;
}
