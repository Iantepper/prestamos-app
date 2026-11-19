import { Stack } from 'expo-router';

import { OpcionesEncabezado } from '@/constants/theme';

// Al entrar directo a una pantalla de esta pestaña (desde Clientes o la Agenda), la lista queda
// debajo, para que "atrás" tenga adónde volver.
export const unstable_settings = { anchor: 'index' };

export default function PrestamosLayout() {
  return (
    <Stack screenOptions={OpcionesEncabezado}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle del préstamo' }} />
      <Stack.Screen name="renovar" options={{ title: 'Renovar préstamo' }} />
      <Stack.Screen name="cliente" options={{ title: 'Préstamos del cliente' }} />
    </Stack>
  );
}
