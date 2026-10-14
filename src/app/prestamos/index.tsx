import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { CampoTexto } from '@/components/campo-texto';
import { OpcionGrande } from '@/components/opcion-grande';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listarClientes, type Cliente } from '@/db/clientes';
import { crearPrestamo, listarPrestamos, type PrestamoListado } from '@/db/prestamos';
import {
  calcularCuotas,
  totalADevolver,
  type DatosPrestamo,
  type Frecuencia,
} from '@/utils/cuotas';
import {
  formatearFecha,
  formatearPesos,
  hoyISO,
  leerDecimal,
  leerEntero,
  leerFecha,
} from '@/utils/formato';
import { reprogramarRecordatorios } from '@/utils/recordatorios';

const COLOR_ERROR = '#D32F2F';

const FRECUENCIAS: { valor: Frecuencia; texto: string }[] = [
  { valor: 'semanal', texto: 'Semanal' },
  { valor: 'quincenal', texto: 'Quincenal' },
  { valor: 'mensual', texto: 'Mensual' },
];

type Errores = {
  cliente?: string;
  monto?: string;
  tasa?: string;
  cuotas?: string;
  fecha?: string;
  mora?: string;
};

export default function PrestamosScreen() {
  const db = useSQLiteContext();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [monto, setMonto] = useState('');
  const [tasa, setTasa] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual');
  const [fecha, setFecha] = useState(() => formatearFecha(hoyISO()));
  const [mora, setMora] = useState('0');
  const [errores, setErrores] = useState<Errores>({});

  const [prestamos, setPrestamos] = useState<PrestamoListado[]>([]);
  const [verSaldados, setVerSaldados] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // Se recarga cada vez que se entra a la pestaña (por si se cargó un cliente nuevo)
  // y después de guardar un préstamo o cambiar entre activos y saldados.
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      Promise.all([listarClientes(db), listarPrestamos(db, verSaldados ? 'saldado' : 'activo')]).then(
        ([filasClientes, filasPrestamos]) => {
          if (!activo) return;
          setClientes(filasClientes);
          setPrestamos(filasPrestamos);
        },
      );
      return () => {
        activo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, recarga, verSaldados]),
  );

  const montoNum = leerEntero(monto);
  const tasaNum = leerDecimal(tasa);
  const cuotasNum = leerEntero(cuotas);
  const fechaISO = leerFecha(fecha);
  // El recargo por mora es opcional: vacío cuenta como 0.
  const moraNum = mora.trim() ? leerDecimal(mora) : 0;

  // Datos listos para calcular, o null si todavía falta completar algo.
  const datos: DatosPrestamo | null =
    montoNum > 0 && tasaNum >= 0 && cuotasNum > 0 && fechaISO
      ? {
          monto: montoNum,
          tasaPct: tasaNum,
          cantCuotas: cuotasNum,
          frecuencia,
          fechaInicio: fechaISO,
        }
      : null;
  const cuotasCalculadas = datos ? calcularCuotas(datos) : null;

  const validar = (): boolean => {
    const nuevos: Errores = {};
    if (clienteId === null) nuevos.cliente = 'Elegí un cliente';
    if (!(montoNum > 0)) nuevos.monto = 'Escribí un monto mayor a 0';
    if (!(tasaNum >= 0)) nuevos.tasa = 'Escribí el interés (puede ser 0)';
    if (!(cuotasNum > 0)) nuevos.cuotas = 'Escribí una cantidad de cuotas mayor a 0';
    if (!fechaISO) nuevos.fecha = 'Escribí la fecha como día/mes/año. Ej: 05/11/2026';
    if (!(moraNum >= 0)) nuevos.mora = 'Escribí un número, o dejalo en 0';
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async () => {
    if (!validar() || !datos || clienteId === null) return;
    try {
      await crearPrestamo(db, clienteId, datos, moraNum);
    } catch {
      Alert.alert('No se pudo guardar', 'Probá de nuevo.');
      return;
    }
    setClienteId(null);
    setMonto('');
    setTasa('');
    setCuotas('');
    setFrecuencia('mensual');
    setFecha(formatearFecha(hoyISO()));
    setMora('0');
    setErrores({});
    setRecarga((r) => r + 1);
    reprogramarRecordatorios(db);
    Alert.alert('Préstamo guardado');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <ThemedText type="subtitle">Nuevo préstamo</ThemedText>

          {clientes.length === 0 ? (
            <ThemedText style={styles.texto}>
              Primero cargá un cliente en la pestaña Clientes.
            </ThemedText>
          ) : (
            <>
              <View style={styles.grupo}>
                <ThemedText style={styles.etiqueta}>Cliente *</ThemedText>
                {clientes.map((cliente) => (
                  <OpcionGrande
                    key={cliente.id}
                    texto={cliente.nombre}
                    detalle={cliente.direccion}
                    seleccionada={cliente.id === clienteId}
                    onPress={() => setClienteId(cliente.id)}
                  />
                ))}
                {errores.cliente ? (
                  <ThemedText style={styles.error}>{errores.cliente}</ThemedText>
                ) : null}
              </View>

              <CampoTexto
                etiqueta="Monto que prestás ($) *"
                value={monto}
                onChangeText={setMonto}
                error={errores.monto}
                keyboardType="number-pad"
                placeholder="Ej: 100000"
              />
              <CampoTexto
                etiqueta="Interés total (%) *"
                value={tasa}
                onChangeText={setTasa}
                error={errores.tasa}
                keyboardType="decimal-pad"
                placeholder="Ej: 20"
              />
              <CampoTexto
                etiqueta="Cantidad de cuotas *"
                value={cuotas}
                onChangeText={setCuotas}
                error={errores.cuotas}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="Ej: 10"
              />

              <View style={styles.grupo}>
                <ThemedText style={styles.etiqueta}>Cada cuánto paga</ThemedText>
                <View style={styles.frecuencias}>
                  {FRECUENCIAS.map((f) => (
                    <OpcionGrande
                      key={f.valor}
                      texto={f.texto}
                      seleccionada={f.valor === frecuencia}
                      onPress={() => setFrecuencia(f.valor)}
                    />
                  ))}
                </View>
              </View>

              <CampoTexto
                etiqueta="Fecha de inicio (día/mes/año) *"
                value={fecha}
                onChangeText={setFecha}
                error={errores.fecha}
                keyboardType="numbers-and-punctuation"
                placeholder="Ej: 05/11/2026"
              />
              <CampoTexto
                etiqueta="Recargo por mora (% por día)"
                value={mora}
                onChangeText={setMora}
                error={errores.mora}
                keyboardType="decimal-pad"
                placeholder="Ej: 1"
              />

              {datos && cuotasCalculadas ? (
                <ThemedView type="backgroundElement" style={styles.vistaPrevia}>
                  <ThemedText style={styles.textoVistaPrevia}>
                    Vas a devolver {formatearPesos(totalADevolver(datos.monto, datos.tasaPct))} en{' '}
                    {datos.cantCuotas} cuotas de {formatearPesos(cuotasCalculadas[0].monto)}
                  </ThemedText>
                  <ThemedText style={styles.texto}>
                    Primera cuota: {formatearFecha(cuotasCalculadas[0].fechaVencimiento)}
                  </ThemedText>
                </ThemedView>
              ) : null}

              <BotonGrande texto="Guardar préstamo" onPress={guardar} />
            </>
          )}

          <ThemedText type="subtitle" style={styles.tituloLista}>
            Préstamos
          </ThemedText>
          <View style={styles.selector}>
            <OpcionGrande
              texto="Activos"
              seleccionada={!verSaldados}
              onPress={() => setVerSaldados(false)}
              style={styles.opcionSelector}
            />
            <OpcionGrande
              texto="Saldados"
              seleccionada={verSaldados}
              onPress={() => setVerSaldados(true)}
              style={styles.opcionSelector}
            />
          </View>
          {prestamos.length === 0 ? (
            <ThemedText style={styles.texto}>
              {verSaldados
                ? 'Todavía no hay préstamos saldados'
                : 'Todavía no hay préstamos activos'}
            </ThemedText>
          ) : (
            prestamos.map((prestamo) => (
              <Pressable
                key={prestamo.id}
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
                  <ThemedText style={styles.texto}>
                    Prestado: {formatearPesos(prestamo.monto)}
                  </ThemedText>
                  <ThemedText style={styles.texto}>
                    Cuotas pagas: {prestamo.cuotas_pagadas} de {prestamo.cant_cuotas}
                  </ThemedText>
                  <ThemedText style={styles.texto}>
                    Cobrado: {formatearPesos(prestamo.cobrado)}
                  </ThemedText>
                  <ThemedText style={styles.texto}>
                    Falta cobrar: {formatearPesos(prestamo.falta_cobrar)}
                  </ThemedText>
                  {prestamo.proximo_vencimiento ? (
                    <ThemedText style={styles.texto}>
                      Próximo vencimiento: {formatearFecha(prestamo.proximo_vencimiento)}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.ayuda} themeColor="textSecondary">
                    Tocá para ver las cuotas
                  </ThemedText>
                </ThemedView>
              </Pressable>
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
  grupo: {
    gap: Spacing.two,
  },
  frecuencias: {
    gap: Spacing.two,
  },
  etiqueta: {
    fontWeight: '700',
  },
  texto: {
    fontSize: 20,
    lineHeight: 28,
  },
  error: {
    color: COLOR_ERROR,
  },
  vistaPrevia: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },
  selector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  opcionSelector: {
    flex: 1,
    alignItems: 'center',
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
  presionado: {
    opacity: 0.7,
  },
  ayuda: {
    fontSize: 20,
    lineHeight: 28,
  },
  textoVistaPrevia: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
});
