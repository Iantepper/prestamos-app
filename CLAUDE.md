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

## Plan por fases
- Fase 0: entorno, proyecto Expo, SQLite. **Completa.**
- Fase 1: clientes y préstamos. Pasos: (1) cálculo de cuotas ✔, (2) pantalla de alta de cliente ✔, (3) guardar clientes en la base ✔, (4) listado de clientes ✔, (5) pantalla de alta de préstamo ✔, (6) generar cuotas al crear préstamo ✔, (7) listado de préstamos activos ✔, (8) detalle del préstamo con sus cuotas ✔. **Completa.**
- Fase 2: registrar pagos y calcular mora (% diario sobre cuota vencida), saldo pendiente. **Completa.**
- Fase 3: agenda de cobros por día; tocar un cobro abre Maps (`Linking.openURL` con `https://www.google.com/maps/search/?api=1&query=<dirección codificada>`); marcar como cobrado. **Completa.**
- Fase 4: notificaciones locales (`expo-notifications`) y resumen (total prestado, por cobrar, atrasos).
- Fase 5 (opcional): semáforo de riesgo por cliente según atrasos.
- Fase 6: pulido de usabilidad y demo.

## Estado actual
Pestañas: Agenda (`src/app/index.tsx`, cuotas pendientes agrupadas en Atrasadas, Hoy, Mañana y Próximos 7 días, con resumen de lo que hay que cobrar hoy; cada tarjeta tiene "Cómo llegar", que abre Google Maps, y "Cobrar", que abre `CuadroCobro`; consulta en `src/db/agenda.ts`), Clientes (`src/app/clientes.tsx`, formulario de alta y, debajo, listado de clientes; usa `crearCliente` y `listarClientes` de `src/db/clientes.ts`) y Préstamos (`src/app/prestamos/`, un Stack dentro de la pestaña: `index.tsx` con el formulario de alta y la lista de préstamos activos, `[id].tsx` con el detalle y sus cuotas; consultas en `src/db/prestamos.ts`). Formato de montos y fechas en `src/utils/formato.ts` (`formatearPesos`, `formatearFecha`); en los formularios las fechas se escriben como DD/MM/AAAA. Tarjetas para elegir opciones: `OpcionGrande` en `src/components/`. Repo en GitHub: Iantepper/prestamos-app, rama `main`.
Si `npx tsc --noEmit` falla por una ruta nueva (`href` o `pathname` no asignable), reiniciar `npx expo start` para regenerar `.expo/types/router.d.ts`.
Pagos (Fase 2): en el detalle del préstamo, tocar una cuota pendiente abre `CuadroCobro` (`src/components/cuadro-cobro.tsx`) y guarda con `registrarPago` de `src/db/pagos.ts`. Mora en `src/utils/mora.ts` (`calcularMora`, y `calcularMoraPendiente` que descuenta la mora ya cobrada): recargo simple = monto de la cuota × mora% diaria × días de atraso, menos lo ya cobrado de mora en esa cuota. Lo cobrado cubre primero el recargo y el resto va a la cuota: `pagos.mora` es la parte de recargo y `pagos.monto` la parte que se suma a `cuotas.monto_pagado`. La cuota queda pagada cuando `monto_pagado` cubre `monto`, y el préstamo pasa a `saldado` cuando no quedan cuotas pendientes. El saldo ("Cobrado" y "Falta cobrar") no incluye recargos por mora.
**Próximo paso: Fase 4 (notificaciones locales y resumen).** Al terminar cada paso, actualizar esta sección.
