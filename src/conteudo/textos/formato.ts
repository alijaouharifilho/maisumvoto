// Datas em pt-BR para os textos. Números, plurais e listas vêm de nucleo/frases.ts (fonte única).
// Sem dependência do fuso da máquina: datas são lidas no fuso fixo da configuração (ex.: "-03:00").

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/
const FUSO = /^([+-])(\d{2}):(\d{2})$/

function minutosDoFuso(fuso: string): number {
  const m = FUSO.exec(fuso)
  if (!m) throw new Error(`fuso inválido: ${fuso} (esperado ±HH:MM)`)
  const minutos = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -minutos : minutos
}

function lerInstante(iso: string, fuso: string): Date {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`data inválida: ${iso}`)
  // Desloca para o fuso pedido e lê com getUTC*: o resultado não depende do fuso da máquina.
  return new Date(ms + minutosDoFuso(fuso) * 60_000)
}

function diaMes(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function hora(d: Date): string {
  const h = d.getUTCHours()
  const min = d.getUTCMinutes()
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, '0')}`
}

/** "2026-10-25" → "domingo, 25/10" (data de calendário, sem fuso). */
export function dia(isoData: string): string {
  if (!ISO_DATA.test(isoData)) throw new Error(`data de calendário inválida: ${isoData}`)
  const d = lerInstante(`${isoData}T00:00:00Z`, '+00:00')
  return `${DIAS[d.getUTCDay()]}, ${diaMes(d)}`
}

/** "2026-10-24T22:00:00-03:00" no fuso "-03:00" → "sábado, 24/10, às 22h". */
export function prazo(iso: string, fuso: string): string {
  const d = lerInstante(iso, fuso)
  const artigo = d.getUTCHours() <= 1 ? 'à' : 'às'
  return `${DIAS[d.getUTCDay()]}, ${diaMes(d)}, ${artigo} ${hora(d)}`
}

/** "2026-10-06T12:00:00Z" no fuso "-03:00" → "06/10/2026, 9h". */
export function dataHora(iso: string, fuso: string): string {
  const d = lerInstante(iso, fuso)
  return `${diaMes(d)}/${d.getUTCFullYear()}, ${hora(d)}`
}
