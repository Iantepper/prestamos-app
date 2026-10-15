import { Stack } from 'expo-router';

import { OpcionesEncabezado } from '@/constants/theme';

export default function PrestamosLayout() {
  return (
    <Stack screenOptions={OpcionesEncabezado}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle del préstamo' }} />
    </Stack>
  );
}
