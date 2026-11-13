import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';

// Conta do dono: sempre pode editar e cuida da lista de editores (igual nas regras do Firestore).
export const EMAIL_DONO = 'rcandrerc@gmail.com';

export const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const TURNOS_PRONTOS = ['Folga', 'Almoço 11h–16h', 'Jantar 18h–23h', 'Integral 11h–23h'];

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

function useColecao(nome) {
  const [lista, setLista] = useState(null);
  useEffect(() => onSnapshot(collection(db, nome), (s) => setLista(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setLista([])), [nome]);
  return lista;
}

export const useFuncionarios = () => {
  const l = useColecao('escala_funcionarios');
  return l && [...l].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome));
};

// Turnos de uma semana: { [idFuncionario]: { [0..6]: texto } }
export function useSemana(segundaIso) {
  const [turnos, setTurnos] = useState(null);
  useEffect(() => {
    setTurnos(null);
    return onSnapshot(doc(db, 'escala_semanas', segundaIso), (s) => setTurnos(s.exists() ? s.data().turnos || {} : {}), () => setTurnos({}));
  }, [segundaIso]);
  return turnos;
}

export function useEditores() {
  const [emails, setEmails] = useState([]);
  useEffect(() => onSnapshot(doc(db, 'escala_config', 'editores'), (s) => setEmails(s.exists() ? s.data().emails || [] : []), () => {}), []);
  return emails;
}

export const definirTurno = (segundaIso, funcId, dia, texto) =>
  setDoc(doc(db, 'escala_semanas', segundaIso), { turnos: { [funcId]: { [dia]: texto } } }, { merge: true });

export const adicionarFuncionario = (nome, funcao, ordem) => addDoc(collection(db, 'escala_funcionarios'), { nome, funcao, ordem });
export const editarFuncionario = (id, dados) => updateDoc(doc(db, 'escala_funcionarios', id), dados);
export const removerFuncionario = (id) => deleteDoc(doc(db, 'escala_funcionarios', id));

export const adicionarEditor = (email) => setDoc(doc(db, 'escala_config', 'editores'), { emails: arrayUnion(email.trim().toLowerCase()) }, { merge: true });
export const removerEditor = (email) => setDoc(doc(db, 'escala_config', 'editores'), { emails: arrayRemove(email) }, { merge: true });
