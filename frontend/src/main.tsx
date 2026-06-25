import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BravoLoader from './components/ui/BravoLoader'
import './index.css'

function Root() {
  // Brief branded boot animation on first load
  const [booting, setBooting] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 1100)
    return () => window.clearTimeout(t)
  }, [])

  if (booting) return <BravoLoader fullScreen label="Tuning in" />

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
