# Fila do RU — protótipo do Desafio ENG200 (UFMG)

Protótipo de um app colaborativo para acabar com a surpresa na fila dos restaurantes universitários da UFMG. Quem está no RU informa como está a fila (pequena, média ou grande); o app combina os relatos recentes e mostra a espera estimada em cada restaurante e qual deles tem menos fila agora.

Projeto da disciplina ENG200 – Introdução à Engenharia (2025). O grupo ficou em **primeiro lugar** na resolução do case.

**[Abrir o protótipo](https://matheus-telles.github.io/eng200demo/)** · [MVP original](https://matheus-telles.github.io/eng200demo/v1/)

## Como funciona

- **Relatos da comunidade:** cada relato vale mais quanto mais recente (o peso cai pela metade a cada 10 minutos) e só os últimos 30 minutos entram na conta. Com menos de 3 relatos, o app avisa que a estimativa é incerta.
- **Um relato por pessoa:** enviar de novo substitui o seu relato anterior para aquele restaurante, em vez de somar.
- **Recomendação:** destaca o restaurante aberto com a menor espera estimada.
- **Movimento típico:** gráfico da fila ao longo do almoço ou jantar, em blocos de 15 minutos, com o melhor horário indicado.
- **Simulação de horário:** fora do horário de funcionamento, a página mostra uma simulação do almoço; dá para escolher outros horários no topo.

Os relatos da comunidade e os horários são simulados (de forma determinística, para a página ficar estável). Os relatos que você envia ficam salvos só no seu navegador (`localStorage`).

## Tecnologias

HTML, CSS e JavaScript puro, sem dependências nem etapa de build. Publicado com GitHub Pages.
