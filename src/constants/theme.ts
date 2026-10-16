import '@/global.css';

import { Platform } from 'react-native';

// Paleta única (tema claro): la app no tiene modo oscuro.
export const Colors = {
  background: '#FFFAF0', // fondo de las pantallas, color papel
  backgroundElement: '#FFFFFF', // tarjetas
  backgroundSelected: '#E8F1EC', // opción elegida (verde muy claro)
  border: '#E6DFD0', // borde fino de tarjetas y campos
  text: '#1B1B1B',
  textSecondary: '#5A5A5A',
  primary: '#1F6F4A', // verde: botones principales, pagado, al día
  onPrimary: '#FFFFFF', // texto sobre verde, ámbar o rojo
  today: '#B7791F', // ámbar: lo que vence hoy
  danger: '#B3261E', // rojo: atrasado, errores y acciones que no se pueden deshacer
} as const;

export type ThemeColor = keyof typeof Colors;

// Colores de los niveles de riesgo (siempre acompañados del texto del nivel).
export const ColoresRiesgo = {
  cumplidor: { fondo: '#2E7D32', texto: '#FFFFFF' },
  con_atrasos: { fondo: '#F9A825', texto: '#1B1B1B' },
  riesgo: { fondo: Colors.danger, texto: '#FFFFFF' },
  nuevo: { fondo: '#757575', texto: '#FFFFFF' },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Encabezado de las pantallas apiladas (detalle, ajustes): título y "Volver" con letra grande.
export const OpcionesEncabezado = {
  headerTitleStyle: { fontSize: 22, fontWeight: '700' as const },
  headerBackTitleStyle: { fontSize: 20 },
  headerBackTitle: 'Volver',
};

// Tarjeta blanca con borde fino y sombra suave: base de todas las tarjetas de la app.
export const EstiloTarjeta = {
  backgroundColor: Colors.backgroundElement,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: Colors.border,
  padding: Spacing.three,
  gap: Spacing.two,
  boxShadow: '0px 2px 6px rgba(27, 27, 27, 0.08)',
} as const;

// Tarjeta resaltada con un borde de color (atrasada, hoy, aviso).
export function bordeDestacado(color: string) {
  return { borderColor: color, borderWidth: 2 } as const;
}
