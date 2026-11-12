import { createResource } from './resource.js';

/** CRUD de professores. A listagem também traz administradores (somente leitura). */
export const ProfessoresCrud = createResource('professores');
