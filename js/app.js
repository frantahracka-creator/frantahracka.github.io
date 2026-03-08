/**
 * PPL Trenažér - App Logic
 */

const App = {
    questions: [],
    curIdx: 0,
    score: 0,
    answeredCount: 0,
    currentSubject: "",
    isAnswered: false,

    subjects: [
        { id: 'Letecke_predpisy', name: 'Letecké právo', full: '10 Letecké právo (Air Law)' },
        { id: 'Obecne_znalosti_o_letadle', name: 'Obecné znalosti o letadle', full: '20 Obecné znalosti o letadle (Aircraft General Knowledge)' },
        { id: 'Provedeni_a_planovani_letu', name: 'Provedení a plánování letu', full: '30 Provedení a plánování letu (Flight Performance and Planning)' },
        { id: 'Lidska_vykonnost', name: 'Lidská výkonnost', full: '40 Lidská výkonnost (Human Performance)' },
        { id: 'Meteorologie', name: 'Meteorologie', full: '50 Meteorologie (Meteorology)' },
        { id: 'Navigace', name: 'Navigace', full: '60 Navigace (Navigation)' },
        { id: 'Provozni_postupy', name: 'Provozní postupy', full: '70 Provozní postupy (Operational Procedures)' },
        { id: 'Letove_zasady', name: 'Základy letu', full: '80 Základy letu (Principles of Flight)' },
        { id: 'Komunikace', name: 'Komunikace', full: '90 Komunikace (Communications)' }
    ],

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderMenu();
    },

    cacheDOM() {
        this.dom = {
            homeScreen: document.getElementById('home-screen'),
            quizScreen: document.getElementById('quiz-screen'),
            menuContainer: document.getElementById('menu-container'),
            progressBar: document.getElementById('progressBar'),
            progressText: document.getElementById('progress-text'),
            scoreText: document.getElementById('score-text'),
            qText: document.getElementById('qText'),
            ansBox: document.getElementById('ansBox'),
            imgCont: document.getElementById('imgContainer'),
            imgTag: document.getElementById('questionImage'),
            nextBtn: document.getElementById('nextBtn'),
            backBtn: document.getElementById('backBtn'),
            shuffleToggle: document.getElementById('shuffleToggle'),
            jumpInput: document.getElementById('jumpInput'),
            themeToggleBtn: document.getElementById('themeToggleBtn'),
            adminModal: document.getElementById('adminModal'),
            newSubjectName: document.getElementById('newSubjectName'),
            jsonFileUpload: document.getElementById('jsonFileUpload'),
            hintContainer: document.getElementById('hintContainer'),
            hintText: document.getElementById('hintText'),
            geminiApiKey: document.getElementById('geminiApiKey'),
            gptApiKey: document.getElementById('gptApiKey'),
            claudeApiKey: document.getElementById('claudeApiKey'),
            mistralApiKey: document.getElementById('mistralApiKey'),
            activeModel: document.getElementById('activeModel'),
            aiContainer: document.getElementById('aiContainer'),
            aiExplainBtn: document.getElementById('aiExplainBtn'),
            aiExplanationBox: document.getElementById('aiExplanationBox')
        };
    },

    bindEvents() {
        // Events are mostly handled via onclick in HTML for now to keep it simple,
        // but we can transition to addEventListener.
    },

    renderMenu() {
        this.dom.menuContainer.innerHTML = '';

        // Load custom subjects from localStorage
        const customSubjectsRaw = localStorage.getItem('customSubjects');
        let customSubjects = [];
        if (customSubjectsRaw) {
            try {
                customSubjects = JSON.parse(customSubjectsRaw);
            } catch (e) {
                console.error("Failed to parse custom subjects", e);
            }
        }

        const allSubjects = [...this.subjects, ...customSubjects];

        allSubjects.forEach(sub => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn';
            btn.innerHTML = `<span>${sub.name}</span>`;
            btn.title = sub.full || sub.name; // Show numbers and English on hover
            btn.onclick = () => this.startQuiz(sub.id, sub.isCustom);
            this.dom.menuContainer.appendChild(btn);
        });

        const mixBtn = document.createElement('button');
        mixBtn.className = 'menu-btn mix-btn';
        mixBtn.innerText = 'Náhodný test (mix témat)';
        mixBtn.onclick = () => this.startMixQuiz();
        this.dom.menuContainer.appendChild(mixBtn);
    },

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    async startQuiz(subject, isCustom = false, forceShuffle = false) {
        try {
            this.currentSubject = subject;
            let data;

            if (isCustom) {
                const storedData = localStorage.getItem(`custom_data_${subject}`);
                if (!storedData) throw new Error("Custom data not found");
                data = JSON.parse(storedData);
            } else {
                const res = await fetch(`./Klice/${subject}.json`);
                data = await res.json();
            }

            const shouldShuffle = forceShuffle || this.dom.shuffleToggle.checked;
            this.questions = shouldShuffle ? this.shuffle(data) : data;

            this.initQuizUI(subject);
        } catch (err) {
            console.error("Failed to load quiz:", err);
            alert("Chyba při načítání testu.");
        }
    },

    async startMixQuiz() {
        try {
            let mixQuestions = [];
            for (let sub of this.subjects) {
                const res = await fetch(`./Klice/${sub.id}.json`);
                const data = await res.json();
                const dataWithSubject = data.map(q => ({ ...q, subjectSource: sub.id }));
                mixQuestions = mixQuestions.concat(this.shuffle(dataWithSubject).slice(0, 12));
            }
            this.questions = this.shuffle(mixQuestions);
            this.initQuizUI("MIX");
        } catch (err) {
            console.error(err);
            alert("Chyba při generování MIXu.");
        }
    },

    initQuizUI(subject) {
        this.curIdx = 0;
        this.score = 0;
        this.answeredCount = 0;
        this.currentSubject = subject;
        this.dom.homeScreen.classList.add('hidden');
        this.dom.quizScreen.classList.remove('hidden');
        this.showQuestion();
    },

    showQuestion() {
        if (!this.questions[this.curIdx]) return;

        this.isAnswered = false;
        const q = this.questions[this.curIdx];

        // Update Stats
        const progress = ((this.curIdx) / this.questions.length) * 100;
        this.dom.progressBar.style.width = `${progress}%`;
        this.dom.progressText.innerText = `Otázka ${this.curIdx + 1} z ${this.questions.length} (ID: ${q.id})`;
        this.dom.backBtn.style.visibility = (this.curIdx === 0) ? 'hidden' : 'visible';
        this.dom.nextBtn.classList.add('hidden');

        // Handling Images
        const sourceFolder = q.subjectSource || this.currentSubject;
        if (q.image) {
            this.dom.imgTag.src = `./Obrazky/${sourceFolder}/${q.image}`;
            this.dom.imgCont.classList.add('visible');
        } else {
            this.dom.imgCont.classList.remove('visible');
        }

        // Reset AI Explanation
        this.dom.aiContainer.classList.add('hidden');
        this.dom.aiExplainBtn.classList.remove('hidden');
        this.dom.aiExplanationBox.classList.add('hidden');
        this.dom.aiExplanationBox.innerHTML = '';

        // Handling Hints
        this.dom.hintText.classList.add('hidden');
        if (q.hint && q.hint.trim() !== "") {
            this.dom.hintContainer.classList.remove('hidden');
            this.dom.hintText.innerText = q.hint;
        } else {
            this.dom.hintContainer.classList.add('hidden');
            this.dom.hintText.innerText = "K této otázce není k dispozici žádná nápověda.";
        }

        // Question Text with animation
        this.dom.qText.classList.remove('fade-in');
        void this.dom.qText.offsetWidth; // Trigger reflow
        this.dom.qText.innerText = q.question;
        this.dom.qText.classList.add('fade-in');

        // Answers
        this.dom.ansBox.innerHTML = '';
        q.answers.forEach((text, i) => {
            const b = document.createElement('button');
            b.className = 'ans-btn fade-in';
            b.style.animationDelay = `${i * 0.1}s`;
            b.innerText = text;
            b.onclick = () => this.handleAnswer(i, b);
            this.dom.ansBox.appendChild(b);
        });
    },

    handleAnswer(selectedIndex, clickedBtn) {
        if (this.isAnswered) return;

        const q = this.questions[this.curIdx];
        const btns = this.dom.ansBox.querySelectorAll('.ans-btn');

        this.isAnswered = true;
        this.answeredCount++;

        btns.forEach(btn => btn.disabled = true);

        if (selectedIndex === q.correct) {
            clickedBtn.classList.add('correct');
            this.score++;
        } else {
            clickedBtn.classList.add('wrong');
            if (btns[q.correct]) btns[q.correct].classList.add('correct');

            // Ukazat tlacitko pro AI vysvetleni pri spatne odpovedi
            this.dom.aiContainer.classList.remove('hidden');
        }

        const successRate = Math.round((this.score / this.answeredCount) * 100);
        this.dom.scoreText.innerText = `Úspěšnost: ${successRate} %`;
        this.dom.nextBtn.classList.remove('hidden');
    },

    async explainAnswerWithAI() {
        const activeModel = localStorage.getItem('activeModel') || 'gemini';
        let apiKey = "";
        let endpoint = "";
        let body = {};
        let headers = { 'Content-Type': 'application/json' };

        // Configuration mapping
        const configs = {
            gemini: {
                key: 'geminiApiKey',
                url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
                errorMsg: "Google Gemini klíč chybí nebo je neplatný."
            },
            gpt: {
                key: 'gptApiKey',
                url: 'https://api.openai.com/v1/chat/completions',
                errorMsg: "OpenAI API klíč chybí nebo je neplatný."
            },
            claude: {
                key: 'claudeApiKey',
                url: 'https://api.anthropic.com/v1/messages',
                errorMsg: "Anthropic Claude klíč chybí nebo je neplatný."
            },
            mistral: {
                key: 'mistralApiKey',
                url: 'https://api.mistral.ai/v1/chat/completions',
                errorMsg: "Mistral API klíč chybí nebo je neplatný."
            }
        };

        const config = configs[activeModel];
        apiKey = localStorage.getItem(config.key);

        if (!apiKey) {
            alert(`Pro využití AI vysvětlení (${activeModel.toUpperCase()}) musíte v Administraci nejprve zadat váš osobní API klíč.`);
            return;
        }

        const q = this.questions[this.curIdx];
        const selectedBtn = this.dom.ansBox.querySelector('.ans-btn.wrong');
        const userWrongAnswer = selectedBtn ? selectedBtn.innerText : "Nevyplněno";
        const correctAnswer = q.answers[q.correct];

        this.dom.aiExplainBtn.classList.add('hidden');
        this.dom.aiExplanationBox.classList.remove('hidden');
        this.dom.aiExplanationBox.innerHTML = `
            <div class="ai-loading">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
            <p style="margin-top: 5px; font-size: 0.82rem; color: var(--text-muted); text-align: center;">${activeModel.toUpperCase()} AI analyzuje otázku...</p>
        `;

        const promptText = `
        Jsi technický expertní systém pro analýzu leteckých zkoušek EASA PPL(A).
        TVÝM ÚKOLEM JE GENEROVAT VÝHRADNĚ TECHNICKÉ ANALÝZY BEZ LIDSKÉHO PERSONA.
        
        STRIKTNÍ PRAVIDLA VÝSTUPU:
        1. START: Odpověď musí začínat technickým údajem. NESMÍ začínat slovem "Ahoj", "Dobře", "Pojďme", "Vysvětlení" ani žádným pozdravem.
        2. ZÁKAZ: Absolutní zákaz motivačních frází (např. "Oceňuji tvůj pokus", "To nevadí").
        3. TÓN: Čistě faktický, encyklopedický, strohý.
        4. FORMÁT: Max 1 odstavec, 3-4 věty. Důležité termíny **tučně**.
        
        PŘÍKLAD SPRÁVNÉ ODPOVĚDI:
        "**Relativní vlhkost** klesá s rostoucí teplotou, protože teplý vzduch má vyšší kapacitu pro vodní páru. Podle **termodynamických zákonů** dochází k..."
        
        AKTUÁLNÍ DATA K ANALÝZE:
        Otázka: "${q.question}"
        Chybná volba studenta: "${userWrongAnswer}"
        Správná odpověď: "${correctAnswer}"
        Kontext (všechny možnosti): ${q.answers.join(' | ')}
        `;

        try {
            if (activeModel === 'gemini') {
                endpoint = `${config.url}?key=${apiKey}`;
                body = { contents: [{ parts: [{ text: promptText }] }] };
            } else if (activeModel === 'gpt') {
                endpoint = config.url;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: "gpt-4o",
                    messages: [{ role: "user", content: promptText }]
                };
            } else if (activeModel === 'claude') {
                endpoint = config.url;
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
                headers['dangerously-allow-browser'] = 'true'; // Warning: usually handled via proxy, but for local use...
                body = {
                    model: "claude-3-5-sonnet-20240620",
                    max_tokens: 500,
                    messages: [{ role: "user", content: promptText }]
                };
            } else if (activeModel === 'mistral') {
                endpoint = config.url;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: "mistral-large-latest",
                    messages: [{ role: "user", content: promptText }]
                };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("AI API Error:", errData);
                throw new Error(config.errorMsg);
            }

            const data = await response.json();
            let replyText = "";

            if (activeModel === 'gemini') {
                replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            } else if (activeModel === 'gpt' || activeModel === 'mistral') {
                replyText = data.choices?.[0]?.message?.content;
            } else if (activeModel === 'claude') {
                replyText = data.content?.[0]?.text;
            }

            if (!replyText) throw new Error("AI nevrátila srozumitelnou odpověď.");

            // Basic Markdown to HTML parsing
            replyText = replyText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            replyText = replyText.replace(/\n\n/g, '<br><br>');
            replyText = replyText.replace(/\n/g, '<br>');

            this.dom.aiExplanationBox.innerHTML = replyText;

        } catch (error) {
            console.error(error);
            this.dom.aiExplanationBox.innerHTML = `<span style="color: var(--danger);">❌ Chyba: ${error.message}</span><br><small style="font-size:0.7rem;">Zkontrolujte API klíč v Administraci a stav připojení.</small>`;
            this.dom.aiExplainBtn.classList.remove('hidden');
        }
    },

    reshuffleQuiz() {
        if (confirm("Chcete aktuální test zamíchat a začít od začátku?")) {
            this.questions = this.shuffle([...this.questions]);
            this.curIdx = 0;
            this.score = 0;
            this.answeredCount = 0;
            this.dom.scoreText.innerText = "Úspěšnost: 0 %";
            this.showQuestion();
        }
    },

    nextQuestion() {
        this.curIdx++;
        if (this.curIdx < this.questions.length) {
            this.showQuestion();
        } else {
            this.finishQuiz();
        }
    },

    prevQuestion() {
        if (this.curIdx > 0) {
            this.curIdx--;
            this.showQuestion();
        }
    },

    jumpToId() {
        const idToFind = parseInt(this.dom.jumpInput.value);
        const foundIndex = this.questions.findIndex(q => q.id === idToFind);
        if (foundIndex !== -1) {
            this.curIdx = foundIndex;
            this.showQuestion();
            this.dom.jumpInput.value = "";
        } else {
            alert("Otázka s ID " + idToFind + " v aktuálním testu není.");
        }
    },

    finishQuiz() {
        alert(`Test dokončen!\nÚspěšnost: ${Math.round((this.score / this.questions.length) * 100)} % `);
        location.reload();
    },

    showHint() {
        this.dom.hintText.classList.remove('hidden');
    },

    toggleTheme() {
        const isClassic = document.body.classList.toggle('theme-classic');
        localStorage.setItem('theme', isClassic ? 'classic' : 'modern');
    },

    openAdmin() {
        this.dom.adminModal.classList.add('active');
        this.dom.geminiApiKey.value = localStorage.getItem('geminiApiKey') || '';
        this.dom.gptApiKey.value = localStorage.getItem('gptApiKey') || '';
        this.dom.claudeApiKey.value = localStorage.getItem('claudeApiKey') || '';
        this.dom.mistralApiKey.value = localStorage.getItem('mistralApiKey') || '';
        this.dom.activeModel.value = localStorage.getItem('activeModel') || 'gemini';
    },

    closeAdmin() {
        this.dom.adminModal.classList.remove('active');
        this.dom.newSubjectName.value = '';
        this.dom.jsonFileUpload.value = '';

        localStorage.setItem('geminiApiKey', this.dom.geminiApiKey.value.trim());
        localStorage.setItem('gptApiKey', this.dom.gptApiKey.value.trim());
        localStorage.setItem('claudeApiKey', this.dom.claudeApiKey.value.trim());
        localStorage.setItem('mistralApiKey', this.dom.mistralApiKey.value.trim());
        localStorage.setItem('activeModel', this.dom.activeModel.value);
    },

    handleFileUpload() {
        const name = this.dom.newSubjectName.value.trim();
        const fileInput = this.dom.jsonFileUpload;

        // Save the API key when clicking the main save button in admin
        const currentKey = this.dom.geminiApiKey.value.trim();
        if (currentKey) {
            localStorage.setItem('geminiApiKey', currentKey);
        } else {
            localStorage.removeItem('geminiApiKey');
        }

        if (!name && fileInput.files.length === 0) {
            // User just wanted to save the API key
            this.closeAdmin();
            // Optional: alert("Údaje uloženy.");
            return;
        }

        if (!name || fileInput.files.length === 0) {
            alert("Vyplňte prosím název a vyberte JSON soubor pro přidání tématu.");
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const jsonContent = JSON.parse(e.target.result);

                // Simple validation to ensure it looks like our expected format
                if (!Array.isArray(jsonContent) || jsonContent.length === 0 || !('question' in jsonContent[0])) {
                    throw new Error("Neplatný formát dat.");
                }

                const newSubjectId = 'custom_' + Date.now();
                const newSubject = {
                    id: newSubjectId,
                    name: name,
                    isCustom: true
                };

                // Get existing custom subjects
                const customSubjectsRaw = localStorage.getItem('customSubjects');
                let customSubjects = customSubjectsRaw ? JSON.parse(customSubjectsRaw) : [];

                customSubjects.push(newSubject);

                // Save subject definition and its data
                localStorage.setItem('customSubjects', JSON.stringify(customSubjects));
                localStorage.setItem(`custom_data_${newSubjectId}`, JSON.stringify(jsonContent));

                alert("Téma úspěšně nahráno!");
                this.closeAdmin();
                this.renderMenu();
            } catch (err) {
                alert("Chyba při zpracování souboru: " + err.message);
            }
        };

        reader.readAsText(file);
    }
};

// Initialize Theme early
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'classic') {
    document.body.classList.add('theme-classic');
}

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
