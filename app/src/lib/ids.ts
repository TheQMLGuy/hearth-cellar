import { customAlphabet } from 'nanoid'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const generator = customAlphabet(alphabet, 10)

export function newId(prefix: string = ''): string {
  return prefix + generator()
}
