# Cuaderno de Cobros

App móvil para un prestamista informal: funciona como una agenda de cobros. Registra clientes y préstamos, calcula las cuotas, lleva la cuenta de lo cobrado y de lo que falta, renueva préstamos, avisa los días de cobro y abre el mapa o el teléfono del cliente.

Está pensada para una persona mayor sin conocimientos técnicos:
- **Letra y botones:** letra grande y botones altos, con pocas opciones por pantalla.
- **Confirmaciones:** cuadros grandes y claros antes de cada acción que no se puede deshacer.

Trabajo práctico de Seminario (UTN). Todo funciona en el celular, sin internet, sin cuentas y sin servidor: los datos se guardan en una base SQLite local.

## Funciones

- **Agenda** (pantalla de inicio): una tarjeta por cliente, en la sección más urgente que le corresponda: Atrasadas (en rojo), Hoy (en ámbar), Mañana y Próximos 7 días.
  - **Resumen de arriba:** "Hoy tenés que cobrar $X en N cuotas".
  - **Cada tarjeta muestra:**
    - "Cobrar ahora" (lo atrasado más lo de hoy), la cantidad de cuotas y hace cuánto venció la más vieja;
    - si tiene cuotas en los próximos días, cuánto y cuándo ("Después: $Y el DD/MM");
    - la dirección y el teléfono.
  - **Botones:** "Cómo llegar" (abre Google Maps), "Llamar" (abre el marcador) y "Cobrar".
  - **Cobro por cliente:** "Cobrar" pregunta "¿Cuánto te pagó?" (cargado con lo que hay que cobrar ahora) y muestra a qué cuotas se aplica antes de confirmar, por ejemplo "Cuota 3: completa", "Cuota 4: $5.000 de $30.000". El pago se reparte solo entre las cuotas pendientes, de la más vieja a la más nueva; se pueden adelantar cuotas, sin pasar de lo que debe.
- **Clientes**:
  - alta con nombre, teléfono, dirección y notas, con aviso si ya existe uno con el mismo nombre y dirección;
  - buscador por nombre (sin distinguir mayúsculas ni acentos);
  - perfil de riesgo de cada uno (Cumplidor, Con atrasos, Riesgo, Nuevo), siempre con texto además del color;
  - para los que tienen préstamo: "Debe en total" y, si hay algo vencido, "Vencido" en rojo;
  - botones "Llamar", "Editar" y "Eliminar". No se puede eliminar un cliente con préstamo activo; si solo tiene préstamos terminados, se borra también su historial, con doble confirmación.
- **Préstamos**:
  - alta eligiendo el cliente (con buscador), con vista previa de las cuotas ("Vas a devolver $X en N cuotas de $Y");
  - **un solo préstamo activo por cliente:** los clientes que ya tienen uno aparecen con la etiqueta "Ya tiene un préstamo" y, al tocarlos, la app ofrece renovarlo;
  - listas de préstamos activos y saldados (los renovados aparecen con los saldados).
- **Detalle del préstamo**:
  - datos, lo cobrado, lo que falta y la lista de cuotas (pendientes, vencidas en rojo, pagadas);
  - cobrar una cuota (también pagos parciales) y editar la fecha y el monto de una cuota pendiente;
  - "Renovar préstamo" y, si hubo una renovación, la línea "Renovado el DD/MM";
  - eliminar el préstamo si todavía no tiene pagos y no participó de una renovación.
- **Renovación** (desde el detalle o desde el alta), en tres pasos:
  1. **Datos:** lo que debe hoy y los datos del nuevo crédito (monto, interés y cuotas).
  2. **Comparación:** dos tarjetas con los dos modos ("Descontar lo que debe" y "Sumar a las cuotas que quedan"), con lo que se le entrega hoy y cómo quedan las cuotas.
  3. **Revisión:** "Revisá antes de confirmar", con el préstamo actual, cómo queda cada cuota, "Le entregás hoy", la cuota de antes y la de ahora, la nueva fecha final y el perfil de riesgo del cliente.
- **Resumen**: total prestado, total cobrado, lo que falta cobrar, cuotas atrasadas y cantidad de préstamos activos y saldados. Los totales se muestran en pesos enteros.
- **Ajustes** (desde Resumen):
  - borrar todos los datos, con doble confirmación;
  - cargar datos de ejemplo para una demo: 5 clientes, uno de cada perfil más uno listo para probar las dos renovaciones. Esta opción aparece solo en modo desarrollo.
- **Recordatorios**: una notificación a las 9:00 de cada día de los próximos 14 que tenga cobros ("Hoy tenés N cobros por $X").

## Cómo instalarla y correrla

Requisitos: [Node.js](https://nodejs.org) (versión LTS) y la app **Expo Go** instalada en el celular (Play Store o App Store).

1. Instalar las dependencias:

   ```bash
   npm install
   ```

2. Iniciar el servidor de desarrollo. Con `--tunnel` el celular se conecta aunque no esté en la misma red que la computadora (en algunas redes es la única forma de que funcione el QR):

   ```bash
   npx expo start --tunnel
   ```

3. Abrir Expo Go en el celular y escanear el código QR que aparece en la terminal. En iPhone, el QR se escanea con la cámara.

4. Para probar con datos: ir a **Resumen → Ajustes → Cargar datos de ejemplo**.

Antes de entregar cambios:

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

## Decisiones de negocio

### Cálculo de cuotas (`src/utils/cuotas.ts`)
- **Interés:** simple sobre el total: total a devolver = monto + monto × interés %.
- **Monto de las cuotas:** todas iguales (total / cantidad de cuotas); la última absorbe la diferencia por redondeo.
- **Frecuencia:** semanal (7 días), quincenal (14 días) o mensual. La primera cuota vence un período después de la fecha de inicio.
- **Edición:** la fecha y el monto de una cuota pendiente se pueden editar después, para ingresos irregulares.

### Un solo préstamo activo por cliente
Un cliente no puede tener dos préstamos activos a la vez. Cuando pide más plata, se renueva el préstamo que tiene.

### Renovación (`src/utils/renovacion.ts`)
El prestamista elige entre dos modos, con el mismo "Monto del nuevo crédito" (X). La **deuda** es lo que falta de las cuotas pendientes.
- **Descontar lo que debe:** se hace un crédito nuevo de X, con el interés sobre X completo (incluye lo que debía). Se le entrega X menos la deuda, así que X tiene que ser mayor que la deuda. El préstamo anterior queda como "renovado" y sus cuotas pendientes se cancelan.
  - Ejemplo: debe $60.000 y pide un crédito de $110.000 al 20 % en 4 cuotas. Se le entregan $50.000 y quedan 4 cuotas de $33.000 (total $132.000).
- **Sumar a las cuotas que quedan:** se le entrega X completo. Con X, el interés y la cantidad de cuotas se calculan cuotas nuevas, y cada una se suma a una cuota pendiente, de la más vieja a la más nueva. Si las cuotas nuevas son más que las pendientes, las que sobran se agregan al final con la misma frecuencia; si son menos, solo se agrandan las primeras.
  - Ejemplo: le quedan 2 cuotas de $30.000 y pide $50.000 al 20 % en 4 cuotas. Se le entregan $50.000 y las cuotas quedan en $45.000, $45.000, $15.000 y $15.000.

### Cobros
- **Por cuota (desde el detalle):** se cobra una cuota, completa o una parte.
- **Por cliente (desde la Agenda):** lo que paga se reparte entre sus cuotas pendientes, de la más vieja a la más nueva, sin pasar de lo que debe en total.
- **Cuota pagada:** cuando lo pagado cubre su monto (un pago parcial no la salda). El préstamo pasa a "saldado" cuando no le quedan cuotas pendientes.

### Sin recargo por mora
El prestamista no cobra mora, así que el recargo está desactivado: el alta de préstamo no tiene ese campo y no aparece ninguna línea de mora en la app. La lógica sigue en el código (`src/utils/mora.ts`) por si se quiere volver a usar; los préstamos viejos que tenían mora la siguen calculando.

### Perfil de riesgo del cliente (`src/utils/riesgo.ts`)
Se basa en los intentos de cobro fallidos: al prestamista le preocupa el segundo cobro que no se pudo hacer. Una cuota está vencida si su fecha ya pasó y no está pagada completa (un pago parcial no la salda). Se evalúa en este orden, con todos los préstamos del cliente:
1. **Riesgo** (rojo): 2 o más cuotas vencidas sin cobrar.
2. **Con atrasos** (amarillo): 1 cuota vencida sin cobrar, o alguna cuota pagada después de su vencimiento en los últimos 90 días.
3. **Nuevo** (gris): sin pagos y sin cuotas vencidas.
4. **Cumplidor** (verde): el resto.

El indicador siempre muestra el texto además del color. Al renovar el préstamo de un cliente en Riesgo aparece el aviso destacado "Este cliente tiene 2 o más cuotas vencidas sin cobrar".

### Cuadros de confirmación
En vez de los carteles chicos del sistema, la app usa cuadros propios. Son grandes, de alto contraste y con palabras claras, por ejemplo "Sí, eliminar" y "No, volver". "No, volver" va arriba, en verde. La acción que confirma va abajo y, si no se puede deshacer, en rojo. Se usan para cobrar, renovar, eliminar y borrar datos.

## Limitaciones conocidas

- **Recordatorios en Expo Go:** las notificaciones locales dependen de `expo-notifications`. En algunas versiones de Expo Go en Android falta un módulo nativo y no se pueden usar; en ese caso los recordatorios se desactivan solos y el resto de la app funciona igual. En el APK sí funcionan.
- **Permiso de notificaciones en el APK:** en una prueba, la app no pidió el permiso al abrirse y hubo que activarlo a mano desde la información de la app en el celular. Está pendiente de revisión.
- **Demora de los avisos en Android:** sin el permiso de alarmas exactas, el aviso de las 9:00 puede llegar unos minutos tarde.
- **Datos solo en el celular:** si se desinstala la app, se pierden. No hay copia de seguridad ni sincronización.
- **Pagos y renovaciones sin deshacer:** no se puede anular un pago registrado ni una renovación.
- **Fechas a mano:** en los formularios se escriben como día/mes/año (no hay calendario para elegirlas).
