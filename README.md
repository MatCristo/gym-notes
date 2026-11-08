<p align="center">
  <img src="assets/images/icon.png" alt="Ícone do Gym Notes" width="112" height="112">
</p>

<h1 align="center">Gym Notes</h1>

<p align="center">
  Caderno de treino para musculação no Android: planeje seus treinos, registre cada série na academia
  e acompanhe a evolução das suas cargas — tudo offline, direto no aparelho.
</p>

<p align="center">
  <img alt="Status: beta" src="https://img.shields.io/badge/status-beta-B8F36B?labelColor=101114">
  <img alt="Expo SDK 57" src="https://img.shields.io/badge/Expo-SDK%2057-101114">
  <img alt="React Native 0.86" src="https://img.shields.io/badge/React%20Native-0.86-101114">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-101114">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-101114">
</p>

---

## Sobre o projeto

O **Gym Notes** nasceu para substituir o bloco de notas que muita gente usa na academia. Em vez de anotar
cargas soltas, você organiza seus treinos em **planejamentos** (ex.: “Hipertrofia”, “Treino em casa”), cadastra os
exercícios uma vez, executa o treino pelo app marcando cada série e, com o tempo, enxerga a sua evolução em
histórico, estatísticas e gráficos.

**Objetivos do projeto**

- Oferecer uma experiência simples e rápida de usar entre uma série e outra.
- Funcionar **100% offline**: os dados ficam somente no aparelho, sem conta, login ou servidor.
- Servir como projeto de portfólio com arquitetura em camadas, persistência local com migrations
  e testes automatizados.

> **Status:** versão de testes (**beta**, `1.0.0`). O app está em testes com um grupo pequeno de usuários
> por meio de APK. Ainda não está publicado na Google Play.

## Funcionalidades

**Planejamentos**
- Vários planejamentos, cada um com seus próprios treinos (A, B, C, D… com nomes livres).
- Criar, editar (nome e descrição opcional), duplicar e excluir planejamentos.
- Duplicar um planejamento copia todos os treinos e exercícios, com a mesma prescrição e ordem — sem copiar
  sessões, histórico ou estatísticas.
- A exclusão pede confirmação, remove os treinos do planejamento e **mantém o histórico** dos treinos já
  realizados. Não é permitida enquanto algum treino do planejamento estiver em andamento.
- Compartilhar um planejamento por **código de texto** (pelo WhatsApp ou qualquer app) e importar planejamentos
  recebidos como cópias independentes — veja [Compartilhamento de planejamentos](#compartilhamento-de-planejamentos).

**Treinos**
- Criar, renomear e excluir treinos dentro de um planejamento (com confirmação).
- Duplicar um treino com todos os seus exercícios.
- Reordenar treinos arrastando pela alça (a ordem é salva e é independente em cada planejamento).
- Iniciar ou continuar um treino direto pelo menu de opções.
- Um treino em andamento não pode ser excluído até ser finalizado.

**Exercícios**
- Cadastrar exercícios com séries, repetições, carga (kg) e descanso (segundos), com validação dos campos.
- Observação opcional em cada exercício (até 200 caracteres), ex.: “Manter a coluna apoiada.” — exibida na
  lista de exercícios do treino e durante a execução.
- Editar, duplicar (a cópia entra logo abaixo do original) e excluir exercícios.
- Reordenar exercícios arrastando (a ordem é salva).

**Execução do treino**
- Iniciar um treino a partir do planejamento; o plano do dia (incluindo as observações) é “congelado” no início
  da sessão.
- Registrar a carga e as repetições realmente feitas em cada série e marcar a série como concluída.
- Cronômetro de descanso com pausar, retomar, ajustar ±15 s e encerrar — preciso mesmo com o app em segundo plano.
- Retomar um treino em andamento depois de fechar o app.
- Finalizar com resumo: duração, exercícios realizados, séries concluídas e planejadas.

**Histórico e evolução**
- Histórico das sessões concluídas, agrupado por mês, com detalhes somente leitura de cada execução
  (planejado × realizado em cada série).
- Evolução por exercício: última carga, maior carga e gráfico de linha da maior carga por sessão,
  com filtros de 30 dias, 90 dias, 6 meses ou todo o período.
- Estatísticas gerais: total de treinos, séries e tempo, média semanal e treinos por semana e por mês.

## Compartilhamento de planejamentos

Um planejamento pode ser enviado para outra pessoa como um **código de texto**, sem servidor, conta ou internet
própria do app: o código viaja pelo aplicativo de mensagens que você já usa.

**O que é compartilhado — e o que nunca é**

| Vai no código | Nunca vai no código |
| --- | --- |
| Nome e descrição do planejamento | Sessões (concluídas ou em andamento) e histórico |
| Nome e ordem dos treinos | Cargas e repetições realizadas, séries concluídas |
| Nome e ordem dos exercícios | Datas e horários de execução, duração dos treinos |
| Séries, repetições, carga **planejada** e descanso | Recordes, estatísticas, evolução e gráficos |
| Observação do exercício (quando houver) | Identificadores internos e datas do banco |

> **Atenção:** o código **não é criptografado**. Ele é apenas codificado em texto: qualquer pessoa que o receber
> consegue ler o conteúdo do planejamento. Compartilhe somente com quem você quiser.

**Como compartilhar (ex.: WhatsApp)**
1. Na aba **Treinos**, toque em **•••** no planejamento e escolha **Compartilhar planejamento**
   (disponível quando o planejamento tem ao menos um treino).
2. Toque em **Compartilhar** e escolha o WhatsApp (ou outro app) — a mensagem já vai com uma explicação curta e o
   código completo. Se preferir, use **Copiar código** e cole na conversa.

**Como importar**
1. Copie a mensagem recebida (pode ser a mensagem inteira, com o texto em volta do código).
2. Na aba **Treinos**, toque em **Importar** (ou em **Importar planejamento**, se a lista estiver vazia).
3. Toque em **Colar código** (ou cole manualmente no campo) e depois em **Ver prévia**.
4. Confira o nome, os treinos e a quantidade de exercícios e toque em **Importar planejamento**.

A importação **sempre cria um planejamento novo e independente**: nenhum planejamento existente é alterado ou
substituído. Se já existir um planejamento com o mesmo nome, o novo recebe o sufixo **“(Importado)”** (ou
“(Importado 2)”, “(Importado 3)”…). Alterar o texto depois da prévia exige uma nova prévia, e o conteúdo é
validado de novo no momento da confirmação. Se algo falhar no meio, nada é gravado.

**Formato do código (visão geral)**
- Começa com `GN1:` ou `GN2:` — identifica o Gym Notes e a versão do formato. O app gera `GN1:` quando nenhum
  exercício tem observação (formato original, que versões anteriores do app também importam) e `GN2:` quando há
  observações. Códigos de versões mais novas pedem a atualização do app em vez de serem importados de forma
  incorreta, e códigos `GN1:` antigos continuam sendo importados (com observações vazias).
- O conteúdo é um JSON compacto em UTF-8 (acentos e emojis preservados) codificado em Base64, seguido de um
  **CRC-32** que detecta códigos incompletos ou alterados.
- O código é validado inteiro antes de qualquer gravação, com os mesmos limites do app (nomes, séries, repetições,
  carga e descanso) e limites próprios: até **50 treinos**, **100 exercícios por treino** e **100 KB** de texto.

**Limitações conhecidas**
- O compartilhamento é feito apenas por texto: não há link, QR Code nem abertura automática do app.
- Planejamentos sem treinos, com mais de 50 treinos ou com mais de 100 exercícios em um treino não podem ser
  compartilhados.
- Caracteres invisíveis inseridos **dentro** do código por outros apps (ex.: espaço de largura zero) o invalidam;
  nesse caso, peça para a pessoa enviar o código novamente.
- O código copiado fica na área de transferência do aparelho, como qualquer texto copiado.

## Capturas de tela

> Em breve. As imagens serão adicionadas em `docs/screenshots/`.

<!--
Para adicionar, salve os arquivos em docs/screenshots/ e troque cada célula pelo <img> correspondente, por exemplo:
<img src="docs/screenshots/treinos.png" alt="Lista de treinos" width="240">
-->

| Treinos | Detalhes do treino | Execução |
| :---: | :---: | :---: |
| _em breve_ | _em breve_ | _em breve_ |

| Cronômetro de descanso | Histórico | Evolução de carga |
| :---: | :---: | :---: |
| _em breve_ | _em breve_ | _em breve_ |

## Tecnologias

| Área | Tecnologia |
| --- | --- |
| Framework | [Expo](https://expo.dev) SDK 57 · React Native 0.86 · React 19 |
| Linguagem | TypeScript 6 (modo `strict`) |
| Navegação | Expo Router (rotas por arquivo, abas e pilha) |
| Banco de dados | SQLite com `expo-sqlite` |
| Identificadores | UUID v4 com `expo-crypto` |
| Gestos e animações | React Native Gesture Handler · Reanimated 4 |
| Reordenação | `react-native-reorderable-list` |
| Compartilhamento | `Share` do React Native · área de transferência com `expo-clipboard` |
| Otimização | React Compiler (habilitado em `app.json`) |
| Testes | Jest com `jest-expo` |
| Qualidade | ESLint (`eslint-config-expo`) · `expo-doctor` |
| Build | EAS Build (APK e AAB) |

Os gráficos, os ícones das abas e o cronômetro foram feitos com componentes do próprio React Native,
sem bibliotecas adicionais.

## Arquitetura

O código é organizado por funcionalidade (`features/`), e cada uma segue as mesmas camadas:

```
Tela (src/app) → Hook → Service → Repository → SQLite
```

| Camada | Responsabilidade |
| --- | --- |
| **Telas e componentes** | Apresentação. Nenhum componente executa SQL. |
| **Hooks** | Estado da tela e integração com a interface (carregamento, erro, atualização da lista). |
| **Services** | Regras de negócio e validação (ex.: não iniciar treino sem exercícios, duplicação transacional, bloqueio de exclusão com treino em andamento). |
| **Repositories** | Único ponto que executa SQL, sempre com consultas parametrizadas. |

Navegação principal: **Planejamentos** (aba Treinos) → **Treinos do planejamento** → **Exercícios do treino** →
**Execução**. As abas Histórico e Estatísticas são globais (consideram todos os planejamentos).

```
src/
├── app/                  # Rotas (Expo Router)
│   ├── (tabs)/           # Abas: Treinos (lista de planejamentos), Histórico e Estatísticas
│   ├── program/[id].tsx  # Treinos de um planejamento
│   ├── workout/[id].tsx  # Detalhes do treino e exercícios
│   ├── session/          # Execução do treino e resumo
│   ├── history/[id].tsx  # Detalhes de uma sessão concluída
│   └── exercise-progress.tsx
├── components/           # Componentes reutilizáveis (ui/ e charts/)
├── database/             # Conexão SQLite, transações e migrations
├── features/
│   ├── programs/         # Planejamentos
│   ├── workouts/         # Treinos
│   ├── exercises/        # Exercícios planejados
│   ├── sessions/         # Execução, séries e cronômetro
│   ├── history/          # Histórico, estatísticas e evolução
│   └── sharing/          # Código de compartilhamento (formato GN1), exportação e importação
│       └── (components | hooks | services | repositories | types | utils)
├── hooks/                # Hooks compartilhados
├── theme/                # Cores, espaçamentos e tipografia
└── utils/                # Formatação de números, datas e tempo; utilitários de lista
test/                     # Infraestrutura dos testes (mocks e helpers)
```

## Banco de dados e persistência

Os dados ficam em um banco **SQLite local** (`gym-notes.db`), aberto uma única vez na inicialização do app.

- **Migrations versionadas** com `PRAGMA user_version`: cada migration roda em transação junto com a troca de
  versão (é aplicada por completo ou não muda nada). O banco nunca é apagado ou recriado em atualizações.
- **Chaves estrangeiras ativas** e verificadas na abertura; `CHECK`s no banco reforçam as validações.
- **Planejamento e execução separados:** o que você planeja (`training_programs`, `workouts`, `exercises`) fica
  separado do que você realmente fez (`workout_sessions`, `session_exercises`, `set_logs`). Ao iniciar um treino,
  nomes e valores planejados são copiados para a sessão — editar ou excluir um treino ou planejamento depois
  **não altera o histórico**.
- **Todo treino pertence a um planejamento:** a chave estrangeira `workouts.program_id` não tem exclusão em cascata
  (o banco recusa excluir um planejamento que ainda tenha treinos) e triggers impedem treinos sem planejamento.
  Na atualização para a versão 6 do banco, os treinos existentes foram associados a **“Meu planejamento”**,
  preservando IDs, exercícios, ordem, sessões e histórico.
- **Transações** nas operações com vários registros (iniciar sessão, duplicar treino ou planejamento, reordenar
  treinos e exercícios, duplicar exercício, excluir planejamento).

| Tabela | Conteúdo |
| --- | --- |
| `training_programs` | Planejamentos (nome, descrição opcional e ordem) |
| `workouts` | Treinos de cada planejamento |
| `exercises` | Exercícios planejados de cada treino (com observação opcional) |
| `workout_sessions` | Execuções de um treino (em andamento ou concluídas) |
| `session_exercises` | Exercícios de cada execução (nome, descanso e observação copiados no início) |
| `set_logs` | Séries: planejado e realizado |

## Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org) 22.13 ou superior (recomendado: 24 LTS — os testes usam o módulo `node:sqlite`)
- npm
- Um celular Android com o app [Expo Go](https://expo.dev/go) compatível com o SDK 57, ou um emulador Android

### Instalação

```bash
git clone https://github.com/MatCristo/gym-notes.git
cd gym-notes
npm install
```

### Rodando no Android com Expo Go

```bash
npx expo start
```

1. Abra o **Expo Go** no celular (na mesma rede Wi-Fi do computador).
2. Escaneie o QR Code exibido no terminal.
3. O app abre com o planejamento **“Meu planejamento”**, que contém três treinos de exemplo (Treino A, B e C).
   Todos podem ser editados ou excluídos.

> Se o computador e o celular não estiverem na mesma rede, use `npx expo start --tunnel`
> (requer `@expo/ngrok`, já incluído nas dependências de desenvolvimento).

> No Expo Go, o ícone e a splash screen exibidos são os do próprio Expo Go. Os do Gym Notes aparecem no APK.

### Gerando um APK de testes

O projeto já está configurado para o [EAS Build](https://docs.expo.dev/build/introduction/) (`eas.json`).
É necessária uma conta Expo gratuita.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                               # vincula o projeto à sua conta
npx eas-cli@latest build -p android --profile preview # gera um APK para instalar direto no aparelho
```

O perfil `production` gera um AAB (formato da Google Play) e não é necessário para testes.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm start` | Inicia o servidor de desenvolvimento do Expo |
| `npm test` | Executa os testes automatizados |
| `npm run test:coverage` | Executa os testes com relatório de cobertura |
| `npm run typecheck` | Verificação de tipos com TypeScript |
| `npm run lint` | ESLint |

## Testes

Os testes cobrem as regras de negócio e o acesso a dados: inicialização e migrations do banco (incluindo a
atualização de bancos antigos com dados reais), CRUD de planejamentos, treinos e exercícios, duplicação,
reordenação, bloqueios de exclusão com treino em andamento, execução e recuperação de sessões, cronômetro,
histórico, estatísticas e evolução de cargas.

O compartilhamento tem testes próprios: o formato do código (UTF-8, Base64, CRC-32, códigos truncados,
alterados ou de versões futuras), a validação, testes de **privacidade** (com sessões e cargas realizadas no banco,
o código exportado é decodificado e conferido campo a campo), importação transacional com rollback, nomes
duplicados e os fluxos de interface de exportação e importação.

Eles rodam contra um **SQLite real** (o módulo `node:sqlite` do Node, com a mesma API usada pelo app),
então migrations, chaves estrangeiras, `CHECK`s e transações são de fato exercitados. Reinícios do app são
simulados reabrindo o mesmo arquivo de banco.

```bash
npm test
```

## Privacidade

O Gym Notes não coleta nem envia dados. Não há conta, login, servidor ou sincronização: tudo fica armazenado
localmente no aparelho. A única permissão Android declarada é `INTERNET` (padrão do React Native), e o app não
solicita nenhuma permissão ao usuário.

O compartilhamento de planejamentos só acontece quando você escolhe compartilhar, e o app não envia nada por
conta própria: o código é entregue ao aplicativo que você escolher. Ele contém apenas a estrutura e as
prescrições do planejamento (veja [o que é compartilhado](#compartilhamento-de-planejamentos)) e não é
criptografado.

## Roadmap

Ideias em avaliação para as próximas versões (ainda **não** implementadas):

- Exportação e importação de dados (backup). Não confundir com o compartilhamento de planejamentos, que nunca
  inclui dados pessoais.
- Publicação na Google Play.

## Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](LICENSE).

---

<p align="center">Desenvolvido por <strong>Matheus Cristo</strong>.</p>
