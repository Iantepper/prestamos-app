# Cuaderno de Cobros

App móvil para un prestamista informal: funciona como una agenda de cobros. Registra clientes y préstamos, calcula las cuotas, lleva la cuenta de lo cobrado y de la mora, avisa los días de cobro y abre el mapa con la dirección del cliente.

Está pensada para una persona mayor sin conocimientos técnicos: letra grande, botones altos, pocas opciones por pantalla y confirmación antes de las acciones que no se pueden deshacer.

Trabajo práctico de Seminario (UTN). Todo funciona en el celular, sin internet, sin cuentas y sin servidor: los datos se guardan en una base SQLite local.

## Funciones

- **Agenda** (pantalla de inicio): cuotas atrasadas (en rojo, con días de atraso), de hoy, de mañana y de los próximos 7 días, con un resumen de lo que hay que cobrar hoy. Desde cada cobro se puede:
  - abrir Google Maps con la dirección del cliente ("Cómo llegar");
  - registrar el cobro ("Cobrar").
- **Clientes**:
  - alta con nombre, teléfono, dirección y notas;
  - lista con el perfil de riesgo de cada uno (Cumplidor, Con atrasos, Riesgo, Nuevo);
  - edición de los datos;
  - eliminación: no se puede si tiene préstamos activos; si solo tiene saldados, se borra también su historial (con doble confirmación).
- **Préstamos**:
  - alta eligiendo el cliente, con vista previa de las cuotas ("Vas a devolver $X en N cuotas de $Y") y aviso si el cliente tiene perfil Riesgo;
  - listas de préstamos activos y saldados.
- **Detalle del préstamo**:
  - datos, saldo cobrado y pendiente, y lista de cuotas;
  - cobrar una cuota (también pagos parciales), con el recargo por mora calculado;
  - editar la fecha y el monto de una cuota pendiente;
  - eliminar el préstamo si todavía no tiene pagos.
- **Resumen**: total prestado, total cobrado, lo que falta cobrar, cuotas atrasadas (con mora) y cantidad de préstamos activos y saldados.
- **Ajustes** (desde Resumen):
  - cargar datos de ejemplo para una demo;
  - borrar todos los datos, con doble confirmación.
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

## Estructura de carpetas

```
src/
  app/                  Pantallas (Expo Router: cada archivo es una ruta)
    _layout.tsx         Base de datos, pestañas y recordatorios al abrir la app
    index.tsx           Agenda de cobros
    clientes.tsx        Alta, lista y edición de clientes
    prestamos/          Pestaña Préstamos (Stack)
      index.tsx         Alta de préstamo y lista de activos / saldados
      [id].tsx          Detalle del préstamo con sus cuotas
    resumen/            Pestaña Resumen (Stack)
      index.tsx         Totales
      ajustes.tsx       Datos de ejemplo y borrado de datos
  components/           Componentes reutilizables (BotonGrande, CampoTexto, OpcionGrande,
                        CuadroCobro, CuadroEditarCuota, CuadroEditarCliente, IndicadorRiesgo...)
  db/                   Base de datos SQLite: tablas (database.ts) y consultas por tema
  utils/                Lógica sin pantalla: cuotas, mora, riesgo, formato, recordatorios
  constants/theme.ts    Colores, espaciados y estilo del encabezado
```

## Decisiones de negocio

### Cálculo de cuotas (`src/utils/cuotas.ts`)
- **Interés:** simple sobre el total: total a devolver = monto + monto × interés %.
- **Monto de las cuotas:** todas iguales (total / cantidad de cuotas); la última absorbe la diferencia por redondeo.
- **Frecuencia:** semanal (7 días), quincenal (14 días) o mensual. La primera cuota vence un período después de la fecha de inicio.
- **Edición:** la fecha y el monto de una cuota pendiente se pueden editar después, para ingresos irregulares.

### Mora (`src/utils/mora.ts`)
- **Recargo simple:** monto de la cuota × mora % diaria × días de atraso. Es 0 si la cuota no está vencida. El % se define por préstamo, y por defecto es 0.
- **Mora ya cobrada:** si en la cuota ya se cobró mora, se descuenta, para no cobrar dos veces los mismos días.
- **Reparto de cada pago:** lo cobrado cubre primero el recargo y el resto va a la cuota. La cuota queda pagada cuando lo pagado cubre su monto.
- **Préstamo saldado:** el préstamo pasa a "saldado" cuando no le quedan cuotas pendientes.
- **Saldo:** "Cobrado" y "Falta cobrar" de cada préstamo no incluyen los recargos por mora. El "Total cobrado" del Resumen sí los incluye, y lo aclara.

### Perfil de riesgo del cliente (`src/utils/riesgo.ts`)
Pago tardío = un pago registrado después del vencimiento de su cuota. Se evalúa en este orden:
1. **Riesgo** (rojo): 3 o más pagos tardíos en los últimos 90 días, o una cuota vencida hace 15 días o más.
2. **Con atrasos** (amarillo): 1 o 2 pagos tardíos en los últimos 90 días, o una cuota vencida hace menos de 15 días.
3. **Nuevo** (gris): todavía no tiene pagos registrados.
4. **Cumplidor** (verde): tiene pagos, ninguno tardío en los últimos 90 días, y nada vencido.

El indicador siempre muestra el texto además del color.

## Limitaciones conocidas

- **Recordatorios en Expo Go:** las notificaciones locales dependen de `expo-notifications`. En algunas versiones de Expo Go en Android falta un módulo nativo y no se pueden usar; en ese caso los recordatorios se desactivan solos y el resto de la app funciona igual. Para tenerlos siempre hace falta una *development build* (`npx eas-cli@latest build --profile development`).
- **Demora de los avisos en Android:** sin el permiso de alarmas exactas, el aviso de las 9:00 puede llegar unos minutos tarde.
- **Datos solo en el celular:** si se desinstala Expo Go o la app, se pierden. No hay copia de seguridad ni sincronización.
- **Pagos sin borrado:** no se puede anular un pago registrado. Un préstamo se puede eliminar solo si no tiene pagos, y un cliente solo si no tiene préstamos activos.
- **Fechas a mano:** en los formularios se escriben como día/mes/año (no hay calendario para elegirlas).
