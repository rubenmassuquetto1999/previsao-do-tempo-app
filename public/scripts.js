// Global state
let currentWeatherData = null;
let isListeningVoice = false;
let recognitionInstance = null;

// Helper to sanitize HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Theme Management (Automatic OS Detection + Manual Toggle with Persistence)
function obterTemaAtual() {
    const dataTheme = document.documentElement.getAttribute('data-theme');
    if (dataTheme) return dataTheme;
    const prefereEscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefereEscuro ? 'dark' : 'light';
}

function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        const titleText = tema === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro';
        themeBtn.setAttribute('title', titleText);
        themeBtn.setAttribute('aria-label', titleText);
    }
}

function alternarTema() {
    const temaAtual = obterTemaAtual();
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
    try {
        localStorage.setItem('weather_theme_pref', novoTema);
    } catch(e) {}
    aplicarTema(novoTema);
}

function inicializarTema() {
    let temaAtivo = 'dark';
    try {
        const salvo = localStorage.getItem('weather_theme_pref');
        if (salvo === 'dark' || salvo === 'light') {
            temaAtivo = salvo;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            temaAtivo = 'light';
        }
    } catch(e) {}

    aplicarTema(temaAtivo);

    // Watch OS theme change if user has not explicitly set a preference
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const salvo = localStorage.getItem('weather_theme_pref');
            if (!salvo) {
                aplicarTema(e.matches ? 'dark' : 'light');
            }
        });
    }
}

// Show/Hide UI States
function showState(stateName) {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const weatherDashboard = document.getElementById('weatherDashboard');
    const appContainer = document.getElementById('appContainer');

    if (loadingState) loadingState.style.display = (stateName === 'loading') ? 'block' : 'none';
    if (errorState) errorState.style.display = (stateName === 'error') ? 'block' : 'none';
    if (weatherDashboard) {
        weatherDashboard.style.display = (stateName === 'dashboard') ? 'flex' : 'none';
        if (stateName === 'dashboard' && window.WeatherAtmosphere) {
            requestAnimationFrame(() => {
                window.WeatherAtmosphere.resize();
            });
        }
    }

    const isShowingData = (stateName === 'dashboard' || stateName === 'loading' || stateName === 'error');
    if (appContainer) {
        if (isShowingData) {
            appContainer.classList.add('has-results');
        } else {
            appContainer.classList.remove('has-results');
        }
    }
    if (document.body) {
        if (isShowingData) {
            document.body.classList.add('has-results');
        } else {
            document.body.classList.remove('has-results');
        }
    }
}

// Main Search Trigger
async function cliqueiNoBotao() {
    const inputCidade = document.getElementById('inputCidade');
    const cidade = inputCidade ? inputCidade.value.trim() : '';

    if (!cidade) {
        focarBusca();
        return;
    }

    await carregarPrevisaoPorCidade(cidade);
}

// Quick City Selection
function selecionarCidadeRapida(nomeCidade) {
    const inputCidade = document.getElementById('inputCidade');
    if (inputCidade) {
        inputCidade.value = nomeCidade;
        atualizarBotaoLimpar();
    }
    carregarPrevisaoPorCidade(nomeCidade);
}

// Clear Search Input
function limparBusca() {
    const inputCidade = document.getElementById('inputCidade');
    if (inputCidade) {
        inputCidade.value = '';
        atualizarBotaoLimpar();
        inputCidade.focus();
    }
}

function focarBusca() {
    const inputCidade = document.getElementById('inputCidade');
    if (inputCidade) inputCidade.focus();
}

function atualizarBotaoLimpar() {
    const inputCidade = document.getElementById('inputCidade');
    const btnClear = document.getElementById('btnClear');
    if (inputCidade && btnClear) {
        btnClear.style.display = inputCidade.value.length > 0 ? 'flex' : 'none';
    }
}

// Geolocation Search
async function buscarPorLocalizacao() {
    if (!navigator.geolocation) {
        alert("A geolocalização não é suportada pelo seu navegador.");
        return;
    }

    showState('loading');
    const loadingTitle = document.querySelector('#loadingState .loading-title');
    if (loadingTitle) loadingTitle.textContent = "Obtendo sua localização...";

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                // Direct reverse-geocoding & weather retrieval with coordinates
                const res = await fetch(`/api/clima?lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                if (data.cod === 200) {
                    renderizarDashboard(data);
                    const inputCidade = document.getElementById('inputCidade');
                    if (inputCidade) {
                        inputCidade.value = data.location.fullName || data.location.name;
                    }
                    atualizarBotaoLimpar();
                } else {
                    mostrarErro(data.message || "Não foi possível carregar o clima de sua localização.");
                }
            } catch (err) {
                console.error("Erro geo:", err);
                mostrarErro("Erro ao consultar a localização.");
            }
        },
        (error) => {
            console.warn("Erro ao obter GPS:", error);
            mostrarErro("Não foi possível acessar a localização. Por favor, digite o nome da cidade.");
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

// Voice Recognition Handler
function detectaVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btnMic = document.getElementById('btnMic');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceText = document.getElementById('voiceText');
    const inputCidade = document.getElementById('inputCidade');

    if (!SpeechRecognition) {
        alert("O reconhecimento de voz não é suportado pelo seu navegador atual. Use o Google Chrome ou Edge para falar.");
        return;
    }

    if (isListeningVoice) {
        if (recognitionInstance) recognitionInstance.stop();
        return;
    }

    try {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = "pt-BR";
        recognitionInstance.interimResults = false;
        recognitionInstance.maxAlternatives = 1;

        recognitionInstance.onstart = function () {
            isListeningVoice = true;
            if (btnMic) btnMic.classList.add('listening');
            if (voiceStatus) voiceStatus.style.display = 'flex';
            if (voiceText) voiceText.textContent = "Ouvindo sua voz... Fale a cidade";
            if (inputCidade) inputCidade.placeholder = "Ouvindo...";
        };

        recognitionInstance.onresult = function (event) {
            const transcript = event.results[0][0].transcript.trim();
            if (inputCidade) {
                // Remove final period if speech engine added one
                const cleanText = transcript.replace(/\.$/, '');
                inputCidade.value = cleanText;
                atualizarBotaoLimpar();
            }
            if (voiceText) voiceText.textContent = `Identificado: "${transcript}" - Buscando...`;
            setTimeout(() => {
                cliqueiNoBotao();
            }, 400);
        };

        recognitionInstance.onerror = function (event) {
            console.warn("Erro de voz:", event.error);
            if (voiceText) voiceText.textContent = "Não foi possível reconhecer o áudio. Tente novamente.";
            setTimeout(() => {
                finalizarVoz();
            }, 2000);
        };

        recognitionInstance.onend = function () {
            finalizarVoz();
        };

        recognitionInstance.start();

    } catch (e) {
        console.error("Erro ao iniciar reconhecimento de voz:", e);
        finalizarVoz();
    }
}

function finalizarVoz() {
    isListeningVoice = false;
    const btnMic = document.getElementById('btnMic');
    const voiceStatus = document.getElementById('voiceStatus');
    const inputCidade = document.getElementById('inputCidade');

    if (btnMic) btnMic.classList.remove('listening');
    if (voiceStatus) voiceStatus.style.display = 'none';
    if (inputCidade) inputCidade.placeholder = "Digite o nome de uma cidade (ex: Curitiba, São Paulo, Lisboa...)";
}

// Fetch Weather & Outfits
async function carregarPrevisaoPorCidade(cidade) {
    showState('loading');
    const loadingTitle = document.querySelector('#loadingState .loading-title');
    if (loadingTitle) loadingTitle.textContent = `Buscando clima de ${cidade}...`;

    try {
        const resposta = await fetch(`/api/clima?cidade=${encodeURIComponent(cidade)}`);
        const dados = await resposta.json();

        if (dados.cod !== 200) {
            mostrarErro(dados.message || `Não encontramos a cidade "${cidade}". Verifique a ortografia.`);
            return;
        }

        renderizarDashboard(dados);

    } catch (error) {
        console.error("Erro ao buscar previsão:", error);
        mostrarErro("Falha na comunicação com o servidor. Tente novamente em instantes.");
    }
}

function mostrarErro(mensagem) {
    showState('error');
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) errorMessage.textContent = mensagem;
}

// Render Weather & Request AI suggestions
async function renderizarDashboard(dados) {
    currentWeatherData = dados;
    showState('dashboard');

    // 1. Fill Hero Current Weather Card
    const cityName = document.getElementById('cityName');
    const updateTime = document.getElementById('updateTime');
    const heroWeatherImg = document.getElementById('heroWeatherImg');
    const currentTemp = document.getElementById('currentTemp');
    const weatherDesc = document.getElementById('weatherDesc');
    const todayMax = document.getElementById('todayMax');
    const todayMin = document.getElementById('todayMin');
    const feelsLike = document.getElementById('feelsLike');
    
    const metricHumidity = document.getElementById('metricHumidity');
    const metricRain = document.getElementById('metricRain');
    const metricWind = document.getElementById('metricWind');
    const metricUv = document.getElementById('metricUv');

    if (cityName) cityName.textContent = dados.location.fullName || dados.location.name;
    if (updateTime) {
        const now = new Date();
        updateTime.textContent = `Atualizado às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    if (heroWeatherImg) {
        const iconCode = dados.current.icon || '02d';
        heroWeatherImg.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
        heroWeatherImg.alt = dados.current.description;
    }

    if (currentTemp) currentTemp.textContent = dados.current.temp;
    if (weatherDesc) weatherDesc.textContent = dados.current.description;
    if (todayMax) todayMax.textContent = `${dados.today.temp_max}°C`;
    if (todayMin) todayMin.textContent = `${dados.today.temp_min}°C`;
    if (feelsLike) feelsLike.textContent = `${dados.current.feels_like}°C`;

    if (metricHumidity) metricHumidity.textContent = `${dados.current.humidity}%`;
    if (metricRain) metricRain.textContent = `${dados.today.rain_chance_max}%`;
    if (metricWind) metricWind.textContent = `${dados.current.wind_speed} km/h`;
    
    if (metricUv) {
        const uv = dados.today.uv_index_max;
        if (uv !== null && uv !== undefined) {
            let uvLabel = 'Baixo';
            if (uv >= 3 && uv <= 5) uvLabel = 'Moderado';
            else if (uv >= 6 && uv <= 7) uvLabel = 'Alto';
            else if (uv >= 8 && uv <= 10) uvLabel = 'Muito Alto';
            else if (uv >= 11) uvLabel = 'Extremo';
            metricUv.textContent = `${Math.round(uv)} (${uvLabel})`;
        } else {
            metricUv.textContent = 'Normal';
        }
    }

    // 2. Render Hourly Forecast Slider
    renderizarPrevisaoHoraria(dados.today.hourly);

    // 3. Render 5-Day Forecast Grid
    renderizar5Dias(dados.forecast5Days);

    // 4. Update Dynamic iOS Atmospheric Weather Animations
    if (window.WeatherAtmosphere) {
        window.WeatherAtmosphere.setWeather(
            dados.current.category || dados.current.weather_code,
            dados.current.is_day,
            dados.current.category
        );
    }

    // 5. Request and render Clothing Recommendations
    await carregarSugestaoRoupas();
}

// Hourly Slider Renderer
function renderizarPrevisaoHoraria(hourlyList) {
    const hourlySlider = document.getElementById('hourlySlider');
    if (!hourlySlider) return;

    if (!hourlyList || hourlyList.length === 0) {
        hourlySlider.innerHTML = `<p style="color: var(--text-muted); padding: 12px;">Sem dados horários no momento.</p>`;
        return;
    }

    hourlySlider.innerHTML = hourlyList.map(item => `
        <div class="hourly-item">
            <span class="hourly-time">${escapeHtml(item.time)}</span>
            <img class="hourly-icon" src="https://openweathermap.org/img/wn/${item.icon}.png" alt="${escapeHtml(item.description)}" title="${escapeHtml(item.description)}">
            <span class="hourly-temp">${item.temp}°C</span>
            <span class="hourly-rain" title="Chance de chuva">💧 ${item.rain_chance}%</span>
        </div>
    `).join('');
}

// 5-Day Forecast Grid Renderer
function renderizar5Dias(fiveDaysList) {
    const fiveDaysGrid = document.getElementById('fiveDaysGrid');
    if (!fiveDaysGrid) return;

    if (!fiveDaysList || fiveDaysList.length === 0) {
        fiveDaysGrid.innerHTML = `<p style="color: var(--text-muted); padding: 12px;">Sem previsão para os próximos dias disponível.</p>`;
        return;
    }

    fiveDaysGrid.innerHTML = fiveDaysList.map(day => `
        <div class="day-card">
            <div class="day-date-group">
                <h4 class="day-name">${escapeHtml(day.dayOfWeek)}</h4>
                <p class="day-date">${escapeHtml(day.dateFormatted)}</p>
            </div>
            
            <div class="day-icon-wrap">
                <img class="day-icon" src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${escapeHtml(day.description)}" loading="lazy">
            </div>
            
            <div class="day-condition-group">
                <span class="day-desc">${escapeHtml(day.description)}</span>
                <span class="day-rain-badge" title="Chance de chuva">💧 ${day.rain_chance}%</span>
            </div>

            <div class="day-temp-bar">
                <span class="day-min" title="Mínima">▼ ${day.temp_min}°C</span>
                <span class="day-max" title="Máxima">▲ ${day.temp_max}°C</span>
            </div>
        </div>
    `).join('');
}

// Clothing Request & Display
async function carregarSugestaoRoupas() {
    if (!currentWeatherData) return;

    const outfitNowSummary = document.getElementById('outfitNowSummary');
    const outfitNowItems = document.getElementById('outfitNowItems');
    const outfitNowTip = document.getElementById('outfitNowTip');
    const outfitNowEmoji = document.getElementById('outfitNowEmoji');

    const outfitDaySummary = document.getElementById('outfitDaySummary');
    const outfitDayVariation = document.getElementById('outfitDayVariation');
    const outfitDayItems = document.getElementById('outfitDayItems');
    const outfitDayTags = document.getElementById('outfitDayTags');
    const outfitDayAlert = document.getElementById('outfitDayAlert');

    if (outfitNowSummary) outfitNowSummary.textContent = "Analisando a temperatura atual...";
    if (outfitNowItems) outfitNowItems.innerHTML = `<div class="outfit-item-row"><span class="outfit-item-bullet"></span><span>Calculando peças ideais...</span></div>`;
    if (outfitDaySummary) outfitDaySummary.textContent = "Analisando a variação térmica do dia...";
    if (outfitDayItems) outfitDayItems.innerHTML = `<div class="outfit-item-row"><span class="outfit-item-bullet"></span><span>Estruturando camadas para o dia...</span></div>`;

    try {
        const response = await fetch('/api/roupa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cidade: currentWeatherData.location.name,
                current: currentWeatherData.current,
                today: currentWeatherData.today,
                forecast5Days: currentWeatherData.forecast5Days
            })
        });

        const data = await response.json();

        if (data.agora) {
            if (outfitNowSummary) outfitNowSummary.textContent = data.agora.resumo || 'Look para agora';
            if (outfitNowEmoji && data.agora.emoji) outfitNowEmoji.textContent = data.agora.emoji;
            if (outfitNowTip) outfitNowTip.textContent = data.agora.dica || 'Aproveite seu momento!';
            
            if (outfitNowItems && Array.isArray(data.agora.itens)) {
                outfitNowItems.innerHTML = data.agora.itens.map(item => `
                    <div class="outfit-item-row">
                        <span class="outfit-item-bullet"></span>
                        <span>${escapeHtml(item)}</span>
                    </div>
                `).join('');
            }
        }

        if (data.dia) {
            if (outfitDaySummary) outfitDaySummary.textContent = data.dia.resumo || 'Planejamento para o dia todo';
            if (outfitDayVariation) outfitDayVariation.textContent = data.dia.variacao || '';
            if (outfitDayAlert) outfitDayAlert.textContent = data.dia.alerta || 'Clima estável previsto.';

            if (outfitDayItems && Array.isArray(data.dia.itens)) {
                outfitDayItems.innerHTML = data.dia.itens.map(item => `
                    <div class="outfit-item-row">
                        <span class="outfit-item-bullet"></span>
                        <span>${escapeHtml(item)}</span>
                    </div>
                `).join('');
            }

            if (outfitDayTags && Array.isArray(data.dia.tags)) {
                outfitDayTags.innerHTML = data.dia.tags.map(tag => {
                    let typeClass = 'tag-default';
                    let icon = '✨';
                    const lower = tag.toLowerCase();
                    if (lower.includes('chuva') || lower.includes('guarda-chuva') || lower.includes('capa')) {
                        typeClass = 'tag-rain';
                        icon = '☂️';
                    } else if (lower.includes('uv') || lower.includes('sol') || lower.includes('óculos') || lower.includes('protetor')) {
                        typeClass = 'tag-uv';
                        icon = '☀️';
                    } else if (lower.includes('estável') || lower.includes('ameno') || lower.includes('confortável') || lower.includes('tempo bom')) {
                        typeClass = 'tag-stable';
                        icon = '🌤️';
                    } else if (lower.includes('frio') || lower.includes('jaqueta') || lower.includes('casaco') || lower.includes('blusa') || lower.includes('vento frio')) {
                        typeClass = 'tag-cold';
                        icon = '❄️';
                    } else if (lower.includes('calor') || lower.includes('quente') || lower.includes('abafado')) {
                        typeClass = 'tag-heat';
                        icon = '🔥';
                    } else if (lower.includes('vento') || lower.includes('ventania')) {
                        typeClass = 'tag-wind';
                        icon = '💨';
                    }

                    return `<span class="outfit-tag-chip ${typeClass}"><span class="tag-icon">${icon}</span><span>${escapeHtml(tag)}</span></span>`;
                }).join('');
            }
        }

    } catch (e) {
        console.error("Erro ao gerar sugestão:", e);
        if (outfitNowSummary) outfitNowSummary.textContent = "Não foi possível carregar as sugestões de look.";
    }
}

function recarregarSugestaoRoupas() {
    if (currentWeatherData) {
        carregarSugestaoRoupas();
    }
}

// Event Listeners on Page Load
document.addEventListener('DOMContentLoaded', () => {
    inicializarTema();
    const inputCidade = document.getElementById('inputCidade');
    if (inputCidade) {
        inputCidade.value = '';
        inputCidade.addEventListener('input', atualizarBotaoLimpar);
        atualizarBotaoLimpar();
    }
    showState('welcome');
});
