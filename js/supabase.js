
/*
 * Alex MT Barber — conexão com Supabase
 * Arquivo: js/supabase.js
 *
 * Usa somente a chave pública publishable.
 * Nunca coloque uma chave secret ou service_role aqui.
 */

(() => {
  'use strict';

  // Dados do projeto NOVO
  const SUPABASE_URL =
    'https://hddtldapdnnzuyijieax.supabase.co';

  const SUPABASE_ANON_KEY =
    'sb_publishable_P_ld9bhfKd3OPNVQQ28gLQ_rOnKFXUr';

  // Inicialização do Supabase
  let client = null;

  function verificarConexao() {
    if (
      !SUPABASE_URL.startsWith('https://') ||
      !SUPABASE_URL.endsWith('.supabase.co')
    ) {
      throw new Error(
        'A URL do Supabase está incorreta.'
      );
    }

    if (!SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
      throw new Error(
        'A chave pública do Supabase está incorreta.'
      );
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== 'function'
    ) {
      throw new Error(
        'A biblioteca do Supabase não foi carregada. Confira os scripts HTML.'
      );
    }

    if (!client) {
      client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }

    return client;
  }

  const agora = () => new Date().toISOString();

  function gerarToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, byte =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  function normalizarCliente(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      phone: row.phone || '',
      token: row.token,
      createdAt: row.created_at || row.createdAt || agora()
    };
  }

  function normalizarPendencia(row) {
    return {
      id: row.id,
      clientId: row.cliente_id ?? row.clientId,
      amount: Number(row.amount || 0),
      type: row.type,
      description: row.description || '',
      status: row.status || 'aberta',
      createdAt: row.created_at || row.createdAt || agora(),
      paidAt: row.paid_at || row.paidAt || null
    };
  }

  const DB = {
    get online() {
      try {
        verificarConexao();
        return Boolean(client);
      } catch (error) {
        return false;
      }
    },

    get client() {
      return client;
    },

    // Recupera a sessão atual do administrador
    async getSession() {
      verificarConexao();

      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      return data.session;
    },

    // Login do administrador
    async signIn(email, password) {
      verificarConexao();

      if (!email || !email.trim() || !password) {
        throw new Error('Informe o e-mail e a senha.');
      }

      const { data, error } =
        await client.auth.signInWithPassword({
          email: email.trim(),
          password
        });

      if (error) throw error;

      return data.session;
    },

    // Encerrar sessão
    async signOut() {
      verificarConexao();

      const { error } = await client.auth.signOut();

      if (error) throw error;
    },

    // Listar todos os clientes e fiados autorizados
    async listAll() {
      verificarConexao();

      const [clientes, pendencias] = await Promise.all([
        client
          .from('clientes')
          .select('*')
          .order('created_at', { ascending: false }),

        client
          .from('pendencias')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (clientes.error) throw clientes.error;
      if (pendencias.error) throw pendencias.error;

      return {
        clients: (clientes.data || []).map(normalizarCliente),
        debts: (pendencias.data || []).map(normalizarPendencia)
      };
    },

    // Consultar a conta pública de um cliente pelo token
    async getCustomerByToken(token) {
      verificarConexao();

      if (!token || !token.trim()) {
        return null;
      }

      const { data, error } = await client.rpc(
        'consultar_conta_cliente',
        { p_token: token.trim() }
      );

      if (error) throw error;

      if (!data || !data.client) {
        return null;
      }

      return {
        client: normalizarCliente(data.client),
        debts: (data.debts || []).map(normalizarPendencia)
      };
    },

    // Cadastrar cliente e seu primeiro fiado
    async addClientAndDebt({
      name,
      phone,
      amount,
      type,
      description
    }) {
      verificarConexao();

      if (!name || !name.trim()) {
        throw new Error('Informe o nome do cliente.');
      }

      if (
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new Error('Informe um valor válido para o fiado.');
      }

      if (!['corte', 'produto'].includes(type)) {
        throw new Error('Tipo de pendência inválido.');
      }

      const token = gerarToken();

      const { data: cliente, error: erroCliente } =
        await client
          .from('clientes')
          .insert({
            name: name.trim(),
            phone: phone?.trim() || null,
            token
          })
          .select('*')
          .single();

      if (erroCliente) throw erroCliente;

      const { data: pendencia, error: erroPendencia } =
        await client
          .from('pendencias')
          .insert({
            cliente_id: cliente.id,
            amount: Number(amount),
            type,
            description: description?.trim() || null,
            status: 'aberta'
          })
          .select('*')
          .single();

      if (erroPendencia) {
        throw new Error(
          'O cliente foi cadastrado, mas o fiado não foi salvo. ' +
          'Confira a tabela pendencias antes de tentar novamente. ' +
          erroPendencia.message
        );
      }

      return {
        client: normalizarCliente(cliente),
        debt: normalizarPendencia(pendencia)
      };
    },

    // Adicionar fiado a um cliente existente
    async addDebt({
      clientId,
      amount,
      type,
      description
    }) {
      verificarConexao();

      if (!clientId) {
        throw new Error('Cliente não informado.');
      }

      if (
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new Error('Informe um valor válido para o fiado.');
      }

      if (!['corte', 'produto'].includes(type)) {
        throw new Error('Tipo de pendência inválido.');
      }

      const { data, error } = await client
        .from('pendencias')
        .insert({
          cliente_id: clientId,
          amount: Number(amount),
          type,
          description: description?.trim() || null,
          status: 'aberta'
        })
        .select('*')
        .single();

      if (error) throw error;

      return normalizarPendencia(data);
    },

    // Marcar uma pendência como paga
    async markPaid(debtId) {
      verificarConexao();

      if (!debtId) {
        throw new Error('Pendência não informada.');
      }

      const { data, error } = await client
        .from('pendencias')
        .update({
          status: 'paga',
          paid_at: agora()
        })
        .eq('id', debtId)
        .select('*')
        .single();

      if (error) throw error;

      return normalizarPendencia(data);
    }
  };

  // Disponibiliza a API para app.js e cliente.js
  window.FiadosDB = DB;

  // Detecta problemas de configuração logo ao carregar
  try {
    verificarConexao();
    console.info('Alex MT Barber: Supabase inicializado.');
  } catch (error) {
    console.error(
      'Alex MT Barber: falha ao inicializar o Supabase.',
      error.message
    );
  }
})();
