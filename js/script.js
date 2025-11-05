// === Variáveis de Estado ===
let allQuestions = [];
let current = null;
let answeredQuestions = new Set();
let asked = 0, correctCount = 0, wrongCount = 0;
let flaggedQuestions = new Set();
const CARD_THEME_KEY = 'ccna-card-theme';
let cardTheme = localStorage.getItem(CARD_THEME_KEY) || 'dark';

// === Funções Auxiliares ===
function escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
function showCorrectMessage() {
    const div = document.createElement('div');
    div.className = 'correct-message';
    div.textContent = 'Correct!';
    div.setAttribute('aria-live', 'assertive');
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

// === Tema do Card ===
function applyCardTheme() {
    const card = document.getElementById('questionCard');
    const icon = document.getElementById('themeIcon');
    if (cardTheme === 'light') {
        card.classList.add('theme-light');
        icon.textContent = 'Dark theme';
    } else {
        card.classList.remove('theme-light');
        icon.textContent = 'Clear theme';
    }
}

// === Carregamento (aba: subnets) ===
async function loadSheet() {
    try {
        const url = `${Config.SHEET_API_URL}?sheet=subnets`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        allQuestions = data.map((r, i) => ({
            id: String(i + 1),
            question: (r.question || '').trim(),
            options: {
                A: (r.A || '').trim(),
                B: (r.B || '').trim(),
                C: (r.C || '').trim(),
                D: (r.D || '').trim()
            },
            correct: (r.correct || '').replace(/\s/g, '').split(',').filter(Boolean).map(s => s.toUpperCase()),
            explanation: (r.explanation || '').trim(),
            image: (r.image || '').trim(),
            category: (r.category || 'Quiz').trim()
        })).filter(q => q.question && Object.values(q.options).some(Boolean));
        if (allQuestions.length === 0) {
            document.getElementById('qMeta').textContent = 'Nenhuma pergunta na aba "subnets".';
            return;
        }
        updateStats();
        nextQuestion();
        applyCardTheme(); // Aplicar tema ao carregar
    } catch (err) {
        document.getElementById('qMeta').textContent = `Erro: ${err.message}`;
        console.error(err);
    }
}

// === Renderização da Pergunta ===
function renderQuestion(q) {
    if (!q) return;
    current = q;
    document.getElementById('qMeta').innerHTML = `ID ${q.id} — ${escapeHTML(q.category)}`;
    if (flaggedQuestions.has(q.id)) {
        document.getElementById('qMeta').innerHTML += ' <span style="color:var(--accent); font-weight:700;">(Doubt)</span>';
    }
    document.getElementById('questionText').textContent = q.question;
    const opts = document.getElementById('options');
    const expl = document.getElementById('explanation');
    const nextBtn = document.getElementById('nextBtn');
    opts.innerHTML = '';
    expl.style.display = 'none';
    expl.innerHTML = '';
    nextBtn.disabled = false;
    ['A', 'B', 'C', 'D'].forEach(l => {
        const txt = q.options[l];
        if (!txt) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.dataset.letter = l;
        btn.innerHTML = `<span class="letter">${l}</span><span class="text">${escapeHTML(txt)}</span>`;
        btn.onclick = () => validateAnswer([l]);
        btn.onkeydown = e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        };
        opts.appendChild(btn);
    });
    applyCardTheme(); // Reaplicar tema
}

// === Validação da Resposta ===
function validateAnswer(selected) {
    const opts = document.querySelectorAll('.opt');
    const expl = document.getElementById('explanation');
    const nextBtn = document.getElementById('nextBtn');
    const flagBtn = document.getElementById('flagBtn');

    opts.forEach(o => {
        o.classList.add('opt-disabled');
        o.onclick = null;
        o.onkeydown = null;
        o.removeAttribute('aria-pressed');
    });

    const isCorrect = arraysEqual(selected, current.correct);
    asked++;
    if (isCorrect) correctCount++; else wrongCount++;
    updateStats();

    opts.forEach(o => {
        const l = o.dataset.letter;
        if (current.correct.includes(l)) o.classList.add('correct');
        if (selected.includes(l)) {
            o.classList.add('wrong');
            o.setAttribute('aria-pressed', 'true');
        }
    });

    // Botão de dúvida
    flagBtn.style.display = 'inline-block';
    flagBtn.onclick = () => {
        if (flaggedQuestions.has(current.id)) {
            flaggedQuestions.delete(current.id);
            flagBtn.textContent = 'Doubt';
            flagBtn.classList.remove('flagged');
        } else {
            flaggedQuestions.add(current.id);
            flagBtn.textContent = 'Doubt Marked';
            flagBtn.classList.add('flagged');
        }
        updateReviewButton();
    };
    flagBtn.textContent = flaggedQuestions.has(current.id) ? 'Doubt Marked' : 'Doubt';
    flagBtn.className = 'btn-ghost' + (flaggedQuestions.has(current.id) ? ' flagged' : '');

    expl.style.display = 'none';
    expl.innerHTML = '';
    if (isCorrect) {
        showCorrectMessage();
        nextBtn.disabled = true;
        setTimeout(() => {
            nextQuestion();
            updateReviewButton();
        }, 1200);
    } else {
        expl.style.display = 'block';
        if (current.image) {
            expl.innerHTML = `<img src="${escapeHTML(current.image)}" alt="Explicação" style="max-width:100%; border-radius:0.5rem; margin:0.5rem 0;">`;
            if (current.explanation) expl.innerHTML += `<p style="margin-top:0.5rem;">${escapeHTML(current.explanation)}</p>`;
        } else {
            expl.innerHTML = `<p>${escapeHTML(current.explanation || 'No explanation available.')}</p>`;
        }
        setTimeout(() => {
            expl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
    updateReviewButton();
}

// === Próxima Pergunta ===
function nextQuestion() {
    let pool = allQuestions.filter(q => !answeredQuestions.has(q.id));
    if (pool.length === 0) {
        answeredQuestions.clear();
        pool = allQuestions;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    answeredQuestions.add(q.id);
    renderQuestion(q);
    updateReviewButton();
}

// === Atualização de Estatísticas ===
function updateStats() {
    document.getElementById('totalAsked').textContent = asked;
    document.getElementById('totalCorrect').textContent = correctCount;
    document.getElementById('totalWrong').textContent = wrongCount;
    const pct = asked ? Math.round((correctCount / asked) * 100) : 0;
    document.getElementById('progress').textContent = `${pct}%`;
    updateReviewButton();
}

// === Botão de Revisão ===
function updateReviewButton() {
    const btn = document.getElementById('reviewBtn');
    const count = document.getElementById('flagCount');
    const size = flaggedQuestions.size;
    if (size > 0) {
        btn.style.display = 'inline-block';
        count.textContent = size;
        btn.onclick = () => {
            const flagged = allQuestions.filter(q => flaggedQuestions.has(q.id));
            if (!flagged.length) return;
            const q = flagged[Math.floor(Math.random() * flagged.length)];
            answeredQuestions.delete(q.id);
            renderQuestion(q);
        };
    } else {
        btn.style.display = 'none';
    }
}

// === Eventos ===
document.getElementById('nextBtn').onclick = () => {
    if (!document.getElementById('nextBtn').disabled) {
        nextQuestion();
    }
};

document.getElementById('themeToggle').onclick = () => {
    cardTheme = cardTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(CARD_THEME_KEY, cardTheme);
    applyCardTheme();
};

// === Inicialização ===
loadSheet();
