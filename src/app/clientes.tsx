import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { CampoTexto } from '@/components/campo-texto';
import { CuadroEditarCliente } from '@/components/cuadro-editar-cliente';
import { useAviso, useConfirmar } from '@/components/dialogos';
import { IndicadorRiesgo } from '@/components/indicador-riesgo';
import { Monto } from '@/components/monto';
import { EncabezadoPantalla } from '@/components/encabezado-pantalla';
import { GuiaPasos } from '@/components/guia-pasos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, EstiloTarjeta, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  actualizarCliente,
  contarPrestamosDeCliente,
  crearCliente,
  eliminarCliente,
  existeClienteIgual,
  listarClientes,
  obtenerDeudasClientes,
  type Cliente,
  type ClienteNuevo,
  type DeudaCliente,
} from '@/db/clientes';
import { obtenerPerfilesRiesgo } from '@/db/riesgo';
import { filtrarPorNombre } from '@/utils/busqueda';
import { hoyISO } from '@/utils/formato';
import { llamar } from '@/utils/llamar';
import { reprogramarRecordatorios } from '@/utils/recordatorios';
import type { NivelRiesgo } from '@/utils/riesgo';

type Errores = { nombre?: string; direccion?: string };

export default function ClientesScreen() {
  const db = useSQLiteContext();
  const confirmar = useConfirmar();
  const avisar = useAviso();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const nombreRef = useRef<TextInput>(null);
  const [perfiles, setPerfiles] = useState<Map<number, NivelRiesgo>>(new Map());
  const [deudas, setDeudas] = useState<Map<number, DeudaCliente>>(new Map());
  const [recarga, setRecarga] = useState(0);
  const [clienteAEditar, setClienteAEditar] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const clientesFiltrados = filtrarPorNombre(clientes, busqueda);

  // Se recarga al entrar a la pestaña (el perfil cambia con los pagos) y al guardar un cliente.
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      const hoy = hoyISO();
      Promise.all([
        listarClientes(db),
        obtenerPerfilesRiesgo(db, hoy),
        obtenerDeudasClientes(db, hoy),
      ]).then(([filas, perfilesClientes, deudasClientes]) => {
        if (!activo) return;
        setClientes(filas);
        setPerfiles(perfilesClientes);
        setDeudas(deudasClientes);
      });
      return () => {
        activo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, recarga])
  );

  const validar = (): boolean => {
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribí el nombre del cliente';
    if (!direccion.trim()) nuevos.direccion = 'Escribí la dirección (se usa para el mapa)';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    let repetido = false;
    try {
      repetido = await existeClienteIgual(db, { nombre, direccion });
    } catch {
      // Si no se puede revisar, se guarda igual: el aviso es solo una ayuda.
    }
    if (
      repetido &&
      !(await confirmar({
        titulo: 'Ya existe un cliente igual',
        mensaje: '¿Cargarlo de todas formas?',
        confirmar: 'Cargar igual',
        cancelar: 'Cancelar',
      }))
    ) {
      return;
    }
    await guardarNuevo();
  };

  const guardarNuevo = async () => {
    try {
      await crearCliente(db, { nombre, telefono, direccion, notas });
    } catch {
      avisar('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setNombre('');
    setTelefono('');
    setDireccion('');
    setNotas('');
    setErrores({});
    setRecarga((r) => r + 1);
    avisar('Cliente guardado');
  };

  const guardarCambios = async (cliente: Cliente, datos: ClienteNuevo) => {
    try {
      await actualizarCliente(db, cliente.id, datos);
    } catch {
      avisar('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setClienteAEditar(null);
    setRecarga((r) => r + 1);
    avisar('Cliente actualizado');
  };

  const eliminar = async (cliente: Cliente) => {
    try {
      const eliminado = await eliminarCliente(db, cliente.id);
      if (!eliminado) {
        avisar(
          'No se puede eliminar',
          'Este cliente tiene préstamos activos. Cobralos o eliminá esos préstamos primero.'
        );
        return;
      }
    } catch {
      avisar('No se pudo eliminar', 'Probá de nuevo.');
      return;
    }
    setRecarga((r) => r + 1);
    reprogramarRecordatorios(db);
    avisar('Cliente eliminado');
  };

  // Sin préstamos: confirmación simple. Con préstamos saldados: doble confirmación, porque
  // también se borra su historial. Con préstamos activos: no se puede.
  const confirmarEliminar = async (cliente: Cliente) => {
    let prestamos;
    try {
      prestamos = await contarPrestamosDeCliente(db, cliente.id);
    } catch {
      avisar('No se pudo eliminar', 'Probá de nuevo.');
      return;
    }
    if (prestamos.activos > 0) {
      avisar(
        'No se puede eliminar',
        'Este cliente tiene préstamos activos. Cobralos o eliminá esos préstamos primero.'
      );
      return;
    }
    if (prestamos.saldados === 0) {
      const seguro = await confirmar({
        titulo: `¿Eliminar a ${cliente.nombre}?`,
        mensaje: 'No se puede deshacer.',
        confirmar: 'Sí, eliminar',
        destructiva: true,
      });
      if (seguro) await eliminar(cliente);
      return;
    }
    const cuantos =
      prestamos.saldados === 1
        ? 'su préstamo saldado'
        : `sus ${prestamos.saldados} préstamos saldados`;
    const primera = await confirmar({
      titulo: `¿Eliminar a ${cliente.nombre} y todo su historial?`,
      mensaje: `También se van a borrar ${cuantos}, con todas sus cuotas y pagos. Lo cobrado deja de aparecer en el Resumen.`,
      confirmar: 'Sí, eliminar',
      destructiva: true,
    });
    if (!primera) return;
    const segunda = await confirmar({
      titulo: 'Última confirmación',
      mensaje: `Se borra ${cliente.nombre} con todo su historial. Esto no se puede deshacer.`,
      confirmar: 'Sí, eliminar todo',
      destructiva: true,
    });
    if (segunda) await eliminar(cliente);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <EncabezadoPantalla
            titulo="Clientes"
            descripcion="Las personas a las que les prestás: cargá una nueva o mirá cómo viene pagando cada una."
          />
          <ThemedText type="subtitle">Nuevo cliente</ThemedText>

          <CampoTexto
            ref={nombreRef}
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
            <GuiaPasos
              titulo="Todavía no cargaste clientes"
              pasos={[
                {
                  texto: 'Completá el formulario de arriba: nombre y dirección',
                  boton: {
                    texto: 'Cargar mi primer cliente',
                    onPress: () => {
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                      nombreRef.current?.focus();
                    },
                  },
                },
                { texto: 'Tocá "Guardar cliente" y va a aparecer acá' },
              ]}
            />
          ) : (
            <>
              <CampoTexto
                etiqueta="Buscar por nombre"
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Ej: María"
                autoCorrect={false}
              />
              {clientesFiltrados.length === 0 ? (
                <ThemedText style={styles.dato}>No hay clientes con ese nombre</ThemedText>
              ) : null}
              {clientesFiltrados.map((cliente) => (
                <ThemedView key={cliente.id} type="backgroundElement" style={styles.tarjeta}>
                  <ThemedText style={styles.nombre}>{cliente.nombre}</ThemedText>
                  <IndicadorRiesgo nivel={perfiles.get(cliente.id) ?? 'nuevo'} />
                  {deudas.has(cliente.id) ? (
                    <ThemedText style={styles.dato}>
                      Debe en total: <Monto valor={deudas.get(cliente.id)!.debe} enteros />
                    </ThemedText>
                  ) : null}
                  {(deudas.get(cliente.id)?.vencido ?? 0) > 0 ? (
                    <ThemedText style={[styles.dato, styles.vencido]}>
                      Vencido: <Monto valor={deudas.get(cliente.id)!.vencido} enteros />
                    </ThemedText>
                  ) : null}
                  {cliente.telefono ? (
                    <ThemedText style={styles.dato}>{cliente.telefono}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.dato}>{cliente.direccion}</ThemedText>
                  {cliente.notas ? (
                    <ThemedText style={styles.dato} themeColor="textSecondary">
                      {cliente.notas}
                    </ThemedText>
                  ) : null}
                  {cliente.telefono ? (
                    <BotonGrande
                      texto="Llamar"
                      icono={{ ios: 'phone.fill', android: 'call', web: 'call' }}
                      onPress={() => llamar(cliente.telefono ?? '')}
                      style={styles.botonLlamar}
                    />
                  ) : null}
                  <View style={styles.botones}>
                    <BotonGrande
                      texto="Editar"
                      variante="secundario"
                      onPress={() => setClienteAEditar(cliente)}
                      style={styles.botonFila}
                    />
                    <BotonGrande
                      texto="Eliminar"
                      variante="peligroBorde"
                      onPress={() => confirmarEliminar(cliente)}
                      style={styles.botonFila}
                    />
                  </View>
                </ThemedView>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {clienteAEditar ? (
        <CuadroEditarCliente
          cliente={clienteAEditar}
          onGuardar={(datos) => guardarCambios(clienteAEditar, datos)}
          onCancelar={() => setClienteAEditar(null)}
        />
      ) : null}
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
  // Editar y Eliminar lado a lado, del mismo ancho y alto.
  botones: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botonFila: {
    flex: 1,
  },
  botonLlamar: {
    marginTop: Spacing.two,
  },
  tarjeta: EstiloTarjeta,
  vencido: {
    color: Colors.danger,
    fontWeight: '700',
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
