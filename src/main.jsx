import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import StartupError from './components/layout/StartupError.jsx'
import { loadSettings } from './config/settings.js'
import { initTheme } from './styles/theme.js'
import { registerServiceWorker } from './utils/install.js'
import './styles/typography.js'
import './styles/index.css'

initTheme()
registerServiceWorker()

const root = ReactDOM.createRoot(document.getElementById('root'))

// The restaurant's name, phones, payment methods etc. come from the database;
// load them before the first screen so every component can read them.
loadSettings()
  .then(() => root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  ))
  .catch(() => root.render(<StartupError />))
