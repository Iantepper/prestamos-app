import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

// Tamaño del nombre de cada pestaña: siempre visible debajo del ícono.
const TAMANO_ETIQUETA = 14;

// Barra inferior con las 4 pestañas. Íconos: Material Symbols en Android (`md`) y SF Symbols en iOS (`sf`).
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Colors.backgroundElement}
      tintColor={Colors.primary}
      indicatorColor={Colors.backgroundSelected}
      rippleColor={Colors.backgroundSelected}
      labelVisibilityMode="labeled"
      iconColor={{ default: Colors.textSecondary, selected: Colors.primary }}
      labelStyle={{
        default: { color: Colors.textSecondary, fontSize: TAMANO_ETIQUETA, fontWeight: '600' },
        selected: { color: Colors.primary, fontSize: TAMANO_ETIQUETA, fontWeight: '700' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clientes">
        <NativeTabs.Trigger.Label>Clientes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="group" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="prestamos">
        <NativeTabs.Trigger.Label>Préstamos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="banknote" md="payments" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="resumen">
        <NativeTabs.Trigger.Label>Resumen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
