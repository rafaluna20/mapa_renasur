import { useState, useCallback } from 'react';

interface MapHistoryState {
  history: string[];
  currentIndex: number;
}

export const useMapHistory = () => {
  const [state, setState] = useState<MapHistoryState>({
    history: [],
    currentIndex: -1
  });

  const visit = useCallback((lotId: string) => {
    setState(prev => {
      // Si es el mismo que el actual, no hacer nada
      if (prev.history[prev.currentIndex] === lotId) {
        return prev;
      }

      // Agregar al historial (limitar a últimos 20)
      const newHistory = [
        ...prev.history.slice(0, prev.currentIndex + 1),
        lotId
      ].slice(-20);
      
      return {
        history: newHistory,
        currentIndex: newHistory.length - 1
      };
    });
  }, []);

  const goBack = useCallback(() => {
    if (state.currentIndex > 0) {
      const newIndex = state.currentIndex - 1;
      setState(prev => ({ ...prev, currentIndex: newIndex }));
      return state.history[newIndex];
    }
    return null;
  }, [state]);

  const goForward = useCallback(() => {
    if (state.currentIndex < state.history.length - 1) {
      const newIndex = state.currentIndex + 1;
      setState(prev => ({ ...prev, currentIndex: newIndex }));
      return state.history[newIndex];
    }
    return null;
  }, [state]);

  const canGoBack = state.currentIndex > 0;
  const canGoForward = state.currentIndex < state.history.length - 1;

  return {
    history: state.history,
    currentIndex: state.currentIndex,
    visit,
    goBack,
    goForward,
    canGoBack,
    canGoForward
  };
};
