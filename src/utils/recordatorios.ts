// src/utils/recordatorios.ts
// Recordatorios locales a las 9:00 de cada día con cobros (próximos 14 días).
// El módulo expo-notifications se carga recién cuando se usa: en algunos entornos (por ejemplo
// Expo Go en Android) falta un módulo nativo y la importación falla. En ese caso los recordatorios
// quedan desactivados sin afectar al resto de la app.
import type * as ModuloNotificaciones from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Platform } from 'react-native';

import { resumirCobrosPorDia } from '@/db/agenda';
import { formatearPesos, hoyISO, sumarDias } from '@/utils/formato';

const CANAL = 'cobros';
const HORA_RECORDATORIO = 9;
const DIAS_A_PROGRAMAR = 14;

// undefined: todavía no se intentó cargar; null: no está disponible.
let notificaciones: typeof ModuloNotificaciones | null | undefined;

function cargarNotificaciones(): typeof ModuloNotificaciones | null {
  if (notificaciones !== undefined) return notificaciones;
  if (Platform.OS === 'web') {
    notificaciones = null;
    return notificaciones;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo: typeof ModuloNotificaciones = require('expo-notifications');
    // Mostrar el aviso aunque la app esté abierta.
    modulo.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificaciones = modulo;
  } catch (error) {
    console.warn('Recordatorios desactivados: no se pudo cargar expo-notifications.', error);
    notificaciones = null;
  }
  return notificaciones;
}

// Al abrir la app: pide permiso si nunca se pidió y reprograma los recordatorios.
export async function iniciarRecordatorios(db: SQLiteDatabase): Promise<void> {
  const Notifications = cargarNotificaciones();
  if (!Notifications) return;
  try {
    // En Android 13+ el pedido de permiso no aparece si no hay un canal creado.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: 'Recordatorios de cobro',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      await explicarPermiso();
      await Notifications.requestPermissionsAsync();
    }
    await reprogramarRecordatorios(db);
  } catch (error) {
    // Si fallan los recordatorios, la app sigue funcionando igual.
    console.warn('No se pudieron programar los recordatorios.', error);
  }
}

// Borra los recordatorios programados y los vuelve a crear con los cobros actuales.
// Se llama al abrir la app y después de crear un préstamo o registrar un pago.
export async function reprogramarRecordatorios(db: SQLiteDatabase): Promise<void> {
  const Notifications = cargarNotificaciones();
  if (!Notifications) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    const hoy = hoyISO();
    const dias = await resumirCobrosPorDia(db, hoy, sumarDias(hoy, DIAS_A_PROGRAMAR - 1));
    const ahora = Date.now();

    for (const dia of dias) {
      const [anio, mes, d] = dia.fecha.split('-').map(Number);
      const cuando = new Date(anio, mes - 1, d, HORA_RECORDATORIO, 0, 0);
      if (cuando.getTime() <= ahora) continue; // hoy después de las 9 ya no se avisa

      const cobros = dia.cantidad === 1 ? '1 cobro' : `${dia.cantidad} cobros`;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Cobros de hoy',
          body: `Hoy tenés ${cobros} por ${formatearPesos(dia.monto)}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: cuando,
          channelId: CANAL,
        },
      });
    }
  } catch (error) {
    // Si fallan los recordatorios, la app sigue funcionando igual.
    console.warn('No se pudieron programar los recordatorios.', error);
  }
}

// Explica para qué se piden las notificaciones antes de que aparezca el pedido del celular.
function explicarPermiso(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      'Avisos de cobro',
      'La app te puede avisar a las 9 de la mañana los días que tenés cobros. ' +
        'A continuación el celular te va a preguntar si permitís las notificaciones: ' +
        'tocá "Permitir" para recibir los avisos.',
      [{ text: 'Entendido', onPress: () => resolve() }],
      { cancelable: false }
    );
  });
}
