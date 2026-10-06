// Entrada do site. Tudo que é pesado (mapa, páginas de conteúdo, Ficha) é carregado sob demanda.
import './estilo/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { LimiteDeErro } from './componentes/LimiteDeErro.tsx'
import { textos } from './conteudo/textos.ts'
import { APOIADO, NOME_SITE } from './config.ts'
import { carregador } from './dados/instancia.ts'
import { ProvedorDados } from './dados/ProvedorDados.tsx'
import { instalarRecuperacao } from './recuperacao.ts'

instalarRecuperacao()

// O index.html já traz título e descrição neutros (para quem não roda JS); aqui entra a descrição completa.
document.title = textos.meta.titulo(NOME_SITE)
document.querySelector('meta[name="description"]')?.setAttribute('content', textos.meta.descricao(APOIADO))

const raiz = document.getElementById('raiz')
if (raiz === null) throw new Error('index.html sem o elemento #raiz')

createRoot(raiz).render(
  <StrictMode>
    <LimiteDeErro>
      <ProvedorDados carregador={carregador}>
        <App />
      </ProvedorDados>
    </LimiteDeErro>
  </StrictMode>,
)
