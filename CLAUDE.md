@AGENTS.md

# Proyecto: app de gestión de préstamos personales (TP de Seminario, UTN)

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
**Proyecto terminado** (todas las fases completas). Repo en GitHub: Iantepper/prestamos-app, rama `main`. El `README.md` describe la app para quien la use o la evalúe.

Pantallas (`src/app/`):
- **Agenda** (`index.tsx`): cuotas pendientes en Atrasadas, Hoy, Mañana y Próximos 7 días, con el resumen "Hoy tenés que cobrar…". Cada tarjeta tiene "Cómo llegar" (Google Maps) y "Cobrar" (`CuadroCobro`). Consulta en `src/db/agenda.ts`.
- **Clientes** (`clientes.tsx`): alta y lista con `IndicadorRiesgo`. "Editar" abre `CuadroEditarCliente`. Consultas en `src/db/clientes.ts`.
- **Préstamos** (`prestamos/`, Stack):
  - `index.tsx`: alta, eligiendo el cliente con `OpcionGrande` + perfil, con aviso si es Riesgo. Lista con botones "Activos" / "Saldados".
  - `[id].tsx`: detalle con saldo y cuotas. Cada cuota pendiente tiene "Cobrar" y "Editar" (`CuadroEditarCuota`). "Eliminar préstamo" aparece solo sin pagos (`eliminarPrestamoSinPagos`).
  - Consultas en `src/db/prestamos.ts`.
- **Resumen** (`resumen/`, Stack):
  - `index.tsx`: totales (consulta en `src/db/resumen.ts`).
  - `ajustes.tsx`: cargar datos de ejemplo y borrar todos los datos, con doble confirmación (`src/db/ejemplo.ts`).

Componentes (`src/components/`):
- `BotonGrande`, con variantes `principal`, `secundario` y `peligro`.
- `CampoTexto` y `OpcionGrande`.
- `CuadroModal`: pantalla completa para formularios cortos, base de los cuadros de cobro y edición.
- `IndicadorRiesgo`.

Convenciones de la interfaz:
- **Texto:** `ThemedText` tiene 20 px por defecto; ningún texto baja de 18 px.
- **Encabezado:** las pantallas apiladas usan `OpcionesEncabezado` de `src/constants/theme.ts`.
- **Confirmaciones:** cobrar, eliminar un préstamo y borrar datos piden confirmación con `Alert`.
- **Fechas:** en los formularios se escriben como DD/MM/AAAA (`leerFecha`).
- **Montos:** se leen con `leerMonto` (acepta "10.500" o "3333,33") y se muestran con `formatearPesos`.

Pagos y mora: `registrarPago` (`src/db/pagos.ts`) y `calcularMoraPendiente` (`src/utils/mora.ts`).
- **Recargo:** monto de la cuota × mora % diaria × días de atraso, menos la mora ya cobrada de esa cuota.
- **Reparto:** lo cobrado cubre primero el recargo; `pagos.mora` es esa parte y `pagos.monto` lo que se suma a `cuotas.monto_pagado`.
- **Cuota pagada:** cuando `monto_pagado` cubre `monto`. El préstamo pasa a `saldado` sin cuotas pendientes.
- **Saldo:** "Cobrado" y "Falta cobrar" de un préstamo no incluyen mora; el "Total cobrado" del Resumen sí.
- **Total a devolver:** en el detalle es la suma de las cuotas, porque pueden haberse editado.

Recordatorios: `src/utils/recordatorios.ts`.
- **Carga diferida:** `expo-notifications` se carga con `require` dentro de un try/catch. Si falla (Expo Go en Android puede no tener el módulo nativo), quedan desactivados con un `console.warn`, y `_layout.tsx` oculta esos avisos con `LogBox.ignoreLogs`.
- **Permiso:** al abrir la app se pide la primera vez, con una explicación previa.
- **Avisos:** uno a las 9:00 por cada día de los próximos 14 con cuotas que vencen ("Hoy tenés N cobros por $X", sin mora).
- **Reprogramación:** al abrir la app y después de crear un préstamo, registrar un pago, editar una cuota, eliminar un préstamo o cargar/borrar datos.

Notas para trabajar:
- **Tipos de rutas:** si `npx tsc --noEmit` falla por una ruta nueva (`href` o `pathname` no asignable), reiniciar `npx expo start` para regenerar `.expo/types/router.d.ts`. El servidor de desarrollo abierto a veces los regenera mal al agregar archivos.
- **Pruebas sin celular:** las consultas se probaron con scripts de Node (`node --experimental-strip-types`) contra `node:sqlite` en memoria, con un adaptador que imita `runAsync`, `getAllAsync`, `getFirstAsync` y `withTransactionAsync`.
