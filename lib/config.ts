/**
 * Interruptor entre el modo DEMO y la API real de Claude.
 *
 * - `true`  (por defecto): no se hace ninguna llamada a Anthropic ni se
 *   necesita ANTHROPIC_API_KEY. La respuesta la construye `lib/demo/generar.ts`
 *   a partir del texto que pegó el broker.
 * - `false`: se usa la API real.
 *
 * PARA ACTIVAR LA API REAL, dos líneas en `.env.local`:
 *
 *     NEXT_PUBLIC_DEMO_MODE=false
 *     ANTHROPIC_API_KEY=sk-ant-...
 *
 * y reiniciar `npm run dev`. No hay que tocar ningún otro archivo.
 *
 * Se usa el prefijo NEXT_PUBLIC_ porque la bandera también se lee en el
 * navegador, para mostrar el aviso de "Modo Demo" antes de generar nada.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/**
 * Espera simulada antes de devolver la respuesta de ejemplo. Sin ella, el
 * resultado aparecería instantáneamente y no se vería el estado de carga que
 * sí tendrá la versión real.
 */
export const DEMO_DELAY_MS = 1800;
