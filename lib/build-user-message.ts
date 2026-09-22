export type GenerationInput = {
  datosCliente: string;
  propiedades: string;
  documentos?: string;
};

/**
 * Arma el mensaje de usuario a partir de los tres textareas.
 *
 * Cada bloque va bajo un encabezado explícito para que Claude no confunda los
 * datos del cliente con los de las propiedades: el broker pega texto libre, así
 * que las etiquetas son la única frontera fiable entre las tres entradas.
 *
 * El bloque de documentos solo se incluye si trae contenido real; un encabezado
 * vacío invitaría a Claude a inventar información que no existe.
 */
export function buildUserMessage({
  datosCliente,
  propiedades,
  documentos,
}: GenerationInput): string {
  const bloques = [
    `## INFORMACIÓN DEL CLIENTE\n\n${datosCliente.trim()}`,
    `## LISTA DE PROPIEDADES DISPONIBLES\n\n${propiedades.trim()}`,
  ];

  if (documentos?.trim()) {
    bloques.push(
      `## DOCUMENTOS O INFORMACIÓN ADICIONAL\n\n${documentos.trim()}`,
    );
  }

  bloques.push(
    "Genera las recomendaciones siguiendo el formato obligatorio de 6 secciones.",
  );

  return bloques.join("\n\n---\n\n");
}
