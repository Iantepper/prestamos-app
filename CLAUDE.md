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

## Decisión de negocio: cálculo de cuotas (src/utils/cuotas.ts, ya creado)
Interés simple sobre el total: total = monto + monto × tasa%; cuota = total / cantidad de cuotas, todas iguales (la última absorbe el redondeo). La primera cuota vence un período después de la fecha de inicio (semanal 7 días, quincenal 14, mensual 1 mes).

## Decisión de negocio: perfil de riesgo del cliente (src/utils/riesgo.ts)
Se calcula con todos los préstamos del cliente (`obtenerPerfilesRiesgo` en `src/db/riesgo.ts`). Pago tardío = un pago con fecha posterior al vencimiento de su cuota (se cuenta cada pago, también los parciales). Se evalúa en este orden:
1. **Riesgo** (rojo): 3 o más pagos tardíos en los últimos 90 días, o alguna cuota vencida hace 15 días o más.
2. **Con atrasos** (amarillo): 1 o 2 pagos tardíos en los últimos 90 días, o alguna cuota vencida hace menos de 15 días.
3. **Nuevo** (gris): sin pagos registrados (y sin cuotas vencidas).
4. **Cumplidor** (verde): el resto, es decir, tiene pagos, ninguno tardío en los últimos 90 días, y nada vencido.
El indicador siempre muestra el texto además del color.

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
- **Agenda** (`index.tsx`): cuotas pendientes en Atrasadas, Hoy, Mañana y Próximos 7 días, con el resumen "Hoy tenés que cobrar…". Cada tarjeta tiene "Cómo llegar" (Google Maps) y, si el cliente tiene teléfono, "Llamar", lado a lado en una fila (sin teléfono, "Cómo llegar" ocupa todo el ancho); abajo, "Cobrar" (`CuadroCobro`) a todo el ancho como acción principal. El texto "Tel: ..." se mantiene para ver el número. Consulta en `src/db/agenda.ts`.
- **Clientes** (`clientes.tsx`): alta y lista con `IndicadorRiesgo`, con un campo "Buscar por nombre" arriba de la lista. "Editar" abre `CuadroEditarCliente`. Consultas en `src/db/clientes.ts`.
  - Al guardar uno nuevo, si ya existe otro con el mismo nombre y dirección (`existeClienteIgual`), pregunta "Ya existe un cliente igual. ¿Cargarlo de todas formas?" (Cancelar / Cargar igual).
  - Si tiene teléfono, "Llamar" (verde relleno, a todo el ancho) va arriba de la fila "Editar" / "Eliminar".
  - "Editar" y "Eliminar" van en la misma fila; "Eliminar" usa la variante `peligroBorde`, para no ser el botón dominante.
  - "Eliminar" (`eliminarCliente`, en una transacción). Con préstamos activos no se puede (avisa "Cobralos o eliminá esos préstamos primero"). Solo con saldados: doble confirmación, y se borran también sus préstamos, cuotas y pagos (cambian los totales del Resumen). Sin préstamos: confirmación simple.
- **Préstamos** (`prestamos/`, Stack):
  - `index.tsx`: alta, eligiendo el cliente con `OpcionGrande` + perfil, con aviso si es Riesgo. Lista con botones "Activos" / "Saldados".
    - Elección del cliente: campo "Buscar por nombre". Con más de 5 clientes se muestran solo los 5 primeros que coinciden (`MAX_CLIENTES_VISIBLES`), con el texto "Escribí el nombre para encontrar a otros". El cliente elegido se sigue mostrando aunque cambie la búsqueda.
  - `[id].tsx`: detalle con saldo y cuotas. Cada cuota pendiente tiene "Cobrar" y "Editar" (`CuadroEditarCuota`). "Eliminar préstamo" aparece solo sin pagos (`eliminarPrestamoSinPagos`).
  - Consultas en `src/db/prestamos.ts`.
- **Resumen** (`resumen/`, Stack):
  - `index.tsx`: totales (consulta en `src/db/resumen.ts`).
  - `ajustes.tsx`: cargar datos de ejemplo y borrar todos los datos, con doble confirmación (`src/db/ejemplo.ts`).

Componentes (`src/components/`):
- `BotonGrande`, con variantes `principal`, `secundario`, `peligro` (rojo lleno) y `peligroBorde` (borde y texto rojos sobre blanco). Acepta `style` (por ejemplo `flex: 1` para dos botones en una fila) e `icono` (nombre de `SymbolView` de `expo-symbols`, incluido en Expo Go: `{ ios, android, web }`).
- `CampoTexto` (acepta `ref` para poner el foco) y `OpcionGrande`.
- `CuadroModal`: pantalla completa para formularios cortos, base de los cuadros de cobro y edición.
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
- **Confirmaciones:** cobrar, eliminar un préstamo, eliminar un cliente y borrar datos piden confirmación con `Alert`.
- **Fechas:** en los formularios se escriben como DD/MM/AAAA (`leerFecha`).
- **Llamar:** `llamar(telefono)` en `src/utils/llamar.ts` quita espacios, guiones y paréntesis y abre el marcador con `tel:`; si falla, avisa "No se pudo abrir el teléfono".
- **Búsqueda de nombres:** `filtrarPorNombre` y `normalizarTexto` (`src/utils/busqueda.ts`), que no distinguen mayúsculas, acentos ni espacios de más.
- **Montos:** se leen con `leerMonto` (acepta "10.500" o "3333,33") y se muestran con `formatearPesos`. En los totales de la pestaña Resumen (Prestado, Total cobrado, Falta cobrar) y en "Cobrado" / "Falta cobrar" de la lista de Préstamos se muestran redondeados a pesos enteros (`formatearPesos(valor, { enteros: true })` o `<Monto enteros />`). Es solo al mostrar: en la base y en el detalle del préstamo y sus cuotas los montos quedan exactos, con centavos.

Pagos y mora: `registrarPago` (`src/db/pagos.ts`) y `calcularMoraPendiente` (`src/utils/mora.ts`).
- **Recargo:** monto de la cuota × mora % diaria × días de atraso, menos la mora ya cobrada de esa cuota.
- **Reparto:** lo cobrado cubre primero el recargo; `pagos.mora` es esa parte y `pagos.monto` lo que se suma a `cuotas.monto_pagado`.
- **Cuota pagada:** cuando `monto_pagado` cubre `monto`. El préstamo pasa a `saldado` sin cuotas pendientes.
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
