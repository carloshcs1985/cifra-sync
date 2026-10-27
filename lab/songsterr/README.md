# Laboratório Songsterr — experimental

Página independente para validar um leitor simples de tablatura e acompanhamento estimado por compasso. Nenhum arquivo da aplicação principal é substituído. Não importa módulos do Cifra Sync, não registra service worker, não usa IndexedDB/localStorage e não modifica a biblioteca pessoal. O service worker já instalado no site pode intermediar arquivos estáticos deste caminho; ele não é alterado pelo laboratório.

## Testar

1. Abra `lab/songsterr/` no endereço publicado.
2. Toque em **Carregar do Songsterr**. A amostra fixa é a guitarra principal de Smells Like Teen Spirit, revisão 9984500. O repositório não contém a transcrição; o leitor consulta a fonte somente sob ação do usuário, sem cookies ou credenciais do Spotify.
3. Para acompanhar Spotify, cadastre a URL adicional exibida na página em Redirect URIs do mesmo aplicativo no Spotify Developer. Não remova a URL principal. Cole o Client ID e conecte a sua conta autorizada. Não é necessário Client Secret.
4. Toque a gravação de estúdio correspondente e indique o início de um compasso. A segunda marcação ajusta a velocidade média. O destaque é estimado, não sincronizado por nota.
5. Desconectar afeta somente este teste. Marcas e token de acesso ficam em memória e são perdidos ao recarregar; apenas o estado temporário de autorização PKCE usa uma chave própria de sessionStorage (`cifrasync.songsterr-lab.pkce`), removida ao concluir/cancelar.

O teste somente lê o estado do Spotify e não controla sua reprodução. A identificação exige Nirvana e o título correspondente; versões ao vivo/acústicas não são aceitas automaticamente. Não há vídeo, som próprio, exportação, download ou cópia persistente da tablatura, pesquisa geral ou fallback integrado. Um arquivo acessível e CORS liberado não equivalem a uma API suportada ou licença de reutilização. Reavaliar estabilidade e condições da fonte antes de integrar à aplicação principal.

Leitor experimental: vozes separadas, corda/casa, notas abafadas/fantasma/ligadas e pausas. Não é uma transcrição gráfica completa: repetições, ornamentos e mudanças de andamento não são interpretados. Cordas numeradas de 1 (aguda, topo) até 6 (grave, base), em guitarra de seis cordas.

Validação em navegador: fonte simulada original para exibição, duas marcas, pausa, artista incompatível, desconexão, preservação de chaves do aplicativo principal, ausência de banco/service worker próprio e ausência de credenciais nas requisições da fonte. Verificação da fonte pública real registrada na execução do teste, sem redistribuir o conteúdo.
