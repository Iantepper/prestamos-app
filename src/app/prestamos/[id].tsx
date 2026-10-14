import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  listarCuotas,
  obtenerPrestamo,
  type Cuota,
  type PrestamoDetalle,
} from '@/db/prestamos';
import { totalADevolver } from '@/utils/cuotas';
import { formatearFecha, formatearPesos } from '@/utils/formato';

const COLOR_PAGADA = '#2E7D32';

const TEXTO_FRECUENCIA = {
  semanal: 'por semana',
  quincenal: 'cada 15 días',
  mensual: 'por mes',
} as const;

export default function DetallePrestamoScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const prestamoId = Number(id);
  const [prestamo, setPrestamo] = useState<PrestamoDetalle | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    Promise.all([obtenerPrestamo(db, prestamoId), listarCuotas(db, prestamoId)]).then(
      ([filaPrestamo, filasCuotas]) => {
        if (!activo) return;
        setPrestamo(filaPrestamo);
        setCuotas(filasCuotas);
        setCargando(false);
      }
    );
    return () => {
      activo = false;
    };
  }, [db, prestamoId]);

  if (cargando) return <ThemedView style={styles.container} />;

  if (!prestamo) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.contenido}>
          <ThemedText style={styles.texto}>No se encontró el préstamo.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido}>
        <ThemedText type="subtitle">{prestamo.cliente_nombre}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          <ThemedText style={styles.texto}>Prestado: {formatearPesos(prestamo.monto)}</ThemedText>
          <ThemedText style={styles.texto}>Interés: {prestamo.tasa_interes} %</ThemedText>
          <ThemedText style={styles.texto}>
            Total a devolver:{' '}
            {formatearPesos(totalADevolver(prestamo.monto, prestamo.tasa_interes))}
          </ThemedText>
          <ThemedText style={styles.texto}>
            {prestamo.cant_cuotas} cuotas, {TEXTO_FRECUENCIA[prestamo.frecuencia]}
          </ThemedText>
          <ThemedText style={styles.texto}>
            Empezó el {formatearFecha(prestamo.fecha_inicio)}
          </ThemedText>
        </ThemedView>

        <ThemedText type="subtitle" style={styles.tituloLista}>
          Cuotas
        </ThemedText>
        {cuotas.map((cuota) => (
          <ThemedView key={cuota.id} type="backgroundElement" style={styles.tarjeta}>
            <ThemedText style={styles.destacado}>
              Cuota {cuota.numero}: {formatearPesos(cuota.monto)}
            </ThemedText>
            <ThemedText style={styles.texto}>
              Vence el {formatearFecha(cuota.fecha_vencimiento)}
            </ThemedText>
            <ThemedText style={[styles.texto, cuota.estado === 'pagada' && styles.pagada]}>
              {cuota.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
            </ThemedText>
          </ThemedView>
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
  tituloLista: {
    marginTop: Spacing.three,
  },
  tarjeta: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  destacado: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  pagada: {
    color: COLOR_PAGADA,
    fontWeight: '700',
  },
});
