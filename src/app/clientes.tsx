import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { CampoTexto } from '@/components/campo-texto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { crearCliente, listarClientes, type Cliente } from '@/db/clientes';

type Errores = { nombre?: string; direccion?: string };

export default function ClientesScreen() {
  const db = useSQLiteContext();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    listarClientes(db).then((filas) => {
      if (activo) setClientes(filas);
    });
    return () => {
      activo = false;
    };
  }, [db, recarga]);

  const validar = (): boolean => {
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribí el nombre del cliente';
    if (!direccion.trim()) nuevos.direccion = 'Escribí la dirección (se usa para el mapa)';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    try {
      await crearCliente(db, { nombre, telefono, direccion, notas });
    } catch {
      Alert.alert('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setNombre('');
    setTelefono('');
    setDireccion('');
    setNotas('');
    setErrores({});
    setRecarga((r) => r + 1);
    Alert.alert('Cliente guardado');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <ThemedText type="subtitle">Nuevo cliente</ThemedText>

          <CampoTexto
            etiqueta="Nombre *"
            value={nombre}
            onChangeText={setNombre}
            error={errores.nombre}
            autoCapitalize="words"
            placeholder="Ej: María Gómez"
          />
          <CampoTexto
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholder="Ej: 11 5555 1234"
          />
          <CampoTexto
            etiqueta="Dirección *"
            value={direccion}
            onChangeText={setDireccion}
            error={errores.direccion}
            autoCapitalize="words"
            placeholder="Ej: Av. Rivadavia 1234, CABA"
          />
          <CampoTexto
            etiqueta="Notas"
            value={notas}
            onChangeText={setNotas}
            multiline
            style={styles.notas}
            placeholder="Ej: Toca timbre del 2°B"
          />

          <BotonGrande texto="Guardar cliente" onPress={guardar} />

          <ThemedText type="subtitle" style={styles.tituloLista}>
            Clientes guardados
          </ThemedText>
          {clientes.length === 0 ? (
            <ThemedText style={styles.dato}>Todavía no cargaste clientes</ThemedText>
          ) : (
            clientes.map((cliente) => (
              <ThemedView key={cliente.id} type="backgroundElement" style={styles.tarjeta}>
                <ThemedText style={styles.nombre}>{cliente.nombre}</ThemedText>
                {cliente.telefono ? (
                  <ThemedText style={styles.dato}>{cliente.telefono}</ThemedText>
                ) : null}
                <ThemedText style={styles.dato}>{cliente.direccion}</ThemedText>
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  notas: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  tituloLista: {
    marginTop: Spacing.four,
  },
  tarjeta: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },
  nombre: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  dato: {
    fontSize: 20,
    lineHeight: 28,
  },
});
