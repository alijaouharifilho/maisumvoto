// Estados da tela do mapa: carregando, vazio (A: sem resultado; B: sem local) e erro de dados.
import { textos } from '../conteudo/textos.ts'
import { RAIO_TEXTO } from '../config.ts'

export function Carregando({ rotulo }: { rotulo: string }) {
  return (
    <output aria-label={rotulo} className="flex flex-col gap-2">
      <div className="esqueleto h-5 w-3/4" />
      <div className="esqueleto h-12 w-1/2" />
      <div className="esqueleto h-5 w-5/6" />
      <span className="sr-only">{rotulo}</span>
    </output>
  )
}

export function Vazio({ semResultado }: { semResultado: boolean }) {
  const titulo = semResultado ? textos.vazio.semResultado.titulo : textos.vazio.semLocal.titulo(RAIO_TEXTO)
  const texto = semResultado ? textos.vazio.semResultado.texto : textos.vazio.semLocal.texto(RAIO_TEXTO)
  return (
    <section className="cartao flex flex-col gap-1">
      <h2 tabIndex={-1} className="font-titulo text-xl font-bold">{titulo}</h2>
      <p>{texto}</p>
    </section>
  )
}

type PropsErro = { tentando: boolean; onTentar: () => void }

export function ErroDeDados({ tentando, onTentar }: PropsErro) {
  const t = textos.erroDados
  return (
    <section role="alert" className="flex flex-col items-start gap-2 rounded-2xl border-2 border-alerta bg-branco p-4">
      <h2 className="font-titulo text-xl font-bold text-alerta">{t.titulo}</h2>
      <p>{t.texto}</p>
      <button type="button" className="botao botao-primario" onClick={onTentar} disabled={tentando}>
        {tentando ? t.tentando : t.tentar}
      </button>
    </section>
  )
}
