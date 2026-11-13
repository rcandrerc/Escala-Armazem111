import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';

// Conta do dono: sempre pode editar e cuida da lista de editores (igual nas regras do Firestore).
export const EMAIL_DONO = 'rcandrerc@gmail.com';

export const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// Valores gravados: '' (folga), 'M' (manhã), 'N' (noite), 'MN' (dia todo).
// Ninguém faz dois turnos no mesmo dia: o toque só alterna folga → manhã → tarde.
export const PROXIMO_TURNO = { '': 'M', M: 'N', N: '', MN: '' };
// Freelancer não tem área fixa: o valor diz a área e o turno do dia (C/S + M/N).
// Cada freelancer tem um setor (campo area); o toque alterna: livre → manhã → tarde.
export const proximoFree = (f, v) => { const a = f.area[0]; return { '': a + 'M', [a + 'M']: a + 'N' }[v] ?? ''; };
export const ehFree = (f) => f.funcao === 'Freelancer';
// Área em que a pessoa conta naquele dia.
export const areaDe = (f, v) => (ehFree(f) ? (v?.[0] === 'C' ? 'Cozinha' : v?.[0] === 'S' ? 'Salão' : '') : f.funcao);
// Modelos de escala. M/N são os dois turnos; o rótulo muda conforme o modelo da semana.
export const MODELOS = {
  '5x2': { nome: '5x2', M: 'Manhã 8h–17h24', N: 'Tarde 14h–23h24', curtoM: '8h–17h24', curtoN: '14h–23h24' },
  '12x36': { nome: '12x36', M: '8h–20h', N: '11h30–23h30', curtoM: '8h–20h', curtoN: '11h30–23h30' },
};
export const MODELO_PADRAO = '5x2';
export const rotuloTurno = (modelo, t) => {
  if (t === 'MN') return 'Dia todo';
  const m = MODELOS[modelo] || MODELOS[MODELO_PADRAO];
  if (t && t.length === 2) return `${t[0] === 'C' ? 'Cozinha' : 'Salão'} ${m[t[1]]}`;
  return m[t];
};
// Valores antigos ('Trabalha', texto livre) contam como dia todo; 'Folga' como folga.
export const normalizarTurno = (t) => (['M', 'N', 'MN', 'CM', 'CN', 'SM', 'SN'].includes(t) ? t : t && !String(t).toLowerCase().startsWith('folga') ? 'MN' : '');

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Segunda-feira da semana que contém a data (meio-dia evita erro de fuso/horário de verão).
export function segundaDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function somarDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Equipe fixa (não tem login): para mudar, é só editar esta lista.
// Turno fixo de cada um: 'M' (manhã) ou 'N' (noite). A ordem dentro de cada área alterna
// manhã/noite de propósito: assim a folga de domingo reveza entre os dois turnos.
export const FUNCIONARIOS = [
  { id: 'henrique', nome: 'Henrique', funcao: 'Cozinha', turno: 'M' },
  { id: 'ramon', nome: 'Ramon', funcao: 'Cozinha', turno: 'N' },
  { id: 'everton', nome: 'Everton', funcao: 'Cozinha', turno: 'M' },
  { id: 'jeferson', nome: 'Jeferson', funcao: 'Cozinha', turno: 'N' },
  { id: 'any', nome: 'Any', funcao: 'Salão', turno: 'M' },
  { id: 'thiago', nome: 'Thiago', funcao: 'Salão', turno: 'N' },
  { id: 'lucas', nome: 'Lucas', funcao: 'Salão', turno: 'M' },
  { id: 'joao', nome: 'João', funcao: 'Salão', turno: 'N' },
  // Freelancers: só entram quando vocês escalam na mão para tapar buraco.
  { id: 'brian', nome: 'Brian', funcao: 'Freelancer', area: 'Cozinha' },
  { id: 'ciele', nome: 'Ciele', funcao: 'Freelancer', area: 'Cozinha' },
  { id: 'ariana', nome: 'Ariana', funcao: 'Freelancer', area: 'Cozinha' },
  { id: 'thiago-ramon', nome: 'Thiago Ramon', funcao: 'Freelancer', area: 'Salão', curto: 'TRa' },
];

// Turnos de uma semana: { [idFuncionario]: { [0..6]: texto } }
export function useSemana(segundaIso) {
  const [semana, setSemana] = useState(null);
  useEffect(() => {
    setSemana(null);
    return onSnapshot(doc(db, 'escala_semanas', segundaIso), (s) => setSemana(s.exists() ? s.data() : {}), () => setSemana({}));
  }, [segundaIso]);
  return semana; // { turnos, modelo }
}

// Todas as semanas que tocam o mês: { [segundaIso]: turnos }. null enquanto carrega.
export function useMes(ano, mes) {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    setDados(null);
    const segundas = [];
    for (let s = segundaDe(new Date(ano, mes, 1, 12)); s <= new Date(ano, mes + 1, 0, 12); s = somarDias(s, 7)) segundas.push(iso(s));
    const acc = {};
    const faltam = new Set(segundas);
    const fns = segundas.map((seg) => onSnapshot(doc(db, 'escala_semanas', seg), (s) => {
      acc[seg] = s.exists() ? s.data() : {};
      faltam.delete(seg);
      if (!faltam.size) setDados({ ...acc });
    }, () => { acc[seg] = {}; faltam.delete(seg); if (!faltam.size) setDados({ ...acc }); }));
    return () => fns.forEach((f) => f());
  }, [ano, mes]);
  return dados;
}

export function useEditores() {
  const [emails, setEmails] = useState([]);
  useEffect(() => onSnapshot(doc(db, 'escala_config', 'editores'), (s) => setEmails(s.exists() ? s.data().emails || [] : []), () => {}), []);
  return emails;
}

export const salvarSemanas = (semanas, modelo) =>
  Promise.all(Object.entries(semanas).map(([seg, turnos]) => setDoc(doc(db, 'escala_semanas', seg), modelo ? { turnos, modelo } : { turnos }, { merge: true })));

export const definirTurno = (segundaIso, funcId, dia, texto) =>
  setDoc(doc(db, 'escala_semanas', segundaIso), { turnos: { [funcId]: { [dia]: texto } } }, { merge: true });

export const adicionarEditor = (email) => setDoc(doc(db, 'escala_config', 'editores'), { emails: arrayUnion(email.trim().toLowerCase()) }, { merge: true });
export const removerEditor = (email) => setDoc(doc(db, 'escala_config', 'editores'), { emails: arrayRemove(email) }, { merge: true });

// Apaga todas as semanas já preenchidas.
export async function apagarTudo() {
  const s = await getDocs(collection(db, 'escala_semanas'));
  await Promise.all(s.docs.map((x) => deleteDoc(x.ref)));
}

// Limpa só um dia (data = Date) para todos os funcionários.
export function apagarDia(data) {
  const turnos = {};
  FUNCIONARIOS.forEach((f) => { turnos[f.id] = { [(data.getDay() + 6) % 7]: '' }; });
  return setDoc(doc(db, 'escala_semanas', iso(segundaDe(data))), { turnos }, { merge: true });
}
