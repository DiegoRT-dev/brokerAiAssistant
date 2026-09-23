# Broker AI Assistant

Herramienta para brokers inmobiliarios: pega los datos del cliente y la lista de
propiedades, y obtén un análisis comparativo más un email listo para enviar,
generado con Claude.

## Desarrollo
Este proyecto fue desarrollado con asistencia de inteligencia artificial (Claude).

## Puesta en marcha (modo demo, gratis)

Demo en Vercel: https://broker-ai-assistant.vercel.app/

La app arranca en **modo demo**: no llama a Anthropic, no necesita clave y no
cuesta nada.

El modo demo **no devuelve un texto fijo**: lee los datos que pegas, puntúa cada
propiedad contra los requisitos del cliente y arma las 6 secciones con esos
números, incluido un email personalizado con el nombre del cliente y las
propiedades reales del listado. Donde no encuentra un dato lo dice en lugar de
inventarlo.

```bash
npm run dev
```

Abre <http://localhost:3000>. No hay ningún otro paso.

Si quieres verla funcionando sin escribir nada, pulsa **"Usar datos de ejemplo"**
en el primer campo: rellena los tres con un caso completo y listo para generar.

## La interfaz

- Header fijo con el indicador de modo (**Modo Demo** o **API conectada**), para
  que siempre se sepa de dónde viene el análisis.
- Dos columnas en escritorio: el formulario a la izquierda y el panel de
  resultados pegado a la derecha, con scroll propio.
- Las 6 secciones de la respuesta se distinguen con cabeceras numeradas, y la
  tabla comparativa se lee cómodamente incluso con muchas propiedades.
- El email al cliente sale aparte, en una tarjeta con el asunto destacado y su
  botón de copiar.
- Claro y oscuro según el tema del sistema, sin ajustes.

### En móvil y tablet

Todo se apila, y además:

- El botón **Generar recomendaciones** se queda fijo en la parte inferior de la
  pantalla, así que está a mano mientras se rellenan los campos.
- Al generar, la vista baja sola al panel de resultados.
- La tabla comparativa se desliza en horizontal con un aviso y sombras en los
  bordes, en lugar de apretar sus 9 columnas hasta lo ilegible.
- Los campos usan 16 px para que Safari de iPhone no haga zoom al enfocarlos, y
  los botones tienen el alto suficiente para el dedo.

## Cambiar a la API real

Dos líneas en `.env.local` (ya están escritas y comentadas):

```
NEXT_PUBLIC_DEMO_MODE=false
ANTHROPIC_API_KEY=sk-ant-...
```

Consigue la clave en <https://console.anthropic.com/settings/keys> y reinicia
`npm run dev`. No hay que tocar código: el interruptor vive en `lib/config.ts`.

> `.env.local` está ignorado por git. La clave solo se usa en el servidor: nunca
> llega al navegador.

## Cómo funciona

| Pieza | Archivo |
|---|---|
| Interruptor demo / API real | `lib/config.ts` |
| Lectura del texto pegado (modo demo) | `lib/demo/parse.ts` |
| Puntuación de cada propiedad | `lib/demo/evaluar.ts` |
| Armado de las 6 secciones | `lib/demo/generar.ts` |
| Pantalla principal (3 textareas, botón, resultados) | `app/page.tsx` |
| Header y indicador de modo | `components/AppHeader.tsx` |
| Panel de resultados y sus estados | `components/ResultPanel.tsx` |
| Estilo del markdown (secciones, tabla, citas) | `components/MarkdownResultado.tsx` |
| Email del cliente como tarjeta | `components/EmailCard.tsx` |
| Textos de ejemplo y placeholders | `lib/ejemplos.ts` |
| Tokens de color (claro y oscuro) | `app/globals.css` |
| Llamada a la API de Claude | `app/api/recommendations/route.ts` |
| System prompt aprobado | `lib/system-prompt.ts` |
| Armado del mensaje de usuario | `lib/build-user-message.ts` |
| Aislamiento del email para copiarlo | `lib/extract-email.ts` |

El navegador envía una sola petición `POST /api/recommendations`. El servidor
transmite la respuesta internamente (para no agotar el tiempo de la petición
HTTP) y devuelve el markdown completo en un único JSON, que la página renderiza
con `react-markdown`.

En modo demo ese mismo endpoint construye la respuesta con `lib/demo/generar.ts`
tras una espera simulada, sin tocar el SDK de Anthropic. El análisis es
heurístico: compara campo por campo. La versión con API razona sobre lo que esa
comparación no ve (estado del inmueble, plusvalía, contexto de la zona).

Modelo (en modo real): `claude-opus-5`. Coste aproximado por generación:
**$0.10 – $0.25**. En modo demo el coste es cero.

## Comandos

```bash
npm run dev       # desarrollo
npm run build     # build de producción
npm run lint      # ESLint
npm run test:demo # pruebas del modo demo
npx tsc --noEmit  # comprobación de tipos
```

## Límites de esta versión

- Sin base de datos ni historial: recargar la pestaña pierde el resultado.
- Sin autenticación.
- El botón "Copiar email" busca la sección *"Email para el cliente"* en la
  respuesta. Si Claude cambiara el formato, el botón se deshabilita en lugar de
  copiar texto equivocado.
- En Vercel Hobby las funciones se cortan a los 60 s; una generación puede
  tardar más. `maxDuration = 300` en el route handler cubre el plan Pro.
