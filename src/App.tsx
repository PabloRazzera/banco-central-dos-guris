import { useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  History,
  LogOut,
  PiggyBank,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Perfil = {
  nome: string
  username: string
}

type Conta = {
  id: string
  saldo_subunidades: number
}

type Transacao = {
  id: string
  tipo: string
  valor_subunidades: number
  descricao: string | null
  criado_em: string
  conta_origem_id: string | null
  conta_destino_id: string | null

  origem_usuario_id?: string | null
  origem_nome?: string | null
  origem_username?: string | null

  destino_usuario_id?: string | null
  destino_nome?: string | null
  destino_username?: string | null
}

type Destinatario = {
  conta_id: string
  nome: string
  username: string
}

type Poupanca = {
  saldo_subunidades: number
  ultimo_calculo_em: string
}

type Pagina =
  | 'dashboard'
  | 'transferir'
  | 'poupanca'
  | 'historico'

type FiltroHistorico =
  | 'todos'
  | 'entradas'
  | 'saidas'
  | 'poupanca'

function formatarDIN(subunidades: number) {
  return (subunidades / 10000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function converterParaSubunidades(valor: string) {
  const numero = Number(valor.replace(',', '.'))

  if (!Number.isFinite(numero) || numero <= 0) {
    return null
  }

  return Math.round(numero * 10000)
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function obterNomeTipo(tipo: string) {
  const tipos: Record<string, string> = {
    transferencia: 'Transferência',
    taxa: 'Taxa',
    emissao: 'Emissão de DIN',
    correcao: 'Correção',
    investimento: 'Investimento',
    resgate: 'Resgate',
    poupanca_deposito: 'Depósito na poupança',
    poupanca_resgate: 'Resgate da poupança',
    poupanca_rendimento: 'Rendimento da poupança',
  }

  return tipos[tipo] || tipo
}

function obterIconeTransacao(
  transacao: Transacao,
  contaId: string
) {
  if (transacao.tipo === 'poupanca_deposito') {
    return <ArrowDownToLine size={18} />
  }

  if (transacao.tipo === 'poupanca_resgate') {
    return <ArrowUpFromLine size={18} />
  }

  if (transacao.tipo === 'poupanca_rendimento') {
    return <PiggyBank size={18} />
  }

  if (transacao.tipo === 'taxa') {
    return <ArrowUpRight size={18} />
  }

  if (transacao.conta_destino_id === contaId) {
    return <ArrowDownLeft size={18} />
  }

  return <ArrowUpRight size={18} />
}

function transacaoEhEntrada(
  transacao: Transacao,
  contaId: string
) {
  if (transacao.tipo === 'poupanca_rendimento') {
    return true
  }

  return transacao.conta_destino_id === contaId
}

function obterTextoPessoa(
  transacao: Transacao,
  contaId: string
) {
  if (transacao.tipo === 'transferencia') {
    if (transacao.conta_destino_id === contaId) {
      if (transacao.origem_username) {
        return `Recebido de @${transacao.origem_username}`
      }

      return 'Recebido de outro usuário'
    }

    if (transacao.destino_username) {
      return `Enviado para @${transacao.destino_username}`
    }

    return 'Enviado para outro usuário'
  }

  if (transacao.tipo === 'poupanca_deposito') {
    return 'Seu saldo disponível'
  }

  if (transacao.tipo === 'poupanca_resgate') {
    return 'Sua poupança'
  }

  if (transacao.tipo === 'poupanca_rendimento') {
    return 'Rendimento automático'
  }

  if (transacao.tipo === 'taxa') {
    return 'Banco Central dos Guris'
  }

  if (transacao.tipo === 'emissao') {
    return 'Banco Central dos Guris'
  }

  return 'Sistema'
}

function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [conta, setConta] = useState<Conta | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [poupanca, setPoupanca] = useState<Poupanca | null>(null)

  const [pagina, setPagina] =
    useState<Pagina>('dashboard')

  const [username, setUsername] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const [erroLogin, setErroLogin] = useState('')
  const [entrando, setEntrando] = useState(false)

  const [destinatarioUsername, setDestinatarioUsername] =
    useState('')

  const [destinatario, setDestinatario] =
    useState<Destinatario | null>(null)

  const [buscandoDestinatario, setBuscandoDestinatario] =
    useState(false)

  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [transferindo, setTransferindo] = useState(false)

  const [depositoValor, setDepositoValor] = useState('')
  const [resgateValor, setResgateValor] = useState('')

  const [depositando, setDepositando] = useState(false)
  const [resgatando, setResgatando] = useState(false)

  const [erroPoupanca, setErroPoupanca] = useState('')

  const [filtroHistorico, setFiltroHistorico] =
    useState<FiltroHistorico>('todos')

  const [carregandoHistorico, setCarregandoHistorico] =
    useState(false)

  useEffect(() => {
    verificarSessao()
  }, [])

  async function verificarSessao() {
    setCarregando(true)

    const { data } = await supabase.auth.getSession()

    if (data.session) {
      await carregarDashboard(data.session.user.id)
      setUsuarioLogado(true)
    }

    setCarregando(false)
  }

  async function carregarDashboard(userId: string) {
    const { data: perfilData, error: perfilError } =
      await supabase
        .from('usuarios')
        .select('nome, username')
        .eq('id', userId)
        .single()

    if (perfilError) {
      console.error(
        'Erro ao carregar perfil:',
        perfilError
      )
      return
    }

    const { data: contaData, error: contaError } =
      await supabase
        .from('contas')
        .select('id, saldo_subunidades')
        .eq('usuario_id', userId)
        .single()

    if (contaError) {
      console.error(
        'Erro ao carregar conta:',
        contaError
      )
      return
    }

    const { data: transacoesData, error: transacoesError } =
      await supabase
        .from('historico_transacoes')
        .select('*')
        .or(
          `conta_origem_id.eq.${contaData.id},conta_destino_id.eq.${contaData.id}`
        )
        .order('criado_em', {
          ascending: false,
        })
        .limit(20)

    if (transacoesError) {
      console.error(
        'Erro ao carregar transações:',
        transacoesError
      )
      return
    }

    setPerfil(perfilData)
    setConta(contaData)
    setTransacoes(transacoesData ?? [])
  }

  async function carregarHistoricoCompleto() {
    if (!conta) return

    setCarregandoHistorico(true)

    const { data, error } = await supabase
      .from('historico_transacoes')
      .select('*')
      .or(
        `conta_origem_id.eq.${conta.id},conta_destino_id.eq.${conta.id}`
      )
      .order('criado_em', {
        ascending: false,
      })

    if (error) {
      console.error(
        'Erro ao carregar histórico:',
        error
      )
      setCarregandoHistorico(false)
      return
    }

    setTransacoes(data ?? [])
    setCarregandoHistorico(false)
  }

  async function carregarPoupanca() {
    setErroPoupanca('')

    const { error: atualizarError } =
      await supabase.rpc('atualizar_poupanca')

    if (atualizarError) {
      console.error(
        'Erro ao atualizar rendimento:',
        atualizarError
      )

      setErroPoupanca(
        atualizarError.message
      )

      return
    }

    const { data: sessionData } =
      await supabase.auth.getSession()

    if (!sessionData.session) return

    const userId =
      sessionData.session.user.id

    const { data, error } = await supabase
      .from('poupancas')
      .select(
        'saldo_subunidades, ultimo_calculo_em'
      )
      .eq('usuario_id', userId)
      .single()

    if (error) {
      console.error(
        'Erro ao carregar poupança:',
        error
      )

      setErroPoupanca(error.message)
      return
    }

    setPoupanca(data)
  }

  async function entrar() {
    if (entrando) return

    setErroLogin('')

    if (!username.trim() || !senha) {
      setErroLogin(
        'Preencha usuário e senha.'
      )
      return
    }

    setEntrando(true)

    const {
      data: emailData,
      error: emailError,
    } = await supabase.rpc(
      'obter_email_login',
      {
        p_username: username.trim(),
      }
    )

    if (
      emailError ||
      !emailData
    ) {
      setErroLogin(
        'Usuário ou senha incorretos.'
      )

      setEntrando(false)
      return
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: emailData,
        password: senha,
      })

    if (
      error ||
      !data.user
    ) {
      setErroLogin(
        'Usuário ou senha incorretos.'
      )

      setEntrando(false)
      return
    }

    await carregarDashboard(
      data.user.id
    )

    setUsuarioLogado(true)
    setPagina('dashboard')
    setSenha('')
    setEntrando(false)
  }

  async function sair() {
    await supabase.auth.signOut()

    setUsuarioLogado(false)
    setPerfil(null)
    setConta(null)
    setPoupanca(null)
    setTransacoes([])
    setPagina('dashboard')
    setUsername('')
    setSenha('')
  }

  async function buscarDestinatario() {
    if (buscandoDestinatario) return

    const nomeBusca =
      destinatarioUsername.trim()

    if (!nomeBusca) {
      alert(
        'Digite o usuário do destinatário.'
      )
      return
    }

    setBuscandoDestinatario(true)
    setDestinatario(null)

    const {
      data,
      error,
    } = await supabase.rpc(
      'buscar_destinatario',
      {
        p_username: nomeBusca,
      }
    )

    if (
      error ||
      !data ||
      data.length === 0
    ) {
      console.error(
        'Erro ao buscar destinatário:',
        error
      )

      alert(
        'Usuário não encontrado.'
      )

      setBuscandoDestinatario(false)
      return
    }

    const usuarioData = data[0]

    setDestinatario({
      conta_id: usuarioData.conta_id,
      nome: usuarioData.nome,
      username: usuarioData.username,
    })

    setBuscandoDestinatario(false)
  }

  async function realizarTransferencia() {
    if (transferindo) return

    if (
      !conta ||
      !destinatario
    ) {
      alert(
        'Selecione um destinatário.'
      )
      return
    }

    const valorSubunidades =
      converterParaSubunidades(
        valor
      )

    if (!valorSubunidades) {
      alert(
        'Digite um valor válido.'
      )
      return
    }

    const taxa = 10000
    const total =
      valorSubunidades + taxa

    if (
      conta.saldo_subunidades <
      total
    ) {
      alert(
        `Saldo insuficiente.\n\nValor: ${formatarDIN(
          valorSubunidades
        )} DIN\nTaxa: 1,00 DIN`
      )

      return
    }

    const confirmar =
      window.confirm(
        `Confirmar transferência?\n\n` +
          `Destinatário: @${destinatario.username}\n` +
          `Valor: ${formatarDIN(
            valorSubunidades
          )} DIN\n` +
          `Taxa: 1,00 DIN\n` +
          `Total: ${formatarDIN(
            total
          )} DIN`
      )

    if (!confirmar) return

    setTransferindo(true)

    const { error } =
      await supabase.rpc(
        'transferir_din',
        {
          p_conta_origem:
            conta.id,
          p_conta_destino:
            destinatario.conta_id,
          p_valor_subunidades:
            valorSubunidades,
          p_descricao:
            descricao.trim() ||
            `Transferência para @${destinatario.username}`,
        }
      )

    if (error) {
      console.error(
        'Erro na transferência:',
        error
      )

      alert(
        error.message ||
          'Não foi possível realizar a transferência.'
      )

      setTransferindo(false)
      return
    }

    const {
      data: sessionData,
    } =
      await supabase.auth.getSession()

    if (
      sessionData.session
    ) {
      await carregarDashboard(
        sessionData.session.user.id
      )
    }

    setValor('')
    setDescricao('')
    setDestinatarioUsername('')
    setDestinatario(null)
    setPagina('dashboard')
    setTransferindo(false)

    alert(
      'Transferência realizada com sucesso!'
    )
  }

  async function depositarNaPoupanca() {
    if (depositando) return

    setErroPoupanca('')

    const valorSubunidades =
      converterParaSubunidades(
        depositoValor
      )

    if (!valorSubunidades) {
      setErroPoupanca(
        'Digite um valor válido.'
      )
      return
    }

    if (!conta) return

    if (
      conta.saldo_subunidades <
      valorSubunidades
    ) {
      setErroPoupanca(
        'Saldo disponível insuficiente.'
      )
      return
    }

    const confirmar =
      window.confirm(
        `Depositar ${formatarDIN(
          valorSubunidades
        )} DIN na poupança?`
      )

    if (!confirmar) return

    setDepositando(true)

    const { error } =
      await supabase.rpc(
        'depositar_poupanca',
        {
          p_valor_subunidades:
            valorSubunidades,
        }
      )

    if (error) {
      console.error(
        'Erro no depósito:',
        error
      )

      setErroPoupanca(
        error.message ||
          'Não foi possível realizar o depósito.'
      )

      setDepositando(false)
      return
    }

    const {
      data: sessionData,
    } =
      await supabase.auth.getSession()

    if (
      sessionData.session
    ) {
      await carregarDashboard(
        sessionData.session.user.id
      )
    }

    await carregarPoupanca()
    await carregarHistoricoCompleto()

    setDepositoValor('')
    setDepositando(false)
  }

  async function resgatarDaPoupanca() {
    if (resgatando) return

    setErroPoupanca('')

    const valorSubunidades =
      converterParaSubunidades(
        resgateValor
      )

    if (!valorSubunidades) {
      setErroPoupanca(
        'Digite um valor válido.'
      )
      return
    }

    if (!poupanca) return

    if (
      poupanca.saldo_subunidades <
      valorSubunidades
    ) {
      setErroPoupanca(
        'Saldo insuficiente na poupança.'
      )
      return
    }

    const confirmar =
      window.confirm(
        `Resgatar ${formatarDIN(
          valorSubunidades
        )} DIN da poupança?`
      )

    if (!confirmar) return

    setResgatando(true)

    const { error } =
      await supabase.rpc(
        'resgatar_poupanca',
        {
          p_valor_subunidades:
            valorSubunidades,
        }
      )

    if (error) {
      console.error(
        'Erro no resgate:',
        error
      )

      setErroPoupanca(
        error.message ||
          'Não foi possível realizar o resgate.'
      )

      setResgatando(false)
      return
    }

    const {
      data: sessionData,
    } =
      await supabase.auth.getSession()

    if (
      sessionData.session
    ) {
      await carregarDashboard(
        sessionData.session.user.id
      )
    }

    await carregarPoupanca()
    await carregarHistoricoCompleto()

    setResgateValor('')
    setResgatando(false)
  }

  async function abrirHistorico() {
    setPagina('historico')
    await carregarHistoricoCompleto()
  }

  function abrirPoupanca() {
    setPagina('poupanca')
    carregarPoupanca()
  }

  function obterTransacoesFiltradas() {
    if (!conta) return []

    return transacoes.filter(
      (transacao) => {
        if (
          filtroHistorico ===
          'poupanca'
        ) {
          return (
            transacao.tipo ===
              'poupanca_deposito' ||
            transacao.tipo ===
              'poupanca_resgate' ||
            transacao.tipo ===
              'poupanca_rendimento'
          )
        }

        const entrada =
          transacaoEhEntrada(
            transacao,
            conta.id
          )

        if (
          filtroHistorico ===
          'entradas'
        ) {
          return entrada
        }

        if (
          filtroHistorico ===
          'saidas'
        ) {
          return !entrada
        }

        return true
      }
    )
  }

  function renderTransacao(
    transacao: Transacao,
    completa = false
  ) {
    if (!conta) return null

    const entrada =
      transacaoEhEntrada(
        transacao,
        conta.id
      )

    const nomePessoa =
      obterTextoPessoa(
        transacao,
        conta.id
      )

    return (
      <div
        key={transacao.id}
        className={`flex gap-4 ${
          completa
            ? 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'
            : 'px-5 py-4 sm:px-6'
        }`}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          {obterIconeTransacao(
            transacao,
            conta.id
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {obterNomeTipo(
                  transacao.tipo
                )}
              </p>

              <p className="mt-1 text-xs text-white/40">
                {nomePessoa}
              </p>
            </div>

            <p
              className={`shrink-0 text-sm font-bold ${
                entrada
                  ? 'text-emerald-300'
                  : 'text-white'
              }`}
            >
              {entrada ? '+' : '-'}
              {formatarDIN(
                transacao.valor_subunidades
              )}{' '}
              DIN
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-1 text-xs text-white/30 sm:flex-row sm:items-center sm:gap-3">
            <span>
              {formatarData(
                transacao.criado_em
              )}
            </span>

            <span className="hidden sm:inline">
              •
            </span>

            <span>
              {transacao.descricao ||
                obterNomeTipo(
                  transacao.tipo
                )}
            </span>
          </div>

          {completa &&
            transacao.tipo ===
              'transferencia' && (
              <div className="mt-4 grid gap-2 rounded-xl bg-black/10 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-white/30">
                    Enviado por
                  </p>

                  <p className="mt-1 text-white/70">
                    {transacao.origem_username
                      ? `@${transacao.origem_username}`
                      : 'Conta não identificada'}
                  </p>
                </div>

                <div>
                  <p className="text-white/30">
                    Enviado para
                  </p>

                  <p className="mt-1 text-white/70">
                    {transacao.destino_username
                      ? `@${transacao.destino_username}`
                      : 'Conta não identificada'}
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="text-sm text-white/60">
            Carregando Banco Central dos Guris...
          </p>
        </div>
      </div>
    )
  }

  if (!usuarioLogado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-white">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
              <Banknote size={32} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Banco Central dos Guris
            </h1>

            <p className="mt-2 text-sm text-white/50">
              Seu banco. Seu DIN. Seu controle.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">
              Entrar
            </h2>

            <p className="mt-1 text-sm text-white/50">
              Acesse sua conta DIN
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Usuário
                </label>

                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      entrar()
                  }}
                  placeholder="Seu usuário"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Senha
                </label>

                <div className="relative">
                  <input
                    type={
                      mostrarSenha
                        ? 'text'
                        : 'password'
                    }
                    value={senha}
                    onChange={(e) =>
                      setSenha(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        entrar()
                    }}
                    placeholder="Sua senha"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-12 outline-none transition placeholder:text-white/25 focus:border-white/30"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarSenha(
                        !mostrarSenha
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {mostrarSenha ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {erroLogin && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {erroLogin}
                </div>
              )}

              <button
                onClick={entrar}
                disabled={entrando}
                className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {entrando
                  ? 'Entrando...'
                  : 'Entrar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const transacoesFiltradas =
    obterTransacoesFiltradas()

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 bg-[#09090b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={() =>
              setPagina('dashboard')
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
              <Banknote size={21} />
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-bold">
                Banco Central dos Guris
              </p>

              <p className="text-xs text-white/40">
                Sistema DIN
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {perfil?.nome}
              </p>

              <p className="text-xs text-white/40">
                @{perfil?.username}
              </p>
            </div>

            <button
              onClick={sair}
              title="Sair"
              className="rounded-xl border border-white/10 p-2.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {pagina === 'dashboard' && (
          <>
            <div className="mb-8">
              <p className="text-sm text-white/40">
                Bem-vindo de volta
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                Olá,{' '}
                {perfil?.nome?.split(
                  ' '
                )[0]}{' '}
                👋
              </h1>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-6 shadow-xl sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/50">
                      Saldo disponível
                    </p>

                    <p className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                      {formatarDIN(
                        conta?.saldo_subunidades ??
                          0
                      )}{' '}
                      <span className="text-xl font-semibold text-white/40">
                        DIN
                      </span>
                    </p>
                  </div>

                  <Wallet
                    className="text-white/30"
                    size={28}
                  />
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setPagina(
                        'transferir'
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    <Send size={17} />
                    Transferir
                  </button>

                  <button
                    onClick={
                      abrirPoupanca
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold transition hover:bg-white/[0.08]"
                  >
                    <PiggyBank
                      size={17}
                    />
                    Poupança
                  </button>
                </div>
              </div>

              <button
                onClick={
                  abrirPoupanca
                }
                className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08]">
                    <PiggyBank
                      size={22}
                    />
                  </div>

                  <ChevronRight
                    size={20}
                    className="text-white/30 transition group-hover:translate-x-1 group-hover:text-white"
                  />
                </div>

                <p className="mt-6 text-sm text-white/50">
                  Poupança
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {formatarDIN(
                    poupanca?.saldo_subunidades ??
                      0
                  )}{' '}
                  DIN
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
                  <span className="rounded-full bg-white/[0.08] px-2 py-1">
                    +0,05% ao dia
                  </span>

                  <span>•</span>

                  <span>
                    Juros compostos
                  </span>
                </div>
              </button>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <History
                    size={19}
                    className="text-white/50"
                  />

                  <h2 className="font-semibold">
                    Últimas movimentações
                  </h2>
                </div>

                <button
                  onClick={
                    abrirHistorico
                  }
                  className="text-xs font-semibold text-white/50 transition hover:text-white"
                >
                  Ver tudo
                </button>
              </div>

              {transacoes.length ===
              0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-white/40">
                    Nenhuma movimentação ainda.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transacoes
                    .slice(0, 5)
                    .map(
                      (
                        transacao
                      ) =>
                        renderTransacao(
                          transacao
                        )
                    )}
                </div>
              )}
            </div>
          </>
        )}

        {pagina ===
          'transferir' && (
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() =>
                setPagina(
                  'dashboard'
                )
              }
              className="mb-6 flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <div className="mb-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.08]">
                  <Send size={22} />
                </div>

                <h1 className="text-3xl font-bold">
                  Transferir DIN
                </h1>

                <p className="mt-2 text-sm text-white/45">
                  Envie DIN para outro usuário do Banco Central dos Guris.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    Usuário do destinatário
                  </label>

                  <div className="flex gap-2">
                    <input
                      value={
                        destinatarioUsername
                      }
                      onChange={(e) => {
                        setDestinatarioUsername(
                          e.target.value
                        )
                        setDestinatario(
                          null
                        )
                      }}
                      placeholder="@usuario"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/30"
                    />

                    <button
                      onClick={
                        buscarDestinatario
                      }
                      disabled={
                        buscandoDestinatario
                      }
                      className="rounded-xl bg-white px-4 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                    >
                      {buscandoDestinatario
                        ? '...'
                        : 'Buscar'}
                    </button>
                  </div>
                </div>

                {destinatario && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs text-white/40">
                      Destinatário
                    </p>

                    <p className="mt-1 font-semibold">
                      {
                        destinatario.nome
                      }
                    </p>

                    <p className="text-sm text-white/45">
                      @
                      {
                        destinatario.username
                      }
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    Valor
                  </label>

                  <div className="relative">
                    <input
                      value={valor}
                      onChange={(e) =>
                        setValor(
                          e.target.value
                        )
                      }
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-16 outline-none transition placeholder:text-white/25 focus:border-white/30"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                      DIN
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    Descrição
                  </label>

                  <input
                    value={descricao}
                    onChange={(e) =>
                      setDescricao(
                        e.target.value
                      )
                    }
                    placeholder="Opcional"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/30"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/45">
                      Taxa
                    </span>

                    <span>
                      1,00 DIN
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between">
                    <span className="text-white/45">
                      Saldo disponível
                    </span>

                    <span>
                      {formatarDIN(
                        conta?.saldo_subunidades ??
                          0
                      )}{' '}
                      DIN
                    </span>
                  </div>
                </div>

                <button
                  onClick={
                    realizarTransferencia
                  }
                  disabled={
                    transferindo ||
                    !destinatario
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={18} />

                  {transferindo
                    ? 'Transferindo...'
                    : 'Confirmar transferência'}
                </button>
              </div>
            </div>
          </div>
        )}

        {pagina === 'poupanca' && (
          <div className="mx-auto max-w-4xl">
            <button
              onClick={() =>
                setPagina(
                  'dashboard'
                )
              }
              className="mb-6 flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>

            <div className="mb-8">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.08]">
                <PiggyBank
                  size={28}
                />
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Poupança
              </h1>

              <p className="mt-2 text-white/45">
                Guarde seus DIN e deixe o saldo render automaticamente.
              </p>
            </div>

            {erroPoupanca && (
              <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {erroPoupanca}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-6 shadow-xl sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/45">
                      Saldo na poupança
                    </p>

                    <p className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                      {formatarDIN(
                        poupanca?.saldo_subunidades ??
                          0
                      )}{' '}
                      <span className="text-xl text-white/35">
                        DIN
                      </span>
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08]">
                    <PiggyBank
                      size={22}
                    />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs text-white/40">
                      Rendimento
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      +0,05%
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      por dia
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs text-white/40">
                      Tipo
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      Composto
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      automático
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center gap-3">
                  <Clock3
                    size={20}
                    className="text-white/50"
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      Cálculo automático
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      O sistema verifica o tempo passado quando a poupança é acessada.
                    </p>
                  </div>
                </div>

                {poupanca?.ultimo_calculo_em && (
                  <div className="mt-6 rounded-2xl bg-black/10 p-4">
                    <p className="text-xs text-white/35">
                      Último cálculo
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatarData(
                        poupanca.ultimo_calculo_em
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08]">
                    <ArrowDownToLine
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      Depositar
                    </h2>

                    <p className="text-xs text-white/40">
                      Do saldo disponível para a poupança
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <input
                    value={
                      depositoValor
                    }
                    onChange={(e) =>
                      setDepositoValor(
                        e.target.value
                      )
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-16 outline-none transition placeholder:text-white/25 focus:border-white/30"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                    DIN
                  </span>
                </div>

                <p className="mt-3 text-xs text-white/35">
                  Disponível:{' '}
                  {formatarDIN(
                    conta?.saldo_subunidades ??
                      0
                  )}{' '}
                  DIN
                </p>

                <button
                  onClick={
                    depositarNaPoupanca
                  }
                  disabled={
                    depositando
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine
                    size={18}
                  />

                  {depositando
                    ? 'Depositando...'
                    : 'Depositar DIN'}
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08]">
                    <ArrowUpFromLine
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      Resgatar
                    </h2>

                    <p className="text-xs text-white/40">
                      Da poupança para o saldo disponível
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <input
                    value={
                      resgateValor
                    }
                    onChange={(e) =>
                      setResgateValor(
                        e.target.value
                      )
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-16 outline-none transition placeholder:text-white/25 focus:border-white/30"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                    DIN
                  </span>
                </div>

                <p className="mt-3 text-xs text-white/35">
                  Disponível:{' '}
                  {formatarDIN(
                    poupanca?.saldo_subunidades ??
                      0
                  )}{' '}
                  DIN
                </p>

                <button
                  onClick={
                    resgatarDaPoupanca
                  }
                  disabled={
                    resgatando
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 font-semibold transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUpFromLine
                    size={18}
                  />

                  {resgatando
                    ? 'Resgatando...'
                    : 'Resgatar DIN'}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="font-semibold">
                Como funciona?
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold">
                    01. Deposite
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/40">
                    Transfira DIN do seu saldo disponível para a poupança.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    02. Aguarde
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/40">
                    O sistema aplica 0,05% por período completo de 24 horas.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    03. Resgate
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/40">
                    Retire qualquer valor disponível quando quiser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {pagina === 'historico' && (
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <button
                onClick={() =>
                  setPagina(
                    'dashboard'
                  )
                }
                className="flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
              >
                <ArrowLeft
                  size={17}
                />
                Voltar
              </button>

              <button
                onClick={
                  carregarHistoricoCompleto
                }
                disabled={
                  carregandoHistorico
                }
                title="Atualizar histórico"
                className="rounded-xl border border-white/10 p-2.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={
                    carregandoHistorico
                      ? 'animate-spin'
                      : ''
                  }
                />
              </button>
            </div>

            <div className="mb-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.08]">
                  <History
                    size={23}
                  />
                </div>

                <div>
                  <h1 className="text-3xl font-bold">
                    Histórico
                  </h1>

                  <p className="mt-1 text-sm text-white/45">
                    Todas as movimentações da sua conta.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['todos', 'Todas'],
                  ['entradas', 'Entradas'],
                  ['saidas', 'Saídas'],
                  ['poupanca', 'Poupança'],
                ] as [
                  FiltroHistorico,
                  string
                ][]
              ).map(
                ([id, nome]) => (
                  <button
                    key={id}
                    onClick={() =>
                      setFiltroHistorico(
                        id
                      )
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      filtroHistorico ===
                      id
                        ? 'border-white bg-white text-black'
                        : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {nome}
                  </button>
                )
              )}
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-white/35">
                    Movimentações encontradas
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {
                      transacoesFiltradas.length
                    }
                  </p>
                </div>

                <History
                  size={19}
                  className="text-white/25"
                />
              </div>
            </div>

            {carregandoHistorico ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                <RefreshCw
                  size={24}
                  className="mx-auto animate-spin text-white/30"
                />

                <p className="mt-3 text-sm text-white/40">
                  Carregando histórico...
                </p>
              </div>
            ) : transacoesFiltradas.length ===
              0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                <History
                  size={28}
                  className="mx-auto text-white/20"
                />

                <p className="mt-4 text-sm text-white/40">
                  Nenhuma movimentação encontrada neste filtro.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transacoesFiltradas.map(
                  (transacao) =>
                    renderTransacao(
                      transacao,
                      true
                    )
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-white/20 sm:px-6">
        Banco Central dos Guris • Sistema interno de DIN
      </footer>
    </div>
  )
}

export default App