(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const money = value => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('pt-BR');
  }

  function renderDebts(element, items, emptyText) {
    if (!items.length) {
      element.innerHTML = `<p class="empty">${emptyText}</p>`;
      return;
    }

    element.innerHTML = items.map(debt => `
      <article class="debt-card">
        <div class="debt-top">
          <strong>${escapeHTML(debt.description || (
            debt.type === 'corte' ? 'Corte' : 'Produto'
          ))}</strong>
          <strong>${money(debt.amount)}</strong>
        </div>
        <div class="debt-bottom">
          <span>${formatDate(
            debt.status === 'paga' ? debt.paidAt : debt.createdAt
          )}</span>
          <span class="status ${debt.status === 'paga' ? 'paid' : 'open'}">
            ${debt.status === 'paga' ? 'Paga' : 'Em aberto'}
          </span>
        </div>
      </article>
    `).join('');
  }

  async function init() {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      $('loading').hidden = true;
      $('errorMessage').hidden = false;
      return;
    }

    try {
      const result = await FiadosDB.getCustomerByToken(token);

      if (!result || !result.client) {
        $('loading').hidden = true;
        $('errorMessage').hidden = false;
        return;
      }

      const { client, debts } = result;
      const openDebts = debts.filter(debt => debt.status === 'aberta');
      const paidDebts = debts.filter(debt => debt.status === 'paga');

      const total = openDebts.reduce(
        (sum, debt) => sum + Number(debt.amount), 0
      );

      $('customerName').textContent = client.name;
      $('customerPhone').textContent = client.phone
        ? `Telefone: ${client.phone}`
        : '';

      $('customerTotal').textContent = money(total);

      renderDebts(
        $('openDebts'),
        openDebts,
        'Você não tem pendências em aberto.'
      );

      renderDebts(
        $('paidDebts'),
        paidDebts,
        'Nenhum pagamento registrado ainda.'
      );

      $('loading').hidden = true;
      $('customerContent').hidden = false;
    } catch (error) {
      console.error(error);
      $('loading').hidden = true;
      $('errorMessage').hidden = false;
    }
  }

  init();
})();