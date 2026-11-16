import { useState } from 'react';
import { DIAS, FUNCIONARIOS, ehFree, areaDe, normalizarTurno, horarioDe, hhmm, definirAlmoco, iso, somarDias } from './dados';
import { FECHA_NA_SEGUNDA } from './gerar';

// Grade hora a hora de um setor: entradas, saídas, almoços e quantas pessoas estão juntas.
const HORAS = Array.from({ length: 16 }, (_, k) => 480 + k * 60); // 08:00 … 23:00
const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function Horarios({ segunda, segundaIso, semanaDoc, editor, hojeIso, avisar, alertaDia, abrirDia }) {
  const [setor, setSetor] = useState('Cozinha');
  const [cel, setCel] = useState(null); // { i, hs }
  const turnos = semanaDoc?.turnos || {};
  const almoco = semanaDoc?.almoco || {};
  const modelo = semanaDoc?.modelo;

  // Pessoas do setor no dia i, com horário e almoço.
  const pessoas = (i) => FUNCIONARIOS.map((f) => {
    const v = normalizarTurno(turnos[f.id]?.[i]);
    if (!v || areaDe(f, v) !== setor) return null;
    const [ini, fim] = horarioDe(f, v, modelo);
    const al = almoco[f.id]?.[i];
    return { f, ini, fim, al: typeof al === 'number' ? al : null };
  }).filter(Boolean);
  const presentes = (ps, t) => ps.filter((p) => p.ini <= t && t < p.fim && !(p.al !== null && p.al <= t && t < p.al + 60)).length;
  const lotacao = (ps, hs) => {
    let max = 0, min = 99;
    const fecha = Math.max(...ps.map((p) => p.fim));
    for (let t = hs; t < Math.min(hs + 60, fecha); t += 6) { const n = presentes(ps, t); max = Math.max(max, n); min = Math.min(min, n); }
    return { max, min };
  };
  const folgas = (i) => FUNCIONARIOS.filter((f) => !ehFree(f) && f.funcao === setor && !normalizarTurno(turnos[f.id]?.[i]));
  const fechado = (i) => FECHA_NA_SEGUNDA && i === 0;
  const curto = (f) => f.curto || f.nome;

  async function alternarAlmoco(p, i, hs) {
    try { await definirAlmoco(segundaIso, p.f.id, i, p.al === hs ? null : hs); }
    catch { avisar('Sem permissão para salvar.'); }
  }

  return (
    <>
      <div className="abas setores">
        {['Cozinha', 'Salão'].map((s) => <button key={s} className={setor === s ? 'on' : ''} onClick={() => setSetor(s)}>{s === 'Cozinha' ? '🍳' : '🍽'} {s}</button>)}
      </div>
      <p className="dica">Segunda fechado. Número = quantas pessoas estão juntas naquela hora. Toque no dia para ver a equipe{editor ? ' e mudar turnos; toque numa hora para marcar almoço (1h)' : ''}.</p>
      <p className="legenda"><span className="lot l1">1</span> falta <span className="lot l2">2</span> ok <span className="lot l3">3</span> cheio <span className="lot l4">4+</span> lotado</p>
      <div className="rolagem grade">
        <table>
          <thead>
            <tr>
              <th className="hora" />
              {DIAS.map((d, i) => {
                if (fechado(i)) return null;
                const data = somarDias(segunda, i);
                return (
                  <th key={d} className={iso(data) === hojeIso ? 'hoje' : ''}>
                    <button className="g-dia" disabled={fechado(i)} onClick={() => abrirDia(i)}>
                      {fmt(data)}<small>{d}</small>
                      {!fechado(i) && alertaDia(i) > 0 && <span className="g-alerta">⚠️ falta {alertaDia(i)}</span>}
                      {!fechado(i) && folgas(i).length > 0 && <span className="g-folga">Folga {folgas(i).map(curto).join(', ')}</span>}
                      {!fechado(i) && <span className="g-ver">{editor ? '✏️ editar' : 'ver dia'}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HORAS.map((hs) => (
              <tr key={hs}>
                <th className="hora">{hhmm(hs)}</th>
                {DIAS.map((d, i) => {
                  if (fechado(i)) return null;
                  const ps = pessoas(i);
                  if (!ps.length) return <td key={d} />;
                  const { max, min } = lotacao(ps, hs);
                  const aberto = min !== 99;
                  const nivel = !aberto ? 0 : min < 2 ? 1 : max >= 4 ? 4 : max === 3 ? 3 : 2;
                  const ev = [];
                  ps.forEach((p) => {
                    if (p.ini >= hs && p.ini < hs + 60) ev.push(<span key={'e' + p.f.id} className="ev entra">▶ {hhmm(p.ini)} {curto(p.f)}{ehFree(p.f) ? ' (F)' : ''}</span>);
                    if (p.al !== null && p.al >= hs && p.al < hs + 60) ev.push(<span key={'a' + p.f.id} className="ev almoco">🍽 {hhmm(p.al)} {curto(p.f)}</span>);
                    if (p.fim >= hs && p.fim < hs + 60) ev.push(<span key={'s' + p.f.id} className="ev sai">◀ {hhmm(p.fim)} {curto(p.f)}</span>);
                  });
                  const conteudo = (<>{nivel > 0 && <span className={`lot l${nivel}`}>{min === max ? max : `${min}–${max}`}</span>}{ev}</>);
                  return (
                    <td key={d} className={`n${nivel}`}>
                      {editor ? <button onClick={() => setCel({ i, hs })}>{conteudo}</button> : conteudo}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cel && (
        <div className="fundo-janela" onClick={() => setCel(null)}>
          <div className="janela" role="dialog" aria-label="Almoço" onClick={(ev) => ev.stopPropagation()}>
            <div className="janela-topo"><h2>Almoço · {setor}</h2><button className="link" onClick={() => setCel(null)}>Fechar</button></div>
            <p className="suave">{DIAS[cel.i]} {fmt(somarDias(segunda, cel.i))}, das {hhmm(cel.hs)} às {hhmm(cel.hs + 60)}. Toque em quem vai almoçar nesse horário (toque de novo para tirar).</p>
            <div className="prontos">
              {pessoas(cel.i).filter((p) => p.ini <= cel.hs && cel.hs + 60 <= p.fim).map((p) => (
                <button key={p.f.id} className={p.al === cel.hs ? 'on' : ''} onClick={() => { alternarAlmoco(p, cel.i, cel.hs); setCel(null); }}>
                  {p.f.nome}{p.al !== null ? ` · almoço ${hhmm(p.al)}` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
