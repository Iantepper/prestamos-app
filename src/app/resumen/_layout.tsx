import { Stack } from 'expo-router';

import { OpcionesEncabezado } from '@/constants/theme';

export default function ResumenLayout() {
  return (
    <Stack screenOptions={OpcionesEncabezado}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Stack>
  );
}
