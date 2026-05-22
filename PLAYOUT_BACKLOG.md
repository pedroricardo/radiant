# Playout Backlog

Backlog consolidado a partir de:

- `PLAYOUT_MANAGER_PLAN.md`
- `IDEAS.md`

Este ficheiro lista apenas trabalho ainda pendente ou claramente incompleto.
O objetivo é separar o que falta no backend do que falta no frontend para entregar o V1 de playout e calendário, sem misturar com o que já está estável.

## Backend

### P0: Playlist domain e resolução real de playlists

- Criar `PlaylistService` com CRUD completo de playlists.
- Criar operações de ordenação de `playlist_items`.
- Expor suporte a itens `track` e `jingle` no domínio de playlist.
- Implementar regras de inserção de jingles.
  - Inserir no início.
  - Inserir no fim.
  - Inserir a cada `N` músicas.
- Implementar cálculo da timeline efetiva de uma playlist.
  - Contar duração real dos ficheiros.
  - Contar crossfade default da rádio.
  - Contar override de crossfade por playlist.
  - Garantir que jingles contam no relógio efetivo.
- Implementar shuffle determinístico por ciclo.
  - Definir PRNG fixo e documentado.
  - Derivar seed efetiva de `shuffleSeed`, `cycleIndex` e âncora da instância do bloco.
  - Garantir que restart com o mesmo `now` produz a mesma ordem.
- Implementar `preventImmediateRepeats`.
- Definir a API pura que responde:
  - qual item toca num `offset` de playlist
  - qual o `seekMs` nesse item
  - onde estão as fronteiras válidas entre músicas

### P0: Resolvedor do scheduler com suporte a `playlist`

- Estender o resolvedor do `PlayoutManager` para resolver blocos `playlist`.
- Construir `PlayoutSelection` rica o suficiente para suportar:
  - `audio_file`
  - `playlist`
  - item atual dentro da playlist
  - `seekMsInSource`
  - `effectiveCrossfadeMs`
  - `timelineAnchor`
  - `selectionReason`
- Implementar `playlistFillMode = once | loop`.
  - `once`: tocar apenas músicas completas que caibam.
  - `loop`: repetir ciclos determinísticos para preencher a janela.
- Garantir que o fim efetivo de um bloco de playlist cai numa fronteira válida de música.
- Garantir restart no meio de um ciclo de playlist sem perder coerência.

### P0: Tradução do scheduler para áudio real

- Ligar a resolução de `playlist` ao `AudioMultiplexer`.
- Traduzir a `PlayoutSelection` de playlist para `AudioSource` real.
- Implementar reavaliação não só por mudança de bloco, mas também por fim de item dentro da playlist.
- Garantir que o runtime pode arrancar:
  - no meio de uma faixa isolada
  - no meio de uma playlist sequencial
  - no meio de uma playlist em shuffle

### P0: Interrupções manuais

- Implementar serviço de interrupções manuais.
- Persistir `playout_interruptions` com leitura/escrita reais.
- Implementar `PlayoutManager.interruptWithFile(radioId, mediaNodeId, modeAfterPlayback)`.
- Aplicar a interrupção imediatamente ao `AudioMultiplexer`.
- Implementar o comportamento `overlay`.
  - O relógio da rádio continua a passar por baixo.
  - Ao terminar, o sistema volta ao que o relógio manda naquele momento.
- Garantir restart correto no meio de uma interrupção.
- Definir contrato/backend para leitura do estado atual de interrupção.

### P0: APIs HTTP ainda em falta

- Criar endpoints de playlists.
  - CRUD de playlists.
  - CRUD/ordenação de `playlist_items`.
  - configuração de regras de jingle.
- Criar endpoint/ação de interrupção manual.
- Criar endpoints de leitura para o domínio de playlists se a dashboard precisar de timeline resolvida, boundaries válidos ou pré-visualização.

### P1: Advertising windows / scheduled breaks

- Modelar janelas fixas de publicidade por rádio.
- Decidir se estas janelas vivem numa tabela própria ou num recurso de schedule separado.
- Fazer o resolvedor de playlist detectar breaks que intersectam a timeline virtual.
- Inserir o break como segmento planejado dentro da timeline resolvida.
- Continuar a playlist depois do break a partir da próxima fronteira válida.
- Implementar a regra de exact fit:
  - a janela de publicidade não pode começar no meio de uma música
  - o backend precisa saber quais são os inícios válidos de um bloco de playlist
- Implementar preenchimento do break com áudio elegível.
  - randomização inicial simples
  - depois espaço para weighting, cooldown, campaign windows, no-repeat

### P1: Validação rica para editor de calendário

- Expor no backend validação orientada a boundaries válidos de playlist, não só colisão booleana.
- Permitir perguntar:
  - este início é válido para esta playlist?
  - para que boundary mais próximo devo fazer snap?
  - até onde posso redimensionar sem cortar música?
- Enriquecer o contrato de validação com dados úteis para resize de playlist e ad windows.
- Garantir que a validação backend continua coerente com a lib partilhada no `RadiantClient`.

### P1: Schedule resource separado para takeovers / interruptions / breaks

- Separar claramente do recurso `schedule/blocks` o que é:
  - interrupção manual
  - ad break planejado
  - takeover especial futuro
- Definir precedência operacional entre:
  - interrupção manual
  - ocorrência avulsa
  - bloco semanal
  - break planeado
  - live session futura

### P1: Radio fallback e tolerância operacional

- Definir fallback quando não existe bloco ativo.
- Definir fallback quando houver live block futuro sem presenter ligado.
- Decidir se o fallback usa `fallbackMediaNodeId`, silêncio, ou outro plano.
- Garantir que o backend consegue expor o motivo da seleção atual para observabilidade.

### P1: Observabilidade e introspeção operacional

- Expor qual a seleção atual do `PlayoutManager` por rádio.
- Expor próximos checkpoints previstos.
- Expor motivo da seleção atual.
  - weekly
  - one-off
  - interruption
  - playlist cycle
  - fallback
- Adicionar logs e métricas úteis para:
  - resync
  - troca de bloco
  - troca de item em playlist
  - interrupção manual
  - falha de resolução

### P2: Per-listener connect ads

- Modelar pool de anúncios de conexão por rádio.
- No `RadioStream`, suportar fluxo por listener:
  - tocar ad local
  - depois juntar ao live stream
- Garantir que isso não altera o relógio partilhado da rádio.
- Adicionar espaço para analytics futuras de impressões por conexão.

### P2: Live sessions from browser

- Adicionar novo target type para live session.
- Implementar recurso/sessão live no backend.
- Receber áudio do browser em realtime.
- Misturar opcionalmente com background music.
- Definir fallback quando o bloco live começa sem presenter ligado.
- Decidir o transporte realtime.
  - WebRTC é a hipótese mais óbvia a investigar

### P2: Metadata editor backend

- Separar metadata descritiva editável da metadata técnica extraída.
- Criar API de edição de metadata descritiva.
  - title
  - artist
  - album
  - cover art
  - outros campos de apresentação
- Preservar metadata técnica como derivada do sistema.
- Criar mecanismo de sugestão automática de metadata.
  - lookup por filename
  - sugestões com confiança
  - confirmação explícita antes de aplicar

### P0-P1: Testes ainda em falta no backend

- Testes unitários de shuffle determinístico.
- Testes unitários de jingles na timeline efetiva.
- Testes unitários de crossfade a contar no relógio.
- Testes unitários de `offset -> item atual + seekMs`.
- Testes unitários de `playlistFillMode = once | loop`.
- Testes de restart no meio de faixa real.
- Testes de restart no meio de playlist sequencial.
- Testes de restart no meio de playlist em shuffle.
- Testes de interrupção manual com `overlay`.
- Testes de múltiplos listeners durante troca de bloco.
- Testes de responsividade do servidor com listeners a conectar/desconectar.
- Testes de ad windows quando esse domínio existir.

## Frontend

### P0: Calendário V1 operacional

- Construir a grade semanal visual por rádio.
- Mostrar ocorrências avulsas sobre a grade.
- Mostrar blocos `audio_file` e `playlist`.
- Permitir criar bloco de playlist.
- Permitir criar bloco de ficheiro.
- Permitir mover blocos com drag and drop.
- Permitir editar/remover blocos.
- Respeitar timezone da rádio em toda a UI.

### P0: Resize e edição temporal correta

- Permitir resize apenas em blocos de `playlist`.
- Tratar blocos de `audio_file` como duração fixa.
- Impedir visualmente resize que corte música a meio.
- Fazer snap do resize a fronteiras válidas vindas da timeline resolvida.
- Mostrar claramente quando um resize é inválido.

### P0: Enforcement de colisões em tempo real

- Usar a lib partilhada `RadiantClient/lib/Schedule` para validação offline durante drag/resize/create.
- Pintar conflitos em tempo real.
- Impedir drops inválidos.
- Usar `resolveCollisionHints(...)` para snap/push quando aplicável.
- Usar projeção local de weekly blocks no range visível.
- Comparar projeção local com `weekly.occurrences` do backend como integrity check.

### P1: UX de playlist timelines

- Mostrar conteúdo configurado do bloco no slot.
- Mostrar se o bloco é `playlist` ou `audio_file`.
- Mostrar boundaries válidos de playlist para resize.
- Quando existir timeline resolvida no backend, suportar preview de:
  - item atual
  - duração efetiva
  - pontos de snap válidos
- Mostrar por que razão um bloco de playlist não pode começar ou terminar num dado ponto.

### P1: UX de ad windows / planned breaks

- Renderizar breaks planeados como entidade visual distinta.
- Mostrar o break “dentro” da timeline efetiva da playlist quando aplicável.
- Fazer snap automático para inícios válidos que respeitem o exact fit do break.
- Tornar visível quando uma playlist ficaria inválida por atravessar o break no meio de uma música.

### P1: UI de interrupção manual

- Ação rápida para interromper a transmissão com um ficheiro.
- Mostrar estado atual de interrupção no dashboard.
- Renderizar a interrupção como camada operacional separada do calendário normal.
- Permitir inspeção do motivo pelo qual a rádio está naquele estado.

### P2: Live sessions UI

- UI para entrar numa live session a partir do browser.
- Captura de microfone.
- Indicadores de ligação, níveis, mute e reconnect.
- Controlo opcional de música de fundo/bed.
- Feedback claro se o bloco live começar sem presenter.

### P2: Metadata editor UI

- Editor de metadata descritiva na media library.
- Upload/substituição de cover art.
- Mostrar distinção entre metadata técnica e metadata editável.
- Fluxo de sugestão automática com revisão manual.

### P2: Per-listener connect ads UX / analytics

- Se connect ads forem implementados, dashboard de configuração por rádio.
- Gestão do pool de anúncios elegíveis.
- Futuro espaço para relatórios de impressões por conexão.

## Notas

- `schedule/blocks` já cobre bem weekly + one-off, mas não deve ser sobrecarregado com interrupções manuais, ad windows ou takeovers especiais.
- O próximo grande desbloqueio técnico continua a ser o domínio de playlists no backend.
- Sem timeline efetiva de playlist no backend, o frontend consegue fazer colisões e projeções temporais básicas, mas não consegue entregar resize/fit corretos para playlists.
