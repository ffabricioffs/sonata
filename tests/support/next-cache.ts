/** Substitui next/cache fora do servidor Next (revalidatePath só faz sentido dentro de uma requisição). */
export const revalidatePaths: string[] = []
export function revalidatePath(path: string) {
  revalidatePaths.push(path)
}
export function revalidateTag() {}
