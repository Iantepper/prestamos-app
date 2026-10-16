import { DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';
import { migrarDB } from '@/db/database';
import { iniciarRecordatorios } from '@/utils/recordatorios';

SplashScreen.preventAutoHideAsync();

// En Expo Go faltan módulos nativos de expo-notifications: sin recordatorios la app funciona igual,
// así que estos avisos de desarrollo no se muestran en pantalla.
LogBox.ignoreLogs([
  'Cannot find native module',
  'Recordatorios desactivados',
  'Push notifications (remote notifications)',
]);

// Tema de navegación con la paleta de la app (encabezados y fondos).
const temaNavegacion: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.danger,
  },
};

export default function TabLayout() {
  return (
    <SQLiteProvider databaseName="prestamos.db" onInit={migrarDB}>
      <ThemeProvider value={temaNavegacion}>
        <AnimatedSplashOverlay />
        <Recordatorios />
        <AppTabs />
      </ThemeProvider>
    </SQLiteProvider>
  );
}

// Al abrir la app pide permiso para avisar (la primera vez) y reprograma los recordatorios.
function Recordatorios() {
  const db = useSQLiteContext();
  useEffect(() => {
    iniciarRecordatorios(db);
  }, [db]);
  return null;
}
