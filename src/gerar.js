import { FUNCIONARIOS, iso, segundaDe, somarDias } from './dados';

// Geração automática do mês. Segunda o restaurante fecha. Cada um fica no seu
// turno fixo (campo turno em FUNCIONARIOS: M ou N), e o modelo decide as folgas:
//  - 5x2: a segunda conta como uma folga; a outra muda toda semana. Dentro de cada
//    área, uma pessoa por semana folga no domingo (revezando) e as outras ganham
//    um dia diferente entre terça e sábado.
//  - 12x36: trabalha um dia e folga o seguinte, alternado entre as pessoas do mesmo
//    turno e área, para nunca ficar turno vazio.
export const FECHA_NA_SEGUNDA = true;

const DIA_MS = 24 * 3600 * 1000;
const BASE = new Date(2024, 0, 1, 12); // uma segunda-feira

export function gerarMes(ano, mes, modelo) {
  const grupos = [...new Set(FUNCIONARIOS.map((f) => f.funcao))];
  const resultado = {};
  for (let d = new Date(ano, mes, 1, 12); d.getMonth() === mes; d = somarDias(d, 1)) {
    const seg = segundaDe(d);
    const i = (d.getDay() + 6) % 7;
    const w = Math.round((seg - BASE) / (7 * DIA_MS));
    const n = Math.round((d - BASE) / DIA_MS);
    const semana = (resultado[iso(seg)] ||= {});
    grupos.forEach((g) => {
      const membros = FUNCIONARIOS.filter((f) => f.funcao === g);
      membros.forEach((f, k) => {
        let trabalha = !(FECHA_NA_SEGUNDA && i === 0);
        if (trabalha && modelo === '5x2') {
          const folgaDomingo = k === w % membros.length;
          const folga = folgaDomingo ? 6 : 1 + ((k + w) % 5); // 1..5 = ter..sáb
          trabalha = i !== folga;
        }
        if (trabalha && modelo === '12x36') {
          const par = membros.filter((x) => x.turno === f.turno).indexOf(f);
          trabalha = (n + par) % 2 === 0;
        }
        (semana[f.id] ||= {})[i] = trabalha ? f.turno : '';
      });
    });
  }
  return resultado;
}
