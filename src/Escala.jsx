import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, configurado } from './firebase';
import {
  DIAS, EMAIL_DONO, PROXIMO_TURNO, MODELOS, MODELO_PADRAO, rotuloTurno, normalizarTurno, iso, segundaDe, somarDias,
  FUNCIONARIOS, useSemana, useMes, useEditores,
  definirTurno, salvarSemanas, apagarTudo, apagarDia, adicionarEditor, removerEditor,
} from './dados';
import { gerarMes, FECHA_NA_SEGUNDA } from './gerar';

// Turnos sem ninguém numa área (só em dia já preenchido): avisam para chamar extra.
function buracos(turno) {
  if (!FUNCIONARIOS.some((f) => turno(f))) return [];
  const r = [];
  GRUPOS.forEach((g) => ['M', 'N'].forEach((t) => {
    if (!FUNCIONARIOS.some((f) => f.funcao === g && turno(f).includes(t))) r.push({ g, t });
  }));
  return r;
}

const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const GRUPOS = ['Cozinha', 'Salão'];

export default function Escala() {
  const [usuario, setUsuario] = useState(null);
  const [aviso, setAviso] = useState('');
  const [segunda, setSegunda] = useState(() => segundaDe(new Date()));
  const [painel, setPainel] = useState(false);
  const [diaApagar, setDiaApagar] = useState(null);
  const [visao, setVisao] = useState('semana');
  const [mesRef, setMesRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));

  useEffect(() => (configurado ? onAuthStateChanged(auth, setUsuario) : undefined), []);
  const editores = useEditores();
  const segundaIso = iso(segunda);
  const semanaDoc = useSemana(segundaIso);
  const turnos = semanaDoc && (semanaDoc.turnos || {});
  const modeloSemana = semanaDoc?.modelo || MODELO_PADRAO;
  const [modelo, setModelo] = useState(MODELO_PADRAO);

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

  // Mês em foco: o da aba Mês, ou o da semana que está na tela.
  const refMes = () => (visao === 'mes' ? mesRef : new Date(segunda.getFullYear(), segunda.getMonth(), 1, 12));
  const nomeMes = (r) => r.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  async function gerar() {
    const ref = refMes();
    if (!window.confirm(`Montar a escala ${modelo} de ${nomeMes(ref)}? Isso substitui o que já está preenchido nesse mês.`)) return;
    try {
      await salvarSemanas(gerarMes(ref.getFullYear(), ref.getMonth(), modelo), modelo);
      setAviso(`Escala de ${nomeMes(ref)} montada. Ajuste o que precisar tocando nos nomes.`);
    } catch { setAviso('Não consegui salvar. Confira se entrou com a conta certa.'); }
  }

  async function apagarTodos() {
    if (!window.confirm('Apagar TODA a escala (todas as semanas e meses)? Isso não dá para desfazer.')) return;
    try { await apagarTudo(); setAviso('Escala inteira apagada.'); }
    catch { setAviso('Não consegui apagar. Confira se entrou com a conta certa.'); }
  }

  async function apagarUmDia(data) {
    const nome = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    if (!window.confirm(`Apagar a escala de ${nome}?`)) return;
    try { await apagarDia(data); setAviso(`Escala de ${nome} apagada.`); }
    catch { setAviso('Não consegui apagar. Confira se entrou com a conta certa.'); }
  }

  async function copiar() {
    const linhas = [`*Escala Armazém 111* — ${fmt(segunda)} a ${fmt(somarDias(segunda, 6))}`];
    dias.forEach(({ nome, i, data }) => {
      linhas.push('', `*${nome} ${fmt(data)}*`);
      if (fechado(i)) return linhas.push('Fechado');
      ['M', 'N'].forEach((t) => {
        const quem = FUNCIONARIOS.filter((f) => turnoDe(f, i).includes(t)).map((f) => f.nome);
        linhas.push(`${rotuloTurno(modeloSemana, t)}: ${quem.length ? quem.join(', ') : '—'}`);
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
      {editor && <p className="dica">Toque no nome para mudar: folga → 1º turno → 2º turno → dia todo.</p>}

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

      {semanaDoc?.modelo && <p className="dica">Escala {modeloSemana} · {rotuloTurno(modeloSemana, 'M')} · {rotuloTurno(modeloSemana, 'N')}</p>}

      {turnos === null ? (
        <p className="aviso">Carregando…</p>
      ) : (
        <div className="dias">
          {dias.map(({ nome, i, data }) => (
            <section key={nome} className={`dia ${iso(data) === hojeIso ? 'hoje' : ''} ${fechado(i) ? 'fechado' : ''}`}>
              <h2>{nome} <small>{fmt(data)}</small>{iso(data) === hojeIso && <em>hoje</em>}{editor && !fechado(i) && <button className="lixo" aria-label={`Apagar ${nome}`} onClick={() => apagarUmDia(data)}>🗑</button>}</h2>
              {!fechado(i) && buracos((f) => turnoDe(f, i)).map(({ g, t }) => (
                <p key={g + t} className="buraco">⚠️ Falta {g.toLowerCase()} · {rotuloTurno(modeloSemana, t)}. Chamar extra ou freelancer.</p>
              ))}
              {fechado(i) ? <p className="ninguem">Fechado</p> : GRUPOS.map((g) => (
                <div key={g} className="grupo">
                  <span className="rotulo">{g}</span>
                  <div className="chips">
                    {FUNCIONARIOS.filter((f) => f.funcao === g).map((f) => {
                      const t = turnoDe(f, i);
                      const rot = t ? `${f.nome} · ${rotuloTurno(modeloSemana, t)}` : f.nome;
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
        {editor && (
          <span className="gerar">
            <select value={modelo} onChange={(ev) => setModelo(ev.target.value)} aria-label="Modelo da escala">
              {Object.keys(MODELOS).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="botao claro" onClick={gerar}>✨ Montar o mês</button>
          </span>
        )}
        {editor && <button className="botao claro perigo" onClick={() => setDiaApagar(iso(new Date()))}>🗑 Apagar o dia</button>}
        {editor && <button className="botao claro perigo" onClick={apagarTodos}>🗑 Apagar tudo</button>}
        {dono && <button className="botao claro" onClick={() => setPainel(true)}>🔑 Quem pode editar</button>}
      </div>

      {diaApagar !== null && (
        <div className="fundo-janela" onClick={() => setDiaApagar(null)}>
          <div className="janela" role="dialog" aria-label="Apagar o dia" onClick={(ev) => ev.stopPropagation()}>
            <div className="janela-topo"><h2>Apagar o dia</h2><button className="link" onClick={() => setDiaApagar(null)}>Fechar</button></div>
            <p className="suave">Escolha o dia que quer limpar para refazer.</p>
            <input type="date" value={diaApagar} onChange={(ev) => setDiaApagar(ev.target.value)} />
            <button className="botao" disabled={!diaApagar} onClick={() => { const [y, m, dd] = diaApagar.split('-').map(Number); setDiaApagar(null); apagarUmDia(new Date(y, m - 1, dd, 12)); }}>Apagar este dia</button>
          </div>
        </div>
      )}

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
        const sd = dados[iso(segundaDe(data))] || {};
        const t = sd.turnos || {};
        const md = MODELOS[sd.modelo] || MODELOS[MODELO_PADRAO];
        const turno = (f) => normalizarTurno(t[f.id]?.[i]);
        const quem = (x) => FUNCIONARIOS.filter((f) => turno(f).includes(x));
        const m = quem('M');
        const n = quem('N');
        const folgas = FUNCIONARIOS.filter((f) => !turno(f));
        const fechada = FECHA_NA_SEGUNDA && i === 0;
        const vazio = m.length + n.length === 0;
        const falta = fechada || fora ? [] : buracos(turno);
        return (
          <button key={iso(data)} disabled={fora} onClick={() => abrir(data)}
            className={`mes-dia ${falta.length ? 'falta' : ''} ${fora ? 'fora' : ''} ${iso(data) === hojeIso ? 'hoje' : ''} ${fechada ? 'fechado' : ''}`}>
            <b>{data.getDate()}{falta.length > 0 && <span className="mes-alerta" title="Falta gente: chamar extra"> ⚠️</span>}</b>
            {!fora && (fechada ? <span className="mes-fecha">Fechado</span> : vazio ? <span className="mes-vazio">—</span> : (
              <>
                <span className="mes-m"><i>{md.curtoM}</i>{m.map((f) => <Nome key={f.id} f={f} />)}</span>
                <span className="mes-n"><i>{md.curtoN}</i>{n.map((f) => <Nome key={f.id} f={f} />)}</span>
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
