import {useCallback, useReducer, type SetStateAction} from 'react';

type DocumentState<P, M> = {pages: P[]; marks: M[]};
type State<P, M> = {present: DocumentState<P, M>; past: DocumentState<P, M>[]; future: DocumentState<P, M>[]; saved: string; editedAt: number};
type Action<P, M> = {type: 'pages'; value: SetStateAction<P[]>; time: number} | {type: 'marks'; value: SetStateAction<M[]>; time: number} | {type: 'reset'; value: DocumentState<P, M>} | {type: 'undo'} | {type: 'redo'} | {type: 'saved'; value: string};

export function useDocumentHistory<P, M>() {
  const empty: DocumentState<P, M> = {pages: [], marks: []};
  const [state, dispatch] = useReducer((state: State<P, M>, action: Action<P, M>): State<P, M> => {
    if (action.type === 'reset') return {present: action.value, past: [], future: [], saved: JSON.stringify(action.value), editedAt: 0};
    if (action.type === 'saved') return {...state, saved: action.value, editedAt: 0};
    if (action.type === 'undo') {
      const previous = state.past.at(-1);
      return previous ? {...state, present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future], editedAt: 0} : state;
    }
    if (action.type === 'redo') {
      const next = state.future[0];
      return next ? {...state, present: next, past: [...state.past, state.present], future: state.future.slice(1), editedAt: 0} : state;
    }
    const key = action.type;
    const value = typeof action.value === 'function' ? (action.value as (v: any[]) => any[])(state.present[key]) : action.value;
    const present = {...state.present, [key]: value};
    if (JSON.stringify(present) === JSON.stringify(state.present)) return state;
    // One pointer gesture or typing burst is one reversible edit.
    const grouped = action.time - state.editedAt < 300 && state.future.length === 0;
    return {...state, present, past: grouped ? state.past : [...state.past.slice(-99), state.present], future: [], editedAt: action.time};
  }, {present: empty, past: [], future: [], saved: JSON.stringify(empty), editedAt: 0});
  const setPages = useCallback((value: SetStateAction<P[]>) => dispatch({type: 'pages', value, time: Date.now()}), []);
  const setMarks = useCallback((value: SetStateAction<M[]>) => dispatch({type: 'marks', value, time: Date.now()}), []);
  const resetDocument = useCallback((pages: P[] = [], marks: M[] = []) => dispatch({type: 'reset', value: {pages, marks}}), []);
  return {...state.present, setPages, setMarks, resetDocument, undo: () => dispatch({type: 'undo'}), redo: () => dispatch({type: 'redo'}), markSaved: (value: string) => dispatch({type: 'saved', value}), canUndo: state.past.length > 0, canRedo: state.future.length > 0, dirty: JSON.stringify(state.present) !== state.saved};
}
