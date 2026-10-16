// Resumen de las cuentas: lo prestado, lo cobrado, lo que falta y los atrasos.
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonGrande } from '@/components/boton-grande';
import { EncabezadoPantalla } from '@/components/encabezado-pantalla';
import { GuiaPasos } from '@/components/guia-pasos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  Colors,
  bordeDestacado,
  EstiloTarjeta,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { listarCobrosPendientes } from '@/db/agenda';
import { obtenerResumen, type Resumen } from '@/db/resumen';
import { formatearPesos, hoyISO, sumarDias } from '@/utils/formato';
import { calcularMoraPendiente } from '@/utils/mora';

const COLOR_VENCIDA = Colors.danger;

type Atrasos = { cantidad: number; monto: number };

export default function ResumenScreen() {
  const db = useSQLiteContext();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [atrasos, setAtrasos] = useState<Atrasos>({ cantidad: 0, monto: 0 });

  // Se recarga cada vez que se entra a la pestaña.
  useFocusEffect(
    useCallback(() => {
      let activo = true;
      const hoy = hoyISO();
      // Las cuotas atrasadas son las pendientes que vencieron hasta ayer.
      Promise.all([obtenerResumen(db), listarCobrosPendientes(db, sumarDias(hoy, -1))]).then(
        ([filaResumen, atrasadas]) => {
          if (!activo) return;
          const monto = atrasadas.reduce((suma, cuota) => {
            const { recargo } = calcularMoraPendiente(
              {
                monto: cuota.monto,
                fechaVencimiento: cuota.fecha_vencimiento,
                moraPagada: cuota.mora_pagada,
              },
              cuota.mora_diaria_pct,
              hoy
            );
            return suma + cuota.monto - cuota.monto_pagado + recargo;
          }, 0);
          setResumen(filaResumen);
          setAtrasos({ cantidad: atrasadas.length, monto: Math.round(monto * 100) / 100 });
        }
      );
      return () => {
        activo = false;
      };
    }, [db])
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <EncabezadoPantalla
            titulo="Resumen"
            descripcion="Cómo están tus cuentas: lo prestado, lo cobrado y lo que falta."
          />

          {resumen && resumen.prestamos_activos + resumen.prestamos_saldados === 0 ? (
            <GuiaPasos
              titulo="Todavía no hay cuentas para mostrar"
              pasos={[
                {
                  texto: 'Cargá un cliente',
                  boton: {
                    texto: 'Cargar mi primer cliente',
                    onPress: () => router.navigate('/clientes'),
                  },
                },
                {
                  texto: 'Creá un préstamo',
                  boton: {
                    texto: 'Crear un préstamo',
                    onPress: () => router.navigate('/prestamos'),
                  },
                },
                { texto: 'Acá vas a ver lo prestado, lo cobrado y lo que falta' },
              ]}
            />
          ) : resumen ? (
            <>
              <Tarjeta
                titulo="Prestado (préstamos activos)"
                valor={formatearPesos(resumen.total_prestado, { enteros: true })}
              />
              <Tarjeta
                titulo="Total cobrado"
                valor={formatearPesos(resumen.total_cobrado, { enteros: true })}
                detalle={
                  resumen.mora_cobrada > 0
                    ? `Incluye ${formatearPesos(resumen.mora_cobrada)} de recargos por mora`
                    : undefined
                }
              />
              <Tarjeta
                titulo="Falta cobrar"
                valor={formatearPesos(resumen.falta_cobrar, { enteros: true })}
              />
              <Tarjeta
                titulo="Cuotas atrasadas"
                valor={
                  atrasos.cantidad === 0
                    ? 'Ninguna'
                    : `${atrasos.cantidad} por ${formatearPesos(atrasos.monto)}`
                }
                detalle={atrasos.cantidad > 0 ? 'Con el recargo por mora incluido' : undefined}
                alerta={atrasos.cantidad > 0}
              />
              <Tarjeta titulo="Préstamos activos" valor={String(resumen.prestamos_activos)} />
              <Tarjeta titulo="Préstamos saldados" valor={String(resumen.prestamos_saldados)} />
            </>
          ) : null}

          <BotonGrande
            texto="Ajustes"
            variante="secundario"
            onPress={() => router.push('/resumen/ajustes')}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

type TarjetaProps = { titulo: string; valor: string; detalle?: string; alerta?: boolean };

function Tarjeta({ titulo, valor, detalle, alerta }: TarjetaProps) {
  return (
    <ThemedView type="backgroundElement" style={[styles.tarjeta, alerta && styles.tarjetaAlerta]}>
      <ThemedText style={styles.titulo}>{titulo}</ThemedText>
      <ThemedText style={[styles.valor, alerta && styles.alerta]}>{valor}</ThemedText>
      {detalle ? <ThemedText style={styles.titulo}>{detalle}</ThemedText> : null}
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
  tarjeta: EstiloTarjeta,
  tarjetaAlerta: bordeDestacado(COLOR_VENCIDA),
  titulo: {
    fontSize: 20,
    lineHeight: 28,
  },
  valor: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  alerta: {
    color: COLOR_VENCIDA,
  },
});
