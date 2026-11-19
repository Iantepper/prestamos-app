@AGENTS.md

# Proyecto: Cuaderno de Cobros, app de gestión de préstamos personales (TP de Seminario, UTN)

App móvil simple para un prestamista informal (usuario tipo: persona de unos 60 años, sin conocimientos técnicos). Funciona como agenda de cobros: registra clientes y préstamos, calcula cuotas, lleva las cuentas de lo cobrado, y desde la agenda abre Maps/navegación con la dirección del cliente.

## Reglas del proyecto
- Responder y escribir textos de la interfaz y mensajes de commit **en español** (voseo rioplatense en la app: "Escribí el nombre").
- **Lo más simple posible.** Sin backend, sin cuentas, sin librerías extra si Expo ya lo resuelve. Todo local con SQLite (`expo-sqlite`).
- **Interfaz para usuario mayor:** letra grande (mínimo 20 px en campos y botones), botones altos, pocas opciones por pantalla, flujo lineal. Reusar `CampoTexto` y `BotonGrande` de `src/components/`.
- **Commits chicos y frecuentes** (uno por cada paso que funcione), mensaje corto en español en presente ("Agrega...", "Guarda..."). `git push` al terminar cada sesión.
- Antes de dar una tarea por terminada: `npx tsc --noEmit` y `npx expo lint` sin errores.
- Paquetes nuevos siempre con `npx expo install <paquete>`.
- Probar en el celular con Expo Go. En la red del usuario el QR solo conecta con `npx expo start --tunnel`.

## Stack
Expo SDK 57, React Native, TypeScript, Expo Router (rutas en `src/app/`), `expo-sqlite`. Plataforma de trabajo: Windows (Git Bash / PowerShell).

## Modelo de datos (src/db/database.ts, ya creado)
Tablas: `clientes` (nombre, telefono, direccion obligatoria, notas), `prestamos` (cliente_id, monto, tasa_interes, cant_cuotas, frecuencia semanal|quincenal|mensual, fecha_inicio, mora_diaria_pct, estado), `cuotas` (prestamo_id, numero, fecha_vencimiento, monto, monto_pagado, estado pendiente|pagada; fecha y monto editables), `pagos` (cuota_id, fecha, monto, mora). Fechas como texto `YYYY-MM-DD`.
Versión 2 de la base (renovaciones, `PRAGMA user_version = 2`): préstamos con estado `renovado`, cuotas con estado `cancelada`, columna `prestamos.renueva_a` (préstamo anterior, puede ser nulo) y tabla `renovaciones` (prestamo_id = el préstamo que queda vigente, fecha, modo `descuento` | `sumar`, deuda_anterior, monto_nuevo, entregado). Los estados son texto sin `CHECK`, así que no hizo falta reconstruir tablas. `migrarDB` aplica cada versión una sola vez y en orden. Las cuotas canceladas no cuentan en ningún cálculo (agenda, totales, riesgo, "Debe en total", saldos); un préstamo renovado no cuenta como activo.
Versión 3 de la base (`PRAGMA user_version = 3`): tabla `cuota_adicionales` (cuota_id, renovacion_id, monto), con la parte de cada cuota que vino de cada renovación, y columna `renovaciones.tasa_interes` (nula en las renovaciones viejas). Lo que no está en `cuota_adicionales` es del crédito original, así que las cuotas anteriores quedan enteras como originales.

## Decisión de negocio: cálculo de cuotas (src/utils/cuotas.ts, ya creado)
Interés simple sobre el total: total = monto + monto × tasa%; cuota = total / cantidad de cuotas, todas iguales (la última absorbe el redondeo). La primera cuota vence un período después de la fecha de inicio (semanal 7 días, quincenal 14, mensual 1 mes).

## Decisión de negocio: renovación de préstamos (src/utils/renovacion.ts)
Un cliente tiene un solo préstamo activo. Cuando pide más plata se **renueva** su préstamo, y hay **una sola forma** en la pantalla: sumar a las cuotas que quedan, con el préstamo siguiendo como uno solo. El dato que se escribe es **E**, "¿Cuánta plata le vas a dar en mano?": tiene que ser mayor que 0 ("Tenés que dar una plata mayor a cero"). La **deuda** es la suma de (monto − monto_pagado) de las cuotas pendientes, sin mora, y el **crédito total** se calcula: X = E + deuda. La renovación mantiene la frecuencia del préstamo y en `renovaciones` se guarda `monto_nuevo` = X, `entregado` = E y `tasa_interes`.
- **Descontar lo que debe** (`descuento`): **sin uso en la pantalla** (el código queda, como la mora; las renovaciones viejas en este modo se siguen mostrando). Crédito nuevo de monto X, con interés sobre X completo, y se le da E en mano. El préstamo actual pasa a `renovado`, sus cuotas pendientes a `cancelada`, y se crea uno nuevo (con `renueva_a`, la misma frecuencia, la fecha de inicio indicada y mora 0).
  - Ejemplo: deuda $60.000, E $50.000 (X $110.000), 20 %, 4 cuotas: quedan 4 cuotas de $33.000 (total $132.000).
- **Sumar a las cuotas que quedan** (`sumar`): el interés se cobra solo sobre E. Con E, la tasa y la cantidad de cuotas se calculan cuotas nuevas (`calcularCuotas`), y la cuota nueva i se **suma** a la i-ésima cuota pendiente, de la más vieja a la más nueva (una cuota parcial conserva lo pagado). Si las nuevas son más que las pendientes, las que sobran se agregan al final, con la frecuencia del préstamo, a partir de su última cuota. Si son menos, solo se agrandan las primeras. Se actualizan `cant_cuotas` y `monto` (se le suma solo E, porque la deuda ya estaba); `tasa_interes` queda la original.
  - Ejemplo: 2 pendientes de $30.000, E $50.000, 20 %, 4 cuotas: quedan $45.000, $45.000, $15.000 y $15.000.
- **Desglose por cuota:** al sumar, cada parte agregada queda en `cuota_adicionales`; las cuotas agregadas al final tienen base 0 y todo su monto es adicional. Parte original = monto − adicionales. Funciones puras: `componentesDeCuota`, `textoDesglose` (estilos detalle y cobro), `desgloseCobro`, `explicarCronograma` ("Hasta la cuota 2 (18/01): $X; después baja a $Y porque termina el crédito original"), `preverCuotas` (vista previa sin guardar), `textoRenovacion` y `montoOriginal`. Consultas: `obtenerAdicionales` y `listarRenovaciones` (`src/db/prestamos.ts`).
- **Guardado:** `renovarPrestamo` (`src/db/prestamos.ts`) hace todo en una transacción y anota una fila en `renovaciones`. Si los datos no sirven, lanza `ErrorRenovacion` con el mensaje para mostrar. Después de renovar se reprograman los avisos de las 9:00.

## Decisión de negocio: sin recargo por mora
El prestamista entrevistado no cobra mora. El alta de préstamo ya no tiene el campo "Recargo por mora" y los préstamos nuevos guardan `mora_diaria_pct = 0` (también los datos de ejemplo). La lógica de mora (`src/utils/mora.ts`, la columna `mora_diaria_pct`, `pagos.mora`) queda dormida: los préstamos viejos con mora siguen calculándola y mostrándola. Con mora 0 no aparece ninguna línea de mora ni de recargo en la Agenda, los cobros, el detalle ni el Resumen.

## Decisión de negocio: perfil de riesgo del cliente (src/utils/riesgo.ts)
Motivo: el prestamista se preocupa por el segundo intento de cobro fallido. Se calcula con todos los préstamos del cliente (`obtenerPerfilesRiesgo` en `src/db/riesgo.ts`). Una cuota está **vencida** si su fecha es anterior a hoy y no está completamente pagada (un pago parcial no la salda). Se evalúa en este orden:
1. **Riesgo** (rojo): 2 o más cuotas vencidas sin cobrar completas.
2. **Con atrasos** (amarillo): exactamente 1 cuota vencida sin cobrar, o alguna cuota pagada después de su vencimiento en los últimos 90 días (se cuenta por cuota y no por pago: una cuota pagada tarde en dos partes cuenta una vez).
3. **Nuevo** (gris): sin pagos y sin cuotas vencidas.
4. **Cumplidor** (verde): el resto.
El indicador siempre muestra el texto además del color. Ya no se usan los umbrales viejos (3 pagos tardíos, 15 días de atraso).

## Plan por fases
- Fase 0: entorno, proyecto Expo, SQLite. **Completa.**
- Fase 1: clientes y préstamos. Pasos: (1) cálculo de cuotas ✔, (2) pantalla de alta de cliente ✔, (3) guardar clientes en la base ✔, (4) listado de clientes ✔, (5) pantalla de alta de préstamo ✔, (6) generar cuotas al crear préstamo ✔, (7) listado de préstamos activos ✔, (8) detalle del préstamo con sus cuotas ✔. **Completa.**
- Fase 2: registrar pagos y calcular mora (% diario sobre cuota vencida), saldo pendiente. **Completa.**
- Fase 3: agenda de cobros por día; tocar un cobro abre Maps (`Linking.openURL` con `https://www.google.com/maps/search/?api=1&query=<dirección codificada>`); marcar como cobrado. **Completa.**
- Fase 4: notificaciones locales (`expo-notifications`) y resumen (total prestado, por cobrar, atrasos). **Completa.**
- Fase 5 (opcional): semáforo de riesgo por cliente según atrasos. **Completa** (ver "Decisión de negocio: perfil de riesgo").
- Fase 6: pulido de usabilidad y demo. **Completa:** edición de cuotas y clientes, borrado de préstamos sin pagos, revisión de usabilidad, datos de ejemplo y README.

## Estado actual
**Proyecto terminado** (todas las fases completas). Nombre de la app: "Cuaderno de Cobros" (`app.json`: slug `cuaderno-de-cobros`, paquete Android `com.iantepper.cuadernodecobros`, color de marca `#1F6F4A`). Repo en GitHub: Iantepper/prestamos-app, rama `main`. El `README.md` describe la app para quien la use o la evalúe.

**Pendiente: permiso de notificaciones.** En el APK instalado la app no pidió el permiso de notificaciones al abrir; hubo que activarlo a mano desde la info de la app en el celular. Falta:
1. Revisar cuándo y con qué condiciones se pide el permiso (`iniciarRecordatorios` en `src/utils/recordatorios.ts`).
2. Agregar en Ajustes una sección "Avisos de cobro" con:
   - el estado de los avisos;
   - un botón "Activar avisos";
   - un botón "Probar aviso", que manda una notificación a los 10 segundos.

Decidido: esperar al resultado de la prueba del aviso de las 9:00 antes de implementarlo.

Pantallas (`src/app/`):
- **Agenda** (`index.tsx`): una tarjeta por cliente (no por cuota), en la sección más urgente que le corresponda: Atrasadas, Hoy, Mañana o Próximos 7 días (`agruparPorCliente` en `src/utils/agenda.ts`).
  - **Tarjeta:** "Cobrar ahora: $X" (atrasadas más las de hoy), la cantidad de cuotas y hace cuánto venció la más vieja; si tiene cuotas futuras en la ventana, "Después: $Y el DD/MM" (si no hay nada para cobrar ahora, "Cobrar: $Y el DD/MM"). Si una cuota tiene más de una parte, una línea chica con su desglose (`desgloseCobro`, sin repetir).
  - **Botones:** dirección, "Cómo llegar" y "Llamar" lado a lado (sin teléfono, "Cómo llegar" ocupa todo el ancho), "Cobrar" a todo el ancho, que abre `CuadroCobroCliente`, y "Renovar", que abre `/prestamos/renovar` con `desde=agenda`.
  - **Resumen de arriba:** "Hoy tenés que cobrar…" sigue contando cuotas.
  - Consulta en `src/db/agenda.ts`.
- **Clientes** (`clientes.tsx`): alta y lista con `IndicadorRiesgo`, con un campo "Buscar por nombre" arriba de la lista. "Editar" abre `CuadroEditarCliente`. Consultas en `src/db/clientes.ts`.
  - **Tocar los datos de un cliente** abre su préstamo activo o, si no tiene, el alta de préstamo con ese cliente ya elegido (`/prestamos?cliente=<id>`). Los botones quedan fuera de esa zona. Con préstamos anteriores aparece "Ver préstamos" (`/prestamos/cliente?id=<id>`).
  - Los que tienen préstamo activo muestran "Debe en total: $X" (cuotas pendientes, en pesos enteros) y, si hay algo vencido, "Vencido: $Y" en rojo (`obtenerDeudasClientes`).
  - Al guardar uno nuevo, si ya existe otro con el mismo nombre y dirección (`existeClienteIgual`), pregunta "Ya existe un cliente igual. ¿Cargarlo de todas formas?" (Cancelar / Cargar igual).
  - Si tiene teléfono, "Llamar" (verde relleno, a todo el ancho) va arriba de la fila "Editar" / "Eliminar".
  - "Editar" y "Eliminar" van en la misma fila; "Eliminar" usa la variante `peligroBorde`, para no ser el botón dominante.
  - "Eliminar" (`eliminarCliente`, en una transacción). Con préstamos activos no se puede (avisa "Cobralos o eliminá esos préstamos primero"). Solo con saldados: doble confirmación, y se borran también sus préstamos, cuotas y pagos (cambian los totales del Resumen). Sin préstamos: confirmación simple.
- **Préstamos** (`prestamos/`, Stack):
  - `index.tsx`: alta, eligiendo el cliente con `OpcionGrande` + perfil. Lista con botones "Activos" / "Saldados" (la vista "Saldados" incluye también los préstamos renovados, con la etiqueta "Renovado").
    - **Un préstamo activo por cliente:** `crearPrestamo` lanza `ClienteConPrestamoActivoError` si el cliente ya tiene uno. En el alta, esos clientes muestran "Ya tiene un préstamo" y al tocarlos aparece el aviso "Este cliente ya tiene un préstamo activo. Podés renovarlo desde el detalle de su préstamo." Los datos existentes no se tocaron. El aviso tiene un botón "Renovar" que abre la pantalla de renovación (`clientesConPrestamoActivo` devuelve cliente -> préstamo activo).
    - No hay campo de mora (ver "Decisión de negocio: sin recargo por mora").
    - Elección del cliente: campo "Buscar por nombre". Con más de 5 clientes se muestran solo los 5 primeros que coinciden (`MAX_CLIENTES_VISIBLES`), con el texto "Escribí el nombre para encontrar a otros". El cliente elegido se sigue mostrando aunque cambie la búsqueda.
  - `renovar.tsx` (`/prestamos/renovar?id=…&desde=detalle|alta|agenda`): renovación en 2 pasos.
    1. Ficha "Préstamo actual" (monto original, interés, cuotas pagas, cada cuota o sus grupos, próxima cuota y "Debe hoy" destacado), "¿Cuánta plata le vas a dar en mano?", interés total y cantidad de cuotas.
    2. "Revisá antes de confirmar": arriba, el recuadro destacado "Cómo va a pagar" (próxima cuota con su desglose, "Va a pagar: <cronograma>", "Hasta ahora pagaba" y "Le vas a dar hoy"). Después, "Cuándo cambia el monto" (`explicarCronograma`), "Cómo quedan las cuotas" con el desglose de cada una y el perfil de riesgo, con el aviso destacado "Este cliente tiene 2 o más cuotas vencidas sin cobrar" si está en Riesgo. Al final, antes de los botones, "Total a devolver: $… · última cuota DD/MM" como línea chica y gris.
    Confirma con el cuadro grande y avisa que se renovó. Vuelve a donde estaba (detalle o Agenda; desde el alta abre el préstamo). Con `desde=agenda`, también al volver atrás regresa a la Agenda (escucha `beforeRemove`).
  - `[id].tsx`: detalle con saldo y cuotas. Debajo de "Falta cobrar", en préstamos activos, va "Faltan pagar 2 cuotas de $X · $Y en total" con lo que queda de cada cuota y, en rojo, "(N vencidas)" (`resumirFaltante` en `src/utils/renovacion.ts`). Si está activo y tiene cuotas pendientes, botón "Renovar préstamo". Muestra "Renovado el DD/MM" cuando hubo una renovación; un préstamo `renovado` muestra sus cuotas canceladas y un botón para ver el préstamo nuevo. Cada cuota pendiente tiene "Cobrar" y "Editar" (`CuadroEditarCuota`). "Eliminar préstamo" aparece solo en préstamos activos sin pagos que no participaron de una renovación (`eliminarPrestamoSinPagos`). Si el monto baja, esa línea agrega "baja a $X desde el DD/MM". Con renovaciones, sección "De qué se compone": crédito original y cada renovación (`textoRenovacion`). Cada cuota con más de una parte muestra su desglose en una línea chica ("$25.000 original + $17.500 renovación del 18/11").
  - `cliente.tsx` (`/prestamos/cliente?id=<cliente>`): todos los préstamos de un cliente, del más nuevo al más viejo.
  - **Navegación:** `_layout.tsx` usa `unstable_settings.anchor = 'index'`; lo que entra desde otra pestaña usa `router.push(..., { withAnchor: true })`, para que la lista quede debajo.
  - Consultas en `src/db/prestamos.ts`.
- **Resumen** (`resumen/`, Stack):
  - `index.tsx`: totales (consulta en `src/db/resumen.ts`).
  - `ajustes.tsx`: cargar datos de ejemplo y borrar todos los datos, con doble confirmación (`src/db/ejemplo.ts`).

Componentes (`src/components/`):
- `BotonGrande`, con variantes `principal`, `secundario`, `peligro` (rojo lleno) y `peligroBorde` (borde y texto rojos sobre blanco). Acepta `style` (por ejemplo `flex: 1` para dos botones en una fila) e `icono` (nombre de `SymbolView` de `expo-symbols`, incluido en Expo Go: `{ ios, android, web }`).
- `CampoTexto` (acepta `ref` para poner el foco) y `OpcionGrande`.
- `CampoMonto` y `useMonto` (`campo-monto.tsx`): campo de plata con puntos de miles al escribir. `useMonto({ inicial, enteros })` da `texto` y `numero` (limpio). Se usa en todos los campos de plata.
- `TarjetaPrestamo`: tarjeta de un préstamo en las listas; abre su detalle.
- `CuadroModal`: pantalla completa para formularios cortos, base de los cuadros de cobro y edición.
- `CuadroCobroCliente`: cobro por cliente desde la Agenda. "¿Cuánto te pagó?" viene cargado con "Cobrar ahora", muestra "Se aplica a:" con el reparto (por ejemplo "Cuota 3: completa", "Cuota 4: $5.000 de $30.000") y pide confirmación. El "Cobrar" por cuota del detalle sigue usando `CuadroCobro`. Debajo de cada cuota con más de una parte va su desglose; `CuadroCobro` lo muestra igual.
- `DialogosProvider` (`src/components/dialogos.tsx`, montado en `_layout.tsx`): cuadros propios de confirmación y aviso que reemplazan a `Alert.alert` (no usar `Alert.alert`). `useConfirmar()` devuelve una promesa con `true`/`false`; `useAviso()`, un aviso con un solo botón "Entendido". Fuera de los componentes se usan `confirmar` y `avisar`. Estética: cuadro centrado, blanco, borde de 2 px, fondo oscurecido, título 26 px, mensaje 22 px, botones apilados de 64 px y letra de 22 px. "No, volver" va arriba en verde relleno y la confirmación abajo (roja con borde si es destructiva). Los pedidos se encolan y se muestran de a uno.
- `IndicadorRiesgo`.
- `EncabezadoPantalla`: título grande y una línea que explica la pantalla (Agenda, Clientes, Préstamos, Resumen).
- `GuiaPasos`: pasos numerados con botones para los estados vacíos.
- `Monto`: monto en negrita dentro de un texto.
- Barra de pestañas (`app-tabs.tsx`): NativeTabs con `labelVisibilityMode="labeled"` (nombre siempre visible, 14 px) e íconos `md` (Material Symbols, Android) / `sf` (iOS).

Convenciones de la interfaz:
- **Colores:** un solo tema claro en `Colors` (`src/constants/theme.ts`): fondo `#FFFAF0`, tarjetas `#FFFFFF` con borde `#E6DFD0`, texto `#1B1B1B` / `#5A5A5A`, principal `#1F6F4A`, hoy `#B7791F`, peligro/atrasado `#B3261E`. Los niveles de riesgo usan `ColoresRiesgo`. No usar colores sueltos en los componentes.
- **Tarjetas:** `EstiloTarjeta` (radio 16, borde fino, sombra suave); `bordeDestacado(color)` para resaltar (atrasada, hoy, aviso).
- **Texto:** `ThemedText` tiene 20 px por defecto; ningún texto baja de 18 px (salvo los nombres de las pestañas, 14 px).
- **Encabezado:** las pantallas apiladas usan `OpcionesEncabezado` de `src/constants/theme.ts`.
- **Confirmaciones:** cobrar, eliminar un préstamo, eliminar un cliente y borrar datos piden confirmación con `useConfirmar` (cuadro propio, no `Alert.alert`).
- **Fechas:** en los formularios se escriben como DD/MM/AAAA (`leerFecha`).
- **Llamar:** `llamar(telefono)` en `src/utils/llamar.ts` quita espacios, guiones y paréntesis y abre el marcador con `tel:`; si falla, avisa "No se pudo abrir el teléfono".
- **Búsqueda de nombres:** `filtrarPorNombre` y `normalizarTexto` (`src/utils/busqueda.ts`), que no distinguen mayúsculas, acentos ni espacios de más.
- **Montos:** se escriben con `CampoMonto` (`formatearMontoEscrito` pone los puntos y `limpiarMonto` devuelve el número; en la base van sin formato) y se muestran con `formatearPesos`. En los totales de la pestaña Resumen (Prestado, Total cobrado, Falta cobrar) y en "Cobrado" / "Falta cobrar" de la lista de Préstamos se muestran redondeados a pesos enteros (`formatearPesos(valor, { enteros: true })` o `<Monto enteros />`). Es solo al mostrar: en la base y en el detalle del préstamo y sus cuotas los montos quedan exactos, con centavos.

Pagos y mora: `registrarPago` (`src/db/pagos.ts`) y `calcularMoraPendiente` (`src/utils/mora.ts`).
- **Recargo:** monto de la cuota × mora % diaria × días de atraso, menos la mora ya cobrada de esa cuota.
- **Reparto:** lo cobrado cubre primero el recargo; `pagos.mora` es esa parte y `pagos.monto` lo que se suma a `cuotas.monto_pagado`.
- **Cuota pagada:** cuando `monto_pagado` cubre `monto`. El préstamo pasa a `saldado` sin cuotas pendientes.
- **Cobro por cliente:** `registrarPagoCliente` (`src/db/pagos.ts`) reparte el monto entre las cuotas pendientes del cliente, de la más vieja a la más nueva, en una transacción. Usa `repartirPago` (`src/utils/reparto.ts`) y la misma lógica que `registrarPago` (`aplicarPago`). Permite adelantar cuotas, con tope en el saldo total.
- **Saldo:** "Cobrado" y "Falta cobrar" de un préstamo no incluyen mora; el "Total cobrado" del Resumen sí.
- **Total a devolver:** en el detalle es la suma de las cuotas, porque pueden haberse editado.

Recordatorios: `src/utils/recordatorios.ts`.
- **Carga diferida:** `expo-notifications` se carga con `require` dentro de un try/catch. Si falla (Expo Go en Android puede no tener el módulo nativo), quedan desactivados con un `console.warn`, y `_layout.tsx` oculta esos avisos con `LogBox.ignoreLogs`.
- **Permiso:** al abrir la app se pide la primera vez, con una explicación previa.
- **Avisos:** uno a las 9:00 por cada día de los próximos 14 con cuotas que vencen ("Hoy tenés N cobros por $X", sin mora). El armado (hora y texto) está en `armarAvisos` (`src/utils/avisos-cobro.ts`), sin depender de expo-notifications, para poder probarlo en Node.
- **Reprogramación:** al abrir la app y después de crear un préstamo, registrar un pago, editar una cuota, eliminar un préstamo o cliente, o cargar/borrar datos. Las reprogramaciones se encolan (de a una), para que dos seguidas no dejen avisos repetidos.
- **Ícono del aviso en Android:** el plugin `expo-notifications` de `app.json` usa `android-icon-monochrome.png` (forma con fondo transparente) y el color `#1F6F4A`. Recién se ve en un build, no en Expo Go.

## Cómo generar el APK
Se usa EAS Build con `npx eas-cli@latest` (nada instalado global). El login y los builds los hace el usuario; Claude no los ejecuta.
- **`eas.json`:**
  - perfil `preview`: APK para instalar directo en el celular (`distribution: internal`, `android.buildType: apk`);
  - perfil `production`: `.aab` para Play Store (`app-bundle`, `autoIncrement: true`);
  - `cli.appVersionSource: remote`: el `versionCode` de Android lo lleva EAS, no `app.json`.
- **`app.json`:**
  - nombre "Cuaderno de Cobros", slug `cuaderno-de-cobros`, versión `1.0.0`;
  - paquete `com.iantepper.cuadernodecobros`;
  - ícono adaptativo (foreground, background y monochrome, fondo `#1F6F4A`);
  - plugin `expo-notifications`. Los permisos `POST_NOTIFICATIONS` y `RECEIVE_BOOT_COMPLETED` los agrega la propia librería al manifest.
- **Pasos (los corre el usuario):**
  1. `npx eas-cli@latest login`.
  2. `npx eas-cli@latest init`, la primera vez: crea el proyecto en EAS y agrega `extra.eas.projectId` a `app.json` (hay que commitear ese cambio).
  3. `npx eas-cli@latest build --platform android --profile preview`.
  4. Al terminar, EAS da un link y un QR para descargar el APK en el celular. Hay que permitir "instalar apps de origen desconocido".
- **En el APK (modo producción, `__DEV__` falso):** Ajustes muestra solo "Borrar todos los datos", con doble confirmación. "Cargar datos de ejemplo" aparece únicamente en desarrollo (Expo Go o `npx expo start`).
- **Recordatorios:** en el APK sí funcionan (incluyen el módulo nativo que a veces falta en Expo Go). Al abrir la app por primera vez aparece la explicación y el pedido de permiso de notificaciones.

Notas para trabajar:
- **Tipos de rutas:** si `npx tsc --noEmit` falla por una ruta nueva (`href` o `pathname` no asignable), reiniciar `npx expo start` para regenerar `.expo/types/router.d.ts`. El servidor de desarrollo abierto a veces los regenera mal al agregar archivos.
- **Pruebas sin celular:** las consultas se probaron con scripts de Node (`node --experimental-strip-types`) contra `node:sqlite` en memoria, con un adaptador que imita `runAsync`, `getAllAsync`, `getFirstAsync` y `withTransactionAsync`.
