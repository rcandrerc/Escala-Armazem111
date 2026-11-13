import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, configurado } from './firebase';
import {
  DIAS, EMAIL_DONO, PROXIMO_TURNO, ROTULO_TURNO, normalizarTurno, iso, segundaDe, somarDias,
  FUNCIONARIOS, useSemana, useMes, useEditores,
  definirTurno, salvarSemanas, adicionarEditor, removerEditor,
} from './dados';
import { gerarMes, FECHA_NA_SEGUNDA } from './gerar';

const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const GRUPOS = ['Cozinha', 'Salão'];

export default function Escala() {
  const [usuario, setUsuario] = useState(null);
  const [aviso, setAviso] = useState('');
  const [segunda, setSegunda] = useState(() => segundaDe(new Date()));
  const [painel, setPainel] = useState(false);
  const [visao, setVisao] = useState('semana');
  const [mesRef, setMesRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));

  useEffect(() => (configurado ? onAuthStateChanged(auth, setUsuario) : undefined), []);
  const editores = useEditores();
  const segundaIso = iso(segunda);
  const turnos = useSemana(segundaIso);

  if (!configurado) return <p className="aviso">Firebase não configurado.</p>;

  const email = (usuario?.email || '').toLowerCase();
  const dono = email === EMAIL_DONO;
  const editor = dono || editores.includes(email);
  const hojeIso = iso(new Date());
  const dias = DIAS.map((nome, i) => ({ nome, i, data: somarDias(segunda, i) }));
  const turnoDe = (f, i) => normalizarTurno(turnos?.[f.id]?.[i]);
  const fechado = (i) => FECHA_NA_SEGUNDA && i === 0;

  async function entrar() {
    setAviso('');
    const p = new GoogleAuthProvider();
    try { await signInWithPopup(auth, p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') signInWithRedirect(auth, p);
      else if (e.code !== 'auth/popup-closed-by-user') setAviso('Não consegui entrar. Tente de novo.');
    }
  }

  async function alternar(f, i) {
    setAviso('');
    try { await definirTurno(segundaIso, f.id, i, PROXIMO_TURNO[turnoDe(f, i)]); }
    catch { setAviso('Sem permissão para salvar. Confira se entrou com a conta certa.'); }
  }

  async function gerar() {
    const ref = new Date(segunda.getFullYear(), segunda.getMonth(), 1, 12);
    const nome = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!window.confirm(`Montar a escala de ${nome} automaticamente? Isso substitui o que já está preenchido nesse mês.`)) return;
    try {
      await salvarSemanas(gerarMes(ref.getFullYear(), ref.getMonth()));
      setAviso(`Escala de ${nome} montada. Ajuste o que precisar tocando nos nomes.`);
    } catch { setAviso('Não consegui salvar. Confira se entrou com a conta certa.'); }
  }

  async function copiar() {
    const linhas = [`*Escala Armazém 111* — ${fmt(segunda)} a ${fmt(somarDias(segunda, 6))}`];
    dias.forEach(({ nome, i, data }) => {
      linhas.push('', `*${nome} ${fmt(data)}*`);
      if (fechado(i)) return linhas.push('Fechado');
      ['M', 'N'].forEach((t) => {
        const quem = FUNCIONARIOS.filter((f) => turnoDe(f, i).includes(t)).map((f) => f.nome);
        linhas.push(`${t === 'M' ? 'Manhã' : 'Noite'}: ${quem.length ? quem.join(', ') : '—'}`);
      });
    });
    try { await navigator.clipboard.writeText(linhas.join('\n')); setAviso('Escala copiada, é só colar no WhatsApp.'); }
    catch { setAviso('Não consegui copiar.'); }
  }

  return (
    <div className="escala">
      <header className="topo">
        <div>
          <h1>Armazém 111</h1>
          <p>Escala da semana</p>
        </div>
        <div className="conta">
          {usuario ? (
            <>
              <span>{editor ? '✏️ Editando' : 'Só leitura'}</span>
              <button className="link" onClick={() => signOut(auth)}>Sair</button>
            </>
          ) : (
            <button className="link" onClick={entrar}>Entrar para editar</button>
          )}
        </div>
      </header>

      {usuario && !editor && <p className="aviso">A conta {usuario.email} não tem permissão para editar. Você pode só ver a escala.</p>}
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {editor && <p className="dica">Toque no nome para mudar: folga → manhã → noite → dia todo.</p>}

      <div className="abas">
        <button className={visao === 'semana' ? 'on' : ''} onClick={() => setVisao('semana')}>Semana</button>
        <button className={visao === 'mes' ? 'on' : ''} onClick={() => { setMesRef(new Date(segunda.getFullYear(), segunda.getMonth(), 1, 12)); setVisao('mes'); }}>📅 Mês</button>
      </div>

      {visao === 'mes' ? (
        <>
          <nav className="semana">
            <button onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1, 12))} aria-label="Mês anterior">‹</button>
            <button className="atual" onClick={() => setMesRef(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))}>
              {mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </button>
            <button onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1, 12))} aria-label="Próximo mês">›</button>
          </nav>
          <Mes ref0={mesRef} hojeIso={hojeIso} abrir={(data) => { setSegunda(segundaDe(data)); setVisao('semana'); }} />
        </>
      ) : (
      <>
      <nav className="semana">
        <button onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior">‹</button>
        <button className="atual" onClick={() => setSegunda(segundaDe(new Date()))}>
          {fmt(segunda)} a {fmt(somarDias(segunda, 6))}
        </button>
        <button onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana">›</button>
      </nav>

      {turnos === null ? (
        <p className="aviso">Carregando…</p>
      ) : (
        <div className="dias">
          {dias.map(({ nome, i, data }) => (
            <section key={nome} className={`dia ${iso(data) === hojeIso ? 'hoje' : ''} ${fechado(i) ? 'fechado' : ''}`}>
              <h2>{nome} <small>{fmt(data)}</small>{iso(data) === hojeIso && <em>hoje</em>}</h2>
              {fechado(i) ? <p className="ninguem">Fechado</p> : GRUPOS.map((g) => (
                <div key={g} className="grupo">
                  <span className="rotulo">{g}</span>
                  <div className="chips">
                    {FUNCIONARIOS.filter((f) => f.funcao === g).map((f) => {
                      const t = turnoDe(f, i);
                      const rot = t ? `${f.nome} · ${ROTULO_TURNO[t]}` : f.nome;
                      if (!editor && !t) return null;
                      return editor
                        ? <button key={f.id} className={`chip ${t ? 't-' + t : ''}`} onClick={() => alternar(f, i)}>{rot}</button>
                        : <span key={f.id} className={`chip t-${t}`}>{rot}</span>;
                    })}
                    {!editor && !FUNCIONARIOS.some((f) => f.funcao === g && turnoDe(f, i)) && <span className="ninguem">—</span>}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      </>
      )}

      <div className="acoes">
        <button className="botao" onClick={copiar}>📋 Copiar para o WhatsApp</button>
        {editor && <button className="botao claro" onClick={gerar}>✨ Montar o mês automático</button>}
        {dono && <button className="botao claro" onClick={() => setPainel(true)}>🔑 Quem pode editar</button>}
      </div>

      {painel && (
        <div className="fundo-janela" onClick={() => setPainel(false)}>
          <div className="janela" role="dialog" aria-label="Quem pode editar" onClick={(ev) => ev.stopPropagation()}>
            <div className="janela-topo"><h2>Quem pode editar</h2><button className="link" onClick={() => setPainel(false)}>Fechar</button></div>
            <Editores emails={editores} />
          </div>
        </div>
      )}
    </div>
  );
}

const Nome = ({ f }) => <span className="nm"><span className="longo">{f.nome}</span><span className="curto">{f.nome.slice(0, 3)}</span></span>;

// Calendário do mês: por dia, quantos vão de manhã e à noite e quem está de folga.
function Mes({ ref0, hojeIso, abrir }) {
  const ano = ref0.getFullYear();
  const mes = ref0.getMonth();
  const dados = useMes(ano, mes);
  if (!dados) return <p className="aviso">Carregando…</p>;
  const ini = segundaDe(new Date(ano, mes, 1, 12));
  const fim = new Date(ano, mes + 1, 0, 12);
  const celulas = [];
  for (let d = ini; d <= somarDias(segundaDe(fim), 6); d = somarDias(d, 1)) celulas.push(d);
  return (
    <div className="mes">
      {DIAS.map((n) => <div key={n} className="mes-cab">{n}</div>)}
      {celulas.map((data) => {
        const i = (data.getDay() + 6) % 7;
        const fora = data.getMonth() !== mes;
        const t = dados[iso(segundaDe(data))] || {};
        const turno = (f) => normalizarTurno(t[f.id]?.[i]);
        const quem = (x) => FUNCIONARIOS.filter((f) => turno(f).includes(x));
        const m = quem('M');
        const n = quem('N');
        const folgas = FUNCIONARIOS.filter((f) => !turno(f));
        const fechada = FECHA_NA_SEGUNDA && i === 0;
        const vazio = m.length + n.length === 0;
        return (
          <button key={iso(data)} disabled={fora} onClick={() => abrir(data)}
            className={`mes-dia ${fora ? 'fora' : ''} ${iso(data) === hojeIso ? 'hoje' : ''} ${fechada ? 'fechado' : ''}`}>
            <b>{data.getDate()}</b>
            {!fora && (fechada ? <span className="mes-fecha">Fechado</span> : vazio ? <span className="mes-vazio">—</span> : (
              <>
                <span className="mes-m">☀ {m.map((f) => <Nome key={f.id} f={f} />)}</span>
                <span className="mes-n">🌙 {n.map((f) => <Nome key={f.id} f={f} />)}</span>
                {folgas.length > 0 && <span className="mes-folga">FOLGA {folgas.map((f) => <Nome key={f.id} f={f} />)}</span>}
              </>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function Editores({ emails }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const tenta = async (fn) => { try { setMsg(''); await fn(); } catch { setMsg('Não consegui salvar.'); } };
  return (
    <>
      <p className="suave">Você ({EMAIL_DONO}) sempre pode editar. Adicione abaixo o e-mail Google de quem mais pode editar. Todo mundo com o link pode ver, sem entrar.</p>
      <ul className="lista">
        {emails.map((e) => <li key={e}><span>{e}</span><button className="link perigo" onClick={() => tenta(() => removerEditor(e))}>Remover</button></li>)}
      </ul>
      <form className="linha" onSubmit={(ev) => {
        ev.preventDefault();
        if (!email.includes('@')) return setMsg('Digite um e-mail válido.');
        tenta(() => adicionarEditor(email)).then(() => setEmail(''));
      }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@gmail.com" />
        <button className="botao">Adicionar</button>
      </form>
      {msg && <p className="erro">{msg}</p>}
    </>
  );
}
