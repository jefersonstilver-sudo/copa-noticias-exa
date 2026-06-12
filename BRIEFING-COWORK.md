# BRIEFING COMPLETO — Central Copa 2026

Cole este texto inteiro no Claude Cowork para ele ter contexto total.

---

## CONTEXTO DO PROJETO

Sou Jeferson Stiliver, CEO da EXA Midia (midia indoor digital em elevadores em Foz do Iguacu/PR). Este site "Central Copa 2026" serve como fonte de conteudo para nossos displays nos elevadores — geramos videos automatizados 2x por dia com noticias da Copa para exibir nos predios.

**Vercel project:** `central-copa-2026`
**GitHub repo:** https://github.com/jefersonstilver-sudo/central-copa-2026 (publico)
**URL atual do site:** verificar no Vercel dashboard
**Data de hoje:** 11 de Junho de 2026 — A COPA COMECOU HOJE (jogo de abertura Mexico x Africa do Sul)

---

## ESTADO ATUAL DO SITE

### Stack
- HTML puro monolitico (~78KB, tudo em `index.html` — CSS, HTML e JS inline)
- 1 API serverless (`api/news.js`) — busca noticias via Google News RSS + NewsData.io + GNews.io
- Gerador de videos com Playwright (`scripts/generate-video.mjs`) — gera MP4 2x/dia (07h e 17h)
- Cron no Vercel: `/api/news` roda diariamente as 8h
- Deploy: Vercel (static site com serverless functions)

### APIs de noticias ja configuradas
- **NewsData.io:** key `pub_6380ed673a7d406eabdf98ed11f20c87`
- **GNews.io:** key `36812da28a16233d7d5bd92397a18b42`
- **Google News RSS:** sem key, usa RSS publico

### Estrutura de arquivos
```
/
├── index.html          (site principal — 78KB monolitico)
├── central-copa-2026.html (copia)
├── index-backup-v4.html   (backup)
├── logo-exa-branca.png
├── vercel.json
├── package.json
├── .gitignore
├── api/
│   └── news.js         (serverless function — noticias)
├── scripts/
│   ├── generate-video.mjs (gerador de video com Playwright)
│   ├── gerar-video.bat
│   ├── setup-scheduler.bat
│   ├── install-tasks.bat
│   ├── task-07h.xml    (Windows Task Scheduler)
│   └── task-17h.xml
└── videos/             (38+ MP4 gerados, gitignored)
```

---

## 6 PROBLEMAS CRITICOS IDENTIFICADOS

### 1. Site estatico fingindo ser "ao vivo"
- Selos "AO VIVO", icone spinner de "AUTO-UPDATE" sao pura animacao CSS
- Noticias da hero/headlines sao links hardcoded de maio/2026
- A API `/api/news` funciona mas o conteudo do hero/headlines NAO usa ela — sao links fixos

### 2. Sem resultados/placares reais
- So tem "Proximos Jogos" (fixtures hardcoded)
- Nao existe tabela de classificacao
- Nao existe placar de jogos em andamento ou encerrados
- A Copa JA COMECOU e o site nao mostra nenhum resultado

### 3. Conteudo velho/desatualizado
- Ticker ainda fala "CONVOCACAO 18/05", "pre-lista 55 nomes"
- Contagem regressiva mostra "--" (ja passou)
- Hero card: "Ancelotti convoca os 26 neste domingo (18/05)" — isso ja aconteceu ha semanas

### 4. Tabelas de grupo = so bandeiras
- Cards de grupo mostram 4 bandeiras + nome
- NAO tem colunas: P (jogos), J, V (vitorias), E (empates), D (derrotas), GP, GC, SG, Pts
- Nao tem classificacao/posicao
- Sem isso e impossivel acompanhar a fase de grupos

### 5. Tudo Brasil-centrico
- Secao "Selecao Brasileira" domina o site
- Jogos de outros paises nao viram noticia
- Quem abre o site nao sabe o que aconteceu em Mexico x Africa do Sul (abertura de hoje)

### 6. Repeticao e hierarquia confusa
- Brasil x Marrocos aparece 3 vezes (hero widget, secao Brasil, lista de jogos)
- Polui e nao deixa claro o que e prioridade

---

## DECISOES JA TOMADAS

### Fonte de dados para placares/tabelas: WIDGET EMBED GRATIS
- Usar widgets prontos (SofaScore, FotMob, OneFootball, Flashscore) para placares e tabelas
- Zero custo, funciona em tempo real sem API paga
- Aceito que o visual nao sera 100% customizavel mas prefiro custo zero

### Stack: VOCE DECIDE
- Pode manter HTML puro ou migrar para Next.js — escolha o que fizer mais sentido

### Objetivo do site: CONTEUDO PARA ELEVADORES
- O site alimenta o gerador de videos (`scripts/generate-video.mjs`)
- Videos MP4 sao gerados 2x por dia e exibidos nos displays dos predios da EXA Midia
- O site tambem pode ser acessado por qualquer pessoa, mas o uso primario e gerar os videos

---

## O QUE PRECISA SER FEITO

1. **Atualizar tudo que esta desatualizado** — remover conteudo de maio, atualizar para realidade de junho/Copa em andamento
2. **Adicionar placares/resultados reais** — widgets embed de SofaScore ou similar
3. **Adicionar tabela de classificacao real** — com P, J, V, E, D, GP, GC, SG, Pts por grupo
4. **Separar Brasil x Mundo** — dar destaque ao Brasil mas cobrir TODOS os jogos
5. **Eliminar repeticoes** — cada informacao aparece 1 vez no lugar certo
6. **Contagem regressiva → proximo jogo** — nao mais "abertura da Copa" (ja passou)
7. **Ticker com noticias reais** — usar dados da API `/api/news` no ticker, nao texto hardcoded
8. **Manter o gerador de videos funcionando** — qualquer mudanca no HTML deve ser compativel com Playwright screenshot

---

## ACESSOS

- **Vercel:** projeto `central-copa-2026` (deploy automatico via git push)
- **GitHub:** https://github.com/jefersonstilver-sudo/central-copa-2026
- **APIs de noticias:** keys ja no codigo (news.js)
- **Dominio:** ainda no .vercel.app (sem dominio customizado)

---

## IDENTIDADE VISUAL (manter)

| Elemento | Valor |
|----------|-------|
| Background | #050509 (quase preto) |
| Cards | rgba(255,255,255,0.03) |
| Vermelho | #e50914 (estilo ESPN/urgencia) |
| Dourado | #d4a843 (premium) |
| Azul | #1a6dd4 |
| Verde Brasil | #009c3b |
| Amarelo Brasil | #FFDF00 |
| Azul Brasil | #002776 |
| Font principal | Inter |
| Font display | Bebas Neue |
| Font tech | Orbitron |

## MARCA
- Logo: `logo-exa-branca.png` no root
- Footer: "Powered by EXA Midia - Midia Indoor Digital em Elevadores - Foz do Iguacu, PR"
- Contato: www.examidia.com.br | @examidia | (45) 99141-5920
