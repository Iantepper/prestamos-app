import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { LogBox, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
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

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <SQLiteProvider databaseName="prestamos.db" onInit={migrarDB}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
