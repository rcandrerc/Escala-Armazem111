import { FUNCIONARIOS, iso, segundaDe, somarDias } from './dados';

// Regras da geração automática (mude aqui se precisar):
//  - segunda-feira o restaurante fecha (ninguém trabalha);
//  - cada funcionário folga em 1 domingo do mês, revezando dentro de cada grupo
//    (cozinha e salão), assim sempre sobra gente de cada área no domingo;
//  - nos outros dias abertos todo mundo trabalha no seu turno fixo (campo turno
//    em FUNCIONARIOS), então só o domingo muda de uma semana para outra.
export const FECHA_NA_SEGUNDA = true;

// Retorna { [segundaIso]: { [idFuncionario]: { [0..6]: 'M' | 'N' | 'MN' | '' } } } só com os dias do mês.
export function gerarMes(ano, mes) {
  const grupos = [...new Set(FUNCIONARIOS.map((f) => f.funcao))];
  const resultado = {};
  const domingos = [];
  for (let d = new Date(ano, mes, 1, 12); d.getMonth() === mes; d = somarDias(d, 1)) if (d.getDay() === 0) domingos.push(iso(d));

  // Quem folga em cada domingo.
  const folgaDomingo = {};
  grupos.forEach((g) => {
    const membros = FUNCIONARIOS.filter((f) => f.funcao === g);
    const desloc = (ano * 12 + mes) % membros.length;
    domingos.slice(0, membros.length).forEach((dia, k) => {
      (folgaDomingo[dia] ||= new Set()).add(membros[(k + desloc) % membros.length].id);
    });
  });

  for (let d = new Date(ano, mes, 1, 12); d.getMonth() === mes; d = somarDias(d, 1)) {
    const seg = segundaDe(d);
    const i = (d.getDay() + 6) % 7;
    const semana = ((resultado[iso(seg)] ||= {}));
    grupos.forEach((g) => {
      FUNCIONARIOS.filter((f) => f.funcao === g).forEach((f) => {
        let turno;
        if (FECHA_NA_SEGUNDA && i === 0) turno = '';
        else if (folgaDomingo[iso(d)]?.has(f.id)) turno = '';
        else turno = f.turno;
        (semana[f.id] ||= {})[i] = turno;
      });
    });
  }
  return resultado;
}

// Mesma estrutura de gerarMes, mas com tudo vazio (usado para apagar o mês).
export function limparMes(ano, mes) {
  const r = {};
  for (let d = new Date(ano, mes, 1, 12); d.getMonth() === mes; d = somarDias(d, 1)) {
    const semana = (r[iso(segundaDe(d))] ||= {});
    FUNCIONARIOS.forEach((f) => { (semana[f.id] ||= {})[(d.getDay() + 6) % 7] = ''; });
  }
  return r;
}
