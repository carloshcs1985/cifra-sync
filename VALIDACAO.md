# Validação da versão 8

- Treze testes Node aprovados: `node --test tests/*.test.cjs`.
- Regressões das versões 6 e 7 aprovadas em Chromium com reprodução simulada.
- Importação automática de uma cifra HTML original de teste: posições dos acordes, letra inteira, transposição de tom menor, leitura após reabrir e ausência de nova consulta aprovadas.
- Validação rejeitou outro artista, outro título, versão ao vivo incompatível e URLs fora da origem permitida.
- Script contido na página de teste permaneceu inerte; autorização do Spotify e cookies não foram enviados à consulta.
- Consulta real de What's My Age Again? ao Cifra Club via Jina Reader, em Chromium com Spotify simulado: 58 linhas com letra e acordes renderizadas; zero linhas exigindo rolagem horizontal no viewport de 390 px; quadro vazio removido; cópia salva reutilizada após reabrir.
- Extração dos HTMLs reais de Don't Speak e Scar Tissue: respectivamente 46 e 43 linhas com acordes sobre a letra; metadados conferidos pelo parser.
- Comparação com uma resposta real do LRCLIB para essa música: 40 linhas com tempos; 41 das 58 linhas da cifra tiveram correspondência de frase. A frase do instante de 21 segundos encontrou uma linha da cifra. As demais linhas continuam visíveis, sem receber tempos inventados.
- Nenhuma exceção de página nos fluxos aprovados. Não foi operada a conta real do Spotify nem o iPhone.

A sincronização fina de cada acorde ainda depende de tempos por ocorrência. A consulta online não equivale a uma cifra já cronometrada. A disponibilidade dos serviços foi conferida durante os testes e pode variar.

## Validações anteriores

# Validação da versão 7

Testes adicionais em Chromium com Spotify e LRCLIB simulados e frases originais:

- Leitura conjunta da letra completa sem inventar tempos de acordes.
- Reconhecimento de Scar Tissue e Smells Like Teen Spirit por artista/título em outro ID de álbum. Ambas são guias harmônicos simplificados, não cifras integrais.
- Registro de trocas durante reprodução; rejeição durante pausa; seleção de ocorrências e desfazer.
- Colunas de acordes importadas preservadas; várias trocas por frase; limites de tempo e busca para trás.
- Transposição preserva tempos; backup pessoal e reabertura preservam marcações.
- Outro ID de gravação desativa o uso dos tempos da gravação anterior.
- Nenhuma exceção de página nos fluxos aprovados.
- Dez testes Node aprovados: `node --test tests/*.test.cjs`.

A conta real do usuário e o iPhone não foram operados. Não foi obtida uma fonte que sincronize automaticamente todas as cifras do catálogo. Sem tempos de troca, o leitor informa essa ausência.

## Validação anterior da versão 6


Em 26/10/2026 foram realizados testes locais em Chromium headless. Os testes de reprodução usam respostas simuladas do Spotify e frases originais de teste; não incluem letras comerciais. A conta real do usuário e o iPhone não foram operados.

## Fluxos aprovados

- migration: original personal song and anchor preserved in IndexedDB; bulk removed from localStorage.
- automaticTrackAndLyrics: passed with synthetic Spotify and original test lyrics.
- chordBar: barra automática de diagramas visível durante o estudo, aprovada.
- diagramsAndModes: passed: four chords, variants, click from sheet and timed lyric line.
- txtImport: passed.
- gzipWorkerImport: passed.
- zipImport: passed, auxiliary JSON ignored.
- lrcImport: passed, overrides external cache.
- personalOverride: passed, catalogue reimport preserves user transposition.
- pinnedLibraryLyrics: passed, lyrics follow selected library song and return to active track.
- personalBackup: passed, user-edited catalogue charts included, bulk and tokens excluded.
- Barra de diagramas e recursos de fila de letras da versão 5 incorporados à versão 6.
- Quatro testes automatizados de LRC, correspondência de gravação, harmonia/baixo nos diagramas e importação ChordPro: aprovados. Execute `node --test tests/study.test.cjs`.

## Teste de volume e offline

- Importação efetiva de **430,324 registros**, em worker.
- Tela permaneceu responsiva durante a importação.
- Biblioteca paginada limita a apresentação a 100 resultados.
- Busca de “My Sacrifice” localizou o guia de acompanhamento.
- Reabertura offline, busca local e diagramas: aprovados.
- No ambiente de teste, a execução completa levou cerca de 67 segundos e o IndexedDB ocupou aproximadamente 525 MiB. Esses valores não são uma previsão de desempenho do iPhone.
- O localStorage continha apenas 148 caracteres de configurações/fila, sem a base grande.
- Nenhuma exceção de página nos fluxos aprovados.

## Escopo

O teste de volume validou o importador, os índices, a continuidade da interface e o funcionamento offline. Os ajustes finais de interface e preservação das edições foram conferidos nos testes funcionais posteriores. As transcrições de terceiros não foram revisadas musicalmente uma a uma. O guia de My Sacrifice é simplificado, sem o riff original e sem tempos artificiais de acordes. A disponibilidade das letras varia por faixa/serviço e deve ser conferida no uso real.
