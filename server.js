const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());

// Open-Meteo WMO Weather interpretation codes
function getWeatherDetails(code, isDay = 1) {
    const dayNightSuffix = isDay ? 'd' : 'n';
    switch (code) {
        case 0:
            return { desc: 'Céu limpo', icon: `01${dayNightSuffix}`, category: 'clear', iconName: 'sun' };
        case 1:
            return { desc: 'Predomínio de sol', icon: `02${dayNightSuffix}`, category: 'mostly_clear', iconName: 'sun-cloud' };
        case 2:
            return { desc: 'Parcialmente nublado', icon: `03${dayNightSuffix}`, category: 'partly_cloudy', iconName: 'cloud-sun' };
        case 3:
            return { desc: 'Encoberto / Nublado', icon: `04${dayNightSuffix}`, category: 'cloudy', iconName: 'cloud' };
        case 45:
        case 48:
            return { desc: 'Nevoeiro ou névoa', icon: `50${dayNightSuffix}`, category: 'fog', iconName: 'fog' };
        case 51:
        case 53:
        case 55:
            return { desc: 'Garoa leve / Chuvisco', icon: `09${dayNightSuffix}`, category: 'drizzle', iconName: 'cloud-drizzle' };
        case 56:
        case 57:
            return { desc: 'Garoa congelante', icon: `09${dayNightSuffix}`, category: 'freezing_drizzle', iconName: 'cloud-snow' };
        case 61:
            return { desc: 'Chuva fraca', icon: `10${dayNightSuffix}`, category: 'rain_light', iconName: 'cloud-rain' };
        case 63:
            return { desc: 'Chuva moderada', icon: `10${dayNightSuffix}`, category: 'rain_moderate', iconName: 'cloud-rain' };
        case 65:
            return { desc: 'Chuva forte', icon: `10${dayNightSuffix}`, category: 'rain_heavy', iconName: 'cloud-rain-wind' };
        case 66:
        case 67:
            return { desc: 'Chuva congelante', icon: `13${dayNightSuffix}`, category: 'freezing_rain', iconName: 'cloud-snow' };
        case 71:
        case 73:
        case 75:
            return { desc: 'Neve', icon: `13${dayNightSuffix}`, category: 'snow', iconName: 'snowflake' };
        case 77:
            return { desc: 'Grãos de neve', icon: `13${dayNightSuffix}`, category: 'snow_grains', iconName: 'snowflake' };
        case 80:
        case 81:
        case 82:
            return { desc: 'Pancadas de chuva', icon: `09${dayNightSuffix}`, category: 'showers', iconName: 'cloud-rain' };
        case 85:
        case 86:
            return { desc: 'Pancadas de neve', icon: `13${dayNightSuffix}`, category: 'snow_showers', iconName: 'snowflake' };
        case 95:
            return { desc: 'Trovoada / Tempestade', icon: `11${dayNightSuffix}`, category: 'thunderstorm', iconName: 'cloud-lightning' };
        case 96:
        case 99:
            return { desc: 'Tempestade com granizo', icon: `11${dayNightSuffix}`, category: 'thunderstorm_hail', iconName: 'cloud-lightning' };
        default:
            return { desc: 'Tempo instável', icon: `02${dayNightSuffix}`, category: 'partly_cloudy', iconName: 'cloud' };
    }
}

// Format Portuguese day of the week
function getDiaSemana(dateStr) {
    const data = new Date(dateStr + 'T12:00:00');
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias[data.getDay()];
}

// Format Portuguese date (ex: 21 de Ago)
function getDataFormatada(dateStr) {
    const data = new Date(dateStr + 'T12:00:00');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${data.getDate()} de ${meses[data.getMonth()]}`;
}

// Mapeamento abrangente de Estados Brasileiros para Sigla UF (com e sem acentuação)
const BRAZIL_UF_MAP = {
    'Acre': 'AC', 'acre': 'AC', 'AC': 'AC',
    'Alagoas': 'AL', 'alagoas': 'AL', 'AL': 'AL',
    'Amapá': 'AP', 'Amapa': 'AP', 'amapa': 'AP', 'amapá': 'AP', 'AP': 'AP',
    'Amazonas': 'AM', 'amazonas': 'AM', 'AM': 'AM',
    'Bahia': 'BA', 'bahia': 'BA', 'BA': 'BA',
    'Ceará': 'CE', 'Ceara': 'CE', 'ceara': 'CE', 'ceará': 'CE', 'CE': 'CE',
    'Distrito Federal': 'DF', 'distrito federal': 'DF', 'DF': 'DF',
    'Espírito Santo': 'ES', 'Espirito Santo': 'ES', 'espirito santo': 'ES', 'espírito santo': 'ES', 'ES': 'ES',
    'Goiás': 'GO', 'Goias': 'GO', 'goias': 'GO', 'goiás': 'GO', 'GO': 'GO',
    'Maranhão': 'MA', 'Maranhao': 'MA', 'maranhao': 'MA', 'maranhão': 'MA', 'MA': 'MA',
    'Mato Grosso': 'MT', 'mato grosso': 'MT', 'MT': 'MT',
    'Mato Grosso do Sul': 'MS', 'mato grosso do sul': 'MS', 'MS': 'MS',
    'Minas Gerais': 'MG', 'minas gerais': 'MG', 'MG': 'MG',
    'Pará': 'PA', 'Para': 'PA', 'para': 'PA', 'pará': 'PA', 'PA': 'PA',
    'Paraíba': 'PB', 'Paraiba': 'PB', 'paraiba': 'PB', 'paraíba': 'PB', 'PB': 'PB',
    'Paraná': 'PR', 'Parana': 'PR', 'parana': 'PR', 'paraná': 'PR', 'PR': 'PR',
    'Pernambuco': 'PE', 'pernambuco': 'PE', 'PE': 'PE',
    'Piauí': 'PI', 'Piaui': 'PI', 'piaui': 'PI', 'piauí': 'PI', 'PI': 'PI',
    'Rio de Janeiro': 'RJ', 'rio de janeiro': 'RJ', 'RJ': 'RJ',
    'Rio Grande do Norte': 'RN', 'rio grande do norte': 'RN', 'RN': 'RN',
    'Rio Grande do Sul': 'RS', 'rio grande do sul': 'RS', 'RS': 'RS',
    'Rondônia': 'RO', 'Rondonia': 'RO', 'rondonia': 'RO', 'rondônia': 'RO', 'RO': 'RO',
    'Roraima': 'RR', 'roraima': 'RR', 'RR': 'RR',
    'Santa Catarina': 'SC', 'santa catarina': 'SC', 'SC': 'SC',
    'São Paulo': 'SP', 'Sao Paulo': 'SP', 'sao paulo': 'SP', 'são paulo': 'SP', 'SP': 'SP',
    'Sergipe': 'SE', 'sergipe': 'SE', 'SE': 'SE',
    'Tocantins': 'TO', 'tocantins': 'TO', 'TO': 'TO'
};

function resolverSiglaEstado(estadoStr) {
    if (!estadoStr) return '';
    const limpo = estadoStr.trim();
    if (BRAZIL_UF_MAP[limpo]) return BRAZIL_UF_MAP[limpo];
    const normalizado = limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (BRAZIL_UF_MAP[normalizado]) return BRAZIL_UF_MAP[normalizado];
    return limpo.length === 2 ? limpo.toUpperCase() : limpo;
}

// Geocodificação reversa inteligente e resiliente para coordenadas GPS
async function reverseGeocode(lat, lon) {
    // 1. Tentar Komoot Photon Reverse API (altamente precisa, sem bloqueio de IP e com dados detalhados)
    try {
        const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
        const photonRes = await fetch(photonUrl, {
            headers: { 'User-Agent': 'PrevisaoDoTempoApp/1.0 (clima-app@gmail.com)' },
            signal: AbortSignal.timeout(3500)
        });
        if (photonRes.ok) {
            const photonData = await photonRes.json();
            const props = photonData.features?.[0]?.properties;
            if (props) {
                const cityName = props.city || props.town || props.village || props.district || props.municipality || props.county || props.name;
                const stateName = props.state || '';
                const stateCode = resolverSiglaEstado(stateName);
                const countryCode = (props.countrycode || props.country || '').toUpperCase();

                if (cityName) {
                    return {
                        cityName: cityName.trim(),
                        stateCode: stateCode ? stateCode.trim() : '',
                        countryCode: countryCode ? countryCode.trim() : '',
                        stateName
                    };
                }
            }
        }
    } catch (e) {
        console.warn('Photon reverse geocode erro/timeout:', e.message);
    }

    // 2. Tentar OpenStreetMap Nominatim Reverse API com User-Agent customizado
    try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`;
        const nomRes = await fetch(nomUrl, {
            headers: { 'User-Agent': 'PrevisaoDoTempoApp/1.0 (clima-app@gmail.com)' },
            signal: AbortSignal.timeout(3500)
        });
        if (nomRes.ok) {
            const data = await nomRes.json();
            const addr = data.address || {};
            const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.suburb || addr.hamlet || addr.county || data.name;
            const stateName = addr.state || '';
            const isoCode = addr['ISO3166-2-lvl4'] ? addr['ISO3166-2-lvl4'].replace(/^BR-/, '') : '';
            const stateCode = isoCode || resolverSiglaEstado(stateName);
            const countryCode = (addr.country_code || '').toUpperCase();
            if (cityName) {
                return {
                    cityName: cityName.trim(),
                    stateCode: stateCode ? stateCode.trim() : '',
                    countryCode: countryCode ? countryCode.trim() : '',
                    stateName
                };
            }
        }
    } catch (e) {
        console.warn('Nominatim reverse geocode erro/timeout:', e.message);
    }

    // 3. Fallback: Open-Meteo Geocoding Nearest City Search
    try {
        const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=brasil&count=1&language=pt`;
        // Ou busca reversa calculada
    } catch (e) {}

    return null;
}

// Dicionário com coordenadas e dados exatos de capitais e metrópoles populares
const FAMOUS_CITIES_DIRECT_MAP = {
    // Capitais do Brasil
    'sao paulo': { name: 'São Paulo', latitude: -23.5505, longitude: -46.6333, country: 'Brasil', country_code: 'BR', admin1: 'SP', timezone: 'America/Sao_Paulo' },
    'são paulo': { name: 'São Paulo', latitude: -23.5505, longitude: -46.6333, country: 'Brasil', country_code: 'BR', admin1: 'SP', timezone: 'America/Sao_Paulo' },
    'rio de janeiro': { name: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729, country: 'Brasil', country_code: 'BR', admin1: 'RJ', timezone: 'America/Sao_Paulo' },
    'brasilia': { name: 'Brasília', latitude: -15.7975, longitude: -47.8919, country: 'Brasil', country_code: 'BR', admin1: 'DF', timezone: 'America/Sao_Paulo' },
    'brasília': { name: 'Brasília', latitude: -15.7975, longitude: -47.8919, country: 'Brasil', country_code: 'BR', admin1: 'DF', timezone: 'America/Sao_Paulo' },
    'salvador': { name: 'Salvador', latitude: -12.9777, longitude: -38.5016, country: 'Brasil', country_code: 'BR', admin1: 'BA', timezone: 'America/Bahia' },
    'fortaleza': { name: 'Fortaleza', latitude: -3.7319, longitude: -38.5267, country: 'Brasil', country_code: 'BR', admin1: 'CE', timezone: 'America/Fortaleza' },
    'belo horizonte': { name: 'Belo Horizonte', latitude: -19.9245, longitude: -43.9352, country: 'Brasil', country_code: 'BR', admin1: 'MG', timezone: 'America/Sao_Paulo' },
    'manaus': { name: 'Manaus', latitude: -3.1190, longitude: -60.0217, country: 'Brasil', country_code: 'BR', admin1: 'AM', timezone: 'America/Manaus' },
    'curitiba': { name: 'Curitiba', latitude: -25.4284, longitude: -49.2733, country: 'Brasil', country_code: 'BR', admin1: 'PR', timezone: 'America/Sao_Paulo' },
    'recife': { name: 'Recife', latitude: -8.0476, longitude: -34.8770, country: 'Brasil', country_code: 'BR', admin1: 'PE', timezone: 'America/Recife' },
    'porto alegre': { name: 'Porto Alegre', latitude: -30.0346, longitude: -51.2177, country: 'Brasil', country_code: 'BR', admin1: 'RS', timezone: 'America/Sao_Paulo' },
    'belem': { name: 'Belém', latitude: -1.4558, longitude: -48.4902, country: 'Brasil', country_code: 'BR', admin1: 'PA', timezone: 'America/Belem' },
    'belém': { name: 'Belém', latitude: -1.4558, longitude: -48.4902, country: 'Brasil', country_code: 'BR', admin1: 'PA', timezone: 'America/Belem' },
    'goiania': { name: 'Goiânia', latitude: -16.6869, longitude: -49.2648, country: 'Brasil', country_code: 'BR', admin1: 'GO', timezone: 'America/Sao_Paulo' },
    'goiânia': { name: 'Goiânia', latitude: -16.6869, longitude: -49.2648, country: 'Brasil', country_code: 'BR', admin1: 'GO', timezone: 'America/Sao_Paulo' },
    'florianopolis': { name: 'Florianópolis', latitude: -27.5954, longitude: -48.5480, country: 'Brasil', country_code: 'BR', admin1: 'SC', timezone: 'America/Sao_Paulo' },
    'florianópolis': { name: 'Florianópolis', latitude: -27.5954, longitude: -48.5480, country: 'Brasil', country_code: 'BR', admin1: 'SC', timezone: 'America/Sao_Paulo' },
    'vitoria': { name: 'Vitória', latitude: -20.3155, longitude: -40.3128, country: 'Brasil', country_code: 'BR', admin1: 'ES', timezone: 'America/Sao_Paulo' },
    'vitória': { name: 'Vitória', latitude: -20.3155, longitude: -40.3128, country: 'Brasil', country_code: 'BR', admin1: 'ES', timezone: 'America/Sao_Paulo' },
    'cuiaba': { name: 'Cuiabá', latitude: -15.6014, longitude: -56.0979, country: 'Brasil', country_code: 'BR', admin1: 'MT', timezone: 'America/Cuiaba' },
    'cuiabá': { name: 'Cuiabá', latitude: -15.6014, longitude: -56.0979, country: 'Brasil', country_code: 'BR', admin1: 'MT', timezone: 'America/Cuiaba' },
    'campo grande': { name: 'Campo Grande', latitude: -20.4697, longitude: -54.6201, country: 'Brasil', country_code: 'BR', admin1: 'MS', timezone: 'America/Campo_Grande' },
    'maceio': { name: 'Maceió', latitude: -9.6498, longitude: -35.7089, country: 'Brasil', country_code: 'BR', admin1: 'AL', timezone: 'America/Maceio' },
    'maceió': { name: 'Maceió', latitude: -9.6498, longitude: -35.7089, country: 'Brasil', country_code: 'BR', admin1: 'AL', timezone: 'America/Maceio' },
    'natal': { name: 'Natal', latitude: -5.7945, longitude: -35.2110, country: 'Brasil', country_code: 'BR', admin1: 'RN', timezone: 'America/Fortaleza' },
    'teresina': { name: 'Teresina', latitude: -5.0920, longitude: -42.8038, country: 'Brasil', country_code: 'BR', admin1: 'PI', timezone: 'America/Fortaleza' },
    'joao pessoa': { name: 'João Pessoa', latitude: -7.1195, longitude: -34.8450, country: 'Brasil', country_code: 'BR', admin1: 'PB', timezone: 'America/Fortaleza' },
    'joão pessoa': { name: 'João Pessoa', latitude: -7.1195, longitude: -34.8450, country: 'Brasil', country_code: 'BR', admin1: 'PB', timezone: 'America/Fortaleza' },
    'aracaju': { name: 'Aracaju', latitude: -10.9472, longitude: -37.0731, country: 'Brasil', country_code: 'BR', admin1: 'SE', timezone: 'America/Maceio' },
    'porto velho': { name: 'Porto Velho', latitude: -8.7619, longitude: -63.9039, country: 'Brasil', country_code: 'BR', admin1: 'RO', timezone: 'America/Porto_Velho' },
    'macapa': { name: 'Macapá', latitude: 0.0356, longitude: -51.0705, country: 'Brasil', country_code: 'BR', admin1: 'AP', timezone: 'America/Belem' },
    'macapá': { name: 'Macapá', latitude: 0.0356, longitude: -51.0705, country: 'Brasil', country_code: 'BR', admin1: 'AP', timezone: 'America/Belem' },
    'rio branco': { name: 'Rio Branco', latitude: -9.9753, longitude: -67.8249, country: 'Brasil', country_code: 'BR', admin1: 'AC', timezone: 'America/Rio_Branco' },
    'boa vista': { name: 'Boa Vista', latitude: 2.8235, longitude: -60.6758, country: 'Brasil', country_code: 'BR', admin1: 'RR', timezone: 'America/Boa_Vista' },
    'palmas': { name: 'Palmas', latitude: -10.2128, longitude: -48.3603, country: 'Brasil', country_code: 'BR', admin1: 'TO', timezone: 'America/Araguaina' },
    'sao luis': { name: 'São Luís', latitude: -2.5307, longitude: -44.3068, country: 'Brasil', country_code: 'BR', admin1: 'MA', timezone: 'America/Fortaleza' },
    'são luís': { name: 'São Luís', latitude: -2.5307, longitude: -44.3068, country: 'Brasil', country_code: 'BR', admin1: 'MA', timezone: 'America/Fortaleza' },

    // Metrópoles Globais
    'nova york': { name: 'Nova York', latitude: 40.7128, longitude: -74.0060, country: 'Estados Unidos', country_code: 'US', admin1: 'Nova York', timezone: 'America/New_York' },
    'nova iorque': { name: 'Nova York', latitude: 40.7128, longitude: -74.0060, country: 'Estados Unidos', country_code: 'US', admin1: 'Nova York', timezone: 'America/New_York' },
    'new york': { name: 'Nova York', latitude: 40.7128, longitude: -74.0060, country: 'Estados Unidos', country_code: 'US', admin1: 'Nova York', timezone: 'America/New_York' },
    'londres': { name: 'Londres', latitude: 51.5074, longitude: -0.1278, country: 'Reino Unido', country_code: 'GB', admin1: 'Inglaterra', timezone: 'Europe/London' },
    'london': { name: 'Londres', latitude: 51.5074, longitude: -0.1278, country: 'Reino Unido', country_code: 'GB', admin1: 'Inglaterra', timezone: 'Europe/London' },
    'paris': { name: 'Paris', latitude: 48.8566, longitude: 2.3522, country: 'França', country_code: 'FR', admin1: 'Île-de-France', timezone: 'Europe/Paris' },
    'toquio': { name: 'Tóquio', latitude: 35.6762, longitude: 139.6503, country: 'Japão', country_code: 'JP', admin1: 'Tóquio', timezone: 'Asia/Tokyo' },
    'tóquio': { name: 'Tóquio', latitude: 35.6762, longitude: 139.6503, country: 'Japão', country_code: 'JP', admin1: 'Tóquio', timezone: 'Asia/Tokyo' },
    'tokyo': { name: 'Tóquio', latitude: 35.6762, longitude: 139.6503, country: 'Japão', country_code: 'JP', admin1: 'Tóquio', timezone: 'Asia/Tokyo' },
    'roma': { name: 'Roma', latitude: 41.9028, longitude: 12.4964, country: 'Itália', country_code: 'IT', admin1: 'Lazio', timezone: 'Europe/Rome' },
    'lisboa': { name: 'Lisboa', latitude: 38.7223, longitude: -9.1393, country: 'Portugal', country_code: 'PT', admin1: 'Lisboa', timezone: 'Europe/Lisbon' },
    'madri': { name: 'Madri', latitude: 40.4168, longitude: -3.7038, country: 'Espanha', country_code: 'ES', admin1: 'Comunidade de Madrid', timezone: 'Europe/Madrid' },
    'madrid': { name: 'Madri', latitude: 40.4168, longitude: -3.7038, country: 'Espanha', country_code: 'ES', admin1: 'Comunidade de Madrid', timezone: 'Europe/Madrid' },
    'buenos aires': { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: 'Argentina', country_code: 'AR', admin1: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires' },
    'miami': { name: 'Miami', latitude: 25.7617, longitude: -80.1918, country: 'Estados Unidos', country_code: 'US', admin1: 'Flórida', timezone: 'America/New_York' },
    'orlando': { name: 'Orlando', latitude: 28.5383, longitude: -81.3792, country: 'Estados Unidos', country_code: 'US', admin1: 'Flórida', timezone: 'America/New_York' },
    'los angeles': { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, country: 'Estados Unidos', country_code: 'US', admin1: 'Califórnia', timezone: 'America/Los_Angeles' },
    'sao francisco': { name: 'São Francisco', latitude: 37.7749, longitude: -122.4194, country: 'Estados Unidos', country_code: 'US', admin1: 'Califórnia', timezone: 'America/Los_Angeles' },
    'são francisco': { name: 'São Francisco', latitude: 37.7749, longitude: -122.4194, country: 'Estados Unidos', country_code: 'US', admin1: 'Califórnia', timezone: 'America/Los_Angeles' },
    'berlim': { name: 'Berlim', latitude: 52.5200, longitude: 13.4050, country: 'Alemanha', country_code: 'DE', admin1: 'Berlim', timezone: 'Europe/Berlin' },
    'berlin': { name: 'Berlim', latitude: 52.5200, longitude: 13.4050, country: 'Alemanha', country_code: 'DE', admin1: 'Berlim', timezone: 'Europe/Berlin' },
    'amsterdam': { name: 'Amsterdã', latitude: 52.3676, longitude: 4.9041, country: 'Holanda', country_code: 'NL', admin1: 'Holanda do Norte', timezone: 'Europe/Amsterdam' },
    'amsterdã': { name: 'Amsterdã', latitude: 52.3676, longitude: 4.9041, country: 'Holanda', country_code: 'NL', admin1: 'Holanda do Norte', timezone: 'Europe/Amsterdam' },
    'pequim': { name: 'Pequim', latitude: 39.9042, longitude: 116.4074, country: 'China', country_code: 'CN', admin1: 'Pequim', timezone: 'Asia/Shanghai' },
    'viena': { name: 'Viena', latitude: 48.2082, longitude: 16.3738, country: 'Áustria', country_code: 'AT', admin1: 'Viena', timezone: 'Europe/Vienna' },
    'moscou': { name: 'Moscou', latitude: 55.7558, longitude: 37.6173, country: 'Rússia', country_code: 'RU', admin1: 'Moscou', timezone: 'Europe/Moscow' },
    'atenas': { name: 'Atenas', latitude: 37.9838, longitude: 23.7275, country: 'Grécia', country_code: 'GR', admin1: 'Ática', timezone: 'Europe/Athens' },
    'cairo': { name: 'Cairo', latitude: 30.0444, longitude: 31.2357, country: 'Egito', country_code: 'EG', admin1: 'Cairo', timezone: 'Africa/Cairo' },
    'dubai': { name: 'Dubai', latitude: 25.2048, longitude: 55.2708, country: 'Emirados Árabes Unidos', country_code: 'AE', admin1: 'Dubai', timezone: 'Asia/Dubai' },
    'sydney': { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, country: 'Austrália', country_code: 'AU', admin1: 'Nova Gales do Sul', timezone: 'Australia/Sydney' },
    'toronto': { name: 'Toronto', latitude: 43.6532, longitude: -79.3832, country: 'Canadá', country_code: 'CA', admin1: 'Ontário', timezone: 'America/Toronto' },
    'vancouver': { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207, country: 'Canadá', country_code: 'CA', admin1: 'Colúmbia Britânica', timezone: 'America/Vancouver' }
};

const COUNTRY_ALIASES_MAP = {
    'eua': 'US',
    'usa': 'US',
    'estados unidos': 'US',
    'brasil': 'BR',
    'brazil': 'BR',
    'portugal': 'PT',
    'espanha': 'ES',
    'spain': 'ES',
    'franca': 'FR',
    'frança': 'FR',
    'italia': 'IT',
    'itália': 'IT',
    'alemanha': 'DE',
    'inglaterra': 'GB',
    'reino unido': 'GB',
    'uk': 'GB',
    'argentina': 'AR',
    'uruguai': 'UY',
    'chile': 'CL',
    'paraguai': 'PY',
    'mexico': 'MX',
    'méxico': 'MX',
    'japao': 'JP',
    'japão': 'JP',
    'china': 'CN',
    'canada': 'CA',
    'canadá': 'CA',
    'australia': 'AU',
    'austrália': 'AU'
};

// Geocodificação inteligente com suporte a português, ranking por relevância e população
async function geocodeSearch(termo) {
    if (!termo || typeof termo !== 'string') return null;
    const cleanTerm = termo.trim();
    const lower = cleanTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Verificar se usuário digitou "Cidade, País" ou "Cidade, UF" (ex: "Nova York, EUA", "Miami, Estados Unidos", "Curitiba, PR")
    let searchParts = cleanTerm.split(/[,-]/).map(p => p.trim()).filter(Boolean);
    let targetCountryCode = null;
    let baseCity = cleanTerm;

    if (searchParts.length >= 2) {
        const potentialCountry = searchParts[searchParts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (COUNTRY_ALIASES_MAP[potentialCountry]) {
            targetCountryCode = COUNTRY_ALIASES_MAP[potentialCountry];
            baseCity = searchParts.slice(0, -1).join(' ').trim();
        } else if (potentialCountry.length === 2 && BRAZIL_UF_MAP[potentialCountry.toUpperCase()]) {
            targetCountryCode = 'BR';
            baseCity = searchParts.slice(0, -1).join(' ').trim();
        }
    }

    const baseCityLower = baseCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2. Checagem direta de cidades famosas (garante retorno instantâneo e 100% preciso para "Nova York", "Nova Iorque", "Paris", etc.)
    if (FAMOUS_CITIES_DIRECT_MAP[baseCityLower]) {
        const direct = FAMOUS_CITIES_DIRECT_MAP[baseCityLower];
        if (!targetCountryCode || targetCountryCode === direct.country_code) {
            return { ...direct };
        }
    }
    if (FAMOUS_CITIES_DIRECT_MAP[lower]) {
        const direct = FAMOUS_CITIES_DIRECT_MAP[lower];
        if (!targetCountryCode || targetCountryCode === direct.country_code) {
            return { ...direct };
        }
    }

    // 3. Estratégias de busca com Open-Meteo
    const queryCandidates = [
        baseCity,
        cleanTerm
    ];

    for (const q of queryCandidates) {
        try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=15&language=pt`;
            const geoRes = await fetch(geoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrevisaoDoTempo/1.0',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData && geoData.results && geoData.results.length > 0) {
                    // Ordenar os resultados por relevância combinada (população + correspondência do nome + país alvo)
                    const scoredResults = geoData.results.map(r => {
                        let score = 0;
                        const rNameLower = (r.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const rCountryCode = (r.country_code || '').toUpperCase();
                        const population = r.population || 0;

                        // Match exato do nome
                        if (rNameLower === baseCityLower || rNameLower === lower) {
                            score += 10000000;
                        } else if (rNameLower.startsWith(baseCityLower) || baseCityLower.startsWith(rNameLower)) {
                            score += 1000000;
                        }

                        // País correspondente
                        if (targetCountryCode && rCountryCode === targetCountryCode) {
                            score += 5000000;
                        }

                        // Relevância por população (cidades maiores têm prioridade natural sobre vilas homônimas)
                        score += population;

                        return { result: r, score };
                    });

                    scoredResults.sort((a, b) => b.score - a.score);
                    const bestMatch = scoredResults[0]?.result;

                    if (bestMatch) {
                        return {
                            name: bestMatch.name,
                            latitude: bestMatch.latitude,
                            longitude: bestMatch.longitude,
                            country: bestMatch.country || bestMatch.country_code || '',
                            country_code: (bestMatch.country_code || '').toUpperCase(),
                            admin1: bestMatch.admin1 || '',
                            timezone: bestMatch.timezone || 'auto'
                        };
                    }
                }
            }
        } catch (err) {
            // Falha não bloqueante, tenta próximo candidato ou fallback
        }
    }

    // 4. Fallback: OpenStreetMap Nominatim em português para pesquisas complexas
    try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanTerm)}&format=json&addressdetails=1&limit=5&accept-language=pt`;
        const nomRes = await fetch(nomUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrevisaoDoTempo/1.0',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });
        if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData) && nomData.length > 0) {
                const item = nomData[0];
                const addr = item.address || {};
                const cityName = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || item.name;
                return {
                    name: cityName || cleanTerm,
                    latitude: parseFloat(item.lat),
                    longitude: parseFloat(item.lon),
                    country: addr.country || '',
                    country_code: (addr.country_code || '').toUpperCase(),
                    admin1: addr.state || '',
                    timezone: 'auto'
                };
            }
        }
    } catch (e) {
        // Ignora silenciosamente
    }

    return null;
}

// Rule-based fallback generator for clothing recommendation
function generateRuleBasedLook(cidade, current, today) {
    const nomeCidadeLimpo = (cidade || '').replace(/^Localização Atual\s*-\s*/i, '') || cidade;
    const tempAtual = current?.temp || 22;
    const sensacao = current?.feels_like !== undefined ? current.feels_like : tempAtual;
    const chuvaProb = today?.rain_chance_max || 0;
    const chuvaAgora = (current?.precipitation || 0) > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(current?.weather_code);
    const uvMax = today?.uv_index_max || 5;
    const tempMin = today?.temp_min !== undefined ? today.temp_min : (tempAtual - 5);
    const tempMax = today?.temp_max !== undefined ? today.temp_max : (tempAtual + 5);
    const amplitude = Math.round(tempMax - tempMin);

    // Look para Agora
    let agoraResumo = '';
    let agoraItens = [];
    let agoraDica = '';
    let agoraEmoji = '👕';

    if (tempAtual < 13) {
        agoraEmoji = '🧥';
        agoraResumo = `Sensação térmica baixa de ${Math.round(sensacao)}°C neste momento em ${nomeCidadeLimpo}.`;
        agoraItens = ['Casaco pesado ou jaqueta forrada', 'Calça grossa ou jeans térmico', 'Sapato ou bota fechada', 'Cachecol ou touca'];
        agoraDica = 'Proteja as extremidades do corpo com meias térmicas e agasalho fechado.';
    } else if (tempAtual < 20) {
        agoraEmoji = '🧥';
        agoraResumo = `Temperatura amena e fresca de ${Math.round(tempAtual)}°C em ${nomeCidadeLimpo}.`;
        agoraItens = ['Camiseta ou camisa com suéter leve', 'Jaqueta jeans ou corta-vento', 'Calça confortável', 'Tênis ou sapato fechado'];
        agoraDica = 'Um look em camadas é perfeito para tirar ou colocar a blusa conforme o ambiente.';
    } else if (tempAtual < 27) {
        agoraEmoji = '👕';
        agoraResumo = `Clima agradável e temperado com ${Math.round(tempAtual)}°C em ${nomeCidadeLimpo}.`;
        agoraItens = ['Camiseta de algodão ou polo leve', 'Calça jeans leve ou bermuda casual', 'Tênis respirável ou calçado leve'];
        agoraDica = 'Tecidos naturais como algodão ou linho garantem respirabilidade e conforto.';
    } else {
        agoraEmoji = '🩳';
        agoraResumo = `Calor marcando ${Math.round(tempAtual)}°C com sensação de ${Math.round(sensacao)}°C em ${nomeCidadeLimpo}.`;
        agoraItens = ['Roupas leves e soltas (regata ou camiseta fresca)', 'Shorts, bermuda ou saia leve', 'Sandália, chinelo ou tênis vazado', 'Óculos de sol'];
        agoraDica = 'Beba bastante água e prefira tons claros que refletem a radiação solar.';
    }

    if (chuvaAgora) {
        agoraItens.push('Guarda-chuva resistente', 'Calçado impermeável');
        agoraDica += ' Está chovendo no momento, tenha atenção ao piso molhado.';
    }

    // Look para o Dia Todo
    let diaResumo = '';
    let diaItens = [];
    let diaVariacao = '';
    let diaAlerta = '';
    let tags = [];

    if (amplitude >= 10) {
        diaVariacao = `Grande variação térmica hoje: mínima de ${Math.round(tempMin)}°C e máxima de ${Math.round(tempMax)}°C (diferença de ${amplitude}°C).`;
        tags.push('Efeito Cebola (Camadas)');
        diaItens.push('Base leve (camiseta confortável)', 'Peça intermediária (cardigã ou suéter)', 'Jaqueta ou casaco externo para manhã/noite');
    } else {
        diaVariacao = `Temperatura relativamente estável ao longo do dia, variando entre ${Math.round(tempMin)}°C e ${Math.round(tempMax)}°C.`;
        tags.push('Clima Estável');
        diaItens.push('Conjunto confortável de acordo com a média do dia');
    }

    if (chuvaProb >= 40) {
        diaAlerta = `Alta probabilidade de chuva durante o dia (${chuvaProb}%). Não esqueça o guarda-chuva ou capa!`;
        tags.push('Leve Guarda-Chuva');
        diaItens.push('Guarda-chuva ou jaqueta impermeável');
    } else {
        diaAlerta = 'Baixa probabilidade de chuva significativa ao longo do dia.';
        tags.push('Sem Chuva Forte Prevista');
    }

    if (uvMax >= 6) {
        tags.push('Proteção UV');
        diaItens.push('Protetor solar e óculos escuros para saídas ao ar livre');
    }

    diaResumo = `Para passar o dia todo em ${nomeCidadeLimpo}, prepare-se para máxima de ${Math.round(tempMax)}°C e mínima de ${Math.round(tempMin)}°C.`;

    return {
        agora: {
            resumo: agoraResumo,
            itens: agoraItens,
            dica: agoraDica,
            emoji: agoraEmoji
        },
        dia: {
            resumo: diaResumo,
            variacao: diaVariacao,
            alerta: diaAlerta,
            itens: diaItens,
            tags: tags
        }
    };
}

// Endpoint de Clima Completo (Atual, Horário do dia e Próximos 5 Dias)
app.get('/api/clima', async (req, res) => {
    const { cidade, lat, lon } = req.query;

    if (!cidade && (!lat || !lon)) {
        return res.status(400).json({ cod: 400, message: 'Cidade ou coordenadas geográficas não informadas.' });
    }

    try {
        let latitude = lat;
        let longitude = lon;
        let localName = cidade;
        let countryCode = '';
        let adminRegion = '';
        let timezone = 'auto';
        let isGeolocation = false;

        // Geocodificação se uma cidade em texto for fornecida
        if (cidade) {
            const local = await geocodeSearch(cidade);
            if (!local) {
                return res.status(404).json({ cod: 404, message: `Cidade "${cidade}" não encontrada.` });
            }

            latitude = local.latitude;
            longitude = local.longitude;
            localName = local.name;
            countryCode = local.country_code || local.country || '';
            adminRegion = local.admin1 || '';
            timezone = local.timezone || 'auto';
        } else if (lat && lon) {
            isGeolocation = true;
            const rev = await reverseGeocode(lat, lon);
            if (rev && rev.cityName) {
                countryCode = rev.countryCode;
                adminRegion = rev.stateCode || rev.stateName;
                if (countryCode === 'BR' && rev.stateCode) {
                    localName = `Localização Atual - ${rev.cityName}/${rev.stateCode}`;
                } else if (countryCode && countryCode !== 'BR') {
                    localName = `Localização Atual - ${rev.cityName}, ${countryCode}`;
                } else {
                    localName = `Localização Atual - ${rev.cityName}`;
                }
            } else {
                localName = 'Localização Atual';
            }
        }

        // Buscar previsão meteorológica completa com retry e fallback resiliente
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=${encodeURIComponent(timezone)}&forecast_days=7`;

        let data = null;

        // Tentativa 1 e 2 na Open-Meteo
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const forecastRes = await fetch(forecastUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*'
                    },
                    signal: AbortSignal.timeout(attempt === 0 ? 5000 : 8000)
                });

                if (forecastRes.ok) {
                    const parsed = await forecastRes.json();
                    if (parsed && parsed.current && parsed.daily) {
                        data = parsed;
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Tentativa ${attempt + 1} Open-Meteo falhou:`, err.message);
            }
        }

        // Se Open-Meteo falhar em produção, tentar fallback com OpenWeather se chave estiver presente, ou rota alternativa
        if (!data) {
            const owmKey = process.env.OPENWEATHER_API_KEY;
            if (owmKey && owmKey.trim()) {
                try {
                    const owmRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=pt_br&appid=${owmKey}`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    if (owmRes.ok) {
                        const owmData = await owmRes.json();
                        const nowIso = new Date().toISOString();
                        const todayDateStr = nowIso.split('T')[0];
                        data = {
                            current: {
                                temperature_2m: owmData.main.temp,
                                apparent_temperature: owmData.main.feels_like,
                                relative_humidity_2m: owmData.main.humidity,
                                precipitation: owmData.rain ? (owmData.rain['1h'] || 0) : 0,
                                weather_code: 0, // mapeamento padrão
                                is_day: 1,
                                wind_speed_10m: (owmData.wind.speed * 3.6),
                                wind_direction_10m: owmData.wind.deg || 0,
                                surface_pressure: owmData.main.pressure
                            },
                            daily: {
                                time: [todayDateStr, todayDateStr, todayDateStr, todayDateStr, todayDateStr, todayDateStr, todayDateStr],
                                temperature_2m_max: [owmData.main.temp_max, owmData.main.temp_max, owmData.main.temp_max, owmData.main.temp_max, owmData.main.temp_max, owmData.main.temp_max, owmData.main.temp_max],
                                temperature_2m_min: [owmData.main.temp_min, owmData.main.temp_min, owmData.main.temp_min, owmData.main.temp_min, owmData.main.temp_min, owmData.main.temp_min, owmData.main.temp_min],
                                apparent_temperature_max: [owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like],
                                apparent_temperature_min: [owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like, owmData.main.feels_like],
                                weather_code: [0, 0, 0, 0, 0, 0, 0],
                                uv_index_max: [5, 5, 5, 5, 5, 5, 5],
                                precipitation_probability_max: [0, 0, 0, 0, 0, 0, 0],
                                precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
                                wind_speed_10m_max: [owmData.wind.speed * 3.6, owmData.wind.speed * 3.6, owmData.wind.speed * 3.6, owmData.wind.speed * 3.6, owmData.wind.speed * 3.6, owmData.wind.speed * 3.6, owmData.wind.speed * 3.6],
                                sunrise: [new Date(owmData.sys.sunrise * 1000).toISOString()],
                                sunset: [new Date(owmData.sys.sunset * 1000).toISOString()]
                            },
                            hourly: {
                                time: [nowIso],
                                temperature_2m: [owmData.main.temp],
                                apparent_temperature: [owmData.main.feels_like],
                                relative_humidity_2m: [owmData.main.humidity],
                                precipitation_probability: [0],
                                weather_code: [0],
                                is_day: [1]
                            }
                        };
                    }
                } catch (owmErr) {
                    console.warn('Fallback OpenWeather também falhou:', owmErr.message);
                }
            }
        }

        if (!data || !data.current || !data.daily) {
            return res.status(502).json({ cod: 502, message: 'Serviço de meteorologia temporariamente instável. Por favor, tente novamente.' });
        }

        const currentWeatherCode = data.current.weather_code || 0;
        const isDay = data.current.is_day !== undefined ? data.current.is_day : 1;
        const weatherInfo = getWeatherDetails(currentWeatherCode, isDay);

        // Previsão do dia de hoje
        const todayData = {
            date: data.daily.time[0],
            dayOfWeek: 'Hoje',
            dateFormatted: getDataFormatada(data.daily.time[0]),
            temp_max: data.daily.temperature_2m_max[0],
            temp_min: data.daily.temperature_2m_min[0],
            feels_like_max: data.daily.apparent_temperature_max[0],
            feels_like_min: data.daily.apparent_temperature_min[0],
            uv_index_max: data.daily.uv_index_max ? data.daily.uv_index_max[0] : null,
            rain_chance_max: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[0] : 0,
            rain_sum: data.daily.precipitation_sum ? data.daily.precipitation_sum[0] : 0,
            wind_max: data.daily.wind_speed_10m_max ? data.daily.wind_speed_10m_max[0] : 0,
            sunrise: data.daily.sunrise ? data.daily.sunrise[0]?.split('T')[1] : null,
            sunset: data.daily.sunset ? data.daily.sunset[0]?.split('T')[1] : null,
        };

        // Obter previsão para as próximas horas a partir da próxima hora imediata (ex: se são 16:25, puxa 17h00, 18h00, 19h00...)
        const hourlyForecast = [];
        if (data.hourly && data.hourly.time && data.current && data.current.time) {
            const currentLocalTimeStr = data.current.time; // formato YYYY-MM-DDTHH:MM
            let nextHourIndex = -1;

            for (let i = 0; i < data.hourly.time.length; i++) {
                if (data.hourly.time[i] > currentLocalTimeStr) {
                    nextHourIndex = i;
                    break;
                }
            }

            if (nextHourIndex === -1) {
                nextHourIndex = 1;
            }

            // Puxar as próximas 24 horas, de hora em hora
            for (let i = nextHourIndex; i < Math.min(nextHourIndex + 24, data.hourly.time.length); i++) {
                const rawTime = data.hourly.time[i].split('T')[1]?.slice(0, 5) || '';
                const hourPart = rawTime.split(':')[0] || '00';
                const formattedHour = `${hourPart}h00`; // Formato: 17h00, 18h00, 19h00...

                const hCode = data.hourly.weather_code[i];
                const hIsDay = data.hourly.is_day ? data.hourly.is_day[i] : 1;
                const hWeather = getWeatherDetails(hCode, hIsDay);

                hourlyForecast.push({
                    time: formattedHour,
                    rawTime: rawTime,
                    fullTime: data.hourly.time[i],
                    temp: Math.round(data.hourly.temperature_2m[i]),
                    feels_like: Math.round(data.hourly.apparent_temperature[i]),
                    rain_chance: data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : 0,
                    humidity: data.hourly.relative_humidity_2m ? data.hourly.relative_humidity_2m[i] : 0,
                    description: hWeather.desc,
                    icon: hWeather.icon,
                    iconName: hWeather.iconName
                });
            }
        }

        // Previsão para os próximos 5 dias (índices 1 a 5)
        const forecast5Days = [];
        for (let i = 1; i <= 5 && i < data.daily.time.length; i++) {
            const dateStr = data.daily.time[i];
            const dCode = data.daily.weather_code[i];
            const dWeather = getWeatherDetails(dCode, 1);

            forecast5Days.push({
                date: dateStr,
                dayOfWeek: getDiaSemana(dateStr),
                dateFormatted: getDataFormatada(dateStr),
                temp_max: Math.round(data.daily.temperature_2m_max[i]),
                temp_min: Math.round(data.daily.temperature_2m_min[i]),
                rain_chance: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : 0,
                rain_sum: data.daily.precipitation_sum ? data.daily.precipitation_sum[i] : 0,
                wind_max: data.daily.wind_speed_10m_max ? Math.round(data.daily.wind_speed_10m_max[i]) : 0,
                uv_index: data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[i]) : 0,
                description: dWeather.desc,
                icon: dWeather.icon,
                iconName: dWeather.iconName,
                category: dWeather.category
            });
        }

        const formattedCityTitle = isGeolocation 
            ? localName 
            : (adminRegion 
                ? `${localName}, ${adminRegion} - ${countryCode}`
                : (countryCode ? `${localName} - ${countryCode}` : localName));

        const respostaClima = {
            cod: 200,
            location: {
                name: localName,
                fullName: formattedCityTitle,
                country: countryCode,
                admin: adminRegion,
                latitude,
                longitude,
                timezone
            },
            current: {
                temp: Math.round(data.current.temperature_2m),
                feels_like: Math.round(data.current.apparent_temperature),
                humidity: data.current.relative_humidity_2m,
                precipitation: data.current.precipitation,
                weather_code: currentWeatherCode,
                description: weatherInfo.desc,
                icon: weatherInfo.icon,
                iconName: weatherInfo.iconName,
                category: weatherInfo.category,
                is_day: isDay,
                wind_speed: Math.round(data.current.wind_speed_10m),
                wind_direction: data.current.wind_direction_10m,
                pressure: Math.round(data.current.surface_pressure)
            },
            today: {
                ...todayData,
                temp_max: Math.round(todayData.temp_max),
                temp_min: Math.round(todayData.temp_min),
                feels_like_max: Math.round(todayData.feels_like_max),
                feels_like_min: Math.round(todayData.feels_like_min),
                hourly: hourlyForecast
            },
            forecast5Days
        };

        return res.json(respostaClima);

    } catch (error) {
        console.error('Erro ao processar dados de clima:', error);
        return res.status(500).json({ cod: 500, message: 'Ocorreu um erro ao carregar os dados meteorológicos.' });
    }
});

// Consultor de roupas e estilo sob medida
async function generateClothingSuggestions(cidade, current, today) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey.trim() === '') return null;

    const nomeCidadeLimpo = (cidade || '').replace(/^Localização Atual\s*-\s*/i, '') || cidade;

    const prompt = `Você é um consultor especialista em vestuário e estilo focado em clima. Para a cidade de ${nomeCidadeLimpo}:
- Condição Atual: ${current.description || 'Tempo estável'}, ${current.temp}°C (Sensação térmica: ${current.feels_like}°C), Umidade: ${current.humidity}%, Vento: ${current.wind_speed} km/h.
- Hoje: Mínima de ${today?.temp_min}°C, Máxima de ${today?.temp_max}°C, Probabilidade de Chuva: ${today?.rain_chance_max}%, Índice UV Máximo: ${today?.uv_index_max || 5}.

Retorne estritamente um objeto JSON com esta estrutura:
{
  "agora": {
    "resumo": "1 frase concisa com a recomendação para o clima exato deste momento.",
    "itens": ["Parte de cima recomendada", "Parte de baixo recomendada", "Calçado ideal", "Acessório ou complemento"],
    "dica": "1 dica de conforto térmico ou praticidade para agora.",
    "emoji": "👕"
  },
  "dia": {
    "resumo": "1 frase com o conselho geral para enfrentar o dia.",
    "variacao": "Como lidar com a variação entre ${today?.temp_min}°C e ${today?.temp_max}°C.",
    "alerta": "Alerta meteorológico útil (ex: chuva, sol forte, vento ou tempo seco).",
    "itens": ["Peça base", "Camada extra / Casaco", "Acessório de proteção (guarda-chuva, óculos, etc.)"],
    "tags": ["Camadas", "Proteção UV", "Chuva"]
  }
}`;

    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request Timeout')), 3500)
        );
        
        const geminiPromise = ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        });

        const geminiResponse = await Promise.race([geminiPromise, timeoutPromise]);

        if (geminiResponse && geminiResponse.text) {
            const parsed = JSON.parse(geminiResponse.text);
            if (parsed.agora && parsed.dia) {
                return parsed;
            }
        }
    } catch (err) {
        // Fallback para motor de regras
    }
    return null;
}

// Endpoint de Recomendação de Looks e Roupas
app.post('/api/roupa', async (req, res) => {
    const { cidade, current, today } = req.body;

    if (!cidade || !current) {
        return res.status(400).json({ error: 'Dados meteorológicos incompletos para a sugestão.' });
    }

    const consultResult = await generateClothingSuggestions(cidade, current, today);
    if (consultResult && consultResult.agora && consultResult.dia) {
        return res.json({
            source: 'dynamic-consultant',
            ...consultResult
        });
    }

    const fallbackLook = generateRuleBasedLook(cidade, current, today);
    return res.json({
        source: 'smart-engine',
        ...fallbackLook
    });
});

app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}!`));
