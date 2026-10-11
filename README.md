# Money Calculator — aplicação para contar dinheiro por turma

Aplicação gratuita e sem dependências. Abre no browser e pode ser instalada no ecrã principal como PWA. Inclui cinco turmas iniciais, criação/renomeação de turmas, contagem por denominação, totais, correções, desfazer, resumo geral e cópias de segurança.

## Instalar via GitHub Pages (sem terminal)

1. Cria um **novo repositório público** no GitHub, por exemplo `money-calculator`. Usa um repositório separado do teu site atual para não misturar ficheiros.
2. Descompacta `money-calculator.zip`. Entra na pasta `money-calculator` e carrega **os conteúdos da pasta**, incluindo a pasta `icons` e os ficheiros `index.html`, `app.js`, `state.js`, `styles.css`, `sw.js` e `manifest.webmanifest`, para a raiz do repositório. O `index.html` deve ficar mesmo na raiz.
3. No repositório, entra em **Settings → Pages**. Em **Build and deployment**, seleciona **Deploy from a branch**, escolhe **main** e **/(root)** e guarda.
4. Abre no telemóvel `https://TEU-UTILIZADOR.github.io/money-calculator/` (substitui o teu nome e o nome do repositório). O link exato aparece na secção Pages do GitHub.
5. **iPhone:** abre no **Safari**, toca no botão **Partilhar** e em **Adicionar ao ecrã principal**; se surgir a opção, ativa **Abrir como aplicação**. **Android:** abre no **Chrome**, toca em **⋮** e em **Instalar aplicação** ou **Adicionar ao ecrã principal**.
6. Abre a app instalada **uma vez com internet** para o navegador guardar todos os ficheiros para utilização offline. Depois, podes usá-la sem internet.

> GitHub Pages serve os ficheiros através de HTTPS e gratuitamente em repositórios públicos. O código da app é público, mas as tuas contagens não são enviadas para o GitHub: ficam guardadas no browser/app do teu telemóvel.

## Utilização

- Toca num botão de moeda ou nota por cada unidade encontrada. O botão afunda/ilumina-se; a última tecla fica destacada.
- No canto superior esquerdo, toca em **Turma 1 ▾** para escolher outra turma, adicionar uma turma ou alterar o nome pelo ícone **✎**.
- Toca numa quantidade do painel **Moedas/Notas** para corrigir essa quantidade diretamente.
- Usa **Desfazer** para reverter a última alteração da turma atual; **Limpar turma** pede confirmação e pode ser desfeito de seguida.
- **Resumo geral** agrega todas as turmas e permite copiar as quantidades.
- No menu de turmas, utiliza **Exportar cópia de segurança** para guardar um ficheiro JSON e **Importar cópia de segurança** para repor todos os dados. Importar substitui as contagens existentes após confirmação.

## Segurança dos dados — importante

Cada alteração é gravada em `localStorage` **antes** de aparecer no ecrã. Se o armazenamento falhar, a alteração é recusada e surge um aviso. As contagens costumam sobreviver ao fecho/reabertura da app e ao reinício do telemóvel, mas **nenhum armazenamento local é infalível**: limpar dados do browser, desinstalar a app ou limitações do sistema podem eliminar as contagens. **Exporta regularmente uma cópia JSON**, idealmente depois de cada dia ou sessão de trabalho. A app não faz sincronização entre dispositivos ou browsers.

A aplicação tem um *service worker* que guarda os ficheiros necessários para funcionar offline. Em alguns dispositivos, o sistema operativo pode encerrar a app em segundo plano; ao reabrir, a contagem persistida é carregada de novo. O sistema operativo também pode eliminar caches sob pressão de armazenamento, pelo que convém confirmar o funcionamento offline depois de instalar.

Se publicares uma nova versão dos ficheiros, muda a constante `CACHE_NAME` de `sw.js` (por exemplo para `money-calculator-static-v2`) para atualizar a cache dos ficheiros da app, sem afetar os valores contados.

## Testes automáticos

É necessário Node.js apenas para executar os testes, **não para usar ou publicar a app**:

```bash
node --test tests/state.test.mjs
```

## Ficheiros

- `index.html` — estrutura da interface
- `styles.css` — design e feedback visual das teclas
- `app.js` — interações, armazenamento, turmas e backups
- `state.js` — cálculos exatos em cêntimos e validação dos dados
- `manifest.webmanifest` e `sw.js` — instalação e funcionamento offline
- `icons/` — ícones para iPhone e Android
- `tests/` — testes de lógica de contagem
Money Calculator v1.0
