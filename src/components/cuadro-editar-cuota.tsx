import { useState } from 'react';

import { BotonGrande } from '@/components/boton-grande';
import { CampoMonto, useMonto } from '@/components/campo-monto';
import { CampoTexto } from '@/components/campo-texto';
import { CuadroModal } from '@/components/cuadro-modal';
import { Monto } from '@/components/monto';
import { ThemedText } from '@/components/themed-text';
import { formatearFecha, formatearPesos, leerFecha } from '@/utils/formato';

type Props = {
  numeroCuota: number;
  fechaVencimiento: string; // 'YYYY-MM-DD'
  monto: number;
  montoPagado: number;
  onGuardar: (cambios: { fechaVencimiento: string; monto: number }) => void;
  onCancelar: () => void;
};

type Errores = { fecha?: string; monto?: string };

// Cuadro para cambiar la fecha de vencimiento y el monto de una cuota pendiente.
export function CuadroEditarCuota({
  numeroCuota,
  fechaVencimiento,
  monto,
  montoPagado,
  onGuardar,
  onCancelar,
}: Props) {
  const [fecha, setFecha] = useState(() => formatearFecha(fechaVencimiento));
  const montoCampo = useMonto({ inicial: monto });
  const [errores, setErrores] = useState<Errores>({});

  const guardar = () => {
    const fechaISO = leerFecha(fecha);
    const montoNum = montoCampo.numero;
    const nuevos: Errores = {};
    if (!fechaISO) nuevos.fecha = 'Escribí la fecha como día/mes/año. Ej: 05/11/2026';
    if (!(montoNum > 0)) {
      nuevos.monto = 'Escribí un monto mayor a 0';
    } else if (montoNum <= montoPagado) {
      nuevos.monto = `Ya pagó ${formatearPesos(montoPagado)}: el monto tiene que ser mayor`;
    }
    setErrores(nuevos);
    if (!fechaISO || Object.keys(nuevos).length > 0) return;
    onGuardar({ fechaVencimiento: fechaISO, monto: montoNum });
  };

  return (
    <CuadroModal titulo={`Editar cuota ${numeroCuota}`} onCerrar={onCancelar}>
      {montoPagado > 0 ? (
        <ThemedText>
          Ya pagó <Monto valor={montoPagado} /> de esta cuota.
        </ThemedText>
      ) : null}
      <CampoTexto
        etiqueta="Fecha de vencimiento (día/mes/año)"
        value={fecha}
        onChangeText={setFecha}
        error={errores.fecha}
        keyboardType="numbers-and-punctuation"
        placeholder="Ej: 05/11/2026"
      />
      <CampoMonto etiqueta="Monto de la cuota ($)" monto={montoCampo} error={errores.monto} />
      <BotonGrande texto="Guardar cambios" onPress={guardar} />
      <BotonGrande texto="Cancelar" variante="secundario" onPress={onCancelar} />
    </CuadroModal>
  );
}
