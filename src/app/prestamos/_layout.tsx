import { Stack } from 'expo-router';

export default function PrestamosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Detalle del préstamo', headerBackTitle: 'Volver' }}
      />
    </Stack>
  );
}
