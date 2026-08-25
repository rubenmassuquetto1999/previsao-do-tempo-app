# 🌤️ Clima & Look | Previsão do Tempo & Consultor de Vestuário

Uma aplicação Full-Stack desenvolvida para consultar o clima em tempo real com alta precisão meteorológica e recomendações dinâmicas de roupas e acessórios ideais para o dia, com animação atmosférica interativa a 60 FPS e suporte a temas Claro e Escuro.

---

## 🚀 Funcionalidades

- **Previsão em Tempo Real:** Dados meteorológicos de alta precisão com sensação térmica, umidade, vento, pressão, probabilidade de chuva e índice UV.
- **Animação Atmosférica Dinâmica (Estilo iOS Weather):** Motor gráfico a 60 FPS que simula no cartão do tempo condições reais (sol com raios volumétricos, noites estreladas com lua, nuvens em camadas flutuantes, chuva com respingos, tempestades com relâmpagos e neblina).
- **Consultoria de Vestuário Sob Medida:** Recomendações estruturadas de look para o momento atual e para a variação térmica do dia todo, incluindo sugestões de calçados e acessórios de proteção (chuva, sol e vento).
- **Previsão Horária e Estendida:** Carrossel horário para as próximas 24 horas e grade estendida para os próximos 5 dias.
- **Geolocalização Automática (GPS):** Detecção rápida com formatação exata da cidade e estado (ex: `Localização Atual - Curitiba/PR`).
- **Comandos de Voz:** Acessibilidade com suporte a ditado por voz via Web Speech API.
- **Design Responsivo & Temas:** Alternância fluida entre **Modo Claro** (com cores vivas e alto contraste) e **Modo Escuro**, responsivo para mobile, tablets e desktops.

---

## 🛠️ Tecnologias Utilizadas

### Front-End
- HTML5 Semântico
- CSS3 Moderno (Variáveis CSS, Backdrop Blur, Flexbox & CSS Grid)
- JavaScript Vanilla (ES6+, Async/Await)
- HTML5 Canvas & 2D Context (Engine de partículas atmosféricas)

### Back-End & Infraestrutura
- Node.js & Express
- Cors & Dotenv
- Proxy seguro de APIs meteorológicas com geocodificação reversa integrada

### Serviços Meteorológicos
- [Open-Meteo API](https://open-meteo.com/) (Previsão precisa sem limites rígidos e histórico detalhado)
- [OpenWeatherMap API](https://openweathermap.org/) (Camada complementar e geolocalização)

---

## ⚙️ Como Rodar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)

### Instalação

1. Clone este repositório:
   ```bash
   git clone https://github.com/SEU-USUARIO/previsao-do-tempo-app.git
   ```

2. Acesse a pasta do projeto:
   ```bash
   cd previsao-do-tempo-app
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

4. Inicie o servidor:
   ```bash
   npm start
   ```

5. Abra no navegador:
   ```text
   http://localhost:3000
   ```
