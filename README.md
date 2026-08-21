# 🌤️ Clima & Look IA | Previsão do Tempo Inteligente

Uma aplicação Full-Stack desenvolvida para consultar o clima em tempo real e gerar sugestões personalizadas de roupas utilizando Inteligência Artificial, adaptando-se perfeitamente às condições climáticas da cidade pesquisada.

## 🌐 Demonstração Online
O projeto está no ar e pronto para uso! 
🔗 **Acesse aqui:** [https://previsao-do-tempo-app.onrender.com](https://previsao-do-tempo-app.onrender.com)

---

## 🚀 Funcionalidades
- **Previsão em Tempo Real:** Busca dados climáticos exatos (temperatura, umidade e ícones visuais) de qualquer cidade do mundo.
- **Consultoria de Moda via IA:** Integração com o modelo Llama 3 (via Groq) para sugerir o look ideal em textos curtos e diretos, com base no clima daquele exato momento.
- **Comandos de Voz:** Acessibilidade garantida com a integração da Web Speech API, permitindo que o usuário dite o nome da cidade através do microfone.
- **Pesquisa Ágil:** Disparo de requisições tanto por clique nos botões quanto pela tecla "Enter".
- **Design Responsivo:** Interface construída com Flexbox moderno, garantindo uma experiência visual impecável em smartphones (incluindo iOS/Safari), tablets e desktops.
- **Segurança de Credenciais:** Arquitetura Back-end em Node.js que consome e protege as chaves das APIs de terceiros.

---

## 🛠️ Tecnologias Utilizadas

### Front-End
- HTML5 Clássico e Semântico
- CSS3 (Flexbox & Media Queries para responsividade total)
- JavaScript (ES6+, Vanilla JS com uso de Async/Await)

### Back-End & Infraestrutura
- Node.js
- Express (Criação de rotas da API local)
- Cors (Controle de acesso)
- Dotenv (Gerenciamento de variáveis de ambiente)
- Render (Deploy e Hospedagem em nuvem)

### APIs de Terceiros
- [OpenWeatherMap API](https://openweathermap.org/) (Geolocalização e Clima)
- [Groq API](https://groq.com/) (LLM de Inteligência Artificial)

---

## ⚙️ Como Rodar o Projeto Localmente

Caso queira clonar o repositório e rodar a aplicação na sua própria máquina, siga os passos abaixo.

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado.
- Chaves de API ativas no OpenWeatherMap e no Groq.

### Instalação

1. Clone este repositório:
   ```bash
   git clone [https://github.com/SEU-USUARIO/previsao-do-tempo-app.git](https://github.com/SEU-USUARIO/previsao-do-tempo-app.git)
