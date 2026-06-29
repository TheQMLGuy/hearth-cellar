import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installTauriShim } from './tauriShim'
import './styles.css'

// Wire up window.hearth to Tauri's IPC + localStorage before React mounts.
installTauriShim()

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
