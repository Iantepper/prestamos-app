// Cuadros de confirmación y de aviso propios (reemplazan Alert.alert, que es chico y de poco
// contraste). Se monta una vez en src/app/_layout.tsx con <DialogosProvider>.
//   const confirmar = useConfirmar();
//   if (await confirmar({ titulo: '¿Eliminar?', confirmar: 'Sí, eliminar', destructiva: true })) …
//   const avisar = useAviso();
//   await avisar('Cliente guardado');
// Fuera de los componentes (por ejemplo en src/utils) se usan las funciones `confirmar` y `avisar`.
import { useSyncExternalStore, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotonGrande } from '@/components/boton-grande';
import { Colors, Spacing } from '@/constants/theme';

export type OpcionesConfirmar = {
  titulo: string;
  mensaje?: string;
  confirmar: string; // texto del botón que confirma, por ejemplo "Sí, eliminar"
  cancelar?: string; // por defecto "No, volver"
  destructiva?: boolean; // borde y texto rojos en el botón que confirma
};

type Boton = {
  texto: string;
  variante: 'principal' | 'secundario' | 'peligroBorde';
  valor: boolean;
};
type Dialogo = {
  titulo: string;
  mensaje?: string;
  botones: Boton[];
  responder: (valor: boolean) => void;
};

// Cola de cuadros a mostrar, de a uno. Vive fuera de React para poder pedir un cuadro desde
// cualquier lado (también antes de que el provider termine de montarse); el provider la lee con
// useSyncExternalStore.
let cola: Dialogo[] = [];
const oyentes = new Set<() => void>();

function cambiarCola(nueva: Dialogo[]) {
  cola = nueva;
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function leerCola() {
  return cola;
}

function mostrar(dialogo: Dialogo) {
  cambiarCola([...cola, dialogo]);
}

// Pregunta y espera la respuesta: true si confirma, false si vuelve atrás.
export function confirmar(opciones: OpcionesConfirmar): Promise<boolean> {
  return new Promise((resolve) =>
    mostrar({
      titulo: opciones.titulo,
      mensaje: opciones.mensaje,
      botones: [
        { texto: opciones.cancelar ?? 'No, volver', variante: 'principal', valor: false },
        {
          texto: opciones.confirmar,
          variante: opciones.destructiva ? 'peligroBorde' : 'secundario',
          valor: true,
        },
      ],
      responder: resolve,
    })
  );
}

// Aviso simple con un solo botón "Entendido". La promesa se cumple al cerrarlo.
export function avisar(titulo: string, mensaje?: string): Promise<void> {
  return new Promise((resolve) =>
    mostrar({
      titulo,
      mensaje,
      botones: [{ texto: 'Entendido', variante: 'principal', valor: true }],
      responder: () => resolve(),
    })
  );
}

export function useConfirmar() {
  return confirmar;
}

export function useAviso() {
  return avisar;
}

export function DialogosProvider({ children }: { children: ReactNode }) {
  const pendientes = useSyncExternalStore(suscribir, leerCola, leerCola);
  const dialogo = pendientes[0];

  const responder = (valor: boolean) => {
    if (!dialogo) return;
    cambiarCola(cola.filter((d) => d !== dialogo));
    dialogo.responder(valor);
  };

  return (
    <>
      {children}
      <Modal
        visible={dialogo !== undefined}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        // Botón "atrás" de Android: equivale a "No, volver" (o a "Entendido" en un aviso).
        onRequestClose={() => responder(dialogo?.botones.length === 1)}>
        <View style={styles.fondo}>
          {dialogo ? (
            <View style={styles.cuadro} accessibilityRole="alert">
              <ScrollView contentContainerStyle={styles.contenido} bounces={false}>
                <Text style={styles.titulo}>{dialogo.titulo}</Text>
                {dialogo.mensaje ? <Text style={styles.mensaje}>{dialogo.mensaje}</Text> : null}
                <View style={styles.botones}>
                  {dialogo.botones.map((boton) => (
                    <BotonGrande
                      key={boton.texto}
                      texto={boton.texto}
                      variante={boton.variante}
                      textoGrande
                      onPress={() => responder(boton.valor)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  cuadro: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: Colors.backgroundElement,
    borderColor: Colors.border,
    borderWidth: 2,
    borderRadius: 20,
  },
  contenido: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  titulo: {
    color: Colors.text,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  mensaje: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 30,
  },
  botones: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
});
