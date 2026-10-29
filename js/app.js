(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const money = value => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  let clients = [];
  let debts = [];
  let deferredInstall = null;

  const loginGate = $('loginGate');
  const appShell = $('appShell');
  const loginError = $('loginError');
  const debtDialog = $('debtDialog');
  const detailDialog = $('detailDialog');

  function toast(message) {
    const element = $('toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove('visible');
    }, 3000);
  }

  function showLogin(message = '') {
    loginGate.hidden = false;
    appShell.hidden = true;
    loginError.textContent = message;
  }

  function showApp() {
    loginGate.hidden = true;
    appShell.hidden = false;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('pt-BR');
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  async function refresh() {
    $('connectionStatus').textContent = 'Carregando...';

    const data = await FiadosDB.listAll();
    clients = data.clients;
    debts = data.debts;

    $('connectionStatus').textContent = 'Supabase conectado';
    renderDashboard();
    renderClients();
    renderHistory();
  }

  function renderDashboard() {
    const openDebts = debts.filter(debt => debt.status === 'aberta');
    const total = openDebts.reduce(
      (sum, debt) => sum + Number(debt.amount), 0
    );
    const clientIds = new Set(openDebts.map(debt => debt.clientId));

    $('openDebtTotal').textContent = money(total);
    $('openClientCount').textContent = clientIds.size;
    $('openDebtCount').textContent = openDebts.length;
  }

  function renderClients() {
    const query = $('searchInput').value.trim().toLocaleLowerCase('pt-BR');

    const filtered = clients.filter(client => {
      const text = `${client.name} ${client.phone}`.toLocaleLowerCase('pt-BR');
      return text.includes(query);
    });

    $('clientListCount').textContent =
      `${filtered.length} cliente(s) encontrado(s)`;

    if (!filtered.length) {
      $('clientList').innerHTML =
        '<p class="empty">Nenhum cliente encontrado.</p>';
      return;
    }

    $('clientList').innerHTML = filtered.map(client => {
      const clientDebts = debts.filter(debt =>
        debt.clientId === client.id && debt.status === 'aberta'
      );
      const total = clientDebts.reduce(
        (sum, debt) => sum + Number(debt.amount), 0
      );

      return `
        <article class="client-card">
          <button class="client-open" data-action="details"
            data-id="${escapeHTML(client.id)}">
            <span class="avatar">${escapeHTML(
              client.name.trim().charAt(0).toUpperCase()
            )}</span>
            <span class="client-info">
              <strong>${escapeHTML(client.name)}</strong>
              <small>${escapeHTML(client.phone || 'Sem telefone')}</small>
              <small>${clientDebts.length} pendência(s) aberta(s)</small>
            </span>
            <span class="client-total">${money(total)}</span>
          </button>
        </article>
      `;
    }).join('');
  }

  function renderHistory() {
    const paid = debts.filter(debt => debt.status === 'paga');

    if (!paid.length) {
      $('paidHistory').innerHTML =
        '<p class="empty">Nenhum pagamento registrado ainda.</p>';
      return;
    }

    $('paidHistory').innerHTML = paid.slice(0, 20).map(debt => {
      const client = clients.find(item => item.id === debt.clientId);
      return `
        <div class="history-row">
          <div>
            <strong>${escapeHTML(client?.name || 'Cliente')}</strong>
            <small>${escapeHTML(debt.description || debt.type)} ·
              ${formatDate(debt.paidAt)}</small>
          </div>
          <strong>${money(debt.amount)}</strong>
        </div>
      `;
    }).join('');
  }

  function customerUrl(client) {
    const url = new URL('cliente.html', window.location.href);
    url.searchParams.set('token', client.token);
    return url.href;
  }

  function whatsappUrl(phone, message) {
    const number = String(phone || '').replace(/\D/g, '');
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function showDetails(clientId) {
    const client = clients.find(item => item.id === clientId);
    if (!client) return;

    const clientDebts = debts.filter(debt => debt.clientId === client.id);
    const openDebts = clientDebts.filter(debt => debt.status === 'aberta');
    const total = openDebts.reduce(
      (sum, debt) => sum + Number(debt.amount), 0
    );
    const url = customerUrl(client);

    $('detailContent').innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">CLIENTE</p>
          <h2>${escapeHTML(client.name)}</h2>
          <p class="muted">${escapeHTML(client.phone || 'Sem telefone')}</p>
        </div>
        <button type="button" class="close-button"
          data-action="close-details" aria-label="Fechar">×</button>
      </div>

      <div class="detail-total">
        <span>Total em aberto</span>
        <strong>${money(total)}</strong>
      </div>

      <div class="detail-actions">
        <button class="button secondary" data-action="copy-link"
          data-url="${escapeHTML(url)}">Copiar link do cliente</button>
        ${client.phone ? `
          <a class="button whatsapp" target="_blank" rel="noopener"
            href="${whatsappUrl(client.phone,
              `Olá, ${client.name}! Aqui está o link para consultar sua conta na Alex MT Barber: ${url}`)}">
            Enviar link pelo WhatsApp
          </a>` : ''}
        <button class="button primary" data-action="add-for-client"
          data-id="${escapeHTML(client.id)}">Adicionar fiado</button>
      </div>

      <h3>Pendências</h3>
      <div class="detail-debts">
        ${clientDebts.length ? clientDebts.map(debt => `
          <div class="debt-row">
            <div>
              <strong>${escapeHTML(debt.description || (
                debt.type === 'corte' ? 'Corte' : 'Produto'
              ))}</strong>
              <small>${formatDate(debt.createdAt)} ·
                ${debt.status === 'paga' ? 'Paga' : 'Em aberto'}</small>
              <strong>${money(debt.amount)}</strong>
            </div>
            ${debt.status === 'aberta' ? `
              <button class="button primary small"
                data-action="mark-paid" data-id="${escapeHTML(debt.id)}">
                Marcar paga
              </button>` : ''}
          </div>
        `).join('') : '<p class="empty">Nenhuma pendência cadastrada.</p>'}
      </div>
    `;

    detailDialog.showModal();
  }

  function openNewDebt(clientId = null) {
    $('debtForm').reset();
    $('debtError').textContent = '';
    $('debtForm').dataset.clientId = clientId || '';
    $('customerName').disabled = Boolean(clientId);
    $('customerPhone').disabled = Boolean(clientId);

    if (clientId) {
      const client = clients.find(item => item.id === clientId);
      if (client) {
        $('customerName').value = client.name;
        $('customerPhone').value = client.phone;
      }
    }

    if (detailDialog.open) detailDialog.close();
    debtDialog.showModal();
  }

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('loginSubmit');
    button.disabled = true;
    button.textContent = 'Entrando...';
    loginError.textContent = '';

    try {
      await FiadosDB.signIn(
        $('loginEmail').value.trim(),
        $('loginPassword').value
      );
      showApp();
      await refresh();
    } catch (error) {
      console.error(error);
      showLogin('Não foi possível entrar. Confira o e-mail, a senha e a configuração do Supabase.');
    } finally {
      button.disabled = false;
      button.textContent = 'Entrar';
    }
  });

  $('logoutButton').addEventListener('click', async () => {
    try {
      await FiadosDB.signOut();
      clients = [];
      debts = [];
      showLogin();
    } catch (error) {
      console.error(error);
      toast('Não foi possível sair. Tente novamente.');
    }
  });

  $('newDebtButton').addEventListener('click', () => openNewDebt());
  $('closeDebtDialog').addEventListener('click', () => debtDialog.close());
  $('searchInput').addEventListener('input', renderClients);

  $('debtForm').addEventListener('submit', async event => {
    event.preventDefault();

    const button = $('saveDebtButton');
    const errorBox = $('debtError');
    button.disabled = true;
    button.textContent = 'Salvando...';
    errorBox.textContent = '';

    try {
      const amount = Number($('debtAmount').value);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Informe um valor maior que zero.');
      }

      const clientId = $('debtForm').dataset.clientId;
      let result;

      if (clientId) {
        const debt = await FiadosDB.addDebt({
          clientId,
          amount,
          type: $('debtType').value,
          description: $('debtDescription').value.trim()
        });
        result = { debt };
      } else {
        result = await FiadosDB.addClientAndDebt({
          name: $('customerName').value.trim(),
          phone: $('customerPhone').value.trim(),
          amount,
          type: $('debtType').value,
          description: $('debtDescription').value.trim()
        });
      }

      debtDialog.close();
      await refresh();
      toast('Fiado registrado com sucesso.');

      if (result.client) showDetails(result.client.id);
      else if (clientId) showDetails(clientId);
    } catch (error) {
      console.error(error);
      errorBox.textContent = error.message ||
        'Não foi possível salvar. Verifique o acesso ao banco.';
    } finally {
      button.disabled = false;
      button.textContent = 'Salvar fiado';
    }
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    try {
      if (action === 'details') showDetails(id);

      if (action === 'close-details') detailDialog.close();

      if (action === 'add-for-client') openNewDebt(id);

      if (action === 'copy-link') {
        await navigator.clipboard.writeText(button.dataset.url);
        toast('Link copiado.');
      }

      if (action === 'mark-paid') {
        if (!confirm('Confirma que esta pendência foi paga?')) return;
        await FiadosDB.markPaid(id);
        await refresh();
        toast('Pagamento registrado.');
        const debt = debts.find(item => item.id === id);
        if (debt) showDetails(debt.clientId);
      }
    } catch (error) {
      console.error(error);
      toast('Não foi possível concluir a operação.');
    }
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    $('installButton').hidden = false;
  });

  $('installButton').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('installButton').hidden = true;
  });

  async function init() {
    if (!FiadosDB.online) {
      showLogin('A biblioteca do Supabase não carregou. Verifique sua conexão.');
      return;
    }

    try {
      const session = await FiadosDB.getSession();
      if (!session) {
        showLogin();
        return;
      }

      showApp();
      await refresh();
    } catch (error) {
      console.error(error);
      showLogin('Não foi possível validar o acesso. Entre novamente.');
    }
  }

  if (FiadosDB.client) {
    FiadosDB.client.auth.onAuthStateChange((_event, session) => {
      if (!session) showLogin();
    });
  }

  init();
})();