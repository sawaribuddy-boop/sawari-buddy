import { createContext, type ReactNode, useContext } from 'react';

const PassengerNoticeContext = createContext<(text: string) => void>(() => undefined);

/** Lets passenger screens show the layout's toast (booking confirmed, boarding PIN). */
export function PassengerNoticeProvider({ show, children }: { show: (text: string) => void; children: ReactNode }) {
  return <PassengerNoticeContext.Provider value={show}>{children}</PassengerNoticeContext.Provider>;
}

export function usePassengerNotice(): (text: string) => void {
  return useContext(PassengerNoticeContext);
}
