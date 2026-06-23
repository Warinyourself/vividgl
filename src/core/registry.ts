import type { ThemeDef } from './types'

const _registry = new Map<string, ThemeDef>()

export function register(name: string, def: ThemeDef): void {
  _registry.set(name, def)
}

export function get(name: string): ThemeDef {
  const def = _registry.get(name)
  if (!def) throw new Error(`[VividGL] Theme "${name}" is not registered. Call VividGL.register() first.`)
  return def
}

export function list(): string[] {
  return [..._registry.keys()]
}
