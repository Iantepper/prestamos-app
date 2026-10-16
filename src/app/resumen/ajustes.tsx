// Ajustes: cargar datos de ejemplo para la demo y borrar todos los datos.
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, EstiloTarjeta, MaxContentWidth, Spacing } from '@/constants/theme';
import { borrarTodosLosDatos, cargarDatosDeEjemplo, hayDatos } from '@/db/ejemplo';
import { reprogramarRecordatorios } from '@/utils/recordatorios';

export default function AjustesScreen() {
  const db = useSQLiteContext();

  const cargarEjemplo = async () => {
    try {
      await cargarDatosDeEjemplo(db);
    } catch {
      Alert.alert('No se pudieron cargar los datos de ejemplo', 'Probá de nuevo.');
      return;
    }
    reprogramarRecordatorios(db);
    Alert.alert('Datos de ejemplo cargados', 'Mirá la Agenda para ver los cobros.');
  };

  const confirmarEjemplo = async () => {
    let yaHayDatos = false;
    try {
      yaHayDatos = await hayDatos(db);
    } catch {
      // Si no se puede saber, se pregunta como si no hubiera datos.
    }
    if (yaHayDatos) {
      Alert.alert(
        'Ya tenés datos cargados',
        'Los datos de ejemplo se van a sumar a los clientes y préstamos que ya tenés. ¿Querés cargarlos igual?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cargar igual', onPress: cargarEjemplo },
        ]
      );
    } else {
      Alert.alert(
        '¿Cargar datos de ejemplo?',
        'Se van a crear 4 clientes con préstamos para probar la app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cargar', onPress: cargarEjemplo },
        ]
      );
    }
  };

  const borrarTodo = async () => {
    try {
      await borrarTodosLosDatos(db);
    } catch {
      Alert.alert('No se pudieron borrar los datos', 'Probá de nuevo.');
      return;
    }
    reprogramarRecordatorios(db);
    Alert.alert('Se borraron todos los datos');
  };

  // Doble confirmación: borrar todo no se puede deshacer.
  const confirmarBorrado = () => {
    Alert.alert(
      '¿Borrar todos los datos?',
      'Se borran todos los clientes, préstamos, cuotas y pagos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, borrar',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Última confirmación',
              'Esto no se puede deshacer. ¿Seguro que querés borrar todo?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Borrar todo', style: 'destructive', onPress: borrarTodo },
              ]
            ),
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contenido}>
        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          <ThemedText style={styles.titulo}>Datos de ejemplo</ThemedText>
          <ThemedText>
            Crea 4 clientes con préstamos en distintos estados (al día, con atrasos, con riesgo y
            nuevo) para mostrar cómo funciona la app.
          </ThemedText>
          <BotonGrande texto="Cargar datos de ejemplo" onPress={confirmarEjemplo} />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.tarjeta}>
          <ThemedText style={styles.titulo}>Borrar todo</ThemedText>
          <ThemedText>
            Borra todos los clientes, préstamos y pagos del celular. No se puede deshacer.
          </ThemedText>
          <BotonGrande
            texto="Borrar todos los datos"
            variante="peligro"
            onPress={confirmarBorrado}
          />
        </ThemedView>
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
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  tarjeta: EstiloTarjeta,
  titulo: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
});
