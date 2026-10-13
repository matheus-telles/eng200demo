// Fila do RU — protótipo do Desafio ENG200 (UFMG, 2025).
// Tudo roda no navegador: os relatos da comunidade são simulados de forma
// determinística e os relatos do usuário ficam no localStorage.

const RESTAURANTES = [
    { id: 'ru1', nome: 'RU I', local: 'Campus Pampulha', filaMax: 30, desloc: 0, jantar: true },
    { id: 'ru2', nome: 'RU II', local: 'Campus Pampulha', filaMax: 34, desloc: 10, jantar: true },
    { id: 'ru2-cima', nome: 'RU II – Parte de Cima', local: 'Campus Pampulha', filaMax: 26, desloc: 15, jantar: false },
    { id: 'ica', nome: 'RU ICA', local: 'Montes Claros', filaMax: 22, desloc: -10, jantar: true },
    { id: 'saude', nome: 'RU Saúde e Direito', local: 'Campus Saúde', filaMax: 18, desloc: -20, jantar: false },
];

// Horários ilustrativos (minutos desde a meia-noite).
const PERIODOS = [
    { nome: 'Almoço', ini: 11 * 60, fim: 14 * 60, pico: 12 * 60 + 15, largura: 38, intensidade: 1 },
    { nome: 'Jantar', ini: 17 * 60 + 30, fim: 19 * 60 + 30, pico: 18 * 60 + 15, largura: 30, intensidade: 0.6 },
];

const NIVEIS = [
    { id: 0, rotulo: 'Pequena', status: 'Fila pequena', icone: '✓', classe: 'bom', minutos: 4 },
    { id: 1, rotulo: 'Média', status: 'Fila média', icone: '!', classe: 'atencao', minutos: 13 },
    { id: 2, rotulo: 'Grande', status: 'Fila grande', icone: '✕', classe: 'critico', minutos: 28 },
];

const JANELA_RELATOS = 30; // minutos considerados na estimativa
const MEIA_VIDA = 10;      // relatos perdem metade do peso a cada 10 min
const CHAVE_STORAGE = 'filaRU.relatos';
const HORARIO_PADRAO = 12 * 60 + 15;

// ---------- utilidades ----------

const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD
const minutoAtualReal = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// Gerador pseudoaleatório com semente, para a simulação ser estável entre recargas.
function aleatorio(semente) {
    let h = 2166136261;
    for (const c of semente) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function periodosDe(ru) {
    return PERIODOS.filter((p) => p.nome === 'Almoço' || ru.jantar);
}

function periodoAberto(ru, min) {
    return periodosDe(ru).find((p) => min >= p.ini && min < p.fim) || null;
}

function proximoPeriodo(ru, min) {
    return periodosDe(ru).find((p) => p.ini > min) || periodosDe(ru)[0];
}

function nivelPorMinutos(minutos) {
    if (minutos < 8) return NIVEIS[0];
    if (minutos <= 20) return NIVEIS[1];
    return NIVEIS[2];
}

// ---------- modelo de fila ----------

// Fila típica (em minutos) de um restaurante num horário.
function filaTipica(ru, min) {
    const p = periodoAberto(ru, min);
    if (!p) return null;
    const pico = p.pico + ru.desloc;
    const curva = Math.exp(-((min - pico) ** 2) / (2 * p.largura ** 2));
    return Math.round(ru.filaMax * (0.1 + 0.9 * curva * p.intensidade));
}

// Relatos simulados da comunidade nos últimos 30 minutos.
function relatosSimulados(ru, relogio) {
    const relatos = [];
    const intervalo = 3 + Math.floor(aleatorio(ru.id) * 4);
    const inicio = relogio - JANELA_RELATOS;
    for (let m = relogio - (relogio % intervalo); m > inicio; m -= intervalo) {
        if (!periodoAberto(ru, m)) continue;
        if (aleatorio(`${ru.id}-${hoje()}-${m}-falta`) < 0.25) continue;
        const ruido = (aleatorio(`${ru.id}-${hoje()}-${m}`) - 0.5) * 12;
        relatos.push({ min: m, nivel: nivelPorMinutos(filaTipica(ru, m) + ruido).id, meu: false });
    }
    return relatos;
}

function lerMeusRelatos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_STORAGE)) || []; } catch { return []; }
}

function salvarMeuRelato(ruId, nivel, relogio) {
    const outros = lerMeusRelatos().filter((r) => !(r.ru === ruId && r.dia === hoje()));
    outros.push({ ru: ruId, dia: hoje(), min: relogio, nivel });
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(outros));
}

function meuRelato(ruId, relogio) {
    return lerMeusRelatos().find((r) => r.ru === ruId && r.dia === hoje()
        && r.min <= relogio && relogio - r.min <= JANELA_RELATOS) || null;
}

// Média ponderada dos relatos, com peso decaindo pela idade do relato.
function estimar(ru, relogio) {
    const relatos = relatosSimulados(ru, relogio);
    const meu = meuRelato(ru.id, relogio);
    if (meu) relatos.push({ min: meu.min, nivel: meu.nivel, meu: true });
    if (!relatos.length) return null;

    let soma = 0, pesos = 0;
    for (const r of relatos) {
        const peso = 0.5 ** ((relogio - r.min) / MEIA_VIDA) * (r.meu ? 1.5 : 1);
        soma += NIVEIS[r.nivel].minutos * peso;
        pesos += peso;
    }
    const minutos = Math.round(soma / pesos);
    const ultimo = Math.max(...relatos.map((r) => r.min));
    return { minutos, nivel: nivelPorMinutos(minutos), total: relatos.length, ultimo: relogio - ultimo };
}

// ---------- estado da página ----------

const seletor = document.getElementById('horario');
const aviso = document.getElementById('aviso');
const recomendacao = document.getElementById('recomendacao');
const lista = document.getElementById('restaurantes');
const tooltip = document.getElementById('tooltip');

function algumAberto(min) {
    return RESTAURANTES.some((ru) => periodoAberto(ru, min));
}

function montarSeletor() {
    const agora = minutoAtualReal();
    const opcoes = [`<option value="agora">Agora (${hm(agora)})</option>`];
    for (const p of PERIODOS) {
        for (let m = p.ini; m < p.fim; m += 15) opcoes.push(`<option value="${m}">${hm(m)} · ${p.nome}</option>`);
    }
    seletor.innerHTML = opcoes.join('');
    seletor.value = algumAberto(agora) ? 'agora' : String(HORARIO_PADRAO);
}

function relogioAtual() {
    return seletor.value === 'agora' ? minutoAtualReal() : Number(seletor.value);
}

function atualizarAviso(relogio) {
    const agora = minutoAtualReal();
    if (seletor.value !== 'agora' && !algumAberto(agora)) {
        aviso.hidden = false;
        aviso.textContent = `Os restaurantes estão fechados agora (${hm(agora)}). Mostrando uma simulação às ${hm(relogio)}; troque o horário no topo para ver outros momentos.`;
    } else {
        aviso.hidden = true;
    }
}

// ---------- renderização ----------

function renderRecomendacao(estimativas) {
    const abertos = estimativas.filter((e) => e.estimativa);
    if (!abertos.length) {
        recomendacao.innerHTML = '<p class="rec-titulo">Todos os restaurantes estão fechados neste horário.</p>';
        return;
    }
    const melhor = abertos.reduce((a, b) => (b.estimativa.minutos < a.estimativa.minutos ? b : a));
    const { nivel, minutos } = melhor.estimativa;
    recomendacao.innerHTML = `
        <p class="rec-rotulo">Menos espera agora</p>
        <p class="rec-titulo">${melhor.ru.nome} <span class="rec-local">${melhor.ru.local}</span></p>
        <p class="rec-detalhe"><span class="chip ${nivel.classe}"><span aria-hidden="true">${nivel.icone}</span> ${nivel.status}</span>
        cerca de <strong>${minutos} min</strong> de espera</p>`;
}

function textoMeta(est) {
    const quando = est.ultimo === 0 ? 'agora mesmo' : `há ${est.ultimo} min`;
    const plural = est.total === 1 ? 'relato' : 'relatos';
    return `${est.total} ${plural} nos últimos ${JANELA_RELATOS} min · último ${quando}`;
}

function renderGrafico(ru, periodo, relogio) {
    const slots = [];
    for (let m = periodo.ini; m < periodo.fim; m += 15) slots.push({ ini: m, fila: filaTipica(ru, m + 7) });
    const max = Math.max(...slots.map((s) => s.fila), 1);
    const W = 320, H = 110, topo = 16, base = 90, gap = 2, raio = 4;
    const larg = W / slots.length;
    const melhor = slots.reduce((a, b) => (b.fila < a.fila ? b : a));

    const barras = slots.map((s, i) => {
        const x = i * larg + gap / 2;
        const w = larg - gap;
        const h = Math.max(2, (s.fila / max) * (base - topo));
        const y = base - h;
        const r = Math.min(raio, w / 2, h);
        const atual = relogio >= s.ini && relogio < s.ini + 15;
        const caminho = `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
        const rotulo = atual ? `<text x="${x + w / 2}" y="${y - 4}" class="rotulo-agora" text-anchor="middle">agora</text>` : '';
        const eixo = s.ini % 60 === 0 ? `<text x="${x}" y="${H - 4}" class="eixo">${hm(s.ini)}</text>` : '';
        return `<g class="barra${atual ? ' atual' : ''}">
            <path d="${caminho}"/>${rotulo}${eixo}
            <rect class="alvo" x="${i * larg}" y="0" width="${larg}" height="${base}"
                data-dica="${hm(s.ini)}–${hm(s.ini + 15)} · fila típica ~${s.fila} min"/>
        </g>`;
    }).join('');

    const linhasTabela = slots.map((s) => `<tr><td>${hm(s.ini)}</td><td>${s.fila} min</td></tr>`).join('');

    return `
        <div class="grafico">
            <p class="grafico-titulo">Movimento típico · ${periodo.nome}</p>
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fila típica do ${ru.nome} a cada 15 minutos no ${periodo.nome.toLowerCase()}. Menor fila às ${hm(melhor.ini)}.">
                <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="linha-base"/>
                ${barras}
            </svg>
            <p class="grafico-nota">Menor fila típica: <strong>${hm(melhor.ini)}</strong> (~${melhor.fila} min)</p>
            <table class="so-leitor"><caption>Fila típica no ${periodo.nome.toLowerCase()}</caption>
                <tr><th>Horário</th><th>Fila</th></tr>${linhasTabela}</table>
        </div>`;
}

function renderCard(ru, est, relogio) {
    const periodo = periodoAberto(ru, relogio);
    const meu = meuRelato(ru.id, relogio);

    if (!periodo) {
        const prox = proximoPeriodo(ru, relogio);
        return `<article class="ru fechado">
            <header><h2>${ru.nome}</h2><p class="local">${ru.local}</p></header>
            <p class="chip neutro">Fechado · abre às ${hm(prox.ini)}</p>
            ${renderGrafico(ru, prox, relogio)}
        </article>`;
    }

    const { nivel } = est;
    const incerto = est.total < 3 ? '<p class="incerto">Poucos relatos: a estimativa ainda é incerta.</p>' : '';
    const botoes = NIVEIS.map((n) => `<button type="button" class="relatar" data-ru="${ru.id}" data-nivel="${n.id}"
        aria-pressed="${meu && meu.nivel === n.id}">${n.rotulo}</button>`).join('');
    const confirmacao = meu
        ? `<p class="confirmacao">Você informou <strong>${NIVEIS[meu.nivel].rotulo.toLowerCase()}</strong> às ${hm(meu.min)}. Obrigado!</p>`
        : '';

    return `<article class="ru ${nivel.classe}">
        <header><h2>${ru.nome}</h2><p class="local">${ru.local}</p></header>
        <p class="chip ${nivel.classe}"><span aria-hidden="true">${nivel.icone}</span> ${nivel.status}</p>
        <p class="espera">~${est.minutos} <span>min de espera</span></p>
        <p class="meta">${textoMeta(est)}</p>
        ${incerto}
        <div class="relato">
            <p>Está no ${ru.nome}? Como está a fila?</p>
            <div class="botoes">${botoes}</div>
            ${confirmacao}
        </div>
        ${renderGrafico(ru, periodo, relogio)}
    </article>`;
}

function render() {
    const relogio = relogioAtual();
    atualizarAviso(relogio);
    const estimativas = RESTAURANTES.map((ru) => ({
        ru,
        estimativa: periodoAberto(ru, relogio) ? estimar(ru, relogio) : null,
    }));
    renderRecomendacao(estimativas);
    lista.innerHTML = estimativas.map(({ ru, estimativa }) => renderCard(ru, estimativa, relogio)).join('');
}

// ---------- eventos ----------

seletor.addEventListener('change', render);

lista.addEventListener('click', (ev) => {
    const botao = ev.target.closest('.relatar');
    if (!botao) return;
    salvarMeuRelato(botao.dataset.ru, Number(botao.dataset.nivel), relogioAtual());
    render();
});

function mostrarDica(alvo, x, y) {
    tooltip.textContent = alvo.dataset.dica;
    tooltip.hidden = false;
    const largura = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(x + 12, window.innerWidth - largura - 8)}px`;
    tooltip.style.top = `${y - 36}px`;
}

lista.addEventListener('pointermove', (ev) => {
    const alvo = ev.target.closest('.alvo');
    lista.querySelectorAll('.barra.hover').forEach((b) => b.classList.remove('hover'));
    if (!alvo) { tooltip.hidden = true; return; }
    alvo.parentNode.classList.add('hover');
    mostrarDica(alvo, ev.clientX, ev.clientY);
});

lista.addEventListener('pointerleave', () => { tooltip.hidden = true; });

montarSeletor();
render();
// Mantém "Agora" atualizado.
setInterval(() => { if (seletor.value === 'agora') render(); }, 60 * 1000);
