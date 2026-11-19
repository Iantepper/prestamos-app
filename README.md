# Cuaderno de Cobros

App móvil para un prestamista informal: funciona como una agenda de cobros. Registra clientes y préstamos, calcula las cuotas, lleva la cuenta de lo cobrado y de lo que falta, renueva préstamos, avisa los días de cobro y abre el mapa o el teléfono del cliente.

Está pensada para una persona mayor sin conocimientos técnicos:
- **Letra y botones:** letra grande y botones altos, con pocas opciones por pantalla.
- **Confirmaciones:** cuadros grandes y claros antes de cada acción importante.

Trabajo práctico de Seminario (UTN). Todo funciona en el celular, sin cuentas y sin servidor: los datos se guardan en una base SQLite local.

## Funciones

- **Agenda** (pantalla de inicio): una tarjeta por cliente, en la sección más urgente que le corresponda: Atrasadas, Hoy, Mañana o Próximos 7 días.
  - **Resumen de arriba:** "Hoy tenés que cobrar $X en N cuotas".
  - **Cada tarjeta muestra:**
    - "Cobrar ahora" (lo atrasado más lo de hoy), la cantidad de cuotas y hace cuánto venció la más vieja;
    - si tiene cuotas en los próximos días, cuánto y cuándo ("Después: $Y el DD/MM");
    - la dirección.
  - **Botones:** "Cómo llegar" (abre Google Maps), "Llamar" (abre el marcador del teléfono) y "Cobrar".
- **Cobro por cliente** (desde la Agenda): "¿Cuánto te pagó?" viene cargado con lo que hay que cobrar ahora. Antes de confirmar muestra a qué cuotas se aplica, por ejemplo "Cuota 3: completa" y "Cuota 4: $5.000 de $30.000".
- **Clientes:**
  - alta con nombre, teléfono, dirección y notas, con aviso si ya existe uno con el mismo nombre y dirección;
  - buscador por nombre (sin distinguir mayúsculas ni acentos);
  - perfil de riesgo de cada uno, siempre con texto además del color;
  - para los que tienen préstamo activo: "Debe en total" y, si hay algo vencido, "Vencido" en rojo;
  - botones "Llamar", "Editar" y "Eliminar". No se puede eliminar un cliente con préstamo activo; si solo tiene préstamos terminados, se borra también su historial, con doble confirmación.
- **Préstamos:**
  - alta eligiendo el cliente (con buscador), con vista previa de las cuotas;
  - listas de préstamos activos y saldados (los renovados aparecen con los saldados).
- **Detalle del préstamo:**
  - datos, lo cobrado, lo que falta y la lista de cuotas;
  - cobrar una cuota (también pagos parciales) y editar la fecha y el monto de una cuota pendiente;
  - "Renovar préstamo" y, si hubo una renovación, la línea "Renovado el DD/MM";
  - eliminar el préstamo si todavía no tiene pagos y no participó de una renovación.
- **Renovación** (desde el detalle o desde el alta), en tres pasos:
  1. **Datos:** lo que debe hoy y los datos del nuevo crédito.
  2. **Comparación:** una tarjeta por modo, con la próxima cuota, lo que va a pagar ("2 cuotas de $45.000, después 2 cuotas de $15.000, una por semana"), lo que paga hoy y lo que se le entrega. El total a devolver y la última cuota van al final, en chico.
  3. **Revisión:** arriba, el recuadro "Cómo va a pagar". Después, el préstamo actual, qué se hace, cómo queda cada cuota y el perfil de riesgo del cliente.
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

Para revisar el código antes de entregar cambios:

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
| Laura Pérez | Cumplidor | $100.000 al 20 % en 4 cuotas de $30.000, con 2 pagas. Sirve para probar la renovación, por ejemplo con un crédito nuevo de $110.000 |

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
    resumen/            Pestaña Resumen (Stack)
      index.tsx         Totales
      ajustes.tsx       Borrado de datos y datos de ejemplo
  components/           Componentes reutilizables: BotonGrande, CampoTexto, OpcionGrande,
                        dialogos (cuadros de confirmación y aviso), CuadroCobro,
                        CuadroCobroCliente, CuadroEditarCuota, CuadroEditarCliente,
                        IndicadorRiesgo...
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
En los dos modos, el "Monto del nuevo crédito" (X) es el crédito total: **se entrega X − deuda** y **X tiene que ser mayor que la deuda**. La deuda es lo que falta pagar de las cuotas pendientes. La diferencia entre los modos es sobre qué se cobra el interés y cómo quedan las cuotas.

- **Descontar lo que debe:** el interés se cobra sobre todo X. Se hace un préstamo nuevo de X, el anterior queda como "renovado" y sus cuotas pendientes se cancelan.
- **Sumar a las cuotas que quedan:** el interés se cobra solo sobre lo entregado. Con ese monto se calculan cuotas nuevas, y cada una se suma a una cuota pendiente, de la más vieja a la más nueva. Si las nuevas son más que las pendientes, las que sobran se agregan al final con la misma frecuencia; si son menos, solo crecen las primeras. Una cuota con un pago parcial conserva lo pagado.

Ejemplo: le quedan 2 cuotas de $30.000 (debe $60.000) y se renueva con un crédito de $110.000 al 20 % en 4 cuotas. En los dos modos se le entregan $50.000.

| | Descontar | Sumar |
|---|---|---|
| Interés sobre | $110.000 | $50.000 |
| Cuotas que quedan | $33.000, $33.000, $33.000, $33.000 | $45.000, $45.000, $15.000, $15.000 |
| Total a pagar desde hoy | $132.000 | $120.000 |

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
