# PlayoutManager V1

## Resumo

Construir o `PlayoutManager` como um scheduler determinista por `radioId`, orientado pelo relógio e pelo timezone da rádio, capaz de arrancar a qualquer momento e resolver exatamente o conteúdo e o offset que deveria estar no ar naquele instante.

O V1 inclui:

- calendário visual estilo grade para programação da rádio
- grade semanal recorrente
- ocorrências avulsas absolutas
- blocos que apontam para `playlist` ou `audio file`
- apenas blocos de `playlist` podem ser redimensionados
- playlists com regras de inserção de jingles
- crossfade com defaults da rádio e override por playlist
- loop e corte de bloco no limite temporal
- biblioteca de mídia como árvore virtual por rádio, persistida em SQL e materializada em storage local
- interrupção manual por ficheiro de áudio
- shuffle determinístico por ciclo de playlist

O objetivo principal é que o runtime da rádio possa morrer e voltar a qualquer momento sem quebrar a ilusão de continuidade.

## Ordem de construção

### Fase 0: tirar o demo do caminho

Objetivo:

- parar de depender do ficheiro hardcoded no `RadioStream`
- preparar o código para receber programação real

Tarefas:

1. extrair do `RadioStream` a lógica demo que hoje injeta `Fujii Kaze - Matsuri.m4a`
2. definir a interface mínima do `PlayoutManager` para “aplicar estado atual do rádio” ao `AudioMultiplexer`
3. fazer o `RadioStream` arrancar o `PlayoutManager`, mas sem calendário ainda
4. manter uma implementação temporária simples que carregue um target fixo por rádio só para não quebrar o stream

Saída esperada:

- `RadioStream` deixa de conhecer detalhes da programação
- o ponto de integração entre rádio e scheduler fica estabilizado

### Fase 1: fundações de domínio e banco

Objetivo:

- criar as entidades base sem as quais não existe programação nem biblioteca

Tarefas:

1. criar tabela `radios`
2. criar tabela `media_nodes`
3. criar tabelas `playlists` e `playlist_items`
4. criar tabela `schedule_weekly_blocks`
5. criar tabela `schedule_one_off_blocks`
6. criar tabela `playout_interruptions`
7. adicionar tipos/ids de domínio correspondentes no client/shared lib
8. definir enums e campos centrais:
   - `targetType`
   - `playbackMode`
   - `modeAfterPlayback`
   - `playlistFillMode`
   - `kind` de `media_nodes`

Saída esperada:

- banco já consegue representar rádio, biblioteca, playlists e programação

### Fase 2: biblioteca de mídia e storage

Objetivo:

- permitir que ficheiros reais existam no sistema com metadata utilizável pelo scheduler

Tarefas:

1. criar `StorageService` abstrato com implementação em disco local
2. criar `MediaLibraryService`
3. implementar criação de pastas e ficheiros na árvore virtual
4. implementar upload de áudio para storage local
5. extrair e persistir metadata no upload:
   - duração
   - sample rate
   - channels
   - mime type
   - size
   - hash
6. implementar listagem da árvore por rádio
7. implementar mover, renomear e apagar nós

Saída esperada:

- a rádio já pode ter uma biblioteca organizada e ficheiros reproduzíveis por `mediaNodeId`

### Fase 3: playlists e regras de jingles

Objetivo:

- modelar a sequência musical antes de resolver calendário

Tarefas:

1. criar `PlaylistService`
2. implementar CRUD de playlists
3. implementar ordenação de `playlist_items`
4. adicionar suporte a `track` e `jingle`
5. implementar regras de inserção de jingles
6. implementar cálculo da timeline efetiva da playlist
7. fazer esse cálculo já considerar:
   - duração real dos ficheiros
   - crossfade default da rádio
   - override da playlist
8. definir algoritmo fixo de shuffle determinístico por ciclo
9. implementar geração da ordem pseudoaleatória estável
10. implementar `preventImmediateRepeats`

Saída esperada:

- uma playlist já consegue responder “qual item toca agora neste offset?”

### Fase 4: resolvedor puro do scheduler

Objetivo:

- construir primeiro o cérebro puro, sem ainda acoplar ao runtime

Tarefas:

1. criar `ScheduleService`
2. implementar CRUD de grade semanal
3. implementar CRUD de ocorrências avulsas
4. implementar validação de conflitos na escrita
5. implementar resolução do bloco ativo por `currentTimeUtc`
6. aplicar timezone IANA da rádio e DST corretamente
7. aplicar precedência:
   - interrupção manual ativa
   - ocorrência avulsa
   - bloco semanal
8. implementar `PlayoutSelection`
9. implementar resolução de `audio file` com `seekMs`
10. implementar resolução de `playlist` com:

- timeline virtual
- jingles
- crossfade
- shuffle determinístico
- cálculo de ciclo
- `playlistFillMode = once | loop`
- snap de resize em fronteiras de música

Saída esperada:

- dado um `radioId` e um `now`, o sistema consegue decidir de forma pura e reproduzível o que devia estar a tocar

### Fase 5: seek real e integração com o media plane

Objetivo:

- ligar a decisão do scheduler ao áudio real

Tarefas:

1. estender `AudioSource.fromAudioFile(...)` para aceitar `seekMs`
2. implementar seek real via `ffmpeg`
3. criar no `PlayoutManager` a tradução de `PlayoutSelection` para `AudioSource`
4. aplicar essa source ao `AudioMultiplexer`
5. trocar o arranque do rádio para usar `PlayoutManager.applyCurrentState(radioId)`
6. reavaliar quando:
   - muda o bloco
   - termina a faixa
   - termina o ficheiro único
7. garantir que restart do runtime reentra na faixa correta

Saída esperada:

- a rádio toca o conteúdo correto ao arrancar e reentrar

### Fase 6: interrupção manual

Objetivo:

- suportar o caso operacional de emergência sem rebentar o modelo determinista

Tarefas:

1. implementar ação manual “interromper transmissão e reproduzir este ficheiro”
2. persistir `playout_interruptions`
3. trocar imediatamente o cluster do rádio para o ficheiro de interrupção
4. ao terminar, implementar:
   - `overlay`
5. garantir que restart durante a interrupção continua correto

Saída esperada:

- operação manual de emergência já funciona de ponta a ponta

### Fase 7: APIs HTTP do backend

Objetivo:

- expor o domínio para dashboard e automação

Tarefas:

1. endpoints de biblioteca
2. endpoints de upload
3. endpoints de playlists
4. endpoints de grade semanal
5. endpoints de ocorrências avulsas
6. endpoint/ação de interrupção manual
7. endpoints de leitura necessários para montar o calendário

Saída esperada:

- o frontend já consegue operar tudo o que o V1 precisa

### Fase 8: calendário V1 no dashboard

Objetivo:

- entregar a experiência visual de programação

Tarefas:

1. construir a grade semanal visual por rádio
2. mostrar ocorrências avulsas sobre a grade
3. permitir criar bloco de playlist
4. permitir criar bloco de ficheiro
5. permitir drag and drop
6. permitir resize
7. permitir editar/remover bloco
8. mostrar conflitos e sobreposições de forma clara
9. respeitar timezone da rádio na UI

Saída esperada:

- programação da rádio já pode ser operada visualmente

Regras de resize no calendário:

- apenas blocos de `playlist` podem ser redimensionados
- blocos de `audio file` têm duração fixa
- o calendário nunca corta uma música a meio
- a menor unidade temporal normal do sistema é uma música completa
- o resize de playlists faz snap para fronteiras válidas da timeline resolvida
- a única exceção que pode preemptar no meio de uma música é uma interrupção manual
- `playlistFillMode = once` toca apenas músicas completas que caibam dentro da janela
- `playlistFillMode = loop` permite repetir a playlist para preencher uma janela maior

### Fase 9: testes de regressão e hardening

Objetivo:

- validar que o sistema realmente aguenta restart e continua coerente

Tarefas:

1. testes unitários do resolvedor puro
2. testes de shuffle determinístico
3. testes de jingles e crossfade no relógio
4. testes de DST
5. testes de restart no meio de faixa
6. testes de restart no meio de ciclo de playlist
7. testes de interrupção manual
8. testes com múltiplos listeners
9. testes de responsividade do servidor após conectar/desconectar listeners

Saída esperada:

- o sistema fica confiável o suficiente para avançar para refinamento e UX

## Princípios do scheduler

- A fonte de verdade do que deveria tocar é sempre o relógio atual, nunca estado mutável do processo.
- Toda resolução é feita no timezone IANA da rádio, com DST correto.
- O `PlayoutManager` deve ser reproduzível após restart.
- O runtime só mantém estado operacional curto; o comportamento musical deve ser recalculável.
- A resolução de playlists deve incluir jingles e crossfade no tempo efetivo.
- Shuffle não pode depender de `Math.random()` nem de ordem viva em memória.

## Comportamento de programação

### Calendário V1

O calendário entra já no V1 como interface e como modelo de programação.

No V1, ele não precisa de replicar tudo o que um Google Calendar faz, mas precisa de suportar bem o caso de uso da rádio:

- visualização da grade semanal por rádio
- visualização de ocorrências avulsas
- criação, edição, mover e resize de blocos
- blocos de `playlist` e `audio file`
- leitura clara de conflitos e sobreposições
- timezone da rádio como base da UI

A UI pode ser “calendar-like” e não precisa de começar com todos os refinamentos de um calendário generalista, mas o modelo funcional do calendário faz parte do V1.

### Tipos de bloco

No V1, um bloco do calendário aponta para:

- `playlist`
- `audio file`

`LiveSession` fica fora do V1, mas a arquitetura deve deixar um ponto claro para futura prioridade de live override.

### Estruturas de calendário

O V1 suporta:

- grade semanal recorrente
- ocorrências avulsas absolutas

Regras:

- a grade semanal é resolvida por dia da semana e hora local da rádio
- a ocorrência avulsa absoluta usa `startsAtUtc` e `endsAtUtc`
- ocorrência avulsa absoluta sobrepõe grade semanal no intervalo em que estiver ativa
- conflitos dentro da mesma tabela devem ser impedidos na escrita

### Regra de preenchimento de bloco

Se um bloco de playlist for maior do que a duração efetiva do conteúdo:

- a playlist faz loop
- o áudio é cortado no instante em que o próximo bloco começa

Se o bloco estiver no meio de um loop quando o runtime reinicia:

- o scheduler resolve novamente o ciclo atual
- encontra o item correto
- entra no `seekMs` certo da faixa correta

## Biblioteca de mídia

### Modelo lógico

A biblioteca de ficheiros por rádio será uma árvore virtual por rádio, persistida em SQL.

Cada nó pode ser:

- `folder`
- `file`

O utilizador pode:

- criar pastas
- mover ficheiros
- renomear
- organizar livremente a árvore

### Modelo físico

O SQL guarda a árvore virtual.

O storage local guarda os ficheiros reais.

V1:

- storage em disco local
- layout físico por `radioId`
- chave física desacoplada do path lógico da árvore

O `PlayoutManager` não deve navegar paths do disco. Ele deve consumir `mediaNodeId`, metadata e `storageKey`.

## Playlists e jingles

### Modelo de playlist

A playlist é uma sequência determinista de itens.

Itens possíveis no V1:

- `track`
- `jingle`

Os jingles não são modelados como eventos do calendário. Eles são modelados como regras da playlist.

### Regras de jingle

No V1, jingles são inseridos por regras da playlist, não por regras do calendário.

Exemplos de regra:

- inserir a cada `N` músicas
- inserir no início
- inserir no fim

Esses jingles contam para a duração efetiva da execução da playlist.

### Crossfade

Crossfade no V1:

- default definido na rádio
- playlist pode fazer override

O crossfade tem de entrar no cálculo do tempo efetivo da timeline.

Ou seja:

- não basta somar a duração bruta dos ficheiros
- a duração da playlist é a duração real já com sobreposição de transições

## Shuffle

### Decisão

O V1 usa `shuffle determinístico por ciclo`.

Não usar:

- shuffle puramente aleatório em tempo real
- cursor vivo em memória como fonte de verdade
- `Math.random()`

### Campos adicionais na playlist

Adicionar à playlist:

- `playbackMode`: `sequential` | `shuffle_deterministic`
- `shuffleSeed`
- `shuffleCycleAnchor`
- `preventImmediateRepeats` com default `true`

### Regra de resolução

No modo `shuffle_deterministic`:

- a ordem dos `track` items é gerada por uma permutação pseudoaleatória estável
- a seed efetiva deve ser derivada de:
  - `playlist.shuffleSeed`
  - `cycleIndex`
  - âncora da instância do bloco

Isso garante:

- mesma playlist + mesma seed + mesma instância de bloco = mesma ordem
- restart do runtime = mesma ordem
- instâncias diferentes do mesmo bloco podem ter ordens diferentes

### Fronteiras do shuffle

O shuffle é resolvido por `block instance`, não globalmente para sempre.

Grade semanal:

- a instância do bloco é aquela semana/dia/hora local da rádio

Ocorrência avulsa:

- a instância do bloco é o próprio `startsAtUtc`

### Relação com jingles

No V1:

- shuffle aplica-se apenas aos `track` items
- jingles entram depois, pela regra de inserção da playlist
- jingles não entram no baralho principal

### Relação com loops

Se um bloco longo exigir múltiplos ciclos da mesma playlist:

- cada ciclo tem a sua ordem determinística
- o scheduler calcula o `cycleIndex`
- resolve a ordem desse ciclo
- encontra o item correto e o `seekMs`

## Interrupção manual

### Caso de uso

O utilizador pode clicar num ficheiro e escolher:

- `Interromper transmissão e reproduzir este ficheiro de áudio`

Isto é uma função de emergência e entra já no V1 apenas no modo manual.

### Comportamentos após o fim da interrupção

Ao terminar o ficheiro de interrupção, o sistema usa apenas um modo:

- `overlay`

#### `overlay`

- a interrupção sobrepõe temporariamente o que o relógio mandaria tocar
- o relógio do rádio continua a passar por baixo
- quando a interrupção termina, volta-se ao conteúdo que o relógio manda agora

### Escopo do V1

No V1:

- interrupção é manual apenas
- não entra como tipo normal de bloco do calendário
- não precisa ainda de UI de agendamento
- no calendário, aparece como segmento vermelho sobreposto:
  `! INTERRUPÇÃO !`
  `<Nota>`
  `<Nome do ficheiro de áudio>`

## Resolução do “agora”

O `PlayoutManager` precisa de um resolvedor puro com entrada:

- `radioId`
- `currentTimeUtc`

Saída:

- `PlayoutSelection`

Conteúdo da `PlayoutSelection`:

- `sourceType`
- `targetId`
- `currentItemId?`
- `seekMsInSource`
- `effectiveCrossfadeMs`
- `timelineAnchor`
- `selectionReason`

### Ordem de resolução

1. converter `currentTimeUtc` para o timezone da rádio
2. verificar interrupção manual ativa
3. verificar ocorrência avulsa absoluta ativa
4. verificar bloco semanal ativo
5. resolver target do bloco
6. se nada existir, usar fallback futuro quando existir

### Resolução de `audio file`

Para um bloco de ficheiro:

- `offset = now - blockStart`
- abrir o ficheiro com `seekMs = offset`

### Resolução de `playlist`

Para um bloco de playlist:

- construir a timeline virtual do bloco
- aplicar ordem sequencial ou shuffle determinístico
- aplicar jingles
- aplicar crossfade
- calcular duração efetiva do ciclo
- aplicar `playlistFillMode`
- calcular `offsetWithinCycle`
- descobrir item atual
- descobrir `seekMsInSource`

Semântica adicional dos blocos de playlist:

- a janela no calendário é um alvo temporal, não permissão para cortar áudio a qualquer milissegundo
- o fim efetivo do bloco é sempre alinhado a uma fronteira de música
- se for preciso abrir espaço para outro evento a uma hora específica, a playlist é encurtada até ao último boundary válido anterior
- se for preciso entrar imediatamente por cima do que está a tocar, usa-se uma interrupção `overlay`

## Integração com runtime da rádio

### Responsabilidade do `PlayoutManager`

O `PlayoutManager` deve:

- resolver o conteúdo atual quando a rádio arranca
- aplicar esse conteúdo ao `AudioMultiplexer`
- reavaliar quando um bloco muda
- reavaliar quando um item termina
- reavaliar quando uma interrupção começa ou acaba

### Responsabilidade do `RadioStream`

O `RadioStream` não decide programação.

Ele apenas:

- mantém relógio/buffer/output PCM por rádio
- recebe do `PlayoutManager` o source/cluster correto
- distribui o áudio para listeners

### Regras operacionais

- não usar timers longos como fonte de verdade do schedule
- sempre recalcular a partir do relógio atual e do plano
- seek em ficheiros deve ser suportado diretamente no `AudioSource.fromAudioFile(...)`
- o runtime deve tolerar restart no meio de uma música ou no meio de um ciclo de playlist

## Estrutura SQL

### Tabelas novas

- `radios`
- `radio_members`
- `media_nodes`
- `playlists`
- `playlist_items`
- `playlist_jingle_rules`
- `schedule_weekly_blocks`
- `schedule_one_off_blocks`
- `playout_interruptions`

### Campos importantes

#### `radios`

- `id`
- `ownerUserId`
- `name`
- `timezoneIana`
- `defaultCrossfadeMs`
- `defaultJingleCrossfadeMs`
- `fallbackMediaNodeId?`

#### `media_nodes`

- `id`
- `radioId`
- `parentId?`
- `kind`
- `name`
- `path`
- `sortKey`
- `storageKey?`
- `mimeType?`
- `sizeBytes?`
- `sha256?`
- `durationMs?`
- `sampleRate?`
- `channels?`
- `createdAt`

#### `playlists`

- `id`
- `radioId`
- `name`
- `crossfadeMs?`
- `playbackMode`
- `shuffleSeed`
- `shuffleCycleAnchor`
- `preventImmediateRepeats`

#### `playlist_items`

- `playlistId`
- `position`
- `mediaNodeId`
- `kind`

#### `playlist_jingle_rules`

- `playlistId`
- `jinglePlaylistId?`
- `jingleMediaNodeId?`
- `insertEveryNTracks?`
- `insertAtStart`
- `insertAtEnd`

#### `schedule_weekly_blocks`

- `id`
- `radioId`
- `dayOfWeek`
- `startLocalTime`
- `endLocalTime`
- `targetType`
- `targetId`
- `playlistFillMode?`

#### `schedule_one_off_blocks`

- `id`
- `radioId`
- `startsAtUtc`
- `endsAtUtc`
- `targetType`
- `targetId`
- `playlistFillMode?`

#### `playout_interruptions`

- `id`
- `radioId`
- `mediaNodeId`
- `startedAtUtc`
- `finishedAtUtc?`
- `modeAfterPlayback`
- `triggeredByUserId`

## Serviços

### `MediaLibraryService`

- CRUD de pastas e ficheiros
- upload
- move
- rename
- delete
- list tree

### `PlaylistService`

- CRUD de playlists
- ordenação de itens
- regras de jingles
- cálculo de timeline efetiva

### `ScheduleService`

- CRUD da grade semanal
- CRUD de ocorrências avulsas
- validação de conflitos
- resolução do bloco ativo
- contratos suficientes para alimentar a UI de calendário da rádio

### UI de calendário

O V1 inclui dashboard de calendário para a rádio com:

- grade semanal editável
- ocorrências avulsas editáveis
- drag and drop de blocos
- resize de blocos para ajustar duração
- associação de bloco a `playlist` ou `audio file`
- leitura do conteúdo configurado no slot

O foco do V1 é programação operacional correta, não paridade total com calendários generalistas.

### `PlayoutManager`

- `resolveNow(radioId, now?)`
- `applyCurrentState(radioId)`
- `interruptWithFile(radioId, mediaNodeId, modeAfterPlayback)`

### `AudioSource`

Estender:

- `fromAudioFile(pathOrStorageKey, { seekMs? })`

## Regras de implementação

- metadata de ficheiro deve ser pré-calculada no upload
- duração do ficheiro não deve ser descoberta em tempo real pelo scheduler
- PRNG do shuffle deve ser fixo e documentado
- algoritmo de permutação deve ser fixo e reproduzível
- a mesma entrada deve sempre gerar a mesma ordem
- alterações de playlist afetam resoluções futuras
- o scheduler não tenta preservar “ordem antiga” se a playlist foi editada

## Testes

### Unitários

- resolução de grade semanal no timezone da rádio
- precedência de ocorrência avulsa sobre semanal
- comportamento em DST
- cálculo determinista de timeline de playlist com jingles
- cálculo de duração efetiva com crossfade
- `offset -> item atual + seekMs`
- loop e corte de bloco
- shuffle determinístico com mesma seed
- shuffle diferente entre instâncias diferentes de bloco
- `preventImmediateRepeats` entre ciclos, quando possível

### Integração

- arrancar rádio no meio de um ficheiro e confirmar seek correto
- arrancar rádio no meio de uma playlist sequencial e confirmar item/offset corretos
- arrancar rádio no meio de uma playlist em shuffle e confirmar item/offset corretos
- restart repetido com o mesmo `now` e mesma playlist em shuffle gera sempre a mesma seleção
- interrupção manual com `overlay`
- dois listeners simultâneos continuam sincronizados durante troca de bloco
- upload persiste metadata e produz ficheiro reproduzível

### Aceitação

- a rádio reinicia e volta ao ponto certo
- jingles contam no relógio da playlist
- crossfade conta no relógio da playlist
- ocorrência avulsa sobrepõe grade semanal
- interrupção manual toca imediatamente
- shuffle continua reproduzível após restart
- biblioteca permite organização por pastas sem acoplamento ao path físico

## Fora do V1

- live sessions reais
- interrupções agendadas que empurram o resto do dia automaticamente
- anúncios com política própria
- fallback fully polished
- shuffle com estado persistido por cursor vivo
