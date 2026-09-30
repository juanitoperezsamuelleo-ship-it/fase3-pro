# FASE·3 Pro

App de mantenimiento predictivo para varias empresas: termografía, desbalance de corriente y tensión, tendencias, diagnóstico con IA e informes.

> **Proyecto independiente.** No comparte código, Firebase ni sitio de Netlify con tu app actual. Tiene su propio identificador de Android (`com.fase3.pro`), así que en el celular se instala **al lado** de la app actual, sin reemplazarla.

---

## 1. Probar ya (modo demo, sin Firebase)

```bash
npm install
npm run dev
```

Abre la dirección que aparece (por ejemplo `http://localhost:5173`).

Mientras `src/firebase-config.js` tenga los valores `PEGA_AQUI…`, la app funciona en **modo demo**:
- Trae datos de ejemplo: 8 equipos, uno de cada tipo, con historial.
- Guarda los datos solo en ese navegador.
- Para entrar, toca **Entrar** sin llenar nada.

Para publicar solo el demo, por ejemplo para mostrarlo a clientes:

```bash
npm run build:demo
```

Este comando siempre genera el modo demo, aunque ya hayas configurado Firebase.

## 1b. Usar los datos de la app inicial (solo lectura)

```bash
npm run build:legacy     # genera la carpeta dist-legacy
```

Este build se conecta al Firebase de **FASE·3 Predictivo** (`src/legacy-config.js`):
- Se entra con las mismas cuentas de la app inicial.
- Muestra los equipos, las lecturas, las fotos y los umbrales reales.
- **No escribe nada** en esa base de datos: no crea, no edita y no borra. La app inicial no se modifica.
- Para iniciar sesión desde un dominio nuevo, agrégalo en ese Firebase en **Authentication → Configuración → Dominios autorizados**.

## 2. Crear el Firebase NUEVO (no uses el de la app actual)

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**. Ponle un nombre como `fase3-pro`.
2. Ve a **Compilación → Authentication → Comenzar** y activa **Correo electrónico/contraseña**.
3. Ve a **Compilación → Firestore Database → Crear base de datos**. Elige la ubicación más cercana, por ejemplo `southamerica-east1`, y el **modo de producción**.
4. En **Firestore → Reglas**, borra todo, pega el contenido del archivo `firestore.rules` y toca **Publicar**.
5. Ve a **Configuración del proyecto (⚙️) → Tus apps → Web `</>`** y registra la app. Copia el objeto `firebaseConfig`.
6. Pega ese objeto en `src/firebase-config.js`, reemplazando los `PEGA_AQUI…`.
7. En **Authentication → Configuración → Dominios autorizados**, agrega el dominio de Netlify del paso 3.

### Cómo funciona con varias empresas

- **Crear empresa:** quien se registra así queda como **administrador** y recibe un **código de empresa** de 6 letras, que aparece en Más → Usuarios.
- **Unirme con código:** los técnicos escriben ese código al registrarse y entran como **técnicos**.
- Cada empresa solo ve sus propios datos (`orgs/{empresa}/…`). Así lo aplican las reglas de Firestore, no solo la app.
- El administrador gestiona umbrales, plantas y CCM, roles, y puede eliminar equipos y lecturas.

## 3. Publicar en Netlify (SITIO NUEVO)

```bash
npm run build
```

1. En [app.netlify.com](https://app.netlify.com), toca **Add new site → Deploy manually** y arrastra la carpeta `dist`.
2. **Importante:** crea un sitio nuevo. No arrastres la carpeta sobre el sitio de tu app actual.
3. Si quieres, cambia el nombre en Site configuration → Change site name (por ejemplo `fase3-pro`).

La app es instalable (PWA). En el celular, abre el enlace y elige **Agregar a pantalla de inicio**.

## 4. APK de Android (Capacitor)

```bash
npm run build
npx cap add android      # solo la primera vez
npx cap sync android
npx cap open android     # abre Android Studio → Build → Build APK
```

## 5. IA

| Función | Sin costo (local) | Con Gemini (opcional) |
|---|---|---|
| Diagnóstico por reglas NETA / NEMA MG1, causas y acciones | ✅ | ✅ más detallado |
| Proyección de tendencias (meses hasta deficiencia mayor) | ✅ | ✅ |
| Revisar lectura antes de guardar (errores de digitación, cambios bruscos) | ✅ | ✅ |
| Resumen del día | ✅ | ✅ |
| Asistente por voz (preguntas frecuentes) | ✅ | ✅ preguntas abiertas |
| Analizar fotos (termográficas o visuales) | — | ✅ |
| Crear equipo desde foto de la placa | — | ✅ |

Para activar Gemini:
1. Crea una clave gratis en [aistudio.google.com](https://aistudio.google.com) → **Get API key**.
2. En la app, ve a **Más → IA y voz** y pégala.

La clave queda solo en ese dispositivo. Para vender la app al público, lo recomendable es mover la clave a una función de servidor (por ejemplo Netlify Functions), para que no quede en el teléfono de cada cliente.

La voz usa el reconocimiento y la síntesis del navegador, que son gratis. El micrófono funciona en Chrome y Edge, en Android y en computador; en iPhone depende de la versión de Safari.

## 6. Estructura

```
src/
  firebase-config.js   ← tu Firebase nuevo
  lib/calc.js          ← desbalance NEMA, ΔT NETA, decimales con coma o punto, fechas en hora local
  lib/templates.js     ← puntos de medida por tipo: motor, tablero/CCM, transformador, generador, capacitores, rectificador
  lib/store.js         ← datos (Firebase multi-empresa o demo)
  lib/analysis.js      ← estado, tendencia y proyección por equipo
  lib/ai.js            ← IA local + Gemini + voz
  lib/reports.js       ← informe PDF y Excel
  screens/             ← Inicio, Lectura, Equipos, Histórico, Más, Asistente
firestore.rules        ← seguridad multi-empresa
```

## 7. Pendiente

- Importar el CSV del Fluke 435 (THD, armónicos, flicker, potencia), cuando tengamos un archivo de ejemplo.
- Tema "Clásica", con el aspecto de la app original.
- Aperturas adicionales.
- Cobro y planes por empresa. El campo `plan` ya existe en cada empresa.
