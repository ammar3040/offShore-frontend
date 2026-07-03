import './lib/fetchInterceptor';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { env } from './config/env'

document.body.classList.toggle('show-new-markers', env.showNewMarkers);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
