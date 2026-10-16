import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const COLOR_ERROR = Colors.danger;

type Props = TextInputProps & {
  etiqueta: string;
  error?: string;
  ref?: Ref<TextInput>; // para poner el foco en el campo desde afuera
};

// Campo de formulario con letra grande, pensado para un usuario mayor.
export function CampoTexto({ etiqueta, error, style, ref, ...rest }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.contenedor}>
      <ThemedText style={styles.etiqueta}>{etiqueta}</ThemedText>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? COLOR_ERROR : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: Spacing.one,
  },
  etiqueta: {
    fontWeight: '700',
  },
  input: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 20,
  },
  error: {
    color: COLOR_ERROR,
  },
});
