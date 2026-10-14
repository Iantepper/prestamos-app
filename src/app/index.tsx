// Pantalla temporal de prueba de la base de datos (se reemplaza más adelante por la agenda).
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [tablas, setTablas] = useState<string[]>([]);
  const [cantClientes, setCantClientes] = useState(0);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    Promise.all([
      db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ),
      db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM clientes'),
    ]).then(([filasTablas, filaClientes]) => {
      if (!activo) return;
      setTablas(filasTablas.map((x) => x.name));
      setCantClientes(filaClientes?.n ?? 0);
    });
    return () => {
      activo = false;
    };
  }, [db, recarga]);

  const agregarPrueba = async () => {
    await db.runAsync('INSERT INTO clientes (nombre, direccion) VALUES (?, ?)', [
      'Cliente de prueba',
      'Obelisco, Buenos Aires',
    ]);
    setRecarga((r) => r + 1);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Base de datos</ThemedText>
        <ThemedText>Tablas creadas: {tablas.join(', ') || '(ninguna)'}</ThemedText>
        <ThemedText>Clientes guardados: {cantClientes}</ThemedText>
        <Pressable onPress={agregarPrueba} style={styles.boton}>
          <ThemedText>Agregar cliente de prueba</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  boton: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
  },
});
