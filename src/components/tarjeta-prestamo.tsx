import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Monto } from '@/components/monto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EstiloTarjeta } from '@/constants/theme';
import type { PrestamoListado } from '@/db/prestamos';
import { formatearFecha } from '@/utils/formato';

// Tarjeta de un préstamo en una lista: al tocarla se abre su detalle. `mostrarEstado` agrega si
// está activo o saldado, para las listas que mezclan préstamos.
export function TarjetaPrestamo({
  prestamo,
  mostrarEstado = false,
}: {
  prestamo: PrestamoListado;
  mostrarEstado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/prestamos/[id]',
          params: { id: prestamo.id },
        })
      }
      style={({ pressed }) => pressed && styles.presionado}>
      <ThemedView type="backgroundElement" style={styles.tarjeta}>
        <ThemedText style={styles.nombre}>{prestamo.cliente_nombre}</ThemedText>
        {mostrarEstado && prestamo.estado !== 'renovado' ? (
          <ThemedText style={styles.estado}>
            {prestamo.estado === 'activo' ? 'Activo' : 'Saldado'}
          </ThemedText>
        ) : null}
        {prestamo.estado === 'renovado' ? (
          <ThemedText style={styles.texto} themeColor="textSecondary">
            Renovado: lo que debía pasó a un préstamo nuevo
          </ThemedText>
        ) : null}
        <ThemedText style={styles.texto}>
          Prestado: <Monto valor={prestamo.monto} />
        </ThemedText>
        <ThemedText style={styles.texto}>
          Cuotas pagas: {prestamo.cuotas_pagadas} de {prestamo.cant_cuotas}
        </ThemedText>
        <ThemedText style={styles.texto}>
          Cobrado: <Monto valor={prestamo.cobrado} enteros />
        </ThemedText>
        <ThemedText style={styles.texto}>
          Falta cobrar: <Monto valor={prestamo.falta_cobrar} enteros />
        </ThemedText>
        {prestamo.proximo_vencimiento ? (
          <ThemedText style={styles.texto}>
            Próximo vencimiento: {formatearFecha(prestamo.proximo_vencimiento)}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.texto} themeColor="textSecondary">
          Tocá para ver las cuotas
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: EstiloTarjeta,
  nombre: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  estado: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  presionado: {
    opacity: 0.7,
  },
});
