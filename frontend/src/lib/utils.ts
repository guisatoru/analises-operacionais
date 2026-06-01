import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Função utilitária para combinar classes do Tailwind CSS de forma condicional
 * e resolver conflitos de classes duplicadas.
 * 
 * Por que existe: O Shadcn UI utiliza esta função para combinar classes padrão
 * dos componentes com as classes customizadas passadas via props sem que uma
 * anule a outra de forma imprevisível.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
