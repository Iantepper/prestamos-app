import { useState, type ComponentProps } from 'react';

import { CampoTexto } from '@/components/campo-texto';
import { escribirMonto, formatearMontoEscrito, limpiarMonto } from '@/utils/formato';

export type EstadoMonto = {
  texto: string; // lo que se ve en el campo: "1.500.000"
  numero: number; // el número limpio: 1500000 (NaN si el campo está vacío)
  enteros: boolean;
  cambiar: (texto: string) => void;
};

// Estado de un campo de plata. `inicial` precarga el campo; `enteros` no deja escribir centavos.
export function useMonto(opciones?: { inicial?: number; enteros?: boolean }): EstadoMonto {
  const enteros = opciones?.enteros ?? false;
  const [texto, setTexto] = useState(() =>
    opciones?.inicial === undefined
      ? ''
      : formatearMontoEscrito(escribirMonto(opciones.inicial), { enteros })
  );
  return {
    texto,
    numero: limpiarMonto(texto),
    enteros,
    cambiar: (nuevo) => setTexto(formatearMontoEscrito(nuevo, { enteros })),
  };
}

type Props = Omit<ComponentProps<typeof CampoTexto>, 'value' | 'onChangeText' | 'keyboardType'> & {
  monto: EstadoMonto;
};

// Campo para escribir plata: pone los puntos de miles mientras se escribe.
export function CampoMonto({ monto, ...rest }: Props) {
  return (
    <CampoTexto
      value={monto.texto}
      onChangeText={monto.cambiar}
      keyboardType={monto.enteros ? 'number-pad' : 'decimal-pad'}
      {...rest}
    />
  );
}
