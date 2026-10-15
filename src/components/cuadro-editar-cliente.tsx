import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { CampoTexto } from '@/components/campo-texto';
import { CuadroModal } from '@/components/cuadro-modal';
import type { Cliente, ClienteNuevo } from '@/db/clientes';

type Props = {
  cliente: Cliente;
  onGuardar: (datos: ClienteNuevo) => void;
  onCancelar: () => void;
};

type Errores = { nombre?: string; direccion?: string };

// Cuadro para cambiar los datos de un cliente.
export function CuadroEditarCliente({ cliente, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono ?? '');
  const [direccion, setDireccion] = useState(cliente.direccion);
  const [notas, setNotas] = useState(cliente.notas ?? '');
  const [errores, setErrores] = useState<Errores>({});

  const guardar = () => {
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribí el nombre del cliente';
    if (!direccion.trim()) nuevos.direccion = 'Escribí la dirección (se usa para el mapa)';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    onGuardar({ nombre, telefono, direccion, notas });
  };

  return (
    <CuadroModal titulo="Editar cliente" onCerrar={onCancelar}>
      <CampoTexto
        etiqueta="Nombre *"
        value={nombre}
        onChangeText={setNombre}
        error={errores.nombre}
        autoCapitalize="words"
      />
      <CampoTexto
        etiqueta="Teléfono"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />
      <CampoTexto
        etiqueta="Dirección *"
        value={direccion}
        onChangeText={setDireccion}
        error={errores.direccion}
        autoCapitalize="words"
      />
      <CampoTexto
        etiqueta="Notas"
        value={notas}
        onChangeText={setNotas}
        multiline
        style={styles.notas}
      />
      <BotonGrande texto="Guardar cambios" onPress={guardar} />
      <BotonGrande texto="Cancelar" variante="secundario" onPress={onCancelar} />
    </CuadroModal>
  );
}

const styles = StyleSheet.create({
  notas: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
