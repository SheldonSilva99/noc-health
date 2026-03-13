// NOC Health - script.js
// Funcionalidades principais, armazenamento local e notificações.

const STORE_KEYS = {
  cadastro: 'noc_cadastro',
  contatos: 'noc_contatos',
  remedios: 'noc_remedios',
  remediosTomados: 'noc_remedios_tomados',
  pressao: 'noc_pressao',
  glicemia: 'noc_glicemia',
  diario: 'noc_diario',
  alertas: 'noc_alertas',
  localizacao: 'noc_localizacao',
  ultimoAcesso: 'noc_ultimo_acesso',
  darkMode: 'noc_dark_mode'
};

let currentHumor = '';
let reminderTimeouts = {};
let reminderIntervals = {};
let watchId = null;
let alertAudio = null;

function getStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function formatDate(dateInput) {
  const d = new Date(dateInput);
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cryptoRandom() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function playAlertSound() {
  try {
    if (!alertAudio) {
      alertAudio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
      alertAudio.preload = 'auto';
    }
    alertAudio.currentTime = 0;
    alertAudio.play().catch(() => {});
  } catch (e) {
    console.warn('Som de alerta não pôde ser reproduzido:', e);
  }
}

function vibratePattern() {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 150, 300, 150, 500]);
  }
}

function showPopup(title, message, icon = 'ℹ️') {
  const popup = document.getElementById('global-popup');
  const titleEl = document.getElementById('popup-title');
  const msgEl = document.getElementById('popup-message');
  const iconEl = document.getElementById('popup-icon');

  if (!popup || !titleEl || !msgEl || !iconEl) {
    alert(`${title}\n\n${message}`);
    return;
  }

  titleEl.textContent = title;
  msgEl.textContent = message;
  iconEl.textContent = icon;
  popup.classList.add('active');
}

function closePopup() {
  document.getElementById('global-popup')?.classList.remove('active');
}

function addAlertRecord(tipo, mensagem) {
  const alertas = getStore(STORE_KEYS.alertas, []);
  alertas.unshift({ id: cryptoRandom(), tipo, mensagem, data: nowIso() });
  setStore(STORE_KEYS.alertas, alertas.slice(0, 100));
  renderHistoricos();
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navMap = {
    home: 'nav-home',
    cadastro: 'nav-cadastro',
    remedios: 'nav-remedios',
    saude: 'nav-saude',
    historico: 'nav-historico'
  };

  if (navMap[page]) {
    document.getElementById(navMap[page])?.classList.add('active');
  }

  if (page === 'historico') renderHistoricos();
  if (page === 'localizacao') atualizarUltimoAcessoUI();

  registrarInteracao();
}

function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const tab = document.getElementById(tabId);
  if (tab) {
    tab.style.display = 'block';
    tab.classList.add('active');
  }

  btn?.classList.add('active');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  setStore(STORE_KEYS.darkMode, document.body.classList.contains('dark-mode'));

  const btn = document.getElementById('dark-toggle');
  if (btn) {
    btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
  }
}

function applyDarkMode() {
  const enabled = getStore(STORE_KEYS.darkMode, false);
  document.body.classList.toggle('dark-mode', enabled);

  const btn = document.getElementById('dark-toggle');
  if (btn) {
    btn.textContent = enabled ? '☀️' : '🌙';
  }
}

function salvarCadastro() {
  const data = {
    nome: document.getElementById('cad-nome')?.value.trim(),
    idade: document.getElementById('cad-idade')?.value.trim(),
    condicoes: document.getElementById('cad-condicoes')?.value.trim(),
    medicamentos: document.getElementById('cad-medicamentos')?.value.trim(),
    obs: document.getElementById('cad-obs')?.value.trim()
  };

  if (!data.nome || !data.idade) {
    showPopup('Cadastro incompleto', 'Preencha pelo menos nome e idade do idoso.', '⚠️');
    return;
  }

  setStore(STORE_KEYS.cadastro, data);
  document.getElementById('cadastro-salvo')?.classList.remove('hidden');
  showPopup('Cadastro salvo', 'Os dados do idoso foram registrados com sucesso.', '✅');
  renderCadastro();
}

function editarCadastro() {
  showPage('cadastro');
}

function renderCadastro() {
  const cadastro = getStore(STORE_KEYS.cadastro, null);
  const display = document.getElementById('cadastro-display');
  const welcome = document.getElementById('welcome-name');
  const saved = document.getElementById('cadastro-salvo');

  if (welcome) {
    welcome.textContent = cadastro?.nome || 'NOC Health';
  }

  if (saved) {
    saved.classList.toggle('hidden', !cadastro);
  }

  if (!display) return;

  if (!cadastro) {
    display.innerHTML = '<p class="hint-text">Nenhum cadastro salvo ainda.</p>';
    return;
  }

  display.innerHTML = `
    <div class="history-item">
      <strong>${escapeHtml(cadastro.nome)}</strong><br>
      Idade: ${escapeHtml(cadastro.idade)} anos<br>
      Condições: ${escapeHtml(cadastro.condicoes || 'Não informado')}<br>
      Medicamentos: ${escapeHtml(cadastro.medicamentos || 'Não informado')}<br>
      Observações: ${escapeHtml(cadastro.obs || 'Nenhuma')}
    </div>
  `;

  const nome = document.getElementById('cad-nome');
  const idade = document.getElementById('cad-idade');
  const condicoes = document.getElementById('cad-condicoes');
  const medicamentos = document.getElementById('cad-medicamentos');
  const obs = document.getElementById('cad-obs');

  if (nome) nome.value = cadastro.nome || '';
  if (idade) idade.value = cadastro.idade || '';
  if (condicoes) condicoes.value = cadastro.condicoes || '';
  if (medicamentos) medicamentos.value = cadastro.medicamentos || '';
  if (obs) obs.value = cadastro.obs || '';
}

function adicionarContato() {
  const contatos = getStore(STORE_KEYS.contatos, []);

  if (contatos.length >= 3) {
    showPopup('Limite atingido', 'Você pode cadastrar no máximo 3 contatos de emergência.', '🚫');
    return;
  }

  const contato = {
    id: cryptoRandom(),
    nome: document.getElementById('ct-nome')?.value.trim(),
    telefone: document.getElementById('ct-telefone')?.value.trim(),
    parentesco: document.getElementById('ct-parentesco')?.value.trim()
  };

  if (!contato.nome || !contato.telefone) {
    showPopup('Contato incompleto', 'Informe pelo menos nome e telefone.', '⚠️');
    return;
  }

  contatos.push(contato);
  setStore(STORE_KEYS.contatos, contatos);

  document.getElementById('ct-nome').value = '';
  document.getElementById('ct-telefone').value = '';
  document.getElementById('ct-parentesco').value = '';

  renderContatos();
  showPopup('Contato salvo', 'Contato de emergência cadastrado.', '📞');
}

function removerContato(id) {
  const contatos = getStore(STORE_KEYS.contatos, []).filter(c => c.id !== id);
  setStore(STORE_KEYS.contatos, contatos);
  renderContatos();
}

function renderContatos() {
  const contatos = getStore(STORE_KEYS.contatos, []);
  const list = document.getElementById('contatos-list');

  if (!list) return;

  if (!contatos.length) {
    list.innerHTML = '<p class="hint-text">Nenhum contato cadastrado.</p>';
    return;
  }

  list.innerHTML = contatos.map(c => `
    <div class="history-item">
      <strong>${escapeHtml(c.nome)}</strong> — ${escapeHtml(c.parentesco || 'Contato')}<br>
      <a href="tel:${encodeURIComponent(c.telefone)}">${escapeHtml(c.telefone)}</a>
      <div style="margin-top:10px">
        <button class="btn-secondary" onclick="removerContato('${c.id}')">Remover</button>
      </div>
    </div>
  `).join('');
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetTomadoSeNovoDia() {
  const data = getStore(STORE_KEYS.remediosTomados, { day: getTodayKey(), items: {} });
  const today = getTodayKey();

  if (data.day !== today) {
    setStore(STORE_KEYS.remediosTomados, { day: today, items: {} });
  }
}

function getRemediosTomados() {
  resetTomadoSeNovoDia();
  return getStore(STORE_KEYS.remediosTomados, { day: getTodayKey(), items: {} });
}

function setRemedioTomado(id, value = true) {
  const data = getRemediosTomados();
  data.items[id] = value;
  setStore(STORE_KEYS.remediosTomados, data);
}

function adicionarRemedio() {
  const remedio = {
    id: cryptoRandom(),
    nome: document.getElementById('rem-nome')?.value.trim(),
    horario: document.getElementById('rem-horario')?.value,
    qtd: document.getElementById('rem-qtd')?.value.trim(),
    obs: document.getElementById('rem-obs')?.value.trim(),
    ativo: true,
    createdAt: nowIso()
  };

  if (!remedio.nome || !remedio.horario || !remedio.qtd) {
    showPopup('Remédio incompleto', 'Informe nome, horário e quantidade.', '⚠️');
    return;
  }

  const remedios = getStore(STORE_KEYS.remedios, []);
  remedios.push(remedio);
  setStore(STORE_KEYS.remedios, remedios);

  resetTomadoSeNovoDia();
  scheduleMedicationReminder(remedio);
  renderRemedios();
  ensureNotificationPermission();

  document.getElementById('rem-nome').value = '';
  document.getElementById('rem-horario').value = '';
  document.getElementById('rem-qtd').value = '';
  document.getElementById('rem-obs').value = '';

  showPopup('Lembrete salvo', 'O remédio foi cadastrado e os alertas foram programados.', '💊');
}

function removerRemedio(id) {
  clearReminder(id);

  const remedios = getStore(STORE_KEYS.remedios, []).filter(r => r.id !== id);
  setStore(STORE_KEYS.remedios, remedios);

  const tomado = getRemediosTomados();
  delete tomado.items[id];
  setStore(STORE_KEYS.remediosTomados, tomado);

  renderRemedios();
}

function marcarTomado(id) {
  setRemedioTomado(id, true);
  clearReminder(id);
  renderRemedios();
  updateDashboard();
  showPopup('Remédio confirmado', 'O lembrete foi marcado como tomado.', '✅');
}

function clearReminder(id) {
  if (reminderTimeouts[id]) {
    clearTimeout(reminderTimeouts[id]);
    delete reminderTimeouts[id];
  }

  if (reminderIntervals[id]) {
    clearInterval(reminderIntervals[id]);
    delete reminderIntervals[id];
  }
}

function nextOccurrenceMs(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const target = new Date();

  target.setHours(h, m, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

async function showSystemNotification(title, body) {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    await reg.showNotification(title, {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'noc-health',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300]
    });

    return true;
  } catch (e) {
    console.warn('Falha na notificação do sistema:', e);
    return false;
  }
}

async function triggerMedicationAlert(remedio, attempt) {
  const msg = `Hora de tomar ${remedio.nome} — ${remedio.qtd}. Lembrete ${attempt} de 3.`;

  playAlertSound();
  vibratePattern();

  const notified = await showSystemNotification('💊 Lembrete de remédio', msg);

  if (!notified) {
    console.warn('Notificação do sistema não exibida. Mostrando popup.');
  }

  showPopup('Lembrete de remédio', msg, '💊');
  addAlertRecord('Remédio', msg);
}

async function escalateMedicationMissed(remedio) {
  const msg = `O remédio ${remedio.nome} não foi marcado como tomado após 3 lembretes.`;

  playAlertSound();
  vibratePattern();

  await showSystemNotification('🚨 Alerta de medicação', msg);
  showPopup('Alerta de medicação', msg, '🚨');
  addAlertRecord('Emergência', msg);

  abrirSmsParaContatos(`ALERTA NOC Health: ${msg}${composeLocationText()}`);
}

function scheduleMedicationReminder(remedio) {
  clearReminder(remedio.id);

  reminderTimeouts[remedio.id] = setTimeout(async () => {
    let attempt = 1;

    const tomadoAgora = !!getRemediosTomados().items[remedio.id];
    if (tomadoAgora) {
      clearReminder(remedio.id);
      renderRemedios();
      return;
    }

    await triggerMedicationAlert(remedio, attempt);

    reminderIntervals[remedio.id] = setInterval(async () => {
      const tomado = !!getRemediosTomados().items[remedio.id];

      if (tomado) {
        clearReminder(remedio.id);
        renderRemedios();
        return;
      }

      attempt += 1;

      if (attempt <= 3) {
        await triggerMedicationAlert(remedio, attempt);
      }

      if (attempt >= 3) {
        clearReminder(remedio.id);
        await escalateMedicationMissed(remedio);
      }

      renderRemedios();
    }, 5 * 60 * 1000);

    renderRemedios();
  }, nextOccurrenceMs(remedio.horario));
}

function renderRemedios() {
  const remedios = getStore(STORE_KEYS.remedios, []);
  const list = document.getElementById('remedios-list');

  if (!list) return;

  if (!remedios.length) {
    list.innerHTML = '<p class="hint-text">Nenhum remédio cadastrado.</p>';
    updateDashboard();
    return;
  }

  const tomados = getRemediosTomados().items;

  list.innerHTML = remedios.map(r => {
    const tomado = !!tomados[r.id];
    const agendado = !!(reminderTimeouts[r.id] || reminderIntervals[r.id]);

    return `
      <div class="history-item">
        <strong>${escapeHtml(r.nome)}</strong><br>
        Horário: ${escapeHtml(r.horario)}<br>
        Dose: ${escapeHtml(r.qtd)}<br>
        Observações: ${escapeHtml(r.obs || 'Nenhuma')}<br>
        Status: ${tomado ? '✅ Tomado hoje' : agendado ? '🔔 Lembrete ativo' : '⏳ Aguardando próximo horário'}
        <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
          <button class="btn-primary" onclick="marcarTomado('${r.id}')">✅ Tomado</button>
          <button class="btn-secondary" onclick="removerRemedio('${r.id}')">🗑️ Remover</button>
        </div>
      </div>
    `;
  }).join('');

  updateDashboard();
}

function registrarPressao() {
  const max = Number(document.getElementById('pr-max')?.value);
  const min = Number(document.getElementById('pr-min')?.value);

  if (!max || !min) {
    showPopup('Dados incompletos', 'Informe pressão máxima e mínima.', '⚠️');
    return;
  }

  const item = { id: cryptoRandom(), max, min, data: nowIso() };
  const arr = getStore(STORE_KEYS.pressao, []);
  arr.unshift(item);
  setStore(STORE_KEYS.pressao, arr.slice(0, 100));

  document.getElementById('pr-max').value = '';
  document.getElementById('pr-min').value = '';

  renderPressao();

  const alta = max >= 14 || min >= 9;

  if (alta) {
    const msg = `Pressão elevada registrada: ${max}/${min}. Verificar o idoso.`;
    showPopup('Pressão alta', msg, '🩺');
    addAlertRecord('Pressão', msg);
    showSystemNotification('🚨 Pressão alta', msg);
    abrirSmsParaContatos(`ALERTA NOC Health: ${msg}${composeLocationText()}`);
  } else {
    showPopup('Pressão registrada', `Medição ${max}/${min} salva com sucesso.`, '✅');
  }

  updateDashboard();
}

function renderPressao() {
  const arr = getStore(STORE_KEYS.pressao, []);
  const containers = [
    document.getElementById('pressao-historico'),
    document.getElementById('hist-pressao')
  ].filter(Boolean);

  const html = arr.length
    ? arr.map(p => `
      <div class="history-item">
        <strong>${p.max}/${p.min}</strong> — ${p.max >= 14 || p.min >= 9 ? '🚨 Alta' : '✅ Normal'}<br>
        ${formatDate(p.data)}
      </div>
    `).join('')
    : '<p class="hint-text">Nenhuma medição registrada.</p>';

  containers.forEach(c => c.innerHTML = html);
}

function registrarGlicemia() {
  const valor = Number(document.getElementById('gl-valor')?.value);
  const obs = document.getElementById('gl-obs')?.value.trim();

  if (!valor) {
    showPopup('Valor inválido', 'Informe o valor da glicemia.', '⚠️');
    return;
  }

  const item = { id: cryptoRandom(), valor, obs, data: nowIso() };
  const arr = getStore(STORE_KEYS.glicemia, []);
  arr.unshift(item);
  setStore(STORE_KEYS.glicemia, arr.slice(0, 100));

  document.getElementById('gl-valor').value = '';
  document.getElementById('gl-obs').value = '';

  renderGlicemia();

  let status = 'normal';
  let msg = `Glicemia ${valor} mg/dL registrada.`;

  if (valor < 70) {
    status = 'hipoglicemia';
    msg = `Possível hipoglicemia detectada: ${valor} mg/dL.`;
  } else if (valor >= 126) {
    status = 'hiperglicemia';
    msg = `Possível hiperglicemia detectada: ${valor} mg/dL.`;
  }

  if (status === 'normal') {
    showPopup('Glicemia registrada', msg, '✅');
  } else {
    showPopup('Alerta de glicemia', msg, '🩸');
    addAlertRecord('Glicemia', msg);
    showSystemNotification('🚨 Alerta de glicemia', msg);
    abrirSmsParaContatos(`ALERTA NOC Health: ${msg}${composeLocationText()}`);
  }

  updateDashboard();
}

function renderGlicemia() {
  const arr = getStore(STORE_KEYS.glicemia, []);
  const containers = [
    document.getElementById('glicemia-historico'),
    document.getElementById('hist-glicemia')
  ].filter(Boolean);

  const html = arr.length
    ? arr.map(g => `
      <div class="history-item">
        <strong>${g.valor} mg/dL</strong><br>
        ${escapeHtml(g.obs || 'Sem observações')}<br>
        ${formatDate(g.data)}
      </div>
    `).join('')
    : '<p class="hint-text">Nenhuma glicemia registrada.</p>';

  containers.forEach(c => c.innerHTML = html);
}

function selectHumor(btn) {
  document.querySelectorAll('.humor-btn').forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  currentHumor = btn.dataset.humor || '';
}

function salvarDiario() {
  const item = {
    id: cryptoRandom(),
    humor: currentHumor || 'Não informado',
    sintomas: document.getElementById('diario-sintomas')?.value.trim(),
    medicamentos: document.getElementById('diario-medicamentos')?.value.trim(),
    obs: document.getElementById('diario-obs')?.value.trim(),
    data: nowIso()
  };

  const arr = getStore(STORE_KEYS.diario, []);
  arr.unshift(item);
  setStore(STORE_KEYS.diario, arr.slice(0, 100));

  document.getElementById('diario-sintomas').value = '';
  document.getElementById('diario-medicamentos').value = '';
  document.getElementById('diario-obs').value = '';

  currentHumor = '';
  document.querySelectorAll('.humor-btn').forEach(el => el.classList.remove('selected'));

  renderDiario();
  showPopup('Diário salvo', 'Registro diário salvo com sucesso.', '📝');
  updateDashboard();
}

function renderDiario() {
  const arr = getStore(STORE_KEYS.diario, []);
  const containers = [
    document.getElementById('diario-historico'),
    document.getElementById('hist-diario')
  ].filter(Boolean);

  const html = arr.length
    ? arr.map(d => `
      <div class="history-item">
        <strong>${escapeHtml(d.humor)}</strong><br>
        Sintomas: ${escapeHtml(d.sintomas || 'Nenhum')}<br>
        Medicamentos: ${escapeHtml(d.medicamentos || 'Nenhum')}<br>
        Observações: ${escapeHtml(d.obs || 'Nenhuma')}<br>
        ${formatDate(d.data)}
      </div>
    `).join('')
    : '<p class="hint-text">Nenhum registro diário salvo.</p>';

  containers.forEach(c => c.innerHTML = html);

  const dataEl = document.getElementById('diario-data');
  if (dataEl) {
    dataEl.textContent = formatDate(nowIso());
  }
}

function renderAlertas() {
  const arr = getStore(STORE_KEYS.alertas, []);
  const c = document.getElementById('hist-alertas');

  if (!c) return;

  c.innerHTML = arr.length
    ? arr.map(a => `
      <div class="history-item">
        <strong>${escapeHtml(a.tipo)}</strong><br>
        ${escapeHtml(a.mensagem)}<br>
        ${formatDate(a.data)}
      </div>
    `).join('')
    : '<p class="hint-text">Nenhum alerta registrado.</p>';
}

function renderHistoricos() {
  renderPressao();
  renderGlicemia();
  renderDiario();
  renderAlertas();
}

function updateDashboard() {
  const p = getStore(STORE_KEYS.pressao, [])[0];
  const g = getStore(STORE_KEYS.glicemia, [])[0];
  const diario = getStore(STORE_KEYS.diario, [])[0];
  const tomados = getRemediosTomados().items;
  const remedios = getStore(STORE_KEYS.remedios, []);
  const pendente = remedios.some(r => !tomados[r.id]);

  const stPressao = document.getElementById('st-pressao');
  const stGlicemia = document.getElementById('st-glicemia');
  const stRemedio = document.getElementById('st-remedio');
  const stHumor = document.getElementById('st-humor');

  const boxPressao = document.getElementById('status-pressao');
  const boxGlicemia = document.getElementById('status-glicemia');
  const boxRemedio = document.getElementById('status-remedio');
  const boxHumor = document.getElementById('status-humor');

  const tudoCerto = document.getElementById('tudo-certo-msg');

  if (stPressao) stPressao.textContent = p ? `${p.max}/${p.min}` : '--';
  if (stGlicemia) stGlicemia.textContent = g ? `${g.valor} mg/dL` : '--';
  if (stRemedio) stRemedio.textContent = remedios.length ? (pendente ? 'Pendente' : 'Em dia') : '--';
  if (stHumor) stHumor.textContent = diario ? diario.humor.split(' ')[0] : '--';

  boxPressao?.classList.remove('ok', 'warn', 'alert');
  boxGlicemia?.classList.remove('ok', 'warn', 'alert');
  boxRemedio?.classList.remove('ok', 'warn', 'alert');
  boxHumor?.classList.remove('ok', 'warn', 'alert');

  if (boxPressao) {
    boxPressao.classList.add(!p ? 'warn' : (p.max >= 14 || p.min >= 9 ? 'alert' : 'ok'));
  }

  if (boxGlicemia) {
    boxGlicemia.classList.add(!g ? 'warn' : (g.valor < 70 || g.valor >= 126 ? 'alert' : g.valor >= 100 ? 'warn' : 'ok'));
  }

  if (boxRemedio) {
    boxRemedio.classList.add(!remedios.length ? 'warn' : (pendente ? 'warn' : 'ok'));
  }

  if (boxHumor) {
    boxHumor.classList.add(!diario ? 'warn' : (/😔|😣/.test(diario.humor) ? 'alert' : 'ok'));
  }

  const allGood =
    p &&
    g &&
    !pendente &&
    diario &&
    p.max < 14 &&
    p.min < 9 &&
    g.valor >= 70 &&
    g.valor < 126 &&
    !/😔|😣/.test(diario.humor);

  if (tudoCerto) {
    tudoCerto.classList.toggle('hidden', !allGood);
  }
}

function composeLocationText() {
  const loc = getStore(STORE_KEYS.localizacao, null);
  if (!loc?.lat || !loc?.lng) return '';
  return ` Localização: https://maps.google.com/?q=${loc.lat},${loc.lng}`;
}

function abrirSmsParaContatos(mensagem) {
  const contatos = getStore(STORE_KEYS.contatos, []);

  if (!contatos.length) return;

  const numeros = contatos.map(c => c.telefone).join(',');
  const url = `sms:${encodeURIComponent(numeros)}?body=${encodeURIComponent(mensagem)}`;
  window.location.href = url;
}

function triggerEmergency() {
  const msg = `Emergência acionada manualmente.${composeLocationText()}`;
  playAlertSound();
  vibratePattern();
  showPopup('Emergência acionada', 'Os contatos de emergência serão avisados.', '🆘');
  addAlertRecord('SOS', msg);
  showSystemNotification('🆘 Emergência', msg);
  abrirSmsParaContatos(`ALERTA NOC Health: ${msg}`);
}

function obterLocalizacao() {
  if (!navigator.geolocation) {
    showPopup('Localização indisponível', 'Este navegador não suporta geolocalização.', '📍');
    return;
  }

  const status = document.getElementById('loc-status');
  if (status) {
    status.textContent = 'Solicitando localização...';
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const loc = {
      lat: pos.coords.latitude.toFixed(6),
      lng: pos.coords.longitude.toFixed(6),
      accuracy: Math.round(pos.coords.accuracy),
      data: nowIso()
    };

    setStore(STORE_KEYS.localizacao, loc);
    renderLocalizacao();
    showPopup('Localização obtida', 'A localização atual foi registrada com sucesso.', '📍');

    try {
      if (watchId === null) {
        watchId = navigator.geolocation.watchPosition(p => {
          const current = {
            lat: p.coords.latitude.toFixed(6),
            lng: p.coords.longitude.toFixed(6),
            accuracy: Math.round(p.coords.accuracy),
            data: nowIso()
          };

          setStore(STORE_KEYS.localizacao, current);
          renderLocalizacao();
        });
      }
    } catch (e) {
      console.warn('watchPosition falhou:', e);
    }
  }, err => {
    const messages = {
      1: 'Permissão de localização negada.',
      2: 'Não foi possível obter a posição atual.',
      3: 'Tempo excedido ao solicitar localização.'
    };

    if (status) {
      status.textContent = messages[err.code] || 'Erro ao obter localização.';
    }

    showPopup('Falha na localização', messages[err.code] || 'Erro ao obter localização.', '⚠️');
  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
}

function renderLocalizacao() {
  const loc = getStore(STORE_KEYS.localizacao, null);
  const status = document.getElementById('loc-status');
  const coords = document.getElementById('loc-coords');

  if (!coords || !status) return;

  if (!loc) {
    status.textContent = 'Clique para obter sua localização.';
    coords.classList.add('hidden');
    coords.innerHTML = '';
    return;
  }

  status.textContent = 'Localização atual registrada.';
  coords.classList.remove('hidden');
  coords.innerHTML = `
    <strong>Latitude:</strong> ${loc.lat}<br>
    <strong>Longitude:</strong> ${loc.lng}<br>
    <strong>Precisão:</strong> ${loc.accuracy} m<br>
    <strong>Atualizado:</strong> ${formatDate(loc.data)}<br><br>
    <a href="https://maps.google.com/?q=${loc.lat},${loc.lng}" target="_blank" rel="noopener">Abrir no mapa</a>
  `;
}

function registrarInteracao() {
  localStorage.setItem(STORE_KEYS.ultimoAcesso, nowIso());
  atualizarUltimoAcessoUI();
}

function atualizarUltimoAcessoUI() {
  const ultimo = localStorage.getItem(STORE_KEYS.ultimoAcesso);
  const el = document.getElementById('ultimo-acesso');
  const badge = document.getElementById('atividade-status');

  if (el) {
    el.textContent = ultimo
      ? `Última interação no app: ${formatDate(ultimo)}`
      : 'Ainda sem interação registrada.';
  }

  if (badge) {
    badge.className = 'status-badge ok';
    badge.textContent = '🟢 Atividade detectada recentemente';
  }
}

function verificarInatividade() {
  const ultimo = localStorage.getItem(STORE_KEYS.ultimoAcesso);
  if (!ultimo) return;

  const agora = new Date();
  const hora = agora.getHours();

  if (hora < 8 || hora > 22) return;

  const diffMs = agora.getTime() - new Date(ultimo).getTime();

  if (diffMs > 2 * 60 * 60 * 1000) {
    const badge = document.getElementById('atividade-status');
    if (badge) {
      badge.className = 'status-badge alert';
      badge.textContent = '🔴 Inatividade prolongada detectada';
    }

    const msg = `Inatividade prolongada detectada durante o dia.${composeLocationText()}`;
    addAlertRecord('Inatividade', msg);
    showSystemNotification('🚨 Alerta de inatividade', msg);
  }
}

function simularInatividade() {
  const fake = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  localStorage.setItem(STORE_KEYS.ultimoAcesso, fake);
  verificarInatividade();
  showPopup('Simulação concluída', 'Foi simulada uma inatividade prolongada.', '⏱️');
  atualizarUltimoAcessoUI();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    console.log('Service worker registrado com sucesso:', reg);
  } catch (e) {
    console.warn('Service worker não registrado:', e);
  }
}

function createNotificationButton() {
  if (!('Notification' in window) || Notification.permission === 'granted') return;
  const existing = document.getElementById('btn-ativar-notificacoes');
  if (existing) return;

  const app = document.getElementById('app');
  const btn = document.createElement('button');

  btn.id = 'btn-ativar-notificacoes';
  btn.className = 'btn-primary';
  btn.style.marginBottom = '14px';
  btn.textContent = '🔔 Ativar notificações do celular';
  btn.addEventListener('click', ensureNotificationPermission);

  app?.prepend(btn);
}

async function ensureNotificationPermission() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    await registerServiceWorker();
    document.getElementById('btn-ativar-notificacoes')?.remove();
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    await registerServiceWorker();
    showPopup('Notificações ativadas', 'Os lembretes de remédio poderão aparecer no topo do celular.', '🔔');
    document.getElementById('btn-ativar-notificacoes')?.remove();
  } else {
    showPopup('Notificações bloqueadas', 'Permita notificações no navegador para receber alertas no topo do celular.', '⚠️');
  }
}

function limparHistorico() {
  if (!confirm('Tem certeza que deseja limpar todo o histórico?')) return;

  [STORE_KEYS.pressao, STORE_KEYS.glicemia, STORE_KEYS.diario, STORE_KEYS.alertas].forEach(k => {
    localStorage.removeItem(k);
  });

  renderHistoricos();
  updateDashboard();
  showPopup('Histórico limpo', 'Os registros foram apagados.', '🗑️');
}

function attachGlobalActivityListeners() {
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, registrarInteracao, { passive: true });
  });
}

function initialRender() {
  const greeting = document.getElementById('greeting-text');
  const today = document.getElementById('today-date');
  const hour = new Date().getHours();

  if (greeting) {
    greeting.textContent = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  }

  if (today) {
    today.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  renderCadastro();
  renderContatos();
  renderRemedios();
  renderHistoricos();
  renderLocalizacao();
  atualizarUltimoAcessoUI();
  updateDashboard();

  const remedios = getStore(STORE_KEYS.remedios, []);
  remedios.forEach(scheduleMedicationReminder);
}

document.addEventListener('DOMContentLoaded', async () => {
  applyDarkMode();
  await registerServiceWorker();
  createNotificationButton();
  initialRender();
  attachGlobalActivityListeners();
  showPage('home');
  verificarInatividade();
  setInterval(verificarInatividade, 60 * 1000);
});
