/**
 * Textos de ejemplo de la pantalla principal.
 *
 * Sirven para dos cosas a la vez: son los `placeholder` de los tres campos y
 * son lo que rellena el botón "Usar datos de ejemplo". Por eso están completos
 * —nada de `...` al final— y describen un caso que ejercita el análisis: una
 * propiedad fuera de la zona preferida, otra que choca con la restricción del
 * cliente y una ficha a la que le faltan datos.
 */

export const EJEMPLO_CLIENTE = `Nombre: Ana
Apellidos: Ramírez Solís
Email: ana.ramirez@ejemplo.com
Teléfono: 55 1234 5678
Ubicación actual: Ciudad de México
Ubicación destino: Querétaro
Trabajo: Gerente de operaciones
Fecha estimada de mudanza: marzo 2027

Tipo de propiedad deseada: Casa
Ubicación preferida: Juriquilla o Zibatá
Presupuesto: 3,500,000 - 4,200,000 MXN
Habitaciones: 3
Baños: 2
Área: 140 - 200 m2
Características deseadas: jardín, 2 cajones de estacionamiento
Restricciones: no acepta planta alta sin elevador

Pago inicial disponible: 900,000 MXN
Cuota mensual máxima: 28,000 MXN
Preaprobación de crédito: Sí, por 3,300,000 MXN`;

export const EJEMPLO_PROPIEDADES = `1) Casa en venta - Disponible
Estado: Querétaro | Municipio: Querétaro | CP: 76230
Colonia: Juriquilla
Calle: Paseo de la Loma 145
Precio: 3,900,000 | Pago inicial: 780,000 | Pago mensual: 26,500
Cuartos: 3 | Baños: 2.5 | Área: 165 m2
Características: jardín, 2 cajones, cocina integral

2) Casa en venta - Disponible
Estado: Querétaro | Municipio: El Marqués | CP: 76269
Colonia: Zibatá
Calle: Circuito Alameda 88
Precio: 4,150,000 | Pago inicial: 830,000 | Pago mensual: 28,900
Cuartos: 3 | Baños: 3 | Área: 180 m2
Características: jardín amplio, 2 cajones, cuarto de servicio

3) Departamento en venta - Disponible
Estado: Querétaro | Municipio: Querétaro | CP: 76127
Colonia: Milenio III
Calle: Av. Antea 300
Precio: 3,200,000 | Pago inicial: 640,000 | Pago mensual: 22,400
Cuartos: 3 | Baños: 2 | Área: 128 m2
Características: planta alta, edificio sin elevador, 1 cajón

4) Casa en venta - Disponible
Estado: Querétaro | Municipio: Corregidora | CP: 76900
Colonia: El Pueblito
Precio: 3,450,000
Cuartos: 3 | Baños: 2
Características: jardín, 2 cajones`;

export const EJEMPLO_DOCUMENTOS = `Notas de la llamada del 12 de marzo:
La carta de preaprobación del banco es por 3,300,000 MXN y vence en 90 días.
Ana prefiere no pasar de 28,000 al mes para no apretar el presupuesto familiar.
No quiere departamento: viene de uno y busca jardín para el perro.
Necesita estar a menos de 30 minutos del parque industrial donde trabajará.`;

/** Marcador del campo de Documentos: ahí no se muestra el ejemplo completo. */
export const PLACEHOLDER_DOCUMENTOS = `Pega aquí texto de documentos: notas de la llamada, carta de preaprobación, reglamento del condominio, etc.`;
