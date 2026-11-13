import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, configurado } from './firebase';
import {
  DIAS, TURNOS_PRONTOS, EMAIL_DONO, iso, segundaDe, somarDias,
  FUNCIONARIOS, useSemana, useEditores,
  definirTurno, adicionarEditor, removerEditor,
} from './dados';

const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function Escala() {
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [segunda, setSegunda] = useState(() => segundaDe(new Date()));
  const [cel, setCel] = useState(null); // { func, dia }
  const [painel, setPainel] = useState(null); // 'editores'

  useEffect(() => (configurado ? onAuthStateChanged(auth, setUsuario) : undefined), []);
  const funcionarios = FUNCIONARIOS;
  const editores = useEditores();
  const segundaIso = iso(segunda);
  const turnos = useSemana(segundaIso);

  if (!configurado) return <p className="aviso">Firebase não configurado.</p>;

  const email = (usuario?.email || '').toLowerCase();
  const dono = email === EMAIL_DONO;
  const editor = dono || editores.includes(email);
  const hojeIso = iso(new Date());

  async function entrar() {
    setErro('');
    const p = new GoogleAuthProvider();
    try { await signInWithPopup(auth, p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') signInWithRedirect(auth, p);
      else if (e.code !== 'auth/popup-closed-by-user') setErro('Não consegui entrar. Tente de novo.');
    }
  }

  const textoDe = (f, i) => turnos?.[f.id]?.[i] || '';

  async function copiar() {
    const linhas = [`*Escala Armazém 111* — semana ${fmt(segunda)} a ${fmt(somarDias(segunda, 6))}`];
    DIAS.forEach((nome, i) => {
      linhas.push('', `*${nome} ${fmt(somarDias(segunda, i))}*`);
      funcionarios.forEach((f) => { const t = textoDe(f, i); if (t) linhas.push(`${f.nome}: ${t}`); });
    });
    try { await navigator.clipboard.writeText(linhas.join('\n')); setErro('Escala copiada, é só colar no WhatsApp.'); }
    catch { setErro('Não consegui copiar.'); }
  }

  return (
    <div className="escala">
      <header className="topo">
        <div>
          <h1>Armazém 111</h1>
          <p>Escala da equipe</p>
        </div>
        <div className="conta">
          {usuario ? (
            <>
              <span>{editor ? '✏️ Editor' : 'Só leitura'}</span>
              <button className="link" onClick={() => signOut(auth)}>Sair</button>
            </>
          ) : (
            <button className="link" onClick={entrar}>Entrar para editar</button>
          )}
        </div>
      </header>

      {usuario && !editor && <p className="aviso">A conta {usuario.email} não tem permissão para editar. Você pode só ver a escala.</p>}
      {erro && <p className="aviso" role="status">{erro}</p>}

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
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th className="nome">Equipe</th>
                {DIAS.map((d, i) => {
                  const dia = somarDias(segunda, i);
                  return <th key={d} className={iso(dia) === hojeIso ? 'hoje' : ''}>{d}<small>{fmt(dia)}</small></th>;
                })}
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr key={f.id}>
                  <th className="nome">{f.nome}{f.funcao && <small>{f.funcao}</small>}</th>
                  {DIAS.map((d, i) => {
                    const t = textoDe(f, i);
                    const classe = !t ? 'vazio' : t.toLowerCase().startsWith('folga') ? 'folga' : 'turno';
                    return (
                      <td key={d} className={`${classe} ${iso(somarDias(segunda, i)) === hojeIso ? 'hoje' : ''}`}>
                        {editor ? <button onClick={() => setCel({ f, dia: i })}>{t || '＋'}</button> : (t || '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="acoes">
        <button className="botao" onClick={copiar} >📋 Copiar para o WhatsApp</button>
        {dono && <button className="botao claro" onClick={() => setPainel('editores')}>🔑 Quem pode editar</button>}
      </div>

      {cel && (
        <Janela titulo={`${cel.f.nome} · ${DIAS[cel.dia]} ${fmt(somarDias(segunda, cel.dia))}`} fechar={() => setCel(null)}>
          <EditarTurno
            atual={textoDe(cel.f, cel.dia)}
            salvar={async (t) => {
              try { await definirTurno(segundaIso, cel.f.id, cel.dia, t); setCel(null); }
              catch { setErro('Sem permissão para salvar. Confira se entrou com a conta certa.'); setCel(null); }
            }}
          />
        </Janela>
      )}
      {painel === 'editores' && (
        <Janela titulo="Quem pode editar" fechar={() => setPainel(null)}>
          <Editores emails={editores} />
        </Janela>
      )}
    </div>
  );
}

function Janela({ titulo, fechar, children }) {
  return (
    <div className="fundo-janela" onClick={fechar}>
      <div className="janela" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="janela-topo"><h2>{titulo}</h2><button className="link" onClick={fechar}>Fechar</button></div>
        {children}
      </div>
    </div>
  );
}

function EditarTurno({ atual, salvar }) {
  const [texto, setTexto] = useState(atual);
  return (
    <>
      <div className="prontos">
        {TURNOS_PRONTOS.map((t) => <button key={t} className={t === atual ? 'on' : ''} onClick={() => salvar(t)}>{t}</button>)}
      </div>
      <form className="linha" onSubmit={(e) => { e.preventDefault(); salvar(texto.trim()); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ou escreva, ex.: 17h–23h" maxLength={40} />
        <button className="botao">Salvar</button>
      </form>
      {atual && <button className="link perigo" onClick={() => salvar('')}>Limpar este dia</button>}
    </>
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
