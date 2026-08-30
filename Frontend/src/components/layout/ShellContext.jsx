import { createContext, useContext } from 'react'

export const ShellContext = createContext({
  openTradeModal: () => {},
  openCommandPalette: () => {}
})

export const useShell = () => useContext(ShellContext)
