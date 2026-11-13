import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, configurado } from './firebase';
import {
  DIAS, EMAIL_DONO, iso, segundaDe, somarDias,
  FUNCIONARIOS, useSemana, useEditores,
  definirTurno, adicionarEditor, removerEditor,
} from './dados';

const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const trabalha = (t) => Boolean(t) && !String(t).toLowerCase().startsWith('folga');
const GRUPOS = ['Cozinha', 'Salão'];

export default function Escala() {
  const [usuario, setUsuario] = useState(null);
  const [aviso, setAviso] = useState('');
  const [segunda, setSegunda] = useState(() => segundaDe(new Date()));
  const [painel, setPainel] = useState(false);

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
  const vai = (f, i) => trabalha(turnos?.[f.id]?.[i]);

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
    try { await definirTurno(segundaIso, f.id, i, vai(f, i) ? '' : 'Trabalha'); }
    catch { setAviso('Sem permissão para salvar. Confira se entrou com a conta certa.'); }
  }

  async function copiar() {
    const linhas = [`*Escala Armazém 111* — ${fmt(segunda)} a ${fmt(somarDias(segunda, 6))}`];
    dias.forEach(({ nome, i, data }) => {
      linhas.push('', `*${nome} ${fmt(data)}*`);
      GRUPOS.forEach((g) => {
        const quem = FUNCIONARIOS.filter((f) => f.funcao === g && vai(f, i)).map((f) => f.nome);
        linhas.push(`${g}: ${quem.length ? quem.join(', ') : '—'}`);
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
      {editor && <p className="dica">Toque no nome no dia para marcar quem trabalha.</p>}

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
            <section key={nome} className={`dia ${iso(data) === hojeIso ? 'hoje' : ''}`}>
              <h2>{nome} <small>{fmt(data)}</small>{iso(data) === hojeIso && <em>hoje</em>}</h2>
              {GRUPOS.map((g) => (
                <div key={g} className="grupo">
                  <span className="rotulo">{g}</span>
                  <div className="chips">
                    {FUNCIONARIOS.filter((f) => f.funcao === g).map((f) => {
                      const on = vai(f, i);
                      if (!editor && !on) return null;
                      return editor
                        ? <button key={f.id} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => alternar(f, i)}>{on ? '✓ ' : ''}{f.nome}</button>
                        : <span key={f.id} className="chip on">{f.nome}</span>;
                    })}
                    {!editor && !FUNCIONARIOS.some((f) => f.funcao === g && vai(f, i)) && <span className="ninguem">—</span>}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="acoes">
        <button className="botao" onClick={copiar}>📋 Copiar para o WhatsApp</button>
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
