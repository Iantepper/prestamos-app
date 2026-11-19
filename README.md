# Cuaderno de Cobros

App móvil para un prestamista informal: funciona como una agenda de cobros. Registra clientes y préstamos, calcula las cuotas, lleva la cuenta de lo cobrado y de lo que falta, renueva préstamos, avisa los días de cobro y abre el mapa o el teléfono del cliente.

Está pensada para una persona mayor sin conocimientos técnicos:
- **Letra y botones:** letra grande y botones altos, con pocas opciones por pantalla.
- **Confirmaciones:** cuadros grandes y claros antes de cada acción importante.
- **Montos:** los campos de plata ponen solos los puntos de miles mientras se escribe (1.500.000).

Trabajo práctico de Seminario (UTN). Todo funciona en el celular, sin cuentas y sin servidor: los datos se guardan en una base SQLite local.

## Funciones

- **Agenda** (pantalla de inicio): una tarjeta por cliente, en la sección más urgente que le corresponda: Atrasadas, Hoy, Mañana o Próximos 7 días.
  - **Resumen de arriba:** "Hoy tenés que cobrar $X en N cuotas".
  - **Cada tarjeta muestra:**
    - "Cobrar ahora" (lo atrasado más lo de hoy), la cantidad de cuotas y hace cuánto venció la más vieja;
    - si tiene cuotas en los próximos días, cuánto y cuándo ("Después: $Y el DD/MM");
    - si una cuota viene de más de un crédito, de qué se compone;
    - la dirección y el teléfono.
  - **Botones:** "Cómo llegar" (abre Google Maps), "Llamar" (abre el marcador del teléfono), "Cobrar" y "Renovar".
- **Cobro por cliente** (desde la Agenda): "¿Cuánto te pagó?" viene cargado con lo que hay que cobrar ahora. Antes de confirmar muestra a qué cuotas se aplica, por ejemplo "Cuota 3: completa" y "Cuota 4: $5.000 de $30.000", con el desglose de las que vienen de más de un crédito: "Cuota $42.500: $25.000 del crédito original + $17.500 del crédito nuevo de $70.000".
- **Clientes:**
  - alta con nombre, teléfono, dirección y notas, con aviso si ya existe uno con el mismo nombre y dirección;
  - buscador por nombre (sin distinguir mayúsculas ni acentos);
  - perfil de riesgo de cada uno, siempre con texto además del color;
  - para los que tienen préstamo activo: "Debe en total" y, si hay algo vencido, "Vencido" en rojo;
  - al tocar los datos de un cliente se abre su préstamo activo o, si no tiene, el alta de préstamo con ese cliente ya elegido;
  - botones "Llamar", "Editar" y "Eliminar", y "Ver préstamos" si tiene préstamos anteriores. No se puede eliminar un cliente con préstamo activo; si solo tiene préstamos terminados, se borra también su historial, con doble confirmación.
- **Préstamos:**
  - alta eligiendo el cliente (con buscador), con vista previa de las cuotas;
  - listas de préstamos activos y saldados (los renovados aparecen con los saldados).
- **Detalle del préstamo:**
  - datos, lo cobrado, lo que falta y la lista de cuotas;
  - debajo de "Falta cobrar", una línea con lo que queda de cada cuota: "Faltan pagar 2 cuotas de $25.000 · $50.000 en total", "baja a $X desde el DD/MM" si el monto baja y, si corresponde, "(N vencidas)" en rojo;
  - si tuvo renovaciones, la sección "De qué se compone": el crédito original y cada renovación, con la fecha, la plata que se le dio, el interés y cuánto suma por cuota;
  - cada cuota con más de una parte muestra su desglose: "$25.000 original + $17.500 renovación del 18/11";
  - cobrar una cuota (también pagos parciales) y editar la fecha y el monto de una cuota pendiente;
  - "Renovar préstamo" y, si hubo una renovación, la línea "Renovado el DD/MM";
  - eliminar el préstamo si todavía no tiene pagos y no participó de una renovación.
- **Renovación**, en dos pasos:
  1. **Datos:** una ficha del préstamo actual, con "Debe hoy" destacado, y la pregunta "¿Cuánta plata le vas a dar en mano?", junto con el interés total y la cantidad de cuotas.
  2. **Revisión:** arriba, el recuadro "Cómo va a pagar", con la próxima cuota y su desglose ("$45.000 = $30.000 del crédito anterior + $15.000 del crédito nuevo"), lo que va a pagar, "Hasta ahora pagaba" y "Le vas a dar hoy". Después, cuándo cambia el monto y por qué, cómo queda cada cuota y el perfil de riesgo del cliente. El total a devolver y la última cuota van al final, en chico.
- **Resumen:** total prestado, total cobrado, lo que falta cobrar, cuotas atrasadas y cantidad de préstamos activos y saldados. Los totales se muestran en pesos enteros.
- **Ajustes** (desde Resumen): borrar todos los datos, con doble confirmación, y cargar los datos de ejemplo (solo en modo desarrollo).
- **Recordatorios:** una notificación a las 9:00 de cada día de los próximos 14 que tenga cobros ("Hoy tenés N cobros por $X").

## Cómo correr la app

Requisitos: [Node.js](https://nodejs.org) (versión LTS) y la app **Expo Go** instalada en el celular.

1. Instalar las dependencias:

   ```bash
   npm install
   ```

2. Iniciar el servidor de desarrollo. Con `--tunnel` el celular se conecta aunque no esté en la misma red que la computadora:

   ```bash
   npx expo start --tunnel
   ```

3. Abrir Expo Go en el celular y escanear el código QR que aparece en la terminal. En iPhone, el QR se escanea con la cámara.

Para revisar el código antes de subir cambios:

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

Para generar un APK instalable se usa EAS Build (perfil `preview` de `eas.json`):

```bash
npx eas-cli@latest build --platform android --profile preview
```

## Datos de ejemplo

Con la app corriendo en modo desarrollo, ir a **Resumen → Ajustes → Cargar datos de ejemplo**. En el APK esta opción no aparece. Se crean 5 clientes ficticios, con fechas calculadas a partir del día de hoy:

| Cliente | Perfil | Situación |
|---|---|---|
| Rosa Fernández | Cumplidor | Un préstamo saldado y otro con dos cuotas pagas y una que vence hoy |
| Jorge Medina | Con atrasos | Una cuota pagada tarde y otra vencida hace 3 días |
| Carlos Ruiz | Riesgo | Dos cuotas vencidas sin cobrar |
| Ana Gómez | Nuevo | Un préstamo que empieza hoy |
| Laura Pérez | Cumplidor | $100.000 al 20 % en 4 cuotas de $30.000, con 2 pagas. Sirve para probar la renovación, por ejemplo dándole $50.000 en mano |

## Tecnologías

- [Expo](https://expo.dev) SDK 57 y React Native 0.86, con React 19
- TypeScript
- Expo Router (navegación y pestañas)
- `expo-sqlite` (base de datos local)
- `expo-notifications` (recordatorios)
- `expo-symbols` (íconos)
- EAS Build (generación del APK)

## Estructura de carpetas

```
src/
  app/                  Pantallas (Expo Router: cada archivo es una ruta)
    _layout.tsx         Base de datos, pestañas, cuadros de confirmación y recordatorios
    index.tsx           Agenda de cobros, agrupada por cliente
    clientes.tsx        Alta, búsqueda, lista, edición y eliminación de clientes
    prestamos/          Pestaña Préstamos (Stack)
      index.tsx         Alta de préstamo y lista de activos / saldados
      [id].tsx          Detalle del préstamo con sus cuotas
      renovar.tsx       Renovación del préstamo en tres pasos
      cliente.tsx       Todos los préstamos de un cliente
    resumen/            Pestaña Resumen (Stack)
      index.tsx         Totales
      ajustes.tsx       Borrado de datos y datos de ejemplo
  components/           Componentes reutilizables: BotonGrande, CampoTexto, CampoMonto,
                        OpcionGrande, TarjetaPrestamo, dialogos (cuadros de confirmación y
                        aviso), CuadroCobro, CuadroCobroCliente, CuadroEditarCuota,
                        CuadroEditarCliente, IndicadorRiesgo...
  db/                   Base de datos SQLite: tablas y migraciones (database.ts) y consultas
                        por tema
  utils/                Lógica sin pantalla: cuotas, renovación, reparto de pagos, agenda,
                        riesgo, mora, formato, recordatorios
  constants/theme.ts    Colores, tarjetas, espaciados y estilo del encabezado
```

## Reglas de negocio

### Cálculo de cuotas (`src/utils/cuotas.ts`)
- **Interés:** simple sobre el total: total a devolver = monto + monto × interés %.
- **Monto de las cuotas:** todas iguales (total / cantidad de cuotas); la última absorbe la diferencia por redondeo.
- **Frecuencia:** semanal (7 días), quincenal (14 días) o mensual. La primera cuota vence un período después de la fecha de inicio.
- **Edición:** la fecha y el monto de una cuota pendiente se pueden editar después.

### Un préstamo activo por cliente
Un cliente no puede tener dos préstamos activos a la vez. En el alta, los que ya tienen uno aparecen con la etiqueta "Ya tiene un préstamo" y la app ofrece renovarlo.

### Renovación (`src/utils/renovacion.ts`)
Hay una sola forma de renovar, y el préstamo sigue siendo uno solo. Se escribe cuánta plata se le va a dar en mano (**E**), que tiene que ser mayor que cero, el interés total y la cantidad de cuotas. El interés se cobra solo sobre E. Con ese monto se calculan cuotas nuevas, y cada una se suma a una cuota pendiente, de la más vieja a la más nueva. Si las nuevas son más que las pendientes, las que sobran se agregan al final con la misma frecuencia; si son menos, solo crecen las primeras. Una cuota con un pago parcial conserva lo pagado, y la renovación mantiene la frecuencia del préstamo.

Ejemplo: le quedan 2 cuotas de $30.000 y se le dan $50.000 en mano, al 20 % en 4 cuotas. Se suman 4 partes de $15.000:

| Cuota | Monto | Crédito original | Crédito nuevo |
|---|---|---|---|
| 3 | $45.000 | $30.000 | $15.000 |
| 4 | $45.000 | $30.000 | $15.000 |
| 5 | $15.000 | | $15.000 |
| 6 | $15.000 | | $15.000 |

Cada cuota recuerda de qué crédito viene cada parte (tabla `cuota_adicionales`, agregada en la versión 3 de la base). Lo que no figura ahí es del crédito original, así que los datos anteriores se conservan sin cambios. Con eso la app explica los cambios de monto: "Hasta la cuota 4 (DD/MM): $45.000; después baja a $15.000 porque termina el crédito original".

La forma anterior, "Descontar lo que debe", ya no aparece en la pantalla. Su código queda sin usar y las renovaciones hechas de esa manera se siguen viendo.

Se puede renovar desde:
- **Préstamos:** con "Renovar préstamo" en el detalle, o al elegir en el alta a un cliente que ya tiene un préstamo activo.
- **Clientes:** al tocar al cliente se abre su préstamo, con el mismo botón.
- **Agenda:** con el botón "Renovar" de cada tarjeta. Al terminar o al volver atrás, se regresa a la Agenda.

### Cobros
- **Por cliente (desde la Agenda):** lo que paga se reparte entre sus cuotas pendientes, de la más vieja a la más nueva. Se pueden adelantar cuotas, sin pasar de lo que debe en total.
- **Por cuota (desde el detalle):** se cobra una cuota, completa o una parte.
- **Cuota pagada:** cuando lo pagado cubre su monto. El préstamo pasa a "saldado" cuando no le quedan cuotas pendientes.

### Sin recargo por mora
El prestamista no cobra recargos, así que la mora está desactivada: el alta de préstamo no tiene ese campo y los préstamos nuevos no generan recargo. La lógica sigue en el código (`src/utils/mora.ts`), y los préstamos viejos que tenían mora la siguen calculando.

### Perfil de riesgo del cliente (`src/utils/riesgo.ts`)
Se basa en los intentos de cobro fallidos. Una cuota está vencida si su fecha ya pasó y no está pagada completa. Se evalúa en este orden, con todos los préstamos del cliente:
1. **Riesgo** (rojo): 2 o más cuotas vencidas sin cobrar.
2. **Con atrasos** (amarillo): 1 cuota vencida sin cobrar, o alguna cuota pagada después de su vencimiento en los últimos 90 días.
3. **Nuevo** (gris): sin pagos y sin cuotas vencidas.
4. **Cumplidor** (verde): el resto.

Al renovar el préstamo de un cliente en Riesgo aparece el aviso destacado "Este cliente tiene 2 o más cuotas vencidas sin cobrar".

### Cuadros de confirmación
En vez de los carteles chicos del sistema, la app usa cuadros propios, grandes, de alto contraste y con palabras claras, por ejemplo "Sí, eliminar" y "No, volver". "No, volver" va arriba, en verde; la acción que confirma va abajo y, si es destructiva, en rojo. Se usan para cobrar, renovar, eliminar y borrar datos.

## Limitaciones conocidas

- **Recordatorios en Expo Go:** en algunas versiones de Expo Go en Android falta un módulo nativo de `expo-notifications`. En ese caso los recordatorios se desactivan solos y el resto de la app funciona igual. En el APK el módulo está incluido.
- **Permiso de notificaciones en el APK:** en una prueba, la app no pidió el permiso al abrirse y hubo que activarlo a mano desde la información de la app en el celular. Está pendiente de revisión.
- **Demora de los avisos en Android:** sin el permiso de alarmas exactas, el aviso de las 9:00 puede llegar unos minutos tarde.
- **Datos solo en el celular:** si se desinstala la app, se pierden. No hay copia de seguridad ni sincronización.
- **Pagos y renovaciones sin deshacer:** no se puede anular un pago registrado ni una renovación.
- **Fechas a mano:** en los formularios se escriben como día/mes/año (no hay calendario para elegirlas).
