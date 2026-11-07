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
cargas soltas, você cadastra seus treinos e exercícios uma vez, executa o treino pelo app marcando cada série
e, com o tempo, enxerga a sua evolução em histórico, estatísticas e gráficos.

**Objetivos do projeto**

- Oferecer uma experiência simples e rápida de usar entre uma série e outra.
- Funcionar **100% offline**: os dados ficam somente no aparelho, sem conta, login ou servidor.
- Servir como projeto de portfólio com arquitetura em camadas, persistência local com migrations
  e testes automatizados.

> **Status:** versão de testes (**beta**, `1.0.0`). O app está em testes com um grupo pequeno de usuários
> por meio de APK. Ainda não está publicado na Google Play.

## Funcionalidades

**Treinos**
- Criar, renomear e excluir treinos (com confirmação).
- Duplicar um treino com todos os seus exercícios.

**Exercícios**
- Cadastrar exercícios com séries, repetições, carga (kg) e descanso (segundos), com validação dos campos.
- Editar e excluir exercícios.
- Reordenar exercícios arrastando (a ordem é salva).

**Execução do treino**
- Iniciar um treino a partir do planejamento; o plano do dia é “congelado” no início da sessão.
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
| **Services** | Regras de negócio e validação (ex.: não iniciar treino sem exercícios, duplicação transacional). |
| **Repositories** | Único ponto que executa SQL, sempre com consultas parametrizadas. |

```
src/
├── app/                  # Rotas (Expo Router)
│   ├── (tabs)/           # Abas: Treinos, Histórico e Estatísticas
│   ├── workout/[id].tsx  # Detalhes do treino e exercícios
│   ├── session/          # Execução do treino e resumo
│   ├── history/[id].tsx  # Detalhes de uma sessão concluída
│   └── exercise-progress.tsx
├── components/           # Componentes reutilizáveis (ui/ e charts/)
├── database/             # Conexão SQLite, transações e migrations
├── features/
│   ├── workouts/         # Treinos
│   ├── exercises/        # Exercícios planejados
│   ├── sessions/         # Execução, séries e cronômetro
│   └── history/          # Histórico, estatísticas e evolução
│       └── (components | hooks | services | repositories | types | utils)
├── hooks/                # Hooks compartilhados
├── theme/                # Cores, espaçamentos e tipografia
└── utils/                # Formatação de números, datas e tempo
test/                     # Infraestrutura dos testes (mocks e helpers)
```

## Banco de dados e persistência

Os dados ficam em um banco **SQLite local** (`gym-notes.db`), aberto uma única vez na inicialização do app.

- **Migrations versionadas** com `PRAGMA user_version`: cada migration roda em transação junto com a troca de
  versão (é aplicada por completo ou não muda nada). O banco nunca é apagado ou recriado em atualizações.
- **Chaves estrangeiras ativas** e verificadas na abertura; `CHECK`s no banco reforçam as validações.
- **Planejamento e execução separados:** o que você planeja (`workouts`, `exercises`) fica separado do que você
  realmente fez (`workout_sessions`, `session_exercises`, `set_logs`). Ao iniciar um treino, nomes e valores
  planejados são copiados para a sessão — editar ou excluir um treino depois **não altera o histórico**.
- **Transações** nas operações com vários registros (iniciar sessão, duplicar treino, reordenar exercícios).

| Tabela | Conteúdo |
| --- | --- |
| `workouts` | Treinos |
| `exercises` | Exercícios planejados de cada treino |
| `workout_sessions` | Execuções de um treino (em andamento ou concluídas) |
| `session_exercises` | Exercícios de cada execução |
| `set_logs` | Séries: planejado e realizado |

## Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org) 22.13 ou superior (recomendado: 24 LTS — os testes usam o módulo `node:sqlite`)
- npm
- Um celular Android com o app [Expo Go](https://expo.dev/go) compatível com o SDK 57, ou um emulador Android

### Instalação

```bash
git clone https://github.com/<seu-usuario>/gym-notes.git
cd gym-notes
npm install
```

### Rodando no Android com Expo Go

```bash
npx expo start
```

1. Abra o **Expo Go** no celular (na mesma rede Wi-Fi do computador).
2. Escaneie o QR Code exibido no terminal.
3. O app abre com três treinos de exemplo (Treino A, B e C), que podem ser editados ou excluídos.

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

Os testes cobrem as regras de negócio e o acesso a dados: inicialização e migrations do banco, CRUD de treinos e
exercícios, duplicação, reordenação, execução e recuperação de sessões, cronômetro, histórico, estatísticas e
evolução de cargas.

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

## Roadmap

Ideias em avaliação para as próximas versões (ainda **não** implementadas):

- Exportação e importação de dados (backup).
- Publicação na Google Play.

## Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](LICENSE).

---

<p align="center">Desenvolvido por <strong>Matheus Cristo</strong>.</p>
