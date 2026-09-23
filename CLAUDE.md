# Broker AI Assistant

Aplicación web para brokers inmobiliarios: pegan los datos de su cliente y una lista de propiedades, y obtienen un análisis comparativo más un email listo para enviar.

---

## ⚠️ Estado actual: MODO DEMO (sin API)

**La aplicación funciona hoy en modo demo, 100% local.**

- **No se llama a la API de Anthropic.** Ni una sola petición sale de la máquina.
- **No se necesita ninguna API key.** `ANTHROPIC_API_KEY` no hace falta; la app arranca y funciona sin ella.
- **Las recomendaciones se generan localmente**, leyendo el texto que el usuario pega en los textareas y comparándolo campo por campo.
- **El coste es cero.**
- La interfaz muestra un aviso visible de "Modo Demo" para que nadie confunda el resultado con un análisis de Claude.

El interruptor vive en un solo archivo: **`lib/config.ts`**.

```ts
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
```

Más adelante conectaremos la API real de Claude. Todo el camino real ya está escrito y probado en `app/api/recommendations/route.ts`; solo está desactivado.

---

## Objetivo de la aplicación

Una herramienta donde el broker pueda:
- Ingresar datos del cliente
- Ingresar lista de propiedades
- (Opcional) pegar texto de documentos
- Generar recomendaciones
- Ver el resultado estructurado (recomendaciones + análisis + tabla + email)
- Copiar fácilmente el email para enviarlo al cliente

---

## Stack y estructura actual

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · SDK de Anthropic (instalado, en espera).

```
app/
  page.tsx                        Pantalla principal (Client Component)
  layout.tsx, globals.css
  api/recommendations/route.ts    POST: valida → demo o API real
components/
  AppHeader.tsx                   Barra superior + indicador de modo
  TextAreaField.tsx               Los 3 campos de entrada
  ResultPanel.tsx                 Panel de resultados y sus estados
  MarkdownResultado.tsx           Estilo del markdown (secciones, tabla, citas)
  EmailCard.tsx                   La sección 6 como tarjeta de correo
  CopyEmailButton.tsx             Copia solo el email
  Iconos.tsx                      Iconos SVG inline
lib/
  config.ts                       ← INTERRUPTOR demo / API real
  system-prompt.ts                System prompt (para la API real)
  build-user-message.ts           Arma el mensaje de usuario (API real)
  anthropic.ts                    Cliente del SDK (construcción perezosa)
  extract-email.ts                Aísla la sección 6 (splitEmail / extractEmail)
  ejemplos.ts                     Textos de ejemplo: placeholders y botón de relleno
  demo/
    parse.ts                      Lee el texto libre que pega el broker
    zonas.ts                      Detecta si está en una zona preferida
    documentos.ts                 Lectura básica del textarea de Documentos
    evaluar.ts                    Puntúa cada propiedad (1 a 9.7)
    generar.ts                    Arma las 6 secciones
    formato.ts                    Moneda, área, frases
test/
  demo.test.mjs                   Pruebas del modo demo (node --test)
  alias-loader.mjs                Resuelve el alias @/ fuera de Next
```

Comandos: `npm run dev` · `npm run build` · `npm run lint` · `npm run test:demo` · `npx tsc --noEmit`

---

## La interfaz

Producto sobrio y profesional, pensado para que un broker lo tenga abierto mientras trabaja.

- **Header fijo** (`components/AppHeader.tsx`) con la marca, un subtítulo de una línea y el chip de estado: **"Modo Demo"** en ámbar o **"API conectada"** en verde, según `DEMO_MODE`. Debajo, una franja explica qué significa el modo demo, para que nadie confunda el resultado con un análisis de Claude.
- **Dos columnas** en escritorio: el formulario a la izquierda y el panel de resultados **pegado** a la derecha, con scroll propio y alto limitado a la ventana, para no perder de vista el análisis mientras se corrigen los datos. En móvil se apila.
- **Los 3 campos** llevan un número que se convierte en ✓ en cuanto tienen contenido: de un vistazo se ve qué falta antes de generar.
- **"Usar datos de ejemplo"** rellena los tres campos desde `lib/ejemplos.ts`, que también sirve los placeholders. El ejemplo trae a propósito una propiedad fuera de la zona preferida, otra que choca con la restricción del cliente y otra con la ficha incompleta, para que se vea el análisis trabajando.
- **Los resultados** se estilizan en `components/MarkdownResultado.tsx`: cada `##` se pinta como cabecera con su número, así que las 6 secciones se distinguen al scrollear; la tabla comparativa tiene encabezado sombreado, cifras alineadas y scroll propio; las citas se muestran como avisos. Hay estado vacío con los pasos a seguir, esqueleto de carga con contador y botón de cancelar, y estado de error.
- **La sección 6 va aparte**, en una tarjeta de correo con el asunto destacado y su propio botón de copiar (`components/EmailCard.tsx`, alimentada por `splitEmail`). Es lo único de toda la respuesta que llega al cliente.
- **Color y movimiento**: paleta verde esmeralda sobre grises neutros, definida como tokens en `app/globals.css` con su valor claro y su valor oscuro; transiciones suaves que se anulan con `prefers-reduced-motion`.
- **Responsive de verdad, no solo apilado.** En móvil y tablet: el botón de generar vive en una **barra pegada al borde inferior** (el formulario son tres campos largos y el botón quedaba enterrado), al generar la vista **baja sola al panel de resultados**, los textareas usan **16 px** —por debajo de eso Safari de iOS hace zoom al enfocar— y los botones tienen 44 px de alto. El panel pegado con scroll propio es solo de `lg` hacia arriba. La barra respeta el área segura del iPhone con `env(safe-area-inset-bottom)`.
- **La tabla comparativa se desliza.** Son 9 columnas: en lugar de apretarlas, tiene un ancho mínimo legible y scroll horizontal, con la clase `.scroll-sombra` de `app/globals.css` —sombras laterales por CSS puro que solo aparecen cuando queda contenido por ver— y un aviso debajo en pantallas pequeñas.

---

## Cómo funciona el Modo Demo

El navegador hace `POST /api/recommendations` igual que en la versión real. El servidor valida la entrada, y en lugar de llamar a Claude construye la respuesta con `lib/demo/generar.ts`:

1. **`parse.ts`** lee los tres textareas. Entiende `Etiqueta: valor` sin importar acentos ni mayúsculas, **admite varios campos por línea separados por `|`** (`Estado: X | Municipio: Y | CP: Z`, el formato que sugiere el placeholder de la app) y normaliza cantidades escritas de cualquier forma (`3,500,000`, `3.5 millones`, `$4.2M`, `140 - 200 m2`). Separa la lista de propiedades en bloques por líneas en blanco, por numeración (`1)`, `2)`) o por repeticiones de `Precio:`.
2. **`zonas.ts`** decide si la propiedad está en una zona preferida. Normaliza artículos y prefijos (`El Refugio` = `Fracc. Refugio Country`) y distingue **dónde** aparece el nombre: en un campo de dirección (confianza alta), en la descripción (media) o solo como cercanía (`a 10 minutos de Juriquilla`), que **no** cuenta como estar en la zona.
3. **`documentos.ts`** saca del textarea de Documentos los temas, las cantidades y las frases donde el cliente expresa una preferencia o un rechazo.
4. **`evaluar.ts`** puntúa cada propiedad contra diez criterios: precio, zona, pago mensual, habitaciones, restricciones, baños, superficie, pago inicial, características deseadas y menciones en los documentos. Descarta lo que no es del tipo pedido o excede el presupuesto en más del 25%.
5. **`generar.ts`** arma las 6 secciones del formato obligatorio con esos números, incluido un email personalizado.

### Cómo se calcula el score

Media ponderada de los criterios **con regresión a la media**: un criterio ficticio de peso 5 y valor 0.62 arrastra el resultado hacia el centro cuando la ficha trae pocos datos. Por eso una propiedad que cumple todo saca ~9.1 y no 10, y por eso cada score viene con una **confianza** (alta/media/baja) derivada de cuántos criterios se pudieron evaluar.

Cuatro topes explícitos:

| Tope | Cuándo |
|---|---|
| **9.7** | global — un 10 redondo fingiría una precisión que esta heurística no tiene |
| **8.0** | fuera de la zona preferida |
| **7.0** | el pago mensual excede el máximo declarado |
| **7.0** | la ficha parece contradecir una restricción del cliente |

Pasarse de la mensualidad pesa **más** que estar fuera de zona: una casa en la colonia equivocada sigue siendo viable y el cliente decide si le compensa; una cuya mensualidad supera lo que dijo que podía pagar, no lo es. El **enganche** se penaliza fuerte pero sin tope, porque es más negociable.

### Restricciones y el email

Si el texto de la propiedad choca con una restricción (`no acepta planta alta` frente a una ficha que dice `planta alta`), se marca como **posible** conflicto —el cruce es por texto y puede equivocarse— y **se excluye del email al cliente**, aunque siga en el análisis para que el broker decida. Ofrecerle a alguien justo lo que dijo que no quería es peor que omitirla.

### Regla de oro del modo demo: no inventar

Donde no hay dato, se dice. Si no se encuentra el presupuesto, el precio ni premia ni penaliza; si no hay nada comparable, el score sale como "sin datos" en lugar de un número inventado; y la sección 1 termina enumerando los campos que no se pudieron leer. **Un score falso es peor que ninguno**, porque el broker decidiría sobre él.

### Limitaciones conocidas del modo demo

- Los Documentos se citan en la sección 1 y se recuerdan en la 5, pero **nunca en el email**: son notas internas del broker, no información para el cliente.
- **Los Documentos se leen por palabras clave, no se comprenden.** Se detectan temas, cantidades y frases de intención, y se cruzan con las propiedades; pero nada de eso es entender el documento. Un contrato con una cláusula relevante redactada sin esas palabras pasa desapercibido. Interpretarlo de verdad es lo que aportará el modelo real.
- El análisis es **heurístico**: compara campo por campo. No valora el estado del inmueble, la plusvalía de la zona, el contexto del mercado ni ningún matiz que requiera criterio.
- La detección de conflictos con restricciones **cruza palabras**, así que puede dar falsos positivos. Por eso avisa en lugar de descartar.
- Cada respuesta abre con una nota que explica esto, para que quede claro en el propio resultado.

---

## Cómo conectar la API real (cuando toque)

Dos líneas en `.env.local`, ya escritas y comentadas ahí:

```
NEXT_PUBLIC_DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
```

Reiniciar `npm run dev`. **No hay que tocar código.** El camino real ya está implementado en `app/api/recommendations/route.ts`:

- Modelo `claude-opus-5`, `max_tokens: 16000`.
- Streaming interno (`.stream()` + `.finalMessage()`) para que no expire la petición HTTP; el navegador sigue recibiendo un único JSON.
- El system prompt va marcado como cacheable.
- Manejo de errores tipado: clave ausente o inválida, rate limit, fallo de conexión, respuesta rechazada.
- La clave nunca llega al navegador (`lib/anthropic.ts` importa `server-only`).

Coste estimado en modo real: **$0.10 – $0.25 por generación**.

---

## System Prompt del asistente (ya probado y aprobado)

> **Este prompt se mantiene intacto.** No se usa en modo demo, pero es lo que se enviará a Claude en cuanto se active la API. Vive en `lib/system-prompt.ts` como copia literal de lo que sigue; si se edita uno, hay que editar el otro.

Eres un Broker AI Assistant experto en bienes raíces. Tu trabajo es ayudar a brokers inmobiliarios a recomendar las mejores propiedades a sus clientes de forma clara, profesional y útil.

### DATOS QUE RECIBIRÁS:
1. Información del Cliente (con estos campos):
- Nombre, Apellidos, Email, Fecha de nacimiento, Teléfono
- Ubicación actual, Ubicación destino, Trabajo, Fecha estimada de mudanza
- Tipo de propiedad deseada, Ubicación preferida, Presupuesto min-max, Número de habitaciones, Número de baños, Área min-max, Características deseadas, Restricciones
- Presupuesto estimado, Pago inicial disponible, Cuota mensual máxima, Estado de preaprobación de crédito, Monto de preaprobación, Solvencia financiera

2. Lista de Propiedades disponibles (con estos campos):
- Tipo de propiedad, Tipo de operación, Estatus
- Estado, Municipio, Código postal, Calle, Número
- Precio, Depósito, Negociable, Pago inicial, Pago mensual
- Cuartos, Baños, Características

3. Documentos o información adicional (si se proporcionan)

### REGLAS DE RECOMENDACIÓN:
- Respeta lo más posible el presupuesto, ubicación preferida, número de habitaciones, baños y requisitos del cliente.
- Presta especial atención a la **zona o colonias preferidas** del cliente. Si una propiedad está fuera de esa zona, menciónalo claramente y valora si realmente vale la pena.
- Puedes recomendar propiedades ligeramente fuera de presupuesto o de algunos requisitos **solo si realmente valen la pena** (mejor ubicación, mucho mejor estado, excelente oportunidad, etc.).
- No seas exagerado ni fuerces recomendaciones que no tengan sentido.
- Prioriza siempre el mejor equilibrio entre precio, ubicación, características y viabilidad financiera del cliente.
- Si una propiedad está muy lejos de los requisitos, no la recomiendes.

### FORMATO DE RESPUESTA OBLIGATORIO (siempre usa este orden):

1. **Resumen de requisitos del cliente**
   (Haz un resumen claro y breve de lo que busca y su situación financiera)

2. **Top propiedades recomendadas**
   (Lista de 3 a 5 propiedades ordenadas de mejor a peor, con un score del 1 al 10 y una frase corta del porqué)

3. **Análisis detallado de cada propiedad recomendada**
   (Para cada una explica: pros, contras, qué tan bien cumple los requisitos, y si vale la pena salirse un poco del presupuesto o de la zona preferida)

4. **Tabla comparativa**
   (Crea una tabla clara comparando las propiedades recomendadas en: Precio, Ubicación, Habitaciones, Baños, Área, Pago mensual estimado, Score, y principales ventajas)

5. **Explicación final y recomendación**
   (Di cuál es tu recomendación principal y por qué, de forma clara y directa)

6. **Email para el cliente**
   (Escribe un email listo para copiar y enviar.
   Tono: punto intermedio (profesional pero cercano y amable, no demasiado formal ni coloquial).
   Usa lenguaje neutro de género (por ejemplo: “Quedo pendiente de tu respuesta” o “Quedo atento/a”).
   El email debe incluir:
   - Saludo personalizado
   - Breve introducción
   - Resumen de las mejores opciones
   - Mención de la recomendación principal
   - Llamado a la acción (agendar visita o llamada)
   - Despedida profesional)

### INSTRUCCIONES ADICIONALES:
- Sé objetivo y transparente.
- Si no hay suficientes propiedades buenas, dilo claramente.
- Usa un lenguaje claro y fácil de entender.
- Cuando generes la tabla, asegúrate de que sea fácil de leer.
- Responde siempre en español.

---

## Convenciones del proyecto

- **Todo en español**: interfaz, comentarios del código, nombres de variables del dominio y mensajes de error.
- **El formato de 6 secciones es un contrato.** `lib/extract-email.ts` depende del título "Email para el cliente" para aislar el email; si no lo encuentra, el botón de copiar se deshabilita en lugar de copiar texto equivocado y la tarjeta de correo no se muestra: el análisis se enseña entero, sin perder nada.
- **Los errores se muestran, no se tragan.** Al cliente le llega un mensaje accionable; el detalle completo queda en el log del servidor, nunca trazas ni fragmentos de la clave.
- **Diseño sobrio y responsive**, pensado para uso profesional. Funciona en claro y oscuro.
- **El color sale de los tokens de `app/globals.css`** (`superficie`, `linea`, `marca`, `texto-suave`, `aviso`…), no de la paleta de Tailwind. Cada token trae su valor claro y su valor
  oscuro, así que los componentes se escriben una sola vez: `bg-superficie` en lugar de un `dark:` por clase.
  El tema se ajusta cambiando esas variables.
- Antes de dar por terminado un cambio: `npm run test:demo`, `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- **La lógica del modo demo tiene pruebas** en `test/demo.test.mjs` (runner nativo de Node, sin dependencias). Si tocas zonas, puntuación o restricciones, añade el caso ahí.

---

## Estado de la primera versión

Terminado y verificado:

- [x] Pantalla principal con las 3 secciones de entrada y el botón "Generar recomendaciones"
- [x] Zona de resultados con markdown, tabla comparativa y estados de carga/error
- [x] Botón para copiar solo el email
- [x] Interfaz tipo SaaS: header fijo con indicador de modo y layout de dos columnas con el panel de resultados pegado
- [x] Tokens de color en `app/globals.css`: claro y oscuro se resuelven en un solo sitio
- [x] Las 6 secciones se distinguen al scrollear; la sección 6 va en su propia tarjeta de correo
- [x] Esqueleto de carga con contador, estado vacío con los pasos y estado de error
- [x] Botón "Usar datos de ejemplo" que rellena los 3 campos de un clic
- [x] Diseño responsive trabajado en las tres tallas: barra de acción fija en móvil, scroll automático a resultados, campos a 16 px, áreas táctiles de 44 px y tabla deslizable
- [x] Cancelación de la generación en curso
- [x] Modo demo que analiza de verdad el texto pegado
- [x] Detección de zonas con confianza, que distingue estar en una zona de estar cerca
- [x] Puntuación calibrada con regresión a la media y topes explícitos
- [x] Restricciones del cliente cruzadas con cada ficha
- [x] Lectura básica del campo de Documentos
- [x] Pruebas automatizadas del modo demo (`npm run test:demo`)
- [x] Camino de la API real implementado y en espera

Pendiente:

- [ ] Conectar la API real de Claude
- [ ] Comprensión real de los Documentos (llega con el modelo real)
- [ ] Decidir si se guarda historial de generaciones (hoy recargar la pestaña pierde el resultado)
