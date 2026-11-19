// Todos los préstamos de un cliente (activo, saldados y renovados), del más nuevo al más viejo.
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { TarjetaPrestamo } from '@/components/tarjeta-prestamo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listarPrestamosDeCliente, type PrestamoListado } from '@/db/prestamos';

export default function PrestamosClienteScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clienteId = Number(id);
  const [prestamos, setPrestamos] = useState<PrestamoListado[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      listarPrestamosDeCliente(db, clienteId).then((filas) => {
        if (activo) setPrestamos(filas);
      });
      return () => {
        activo = false;
      };
    }, [db, clienteId])
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido}>
        {prestamos?.length === 0 ? (
          <ThemedText>Este cliente todavía no tiene préstamos</ThemedText>
        ) : null}
        {prestamos?.map((prestamo) => (
          <TarjetaPrestamo key={prestamo.id} prestamo={prestamo} mostrarEstado />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
});
