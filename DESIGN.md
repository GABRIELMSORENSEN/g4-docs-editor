---
version: alpha
name: "G4 Docs Editor"
description: "Identidade G4T0XX em preto grafite e vermelho, com operação local explícita."
colors:
  background: "#0d0b0d"
  surface: "#161316"
  primary: "#be123c"
  foreground: "#fff7fa"
  muted: "#d2c3c9"
typography:
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
  mono:
    fontFamily: "Consolas, monospace"
rounded:
  DEFAULT: "0.5rem"
spacing:
  section-gap: "2rem"
components:
  button: {}
  dialog: {}
---

# G4 Docs Editor

## Overview

Identidade aprovada no pedido de modernização G4T0XX: preto e vermelho. Referência: painel de ferramentas do próprio desenvolvedor, com informações verificáveis e ações explícitas. Registro: product. Público de língua portuguesa, uso pessoal em Windows/Android e VR conforme o produto. Interface pt-BR; datas no horário local do dispositivo. Não inferir escopo de mercado japonês pela tradução de conteúdo.

Os valores canônicos vivem em `src/index.css`. Este documento espelha o sistema de cores; os consumidores ficam em `src/App.tsx`. Atualizar documento e tokens juntos. Preto forma a base, vermelho identifica ações e seleção. Sucesso e erro também recebem rótulos, sem depender só da cor.

## Colors

Fundos, superfícies e texto usam os valores acima. Anéis de foco e estados ativos permanecem visíveis. A cor de marca não substitui o significado de ações destrutivas. Documentos PDF conservam papel branco e cores do conteúdo. Nenhuma troca global de cor deve modificar os pixels do documento.

## Typography

Família principal indicada acima, com fallback do sistema. Hierarquia por tamanho e peso. Texto técnico usa monoespaçada apenas onde facilita leitura de caminhos, identificadores e protocolos. Sem percentuais de habilidade inventados nem números que sugiram validações inexistentes.

## Layout

Ferramentas priorizam controles e estado; o portfólio prioriza apresentação e acesso a projetos. Grades densas e listas com fluxo contínuo. Reduzir colunas em telas estreitas; permitir rolagem de conteúdo e de tabelas. Nenhum formulário deve esconder seus botões fora da área alcançável.

## Elevation & Depth

Superfícies tonais e bordas discretas. Sobreposição só para diálogos e avisos. O papel do PDF não recebe a cor da superfície do aplicativo.

## Shapes

Controles com cantos moderados. Dimensões estáveis durante processamento; botões desabilitados conservam geometria e perdem aparência acionável.

## Components

Botões indicam ação, têm foco visível e feedback de execução. Busca tem limpeza explícita. Campos têm rótulos e erros textuais. Diálogos guardam ações de descarte, revogação ou alteração de arquivos e devolvem foco ao controle de origem. Seletores nativos são deliberadamente aceitos quando o sistema operacional é dono do popup. Em aplicações nativas, os controles e diálogos pertencem à plataforma.

Motion confirma navegação e estado. Preferência por movimento reduzido desliga transições decorativas. No portfólio, Motion e GSAP compartilham essa preferência. Nos produtos, nenhuma informação depende de animação.

## Do's and Don'ts

- Mostrar a diferença entre solicitado, entregue e confirmado.
- Preservar entradas e trabalho após falha; oferecer recuperação explícita.
- Usar dados reais e identificar recursos experimentais.
- Não publicar segredos, configurações de compradores nem credenciais de servidores.
- Não chamar cobertura visual de PDF de remoção segura de conteúdo.
